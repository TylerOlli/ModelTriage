/**
 * Two-stage intent-aware LLM router with attachment-aware defaults
 */

import type { ModelId } from "./types";
import { runOpenAI } from "./providers/openai";
import {
  MODEL_DEFAULTS,
  getDefaultVisionModel,
  getDefaultCodeModel,
} from "../attachments/vision-support";
import {
  requiresDeepReasoning,
  isLightweightRequest,
  isCodeRelated,
} from "../attachments/complexity-detector";
import {
  getAttachmentsGist,
  type AttachmentGist,
} from "../attachments/gist-generator";
import {
  type FitBreakdown,
  mapToDisplayScore,
  calculateOverallFit,
  createDefaultFitBreakdown,
  type FitDimension,
} from "./score-breakdown";
import type { ScoringResult } from "./scoring-types";
import { scoreForModel } from "./scoring-engine";

export interface RoutingDecision {
  intent: "coding" | "writing" | "analysis" | "vision" | "unknown";
  category: string;
  chosenModel: ModelId;
  confidence: number; // 0..1
  reason: string;
  fitBreakdown?: FitBreakdown;
  scoring?: ScoringResult;
}

export interface AttachmentContext {
  hasImages: boolean;
  hasTextFiles: boolean;
  textFileTypes: string[];
  attachmentNames: string[];
  totalTextChars: number;
  promptChars: number;
  imageCount: number;
  textFileCount: number;
  attachments?: Array<{
    type: string;
    filename?: string;
    content?: string;
    extension?: string;
  }>;
}

interface ClassifierResponse {
  intent: "coding" | "writing" | "analysis" | "unknown";
  category: string;
  chosenModel: string;
  confidence: number;
  reason: string;
}

// ─── Routing Cache ──────────────────────────────────────────────
// In-memory cache for routing decisions, keyed by normalized prompt hash.
// Eliminates the 1-2s LLM classifier call for repeated or similar prompts.
// Entries expire after TTL_MS. Cleanup runs on every cache check.

interface CachedDecision {
  decision: RoutingDecision;
  expiresAt: number;
}

const ROUTE_CACHE = new Map<string, CachedDecision>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CACHE_MAX_SIZE = 200; // Prevent unbounded memory growth

function getCacheKey(prompt: string): string {
  // Normalize: lowercase, trim, collapse whitespace
  return prompt.toLowerCase().trim().replace(/\s+/g, " ");
}

function cleanExpiredCache(): void {
  const now = Date.now();
  for (const [key, entry] of ROUTE_CACHE) {
    if (entry.expiresAt <= now) {
      ROUTE_CACHE.delete(key);
    }
  }
}

export class IntentRouter {
  private readonly CLASSIFIER_MODEL: ModelId = "gpt-5-mini";
  private readonly CLASSIFIER_TIMEOUT_MS = 10000;

  /**
   * CONFIDENCE THRESHOLD HEURISTIC (deterministic fast-path)
   *
   * When confidence exceeds this threshold, the router skips the LLM classifier
   * entirely and uses deterministic signals (prompt keywords, modality, structure)
   * for instant model selection. This eliminates ~1-2s of latency from the
   * gpt-5-mini classifier call for clear-cut prompts.
   *
   * Lowered from 0.85 to 0.78 to let more prompts skip the LLM classifier.
   * Combined with the routing cache, this means most prompts are routed
   * in <1ms after the first request.
   *
   * Signals used (all deterministic, zero additional model calls):
   * - Attachment type (images → vision, code files → code model)
   * - Prompt keyword patterns (debug/error → coding_debug, etc.)
   * - Prompt length and structure (short → lightweight, complex keywords → deep reasoning)
   */
  private readonly FAST_PATH_CONFIDENCE_THRESHOLD = 0.78;

  /**
   * Route a prompt to the best model using attachment-aware selection
   * @param prompt - The user's prompt
   * @param generateCustomReason - If true, generates a prompt-aware explanation (adds ~1-2s latency)
   * @param attachmentContext - Optional attachment metadata for smart routing
   */
  async route(
    prompt: string,
    generateCustomReason = false,
    attachmentContext?: AttachmentContext
  ): Promise<RoutingDecision> {
    try {
      // PRIORITY 0: Cache lookup (instant, <1ms)
      // Skips ALL routing logic for repeat prompts.
      // Only used when no attachments (attachments change routing).
      if (!attachmentContext) {
        cleanExpiredCache();
        const cacheKey = getCacheKey(prompt);
        const cached = ROUTE_CACHE.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
          console.log("Cache hit — routing decision from cache:", {
            model: cached.decision.chosenModel,
            intent: cached.decision.intent,
          });
          return cached.decision;
        }
      }

      // PRIORITY 1: Attachment-aware routing (deterministic, no model calls)
      // Returns immediately when attachments provide clear routing signals.
      if (attachmentContext) {
        const attachmentDecision = this.routeByAttachment(
          prompt,
          attachmentContext
        );
        if (attachmentDecision) {
          console.log("Attachment-aware routing decision:", attachmentDecision);
          return this.enrichWithScoring(attachmentDecision, prompt);
        }
      }

      // PRIORITY 2: Deterministic fast-path routing (no model calls)
      // Uses prompt keyword patterns and structure to route without the LLM classifier.
      // Only triggers when confidence is above FAST_PATH_CONFIDENCE_THRESHOLD.
      const fastPathDecision = this.tryFastPathRouting(prompt);
      if (fastPathDecision) {
        console.log("Fast-path routing decision (skipped LLM classifier):", fastPathDecision);
        const enriched = this.enrichWithScoring(fastPathDecision, prompt);
        this.cacheDecision(prompt, enriched);
        return enriched;
      }

      // FALLBACK: Traditional intent-based routing via LLM classifier
      // Only reached when deterministic signals are insufficient.
      // Stage 1: Intent detection using classifier (~1-2s latency)
      const classification = await this.classifyIntent(prompt);

      // Stage 2: Specialized routing based on intent + category
      const decision = this.routeByCategory(classification);

      // Stage 3: Generate prompt-aware explanation (optional, can skip in streaming mode)
      if (generateCustomReason) {
        const customReason = await this.generateRoutingReason({
          prompt,
          chosenModel: decision.chosenModel,
          intent: decision.intent,
          category: decision.category,
        });

        const enriched = this.enrichWithScoring({
          ...decision,
          reason: customReason,
        }, prompt);
        this.cacheDecision(prompt, enriched);
        return enriched;
      }

      const enriched = this.enrichWithScoring(decision, prompt);
      this.cacheDecision(prompt, enriched);
      return enriched;
    } catch (err) {
      console.error("Classifier failed:", err);
      // Fallback to gpt-5-mini on classifier failure
      const fallbackDecision: RoutingDecision = {
        intent: "unknown",
        category: "router_fallback",
        chosenModel: "gpt-5-mini",
        confidence: 0,
        reason: "Selected as a reliable default for this request.",
        fitBreakdown: createDefaultFitBreakdown(),
      };
      return this.enrichWithScoring(fallbackDecision, prompt);
    }
  }

  /**
   * Store a routing decision in the in-memory cache.
   * Evicts oldest entries if the cache exceeds max size.
   */
  private cacheDecision(prompt: string, decision: RoutingDecision): void {
    const cacheKey = getCacheKey(prompt);

    // Evict oldest entries if at capacity
    if (ROUTE_CACHE.size >= CACHE_MAX_SIZE) {
      const firstKey = ROUTE_CACHE.keys().next().value;
      if (firstKey) ROUTE_CACHE.delete(firstKey);
    }

    ROUTE_CACHE.set(cacheKey, {
      decision,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }

  /**
   * Enrich a routing decision with Expected Success scoring.
   * This is deterministic and adds <1ms to routing latency.
   */
  private enrichWithScoring(decision: RoutingDecision, prompt: string): RoutingDecision {
    try {
      const scoring = scoreForModel(prompt, decision.chosenModel);
      return { ...decision, scoring };
    } catch (err) {
      console.error("Scoring engine error (non-fatal):", err);
      return decision;
    }
  }

  /**
   * FAST-PATH ROUTING: Deterministic model selection using only prompt signals.
   *
   * Skips the LLM classifier entirely when prompt patterns strongly indicate
   * a specific intent. Uses keyword matching, prompt structure, and complexity
   * heuristics — zero additional model calls.
   *
   * Returns null if confidence is below FAST_PATH_CONFIDENCE_THRESHOLD,
   * causing the router to fall back to the LLM classifier.
   *
   * Speculative dispatch note: We considered dispatching the model request
   * speculatively before routing completes, but the complexity of cancellation
   * and the risk of wasted tokens outweigh the marginal latency gain (~200ms).
   * The fast-path heuristic achieves most of the benefit without cancellation risk.
   */
  private tryFastPathRouting(prompt: string): RoutingDecision | null {
    const promptLower = prompt.toLowerCase().trim();
    const promptLength = prompt.length;

    // --- Debugging / error analysis (strong signal) ---
    const debugPatterns = [
      /\b(stack\s*trace|traceback|error\s*message|exception|runtime\s*error)\b/i,
      /\b(bug|debug|fix\s*(this|the|my)|what('s|\s+is)\s+wrong)\b/i,
      /\b(segfault|null\s*pointer|undefined\s+is\s+not|cannot\s+read\s+propert)/i,
      /\b(ENOENT|ECONNREFUSED|SIGABRT|exit\s+code|status\s+code\s+[45]\d\d)\b/i,
    ];
    const isDebug = debugPatterns.some((p) => p.test(prompt));
    if (isDebug) {
      return {
        intent: "coding",
        category: "coding_debug",
        chosenModel: "gpt-5.2",
        confidence: 0.9,
        reason: "This is a debugging request involving error analysis, and GPT-5.2 excels at systematic error tracing and root-cause identification.",
      };
    }

    // --- Complex implementation / system design (strong signal) ---
    const complexPatterns = [
      /\b(system\s+design|architect(ure)?|design\s+pattern|distributed)\b/i,
      /\b(implement\s+(a|an|the)\s+\w+\s+(system|service|engine|pipeline))\b/i,
      /\b(performance\s+optim|scale|horizontal|vertical\s+scal|sharding)\b/i,
      /\b(full\s+implementation|production[- ]ready|end[- ]to[- ]end)\b/i,
    ];
    const isComplex = complexPatterns.some((p) => p.test(prompt));
    if (isComplex && promptLength > 80) {
      return {
        intent: "coding",
        category: "coding_complex_impl",
        chosenModel: "gpt-5.2",
        confidence: 0.88,
        reason: "This is a complex implementation task requiring deep reasoning, and GPT-5.2 has strong multi-step reasoning and architectural planning abilities.",
      };
    }

    // --- Code review / refactoring (strong signal → Opus) ---
    const codeReviewPatterns = [
      /\b(code\s+review|review\s+(this|my|the)\s+(code|pr|pull\s+request|diff|patch))\b/i,
      /\b(refactor|clean\s+up|improve\s+(this|my|the)\s+code|code\s+quality)\b/i,
      /\b(explain\s+(this|my|the)\s+(code|function|class|module|codebase))\b/i,
      /\b(pr\s+review|pull\s+request\s+review|review\s+changes)\b/i,
    ];
    const isCodeReview = codeReviewPatterns.some((p) => p.test(prompt));
    if (isCodeReview) {
      return {
        intent: "coding",
        category: "coding_review",
        chosenModel: "claude-opus-4-6",
        confidence: 0.88,
        reason: "This is a code review task, and Claude Opus 4.6 excels at thorough code analysis, identifying quality issues, and suggesting structural improvements.",
      };
    }

    // --- Quick coding tasks (short prompts with code keywords) ---
    const quickCodePatterns = [
      /\b(write\s+(a|an|me)\s+(function|method|class|script|regex|query))\b/i,
      /\b(how\s+(to|do\s+I)\s+(implement|create|make|write|use))\b/i,
      /\b(convert|transform|parse|format|validate|sort|filter)\s/i,
      /\b(snippet|one[- ]liner|example|syntax)\b/i,
    ];
    const isQuickCode = quickCodePatterns.some((p) => p.test(prompt));
    if (isQuickCode && promptLength < 300) {
      return {
        intent: "coding",
        category: "coding_quick",
        chosenModel: "claude-sonnet-4-5-20250929",
        confidence: 0.88,
        reason: "This is a straightforward coding task, and Claude Sonnet 4.5 excels at quick, accurate code generation and clear explanations.",
      };
    }

    // --- High-stakes writing (executive, public, sensitive → Opus) ---
    const highStakesWritingPatterns = [
      /\b(executive\s+summary|board\s+memo|investor\s+(letter|update|memo))\b/i,
      /\b(public\s+statement|press\s+release|official\s+(response|statement|announcement))\b/i,
      /\b(legal\s+(brief|memo|letter|document)|compliance\s+(report|document))\b/i,
      /\b(ceo|cto|cfo|c-suite|board\s+of\s+directors|stakeholder)\b/i,
      /\b(sensitive|confidential|high[- ]stakes|formal\s+communication)\b/i,
    ];
    const isHighStakesWriting = highStakesWritingPatterns.some((p) => p.test(prompt));
    if (isHighStakesWriting) {
      return {
        intent: "writing",
        category: "writing_high_stakes",
        chosenModel: "claude-opus-4-6",
        confidence: 0.88,
        reason: "This is a high-stakes communication task, and Claude Opus 4.6 handles sensitive, nuanced writing with precision and appropriate tone.",
      };
    }

    // --- Standard writing (marketing, blog, professional → Sonnet) ---
    const standardWritingPatterns = [
      /\b(write\s+(a|an|me|the)\s+(blog|article|post|email|newsletter|copy))\b/i,
      /\b(marketing\s+(copy|email|content|campaign)|landing\s+page)\b/i,
      /\b(draft\s+(a|an|the)\s+(email|letter|proposal|report|memo))\b/i,
      /\b(professional\s+(email|letter|writing)|business\s+(email|letter|proposal))\b/i,
      /\b(cover\s+letter|resume|cv|linkedin\s+(post|summary))\b/i,
    ];
    const isStandardWriting = standardWritingPatterns.some((p) => p.test(prompt));
    if (isStandardWriting) {
      return {
        intent: "writing",
        category: "writing_standard",
        chosenModel: "claude-sonnet-4-5-20250929",
        confidence: 0.88,
        reason: "This is a professional writing task, and Claude Sonnet 4.5 produces polished, high-quality content with appropriate tone and structure.",
      };
    }

    // --- Lightweight writing (short, casual) ---
    // GUARD: If the prompt mentions a programming language or code-related terms,
    // this is a code rewrite, not a writing task. Route to code model instead.
    const codeLanguageSignals =
      /\b(typescript|javascript|python|java|rust|golang|go|ruby|swift|kotlin|c\+\+|csharp|c#|php|sql|html|css|react|vue|angular|node\.?js|express|django|flask|rails|spring|function|class|method|api|endpoint|component|module|interface|struct|enum)\b/i;
    const hasCodeSignal = codeLanguageSignals.test(prompt);

    const lightWritingPatterns = [
      /\b(summarize|shorten|rewrite|rephrase|simplify|paraphrase)\b/i,
      /\b(tldr|tl;dr|brief|concise|shorter\s+version)\b/i,
      /\b(make\s+(this|it)\s+(shorter|simpler|clearer|more\s+concise))\b/i,
    ];
    const isLightWriting = lightWritingPatterns.some((p) => p.test(prompt));

    // If it looks like light writing but mentions code/languages, route as quick code instead
    if (isLightWriting && hasCodeSignal && promptLength < 500) {
      return {
        intent: "coding",
        category: "coding_quick",
        chosenModel: "claude-sonnet-4-5-20250929",
        confidence: 0.88,
        reason: "This is a code rewriting task, and Claude Sonnet 4.5 excels at fast, clean code transformations.",
      };
    }

    if (isLightWriting && !hasCodeSignal && promptLength < 500) {
      return {
        intent: "writing",
        category: "writing_light",
        chosenModel: "claude-haiku-4-5-20251001",
        confidence: 0.88,
        reason: "This is a lightweight writing task, and Claude Haiku 4.5 is fast and efficient at summaries and concise rewrites.",
      };
    }

    // --- Complex analysis (deep tradeoffs, multi-step reasoning) ---
    const complexAnalysisPatterns = [
      /\b(analyze\s+(the\s+)?tradeoffs?|trade[- ]offs?\s+between|evaluate\s+(the\s+)?(pros|options|approaches))\b/i,
      /\b(deep\s+dive|in[- ]depth\s+analysis|thorough(ly)?\s+(analyze|evaluate|assess))\b/i,
      /\b(multi[- ]step\s+reasoning|reason\s+through|think\s+through\s+step)\b/i,
      /\b(evaluate\s+(this|the)\s+(architecture|design|approach|strategy|plan))\b/i,
      /\b(cost[- ]benefit|risk\s+assessment|impact\s+analysis|feasibility)\b/i,
    ];
    const isComplexAnalysis = complexAnalysisPatterns.some((p) => p.test(prompt));
    if (isComplexAnalysis && promptLength > 60) {
      return {
        intent: "analysis",
        category: "analysis_complex",
        chosenModel: "gpt-5.2",
        confidence: 0.88,
        reason: "This is a complex analysis task requiring deep multi-step reasoning, and GPT-5.2 excels at evaluating nuanced tradeoffs and structured decision-making.",
      };
    }

    // --- Simple analysis / factual questions ---
    const simpleAnalysisPatterns = [
      /\b(what\s+is|what\s+are|explain|define|difference\s+between|compare)\b/i,
      /\b(pros\s+and\s+cons|advantages|disadvantages|when\s+to\s+use)\b/i,
    ];
    const isSimpleAnalysis = simpleAnalysisPatterns.some((p) => p.test(prompt));
    if (isSimpleAnalysis && promptLength < 200) {
      return {
        intent: "analysis",
        category: "analysis_standard",
        chosenModel: "gpt-5-mini",
        confidence: 0.86,
        reason: "This is a straightforward analytical question, and GPT-5 Mini provides clear, efficient reasoning for research and comparison tasks.",
      };
    }

    // No strong deterministic signal — fall back to LLM classifier.
    // Gemini models (gemini-2.5-flash, gemini-2.5-pro) are intentionally absent
    // from the fast-path. They serve as low-confidence alternatives in the LLM
    // classifier's routeByCategory() fallback (confidence < 0.6). Since the
    // fast-path only fires for high-confidence matches (≥0.86), Gemini selection
    // is correctly deferred to the classifier path where confidence is uncertain.
    return null;
  }

  /**
   * Generate an image-aware explanation using attachment gist
   * NOTE: This is a temporary reason used only for initial routing.
   * It will be replaced by IMAGE_GIST-based reason during streaming.
   */
  private generateImageAwareReason(
    prompt: string,
    attachments: Array<{ type: string; filename?: string; content?: string; extension?: string }> | undefined,
    chosenModel: ModelId
  ): string {
    const isDev = process.env.NODE_ENV !== "production";
    
    // Generate gist from attachments
    const gist = getAttachmentsGist(attachments || [], prompt);
    
    if (!gist) {
      const fallback = "This request includes an image that requires visual analysis, and the selected model is well-suited for interpreting visual information.";
      if (isDev) {
        console.log('[ROUTING] Using generic image fallback (will be replaced by IMAGE_GIST during streaming)');
      }
      return fallback;
    }
    
    // Model-specific capabilities
    const modelCapabilities: Record<string, string> = {
      "gemini-2.5-pro": "Gemini 2.5 Pro is highly effective at",
      "gemini-2.5-flash": "Gemini 2.5 Flash is well-suited for quickly",
      "gpt-5.2": "GPT-5.2 excels at",
      "claude-sonnet-4-5-20250929": "Claude Sonnet 4.5 is well-suited for",
    };
    
    const modelPrefix = modelCapabilities[chosenModel] || "The selected model is well-suited for";
    
    // Construct explanation based on gist
    let visualTask = "interpreting visual information";
    
    if (gist.signals.includes("code")) {
      visualTask = "accurately reading and extracting code from images";
    } else if (gist.signals.includes("terminal")) {
      visualTask = "interpreting and explaining error messages from screenshots";
    } else if (gist.signals.includes("UI")) {
      visualTask = "analyzing interface behavior and visual layout";
    } else if (gist.signals.includes("diagram")) {
      visualTask = "understanding visual diagrams and structured information";
    }
    
    // Format: "This is a [kind] showing [topic], and [model] is [capability] [task]."
    const reason = `This is ${gist.kind} showing ${gist.topic}, and ${modelPrefix} ${visualTask}.`;
    
    if (isDev) {
      console.log('[ROUTING] Generated initial image reason (will be replaced by IMAGE_GIST):', reason);
    }
    
    return reason;
  }

  /**
   * Generate a file-aware explanation using attachment gist
   */
  private generateFileAwareReason(
    prompt: string,
    attachments: Array<{ type: string; filename?: string; content?: string; extension?: string }> | undefined,
    chosenModel: ModelId,
    isComplex: boolean
  ): string {
    // Generate gist from attachments
    const gist = getAttachmentsGist(attachments || [], prompt);
    
    if (!gist) {
      return "This request includes an uploaded code/text file, so a stronger coding model was selected for accurate analysis and reliable results.";
    }
    
    const modelDisplayName = chosenModel.includes("claude-sonnet")
      ? "Claude Sonnet 4.5"
      : chosenModel.includes("gpt-5.2")
      ? "GPT-5.2"
      : chosenModel.includes("claude-opus")
      ? "Claude Opus 4.6"
      : chosenModel.includes("gpt-5-mini")
      ? "GPT-5 Mini"
      : chosenModel.includes("gemini-2.5-pro")
      ? "Gemini 2.5 Pro"
      : chosenModel.includes("gemini-2.5-flash")
      ? "Gemini 2.5 Flash"
      : chosenModel.includes("haiku")
      ? "Claude Haiku 4.5"
      : "the selected model";
    
    // Build a natural file description: "a CSS stylesheet with responsive layout styles"
    const fileDescription = this.buildFileDescription(gist);
    
    // Construct explanation based on gist
    if (isComplex) {
      // Complex/deep reasoning scenario
      const complexCapability = this.getComplexCapability(gist);
      return `This is ${fileDescription}, and ${modelDisplayName} is the best fit because it excels at ${complexCapability}.`;
    } else {
      // Standard file upload
      const capability = this.getFileCapability(gist);
      return `This is ${fileDescription}, and ${modelDisplayName} is the best fit for ${capability}.`;
    }
  }

  /**
   * Build a natural-sounding file description from gist data
   * e.g., "a CSS stylesheet with responsive layout styles" or "a TypeScript file defining React component with hooks"
   */
  private buildFileDescription(gist: { kind: string; language?: string; topic: string; signals: string[] }): string {
    const kind = gist.kind.toLowerCase();
    const topic = gist.topic;

    // If the kind already includes the language (e.g., "CSS stylesheet", "TypeScript file"),
    // just describe what it contains
    if (topic && topic !== "code" && topic !== `${gist.language} code`) {
      return `${this.articleFor(kind)} ${kind} with ${topic}`;
    }
    
    // Generic: just the kind
    return `${this.articleFor(kind)} ${kind}`;
  }

  /**
   * Get the right capability description for complex file analysis
   */
  private getComplexCapability(gist: { signals: string[]; language?: string; topic: string }): string {
    if (gist.signals.includes("database") || gist.signals.includes("schema")) {
      return "complex schema analysis and database architecture decisions";
    }
    if (gist.signals.includes("infrastructure") || gist.signals.includes("Docker")) {
      return "infrastructure analysis and deployment architecture";
    }
    if (gist.signals.includes("React") || gist.signals.includes("Next.js") || gist.signals.includes("Vue") || gist.signals.includes("Svelte")) {
      return "deep component architecture analysis and framework-aware refactoring";
    }
    return "complex analysis, architectural decisions, and thorough code reasoning";
  }

  /**
   * Get the right capability description for standard file uploads
   */
  private getFileCapability(gist: { signals: string[]; language?: string; topic: string; kind: string }): string {
    // Error/debug scenarios
    if (gist.signals.includes("error codes") || gist.signals.includes("build failure")) {
      return "debugging and pinpointing root causes in error output";
    }
    // Styling files
    if (gist.signals.includes("styling")) {
      if (gist.signals.includes("Tailwind")) return "Tailwind CSS analysis and styling improvements";
      if (gist.signals.includes("responsive")) return "responsive design analysis and CSS improvements";
      if (gist.signals.includes("animations")) return "animation and transition refinements";
      return "CSS analysis, styling updates, and visual design improvements";
    }
    // Markup files
    if (gist.signals.includes("markup")) {
      return "HTML structure analysis, accessibility improvements, and semantic markup";
    }
    // Database files
    if (gist.signals.includes("database") || gist.signals.includes("schema")) {
      return "SQL analysis, query optimization, and schema improvements";
    }
    // Scripting
    if (gist.signals.includes("scripting") || gist.signals.includes("CI/CD")) {
      return "script analysis, automation improvements, and best practices";
    }
    // Documentation
    if (gist.signals.includes("documentation")) {
      return "documentation improvements, clarity, and structure";
    }
    // Data files
    if (gist.signals.includes("data")) {
      return "data analysis, structure validation, and processing";
    }
    // Config files
    if (gist.signals.includes("config")) {
      return "configuration analysis and optimization";
    }
    // Framework-specific
    if (gist.signals.includes("React") || gist.signals.includes("Next.js")) {
      return `${gist.language || "code"} analysis and framework-aware improvements`;
    }
    // Type definitions
    if (gist.signals.includes("types")) {
      return "type-safe code analysis and refactoring";
    }
    // Tests
    if (gist.signals.includes("tests")) {
      return "test analysis, coverage improvements, and best practices";
    }
    // Academic
    if (gist.signals.includes("academic")) {
      return "LaTeX formatting, structure improvements, and content review";
    }
    // Language-specific fallback
    if (gist.language && gist.language !== "text") {
      return `${gist.language} analysis, improvements, and accurate edits`;
    }
    // Generic fallback
    return "accurate file analysis and improvements";
  }

  /**
   * Return "a" or "an" based on the word following it
   */
  private articleFor(word: string): string {
    const firstChar = word.charAt(0).toLowerCase();
    return ["a", "e", "i", "o", "u"].includes(firstChar) ? "an" : "a";
  }

  /**
   * Attachment-aware routing (PRIORITY over intent classification)
   */
  private routeByAttachment(
    prompt: string,
    context: AttachmentContext
  ): RoutingDecision | null {
    // HARD RULE: Images → Vision models
    if (context.hasImages) {
      const isLightweight = isLightweightRequest({
        promptChars: context.promptChars,
        totalTextChars: context.totalTextChars,
        imageCount: context.imageCount,
        textFileCount: context.textFileCount,
      });

      const chosenModel = getDefaultVisionModel(isLightweight);
      
      // Generate image-aware explanation using gist
      const reason = this.generateImageAwareReason(
        prompt,
        context.attachments,
        chosenModel
      );

      return {
        intent: "vision",
        category: isLightweight ? "vision_lightweight" : "vision_standard",
        chosenModel,
        confidence: 0.95,
        reason,
        fitBreakdown: this.generateFitBreakdown("vision", isLightweight ? "vision_lightweight" : "vision_standard", chosenModel, prompt, context),
      };
    }

    // CODE/TEXT files → Code-optimized models (NEVER downgrade to cheap models)
    if (
      context.hasTextFiles ||
      isCodeRelated({ prompt, textFileTypes: context.textFileTypes })
    ) {
      const needsDeepReasoning = requiresDeepReasoning({
        prompt,
        totalTextChars: context.totalTextChars,
        hasTextFiles: context.hasTextFiles,
      });

      if (needsDeepReasoning) {
        // Escalate to deep reasoning model
        const reason = this.generateFileAwareReason(
          prompt,
          context.attachments,
          MODEL_DEFAULTS.deepReasoningA,
          true
        );
        
        return {
          intent: "coding",
          category: "code_complex",
          chosenModel: MODEL_DEFAULTS.deepReasoningA,
          confidence: 0.9,
          reason,
          fitBreakdown: this.generateFitBreakdown("coding", "code_complex", MODEL_DEFAULTS.deepReasoningA, prompt, context),
        };
      }

      // IMPORTANT: For uploaded files, always use a strong workhorse model
      // NEVER downgrade to fast/cheap models like gpt-5-mini
      if (context.hasTextFiles) {
        const reason = this.generateFileAwareReason(
          prompt,
          context.attachments,
          MODEL_DEFAULTS.codePrimary,
          false
        );
        
        return {
          intent: "coding",
          category: "code_uploaded_file",
          chosenModel: MODEL_DEFAULTS.codePrimary, // claude-sonnet-4-5-20250929
          confidence: 0.9,
          reason,
          fitBreakdown: this.generateFitBreakdown("coding", "code_uploaded_file", MODEL_DEFAULTS.codePrimary, prompt, context),
        };
      }

      // Code-related prompt WITHOUT uploaded files (can use lightweight)
      const isLightweight = isLightweightRequest({
        promptChars: context.promptChars,
        totalTextChars: context.totalTextChars,
        imageCount: context.imageCount,
        textFileCount: context.textFileCount,
      });

      const chosenModel = getDefaultCodeModel(isLightweight);

      return {
        intent: "coding",
        category: isLightweight ? "code_quick" : "code_standard",
        chosenModel,
        confidence: 0.9,
        reason: isLightweight
          ? "This is a quick code question, and GPT-5 Mini is the best fit because it's fast and accurate for small code tasks and explanations."
          : "This is a code-related request, and Claude Sonnet 4.5 is the best fit because it excels at thorough code generation, debugging, and detailed explanations.",
      };
    }

    // No attachments or not matching patterns → use traditional routing
    return null;
  }

  /**
   * Stage 1: Classify prompt intent using LLM
   */
  private async classifyIntent(prompt: string): Promise<ClassifierResponse> {
    const classifierPrompt = `Classify this prompt and select the best model. Respond ONLY with valid JSON.

Prompt: "${prompt}"

Routing Rules (Primary → Alternative):

CODING:
- coding_quick (small functions, snippets, type fixes)
  Primary: claude-sonnet-4-5-20250929 (confidence ≥ 0.6)
  Alternative: gemini-2.5-flash (confidence < 0.6)

- coding_review (refactor, PR review, explain code)
  Primary: claude-opus-4-6 (confidence ≥ 0.6)
  Alternative: gemini-2.5-pro (confidence < 0.6)

- coding_debug (stack traces, errors, logs)
  Primary: gpt-5.2 (confidence ≥ 0.6)
  Alternative: gemini-2.5-pro (confidence < 0.6)

- coding_complex_impl (algorithms, performance, system design)
  Primary: gpt-5.2 (confidence ≥ 0.6)
  Alternative: gemini-2.5-pro (confidence < 0.6)

WRITING:
- writing_light (summarize, shorten, casual rewrite)
  Primary: claude-haiku-4-5-20251001 (confidence ≥ 0.6)
  Alternative: gemini-2.5-flash (confidence < 0.6)

- writing_standard (marketing, blog, landing pages)
  Primary: claude-sonnet-4-5-20250929 (confidence ≥ 0.6)
  Alternative: gemini-2.5-pro (confidence < 0.6)

- writing_high_stakes (executive, public statements, sensitive)
  Primary: claude-opus-4-6 (confidence ≥ 0.6)
  Alternative: gemini-2.5-pro (confidence < 0.6, fallback only)

ANALYSIS:
- analysis_standard (compare options, basic reasoning)
  Primary: gpt-5-mini (confidence ≥ 0.6)
  Alternative: gemini-2.5-flash (confidence < 0.6)

- analysis_complex (deep tradeoffs, multi-step reasoning)
  Primary: gpt-5.2 (confidence ≥ 0.6)
  Alternative: gemini-2.5-pro (confidence < 0.6)

Cost-awareness:
- Prefer gemini-2.5-flash over gemini-2.5-pro when both viable
- Do not select gemini-2.5-pro for trivial/low-confidence prompts
- If confidence < 0.5, default to gpt-5-mini

Required JSON format:
{
  "intent": "coding|writing|analysis|unknown",
  "category": "<category_from_above>",
  "chosenModel": "<exact_model_id>",
  "confidence": 0.0-1.0,
  "reason": "<A detailed 1-2 sentence explanation that: (1) describes what the user's request is specifically about, and (2) explains why the chosen model is the best fit for that specific task. Be concrete about both the topic and the model's relevant strength.>"
}

REASON EXAMPLES (follow this style):
- "The request is asking about JavaScript array methods, which is best suited for Claude Sonnet 4.5 because it excels at quick, accurate code generation and clear explanations."
- "This is a complex system design question involving distributed caching, and GPT-5.2 is the best fit because it has strong multi-step reasoning and architectural planning abilities."
- "The request is asking for a casual blog post summary, which is best suited for Claude Haiku 4.5 because it's fast and effective at lightweight writing tasks."
- "This is a debugging request involving a React hydration error, and GPT-5.2 is well-suited because it excels at systematic error analysis and tracing complex issues."
- "The request is asking for a professional marketing email, which is best suited for Claude Sonnet 4.5 because it produces polished, high-quality professional content."

Output ONLY the JSON object, no other text.`;

    const response = await Promise.race([
      runOpenAI(
        {
          prompt: classifierPrompt,
          maxTokens: 2000, // GPT-5-mini needs lots of tokens for reasoning + JSON output
          // Don't set temperature - GPT-5 models use default temp=1
        },
        this.CLASSIFIER_MODEL
      ),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Classifier timeout")),
          this.CLASSIFIER_TIMEOUT_MS
        )
      ),
    ]);

    console.log("Classifier raw response:", {
      text: response.text.substring(0, 200),
      error: response.error,
      model: response.model,
    });

    if (response.error) {
      throw new Error(`Classifier API error: ${response.error}`);
    }

    if (!response.text || response.text.trim().length === 0) {
      throw new Error("Classifier returned empty response");
    }

    // Parse JSON response
    const text = response.text.trim();
    let classification: ClassifierResponse;

    try {
      // Try to extract JSON if wrapped in markdown or has extra text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch[0] : text;
      classification = JSON.parse(jsonText);
      
      console.log("Classifier parsed successfully:", classification);
    } catch (parseErr) {
      console.error("Failed to parse classifier response:", {
        text: text.substring(0, 500),
        error: parseErr,
      });
      throw new Error(`Failed to parse classifier response: ${parseErr instanceof Error ? parseErr.message : 'Unknown parse error'}`);
    }

    // Validate required fields
    if (!classification.intent || !classification.category || !classification.chosenModel) {
      throw new Error(`Classifier response missing required fields: ${JSON.stringify(classification)}`);
    }

    return classification;
  }

  /**
   * Stage 2: Route by category with fallback logic
   */
  private routeByCategory(
    classification: ClassifierResponse
  ): RoutingDecision {
    const { intent, category, confidence, chosenModel: classifierModel, reason: classifierReason } = classification;
    let chosenModel: ModelId;
    let reason: string;

    // Valid model IDs (for validation)
    const validModels: ModelId[] = [
      "gpt-5-mini",
      "gpt-5.2",
      "claude-opus-4-6",
      "claude-sonnet-4-5-20250929",
      "claude-haiku-4-5-20251001",
      "gemini-2.5-flash",
      "gemini-2.5-pro",
    ];

    // Fallback reason mapping (used only when classifier reason is missing or too short)
    const fallbackReasons: Record<string, string> = {
      coding_quick: "This is a straightforward coding task, well-suited for a fast and accurate code generation model.",
      coding_review: "This request involves code analysis, best handled by a model that excels at reviewing and improving code quality.",
      coding_debug: "This is a debugging request, best suited for a model with strong systematic error analysis capabilities.",
      coding_complex_impl: "This is a complex implementation task requiring a model specialized in advanced algorithms and system design.",
      writing_light: "This is a lightweight writing task, best suited for a fast model that's efficient at summaries and casual rewrites.",
      writing_standard: "This is a professional writing task, best handled by a model that produces polished, high-quality content.",
      writing_high_stakes: "This is a high-stakes communication task, best suited for a model optimized for careful, nuanced writing.",
      analysis_standard: "This is an analytical question, well-suited for a model with clear reasoning and research capabilities.",
      analysis_complex: "This is a complex analysis task requiring a model with deep multi-step reasoning abilities.",
    };

    // Check if classifier reason is detailed enough to use directly
    const isDetailedReason = classifierReason && 
      classifierReason.length > 40 &&
      !classifierReason.toLowerCase().includes("best match for this request") &&
      !classifierReason.toLowerCase().includes("general-purpose");

    // Safety: if confidence < 0.5, always default to gpt-5-mini
    if (confidence < 0.5) {
      chosenModel = "gpt-5-mini";
      reason = "Selected GPT-5 Mini as a reliable default for general-purpose tasks.";
      return { 
        intent, 
        category, 
        chosenModel, 
        confidence, 
        reason,
        fitBreakdown: this.generateFitBreakdown(intent as any, category, chosenModel, "", undefined),
      };
    }

    // If classifier returned a valid model and confidence is acceptable, use it
    if (
      confidence >= 0.6 &&
      classifierModel &&
      validModels.includes(classifierModel as ModelId)
    ) {
      chosenModel = classifierModel as ModelId;
      // Use the classifier's detailed reason if available, otherwise fall back to category reason
      reason = isDetailedReason 
        ? classifierReason 
        : (fallbackReasons[category] || "Selected as the best match for this request.");
      return { 
        intent, 
        category, 
        chosenModel, 
        confidence, 
        reason,
        fitBreakdown: this.generateFitBreakdown(intent as any, category, chosenModel, "", undefined),
      };
    }

    // Fallback logic for low confidence (0.5 <= confidence < 0.6) or invalid model
    // Use cost-aware alternatives with Gemini included

    // Use classifier reason if detailed, otherwise build a descriptive fallback
    // These fallback reasons mention the alternative model since confidence was low

    // Coding intent routing
    if (intent === "coding") {
      if (category === "coding_quick") {
        chosenModel = "gemini-2.5-flash";
        reason = isDetailedReason ? classifierReason : "This coding question is best suited for Gemini 2.5 Flash because it's fast and effective at quick code generation and snippets.";
      } else if (category === "coding_review") {
        chosenModel = "gemini-2.5-pro";
        reason = isDetailedReason ? classifierReason : "This code review task is best suited for Gemini 2.5 Pro because it has strong capabilities for analyzing and refactoring code.";
      } else if (category === "coding_debug") {
        chosenModel = "gemini-2.5-pro";
        reason = isDetailedReason ? classifierReason : "This debugging request is best suited for Gemini 2.5 Pro because it excels at systematic error analysis and tracing issues.";
      } else if (category === "coding_complex_impl") {
        chosenModel = "gemini-2.5-pro";
        reason = isDetailedReason ? classifierReason : "This complex implementation task is best suited for Gemini 2.5 Pro because it has strong algorithm design and reasoning capabilities.";
      } else {
        // Unknown coding category
        chosenModel = "gemini-2.5-flash";
        reason = isDetailedReason ? classifierReason : "This programming question is best suited for Gemini 2.5 Flash because it's fast and reliable for general code tasks.";
      }
    }
    // Writing intent routing
    else if (intent === "writing") {
      if (category === "writing_light") {
        chosenModel = "gemini-2.5-flash";
        reason = isDetailedReason ? classifierReason : "This lightweight writing task is best suited for Gemini 2.5 Flash because it's fast and efficient at summaries and casual rewrites.";
      } else if (category === "writing_standard") {
        chosenModel = "gemini-2.5-pro";
        reason = isDetailedReason ? classifierReason : "This writing task is best suited for Gemini 2.5 Pro because it produces polished, professional-quality content.";
      } else if (category === "writing_high_stakes") {
        chosenModel = "gemini-2.5-pro";
        reason = isDetailedReason ? classifierReason : "This high-stakes communication task is best suited for Gemini 2.5 Pro because it handles nuanced, sensitive writing with care.";
      } else {
        // Unknown writing category
        chosenModel = "gemini-2.5-flash";
        reason = isDetailedReason ? classifierReason : "This writing request is best suited for Gemini 2.5 Flash because it's balanced and effective for clear, concise content.";
      }
    }
    // Analysis intent routing
    else if (intent === "analysis") {
      if (category === "analysis_complex") {
        chosenModel = "gemini-2.5-pro";
        reason = isDetailedReason ? classifierReason : "This complex analysis task is best suited for Gemini 2.5 Pro because it has strong deep reasoning and multi-step analysis abilities.";
      } else {
        // analysis_standard or unknown
        chosenModel = "gemini-2.5-flash";
        reason = isDetailedReason ? classifierReason : "This analytical question is best suited for Gemini 2.5 Flash because it provides clear, efficient reasoning for standard research tasks.";
      }
    }
    // Unknown intent
    else {
      chosenModel = "gpt-5-mini";
      reason = "Selected GPT-5 Mini as a reliable default for this general-purpose request.";
    }

    return {
      intent,
      category,
      chosenModel,
      confidence,
      reason,
      fitBreakdown: this.generateFitBreakdown(intent as any, category, chosenModel, "", undefined),
    };
  }

  /**
   * Generate a prompt-aware routing explanation using LLM.
   * For follow-up turns, generates a contextual reason that references
   * the conversation continuation rather than treating it as a fresh request.
   */
  async generateRoutingReason(params: {
    prompt: string;
    chosenModel: ModelId;
    intent: string;
    category: string;
    attachmentGist?: AttachmentGist | null;
    isFollowUp?: boolean;
    previousPrompt?: string;
  }): Promise<string> {
    const { prompt, chosenModel, intent, category, attachmentGist, isFollowUp, previousPrompt } = params;

    // Map model IDs to display names
    const modelDisplayNames: Record<ModelId, string> = {
      "gpt-5-mini": "GPT-5 Mini",
      "gpt-5.2": "GPT-5.2",
      "claude-opus-4-6": "Claude Opus 4.6",
      "claude-sonnet-4-5-20250929": "Claude Sonnet 4.5",
      "claude-haiku-4-5-20251001": "Claude Haiku 4.5",
      "gemini-2.5-flash": "Gemini 2.5 Flash",
      "gemini-2.5-pro": "Gemini 2.5 Pro",
    };

    const modelDisplayName = modelDisplayNames[chosenModel] || chosenModel;

    // Build attachment context for the prompt
    let attachmentContext = "";
    if (attachmentGist) {
      attachmentContext = `
ATTACHMENT INFORMATION:
- Type: ${attachmentGist.kind}
- Language: ${attachmentGist.language || "unknown"}
- Topic: ${attachmentGist.topic}
- Signals: ${attachmentGist.signals.join(", ")}

CRITICAL: Only describe specifics if you can confidently infer them from the attachment info above. If uncertain, use safe generic descriptions.`;
    }

    // Build the explanation prompt — different template for follow-ups vs initial requests
    let explanationPrompt: string;

    if (isFollowUp && previousPrompt) {
      // Follow-up turn: generate a contextual continuation reason
      explanationPrompt = `You are explaining why ${modelDisplayName} was selected to answer a follow-up question in an ongoing conversation.

CONVERSATION CONTEXT:
- Original request: "${previousPrompt.substring(0, 200)}"
- Follow-up question: "${prompt.substring(0, 300)}"

Write exactly 1-2 sentences that:
1. Start with "Continuing conversation." to signal this is a follow-up
2. Describe what the user is now asking (how it differs from or extends the original request)
3. Explain why ${modelDisplayName} is the best fit for this follow-up task

STRICT RULES:
- Output must be 1-2 sentences maximum
- MUST start with "Continuing conversation."
- MUST describe what the follow-up asks for specifically
- MUST reference a concrete model strength
- Do NOT reuse the original routing reason verbatim
- Do NOT be generic (no "balanced capabilities", "best match", "good choice")
- Do NOT mention routing, categories, or internal mechanics

GOOD EXAMPLES:
- "Continuing conversation. User now asks to rewrite the JavaScript function in jQuery. This is still a concise code transformation task; ${modelDisplayName} is selected for fast, clean refactoring."
- "Continuing conversation. The user wants to add error handling to the previous implementation. ${modelDisplayName} excels at iterative code improvements and defensive programming patterns."
- "Continuing conversation. User asks for a more formal tone in the email. ${modelDisplayName} is well-suited for nuanced writing adjustments and style refinement."

Your explanation:`;
    } else {
      // Initial request: standard routing reason
      explanationPrompt = `You are explaining why ${modelDisplayName} was selected to answer a user's request.

${attachmentContext}

Write exactly 1-2 sentences that:
1. Specifically describe what the user is asking about (the topic, language, framework, or task)
2. Explain why ${modelDisplayName} is the best fit for that specific task, referencing a concrete model strength

${attachmentGist ? `ATTACHMENT RULES:
- Mention the attachment type (image/screenshot OR uploaded file type)
- Describe what the attachment contains if identifiable from the attachment info
- Explain why the model fits for processing that attachment` : `TEXT REQUEST RULES:
- Identify the specific topic or task the user is asking about (e.g., "JavaScript closures", "Python web scraping", "React state management", "writing a cover letter")
- Explain the specific strength of ${modelDisplayName} that makes it ideal for this task (e.g., "excels at quick code generation", "strong at complex multi-step reasoning", "produces polished professional writing")
- Be specific about BOTH the topic and the model strength — never be vague about either`}

STRICT RULES:
- Output must be 1-2 sentences maximum
- MUST mention the specific topic/subject of the user's request
- MUST explain a specific model capability (not just "well-suited" or "good at this")
- Do NOT mention routing, categories, confidence, or internal mechanics
- Do NOT use generic filler like "balanced capabilities" or "best match" or "general-purpose"
- Do NOT invent details if unclear — describe the request at whatever level of detail you can confidently identify

GOOD EXAMPLES:
- "The request is asking about JavaScript array methods, which is best suited for ${modelDisplayName} because it excels at quick, accurate code generation and clear explanations."
- "This is a complex system design question about distributed caching, and ${modelDisplayName} is the best fit because it has strong multi-step reasoning and architectural planning abilities."
- "The request is about debugging a React hydration error, and ${modelDisplayName} is well-suited because it systematically traces errors and identifies root causes."
- "This request asks for a professional marketing email, which is best suited for ${modelDisplayName} because it produces polished, brand-appropriate content."
- "The request is asking how to write unit tests in Python, and ${modelDisplayName} is a strong fit because it generates clean, well-structured test code with good coverage patterns."

BAD EXAMPLES (NEVER USE):
- "This request is well-suited to ${modelDisplayName}'s balanced capabilities."
- "Selected as the best match for this request."
- "${modelDisplayName} is a good choice for this task."

User request: "${prompt.substring(0, 300)}"

Your explanation:`;
    }

    console.log("Generating routing reason for:", {
      model: modelDisplayName,
      promptPreview: prompt.substring(0, 100),
      category,
      hasAttachment: !!attachmentGist,
      attachmentKind: attachmentGist?.kind,
      isFollowUp: !!isFollowUp,
    });

    try {
      const response = await Promise.race([
        runOpenAI(
          {
            prompt: explanationPrompt,
            maxTokens: 150, // Allow room for detailed 1-2 sentence explanations
            temperature: 0.3, // Lower temperature for more consistent output
          },
          this.CLASSIFIER_MODEL
        ),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Reason generation timeout")), 8000)
        ),
      ]);

      if (response.error || !response.text) {
        throw new Error("Failed to generate explanation");
      }

      // Clean up the response
      let reason = response.text.trim();
      
      // Remove quotes if present
      reason = reason.replace(/^["']|["']$/g, "");
      
      // Remove any leading phrase like "Your one-sentence explanation:" if present
      reason = reason.replace(/^(Your one-sentence explanation:|Explanation:)/i, "").trim();
      
      // Reject truly generic phrases that don't reference the task or attachment
      const forbiddenPhrases = [
        "best match for this request",
        "best match for your request",
        "selected as the best",
        "chosen because it is",
        "general-purpose",
        "balanced capabilities",
      ];
      
      const isGeneric = forbiddenPhrases.some(phrase => 
        reason.toLowerCase().includes(phrase)
      );
      
      // Check if it references the attachment when one is present
      const hasAttachmentReference = !attachmentGist || 
        reason.toLowerCase().includes("screenshot") ||
        reason.toLowerCase().includes("image") ||
        reason.toLowerCase().includes("upload") ||
        reason.toLowerCase().includes("file") ||
        reason.toLowerCase().includes("log") ||
        reason.toLowerCase().includes("code") ||
        reason.toLowerCase().includes("config");
      
      // Check if it references the user's task (for non-attachment requests)
      const hasTaskReference = 
        /this (is|question|request|task|prompt|code|debugging|writing|learning|conversion|help)/i.test(reason) ||
        /the (request|question|task|prompt|code|user)/i.test(reason) ||
        /(for|about|regarding|concerning|asking|involves|involves) /i.test(reason);
      
      // Follow-up reasons have different phrasing ("Continuing conversation...", "User now asks...")
      // so they get a separate check that accepts follow-up-specific patterns.
      const hasFollowUpReference = 
        /continuing conversation/i.test(reason) ||
        /user (now |wants |asks |asked )/i.test(reason) ||
        /follow.?up/i.test(reason) ||
        /rewrite|convert|transform|refactor|modify|update|change|add|extend|improve/i.test(reason);
      
      if (isGeneric) {
        console.log("❌ Rejecting generic routing reason:", reason);
        throw new Error("Generated explanation uses forbidden generic phrases");
      }
      
      if (attachmentGist && !hasAttachmentReference) {
        console.log("❌ Rejecting reason that doesn't mention attachment:", reason);
        throw new Error("Generated explanation doesn't reference the attachment");
      }
      
      if (!attachmentGist && !hasTaskReference && !(isFollowUp && hasFollowUpReference)) {
        console.log("❌ Rejecting non-specific reason:", { reason, hasTaskReference, isFollowUp, hasFollowUpReference });
        throw new Error("Generated explanation doesn't reference the specific task");
      }
      
      if (reason.length < 25) {
        console.log("❌ Rejecting too-short reason:", { reason, length: reason.length });
        throw new Error("Generated explanation is too short");
      }
      
      // Ensure it ends with a period
      if (!reason.endsWith(".") && !reason.endsWith("!") && !reason.endsWith("?")) {
        reason += ".";
      }

      // Ensure it starts with capital letter
      if (reason.length > 0) {
        reason = reason.charAt(0).toUpperCase() + reason.slice(1);
      }

      console.log("✅ Generated routing reason passed validation:", reason);

      return reason;
    } catch (err) {
      console.warn("⚠️ Failed to generate AI routing reason, using fallback:", {
        error: err instanceof Error ? err.message : err,
        category,
        modelDisplayName,
        isFollowUp: !!isFollowUp,
      });
      
      // For follow-ups, build a deterministic reason from the available context.
      // This avoids the generic category-based fallback that has no conversation awareness.
      if (isFollowUp && previousPrompt) {
        // Truncate prompts for readability
        const prevSummary = previousPrompt.length > 80 ? previousPrompt.substring(0, 77) + "..." : previousPrompt;
        const followUpSummary = prompt.length > 80 ? prompt.substring(0, 77) + "..." : prompt;
        const fallbackFollowUp = `Continuing conversation. The user originally asked "${prevSummary}" and now requests "${followUpSummary}". ${modelDisplayName} is selected for its strength in fast, accurate code and content generation.`;
        console.log("📝 Using follow-up fallback reason:", fallbackFollowUp);
        return fallbackFollowUp;
      }

      // Fallback to a category-specific explanation
      // Note: These are less specific than AI-generated ones but still helpful
      const fallbackReasons: Record<string, string> = {
        coding_quick: `This is a straightforward coding question, and ${modelDisplayName} is the best fit because it excels at quick, accurate code generation and explanations.`,
        coding_review: `This is a code review task, and ${modelDisplayName} is the best fit because it has strong capabilities for analyzing code quality and suggesting improvements.`,
        coding_debug: `This is a debugging request, and ${modelDisplayName} is the best fit because it excels at systematic error analysis and tracing issues to their root cause.`,
        coding_complex_impl: `This is a complex implementation task, and ${modelDisplayName} is the best fit because it has strong algorithm design and system architecture capabilities.`,
        writing_light: `This is a lightweight writing task, and ${modelDisplayName} is the best fit because it's fast and efficient at producing summaries and casual content.`,
        writing_standard: `This is a professional writing task, and ${modelDisplayName} is the best fit because it produces polished, high-quality content with appropriate tone.`,
        writing_high_stakes: `This is a high-stakes communication task, and ${modelDisplayName} is the best fit because it handles sensitive, nuanced writing with precision and care.`,
        analysis_standard: `This is an analytical question, and ${modelDisplayName} is the best fit because it provides clear reasoning and well-researched answers.`,
        analysis_complex: `This is a complex analysis task, and ${modelDisplayName} is the best fit because it has deep multi-step reasoning and can handle nuanced tradeoffs.`,
      };

      const fallbackReason = fallbackReasons[category] || `This request is best suited for ${modelDisplayName} because it provides reliable, well-rounded responses across a variety of tasks.`;
      console.log("📝 Using fallback reason:", fallbackReason);
      
      // Return fallback instead of throwing - ensures the reason is always sent via SSE
      return fallbackReason;
    }
  }

  /**
   * Generate fit breakdown for a routing decision
   */
  private generateFitBreakdown(
    intent: string,
    category: string,
    chosenModel: ModelId,
    prompt: string,
    attachmentContext?: AttachmentContext
  ): FitBreakdown {
    const promptLength = prompt.length;
    const hasAttachments = attachmentContext && (attachmentContext.hasImages || attachmentContext.hasTextFiles);
    
    // Determine reasoning complexity (0-10)
    const complexKeywords = /\b(algorithm|architecture|system\s+design|optimize|performance|scalability|tradeoff|compare|analyze)\b/i;
    const isComplex = complexKeywords.test(prompt) || promptLength > 400;
    const reasoningRaw = isComplex ? 8 : category.includes("complex") ? 9 : category.includes("quick") ? 5 : 7;
    
    // Determine output structure needs (0-10)
    const structuredKeywords = /\b(json|yaml|xml|csv|table|list|format|structure)\b/i;
    const needsStructure = structuredKeywords.test(prompt);
    const outputRaw = needsStructure ? 9 : category.includes("review") ? 8 : category.includes("quick") ? 6 : 7;
    
    // Determine cost efficiency (0-10) - higher for cheaper models
    const costRaw = chosenModel.includes("haiku") || chosenModel.includes("mini") || chosenModel.includes("flash") ? 9 : 
                    chosenModel.includes("sonnet") || chosenModel.includes("pro") ? 7 : 6;
    
    // Determine speed fit (0-10) - higher for faster models  
    const speedRaw = chosenModel.includes("haiku") || chosenModel.includes("mini") || chosenModel.includes("flash") ? 9 :
                     chosenModel.includes("sonnet") ? 8 : 
                     promptLength < 100 ? 7 : 6;
    
    const dimensions: FitDimension[] = [
      {
        key: "reasoningFit",
        label: "Reasoning Fit",
        raw: reasoningRaw,
        display: mapToDisplayScore(reasoningRaw),
        note: isComplex ? "Strong reasoning for complex tasks" : "Well-suited for this reasoning level",
      },
      {
        key: "outputMatch",
        label: "Output Match",
        raw: outputRaw,
        display: mapToDisplayScore(outputRaw),
        note: needsStructure ? "Excellent structured output control" : "Good format alignment",
      },
      {
        key: "costEfficiency",
        label: "Cost Efficiency",
        raw: costRaw,
        display: mapToDisplayScore(costRaw),
        note: costRaw >= 9 ? "Highly cost-effective choice" : "Balanced cost-quality ratio",
      },
      {
        key: "speedFit",
        label: "Speed Fit",
        raw: speedRaw,
        display: mapToDisplayScore(speedRaw),
        note: speedRaw >= 9 ? "Very fast response time" : "Appropriate response speed",
      },
    ];
    
    // Add recency fit if prompt mentions recent/latest
    const recencyKeywords = /\b(latest|recent|current|new|2026|2025|updated?)\b/i;
    if (recencyKeywords.test(prompt)) {
      const recencyRaw = chosenModel.includes("gpt-5") || chosenModel.includes("claude-") ? 8 : 6;
      dimensions.push({
        key: "recencyFit",
        label: "Recency Fit",
        raw: recencyRaw,
        display: mapToDisplayScore(recencyRaw),
        note: "Current knowledge for latest info",
      });
    }
    
    const overallFit = calculateOverallFit(dimensions);
    
    // Generate short explanation
    const modelName = this.getModelDisplayName(chosenModel);
    const shortWhy = category.includes("complex") 
      ? `${modelName} excels at complex reasoning and architectural planning for this task.`
      : category.includes("quick")
      ? `${modelName} delivers fast, accurate results for straightforward tasks.`
      : category.includes("review")
      ? `${modelName} provides thorough analysis and quality assessment.`
      : category.includes("high_stakes")
      ? `${modelName} handles sensitive, nuanced content with precision.`
      : `${modelName} offers balanced capabilities for this request.`;
    
    return {
      shortWhy,
      overallFit,
      fitBreakdown: dimensions,
    };
  }

  private getModelDisplayName(modelId: ModelId): string {
    const names: Record<ModelId, string> = {
      "gpt-5-mini": "GPT-5 Mini",
      "gpt-5.2": "GPT-5.2",
      "claude-opus-4-6": "Claude Opus 4.6",
      "claude-sonnet-4-5-20250929": "Claude Sonnet 4.5",
      "claude-haiku-4-5-20251001": "Claude Haiku 4.5",
      "gemini-2.5-flash": "Gemini 2.5 Flash",
      "gemini-2.5-pro": "Gemini 2.5 Pro",
    };
    return names[modelId] || modelId;
  }
}

export const intentRouter = new IntentRouter();
