/**
 * Two-stage intent-aware LLM router for automatic model selection
 */

import type { ModelId } from "./types";
import { runOpenAI } from "./providers/openai";

export interface RoutingDecision {
  intent: "coding" | "writing" | "analysis" | "unknown";
  category: string;
  chosenModel: ModelId;
  confidence: number; // 0..1
  reason: string;
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
   * Route a prompt to the best model using two-stage classification
   * @param prompt - The user's prompt
   * @param generateCustomReason - If true, generates a prompt-aware explanation (adds ~1-2s latency)
   */
  async route(
    prompt: string,
    generateCustomReason = false
  ): Promise<RoutingDecision> {
    try {
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
  "reason": "<1 sentence why>"
}

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
    const { intent, category, confidence, chosenModel: classifierModel } = classification;
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

    // User-friendly reason mapping (no internal details)
    const userFriendlyReasons: Record<string, string> = {
      coding_quick: "Fast and reliable for quick programming tasks.",
      coding_review: "Excellent at analyzing and improving code quality.",
      coding_debug: "Strong at identifying and resolving technical issues.",
      coding_complex_impl: "Specialized in advanced algorithms and system design.",
      writing_light: "Efficient for summaries and casual writing.",
      writing_standard: "Balanced for professional, high-quality content.",
      writing_high_stakes: "Optimized for important, nuanced communication.",
      analysis_standard: "Well-suited for research and answering questions.",
      analysis_complex: "Strong at deep analysis and complex reasoning.",
    };

    // Safety: if confidence < 0.5, always default to gpt-5-mini
    if (confidence < 0.5) {
      chosenModel = "gpt-5-mini";
      reason = "Selected as a reliable default for general-purpose tasks.";
      return { intent, category, chosenModel, confidence, reason };
    }

    // If classifier returned a valid model and confidence is acceptable, use it
    if (
      confidence >= 0.6 &&
      classifierModel &&
      validModels.includes(classifierModel as ModelId)
    ) {
      chosenModel = classifierModel as ModelId;
      reason = userFriendlyReasons[category] || "Selected as the best match for this request.";
      return { intent, category, chosenModel, confidence, reason };
    }

    // Fallback logic for low confidence (0.5 <= confidence < 0.6) or invalid model
    // Use cost-aware alternatives with Gemini included

    // Coding intent routing
    if (intent === "coding") {
      if (category === "coding_quick") {
        chosenModel = "gemini-2.5-flash";
        reason = userFriendlyReasons.coding_quick;
      } else if (category === "coding_review") {
        chosenModel = "gemini-2.5-pro";
        reason = userFriendlyReasons.coding_review;
      } else if (category === "coding_debug") {
        chosenModel = "gemini-2.5-pro";
        reason = userFriendlyReasons.coding_debug;
      } else if (category === "coding_complex_impl") {
        chosenModel = "gemini-2.5-pro";
        reason = userFriendlyReasons.coding_complex_impl;
      } else {
        // Unknown coding category
        chosenModel = "gemini-2.5-flash";
        reason = "Fast and reliable for programming tasks.";
      }
    }
    // Writing intent routing
    else if (intent === "writing") {
      if (category === "writing_light") {
        chosenModel = "gemini-2.5-flash";
        reason = userFriendlyReasons.writing_light;
      } else if (category === "writing_standard") {
        chosenModel = "gemini-2.5-pro";
        reason = userFriendlyReasons.writing_standard;
      } else if (category === "writing_high_stakes") {
        chosenModel = "gemini-2.5-pro";
        reason = userFriendlyReasons.writing_high_stakes;
      } else {
        // Unknown writing category
        chosenModel = "gemini-2.5-flash";
        reason = "Balanced for clear, effective writing.";
      }
    }
    // Analysis intent routing
    else if (intent === "analysis") {
      if (category === "analysis_complex") {
        chosenModel = "gemini-2.5-pro";
        reason = userFriendlyReasons.analysis_complex;
      } else {
        // analysis_standard or unknown
        chosenModel = "gemini-2.5-flash";
        reason = userFriendlyReasons.analysis_standard;
      }
    }
    // Unknown intent
    else {
      chosenModel = "gpt-5-mini";
      reason = "Selected as a reliable default for general-purpose tasks.";
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
  }): Promise<string> {
    const { prompt, chosenModel, intent, category } = params;

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

    // Provide context hints based on intent/category to guide the explanation
    const taskHints: Record<string, string> = {
      coding_quick: "quick code generation or simple programming tasks",
      coding_review: "code review, refactoring, or explaining existing code",
      coding_debug: "debugging, troubleshooting, or analyzing errors",
      coding_complex_impl: "complex implementations, algorithms, or system design",
      writing_light: "quick writing, summaries, or casual content",
      writing_standard: "professional writing and standard content",
      writing_high_stakes: "important or nuanced communication",
      analysis_standard: "research, analysis, or answering questions",
      analysis_complex: "deep analysis and complex reasoning",
    };

    const taskHint = taskHints[category] || "general tasks";

    const explanationPrompt = `Write ONE short sentence (max 15 words) explaining why ${modelDisplayName} is a good fit for the user's request below.

Guidelines:
- Focus on what makes the model suitable for THIS specific task
- Mention relevant strengths: speed, accuracy, code quality, writing clarity, debugging ability, or reasoning depth
- DO NOT mention: routing, categories, confidence, internal logic, or "based on your prompt"
- DO NOT compare to other models
- Keep tone neutral and matter-of-fact
- Output ONLY the sentence, no quotes, no preamble

Context hint: This is about ${taskHint}

User request: "${prompt.substring(0, 200)}"

Your one-sentence explanation:`;

    try {
      const response = await Promise.race([
        runOpenAI(
          {
            prompt: explanationPrompt,
            maxTokens: 50,
            // Don't set temperature - GPT-5 models use default temp=1
          },
          this.CLASSIFIER_MODEL
        ),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Reason generation timeout")), 5000)
        ),
      ]);

      if (response.error || !response.text) {
        throw new Error("Failed to generate explanation");
      }

      // Clean up the response
      let reason = response.text.trim();
      
      // Remove quotes if present
      reason = reason.replace(/^["']|["']$/g, "");
      
      // Ensure it ends with a period
      if (!reason.endsWith(".") && !reason.endsWith("!") && !reason.endsWith("?")) {
        reason += ".";
      }

      // Ensure it starts with capital letter
      if (reason.length > 0) {
        reason = reason.charAt(0).toUpperCase() + reason.slice(1);
      }

      console.log("Generated routing reason:", reason);

      return reason;
    } catch (err) {
      console.error("Failed to generate routing reason:", err);
      
      // Fallback to a generic but reasonable explanation
      const fallbackReasons: Record<string, string> = {
        coding_quick: "Well-suited for quick programming questions and implementations.",
        coding_review: "Excellent at code review and refactoring tasks.",
        coding_debug: "Strong at debugging and analyzing errors.",
        coding_complex_impl: "Specialized in complex algorithms and system design.",
        writing_light: "Fast and efficient for summaries and casual writing.",
        writing_standard: "Balanced for professional, high-quality writing.",
        writing_high_stakes: "Optimized for nuanced, high-stakes communication.",
        analysis_standard: "Ideal for research and answering questions.",
        analysis_complex: "Strong at deep analysis and complex reasoning.",
      };

      return fallbackReasons[category] || "Selected as the best match for this request.";
    }
  }
}

export const intentRouter = new IntentRouter();
