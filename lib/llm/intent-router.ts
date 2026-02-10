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

export interface RoutingDecision {
  intent: "coding" | "writing" | "analysis" | "vision" | "unknown";
  category: string;
  chosenModel: ModelId;
  confidence: number; // 0..1
  reason: string;
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

export class IntentRouter {
  private readonly CLASSIFIER_MODEL: ModelId = "gpt-5-mini";
  private readonly CLASSIFIER_TIMEOUT_MS = 10000;

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
      // PRIORITY: Attachment-aware routing (when attachments present)
      if (attachmentContext) {
        const attachmentDecision = this.routeByAttachment(
          prompt,
          attachmentContext
        );
        if (attachmentDecision) {
          console.log("Attachment-aware routing decision:", attachmentDecision);
          return attachmentDecision;
        }
      }

      // FALLBACK: Traditional intent-based routing (no attachments)
      // Stage 1: Intent detection using classifier
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

        return {
          ...decision,
          reason: customReason,
        };
      }

      return decision;
    } catch (err) {
      console.error("Classifier failed:", err);
      // Fallback to gpt-5-mini on classifier failure
      return {
        intent: "unknown",
        category: "router_fallback",
        chosenModel: "gpt-5-mini",
        confidence: 0,
        reason: "Selected as a reliable default for this request.",
      };
    }
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
      ? "Claude Opus 4.5"
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
  Primary: claude-opus-4-5-20251101 (confidence ≥ 0.6)
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
  Primary: claude-opus-4-5-20251101 (confidence ≥ 0.6)
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
      "claude-opus-4-5-20251101",
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
      return { intent, category, chosenModel, confidence, reason };
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
      return { intent, category, chosenModel, confidence, reason };
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
    };
  }

  /**
   * Generate a prompt-aware routing explanation using LLM
   */
  async generateRoutingReason(params: {
    prompt: string;
    chosenModel: ModelId;
    intent: string;
    category: string;
    attachmentGist?: AttachmentGist | null;
  }): Promise<string> {
    const { prompt, chosenModel, intent, category, attachmentGist } = params;

    // Map model IDs to display names
    const modelDisplayNames: Record<ModelId, string> = {
      "gpt-5-mini": "GPT-5 Mini",
      "gpt-5.2": "GPT-5.2",
      "claude-opus-4-5-20251101": "Claude Opus 4.5",
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

    const explanationPrompt = `You are explaining why ${modelDisplayName} was selected to answer a user's request.

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

    console.log("Generating routing reason for:", {
      model: modelDisplayName,
      promptPreview: prompt.substring(0, 100),
      category,
      hasAttachment: !!attachmentGist,
      attachmentKind: attachmentGist?.kind,
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
      
      if (isGeneric) {
        console.log("❌ Rejecting generic routing reason:", reason);
        throw new Error("Generated explanation uses forbidden generic phrases");
      }
      
      if (attachmentGist && !hasAttachmentReference) {
        console.log("❌ Rejecting reason that doesn't mention attachment:", reason);
        throw new Error("Generated explanation doesn't reference the attachment");
      }
      
      if (!attachmentGist && !hasTaskReference) {
        console.log("❌ Rejecting non-specific reason:", { reason, hasTaskReference });
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
      });
      
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
}

export const intentRouter = new IntentRouter();
