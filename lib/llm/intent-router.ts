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
   */
  async route(prompt: string): Promise<RoutingDecision> {
    try {
      // Stage 1: Intent detection using classifier
      const classification = await this.classifyIntent(prompt);

      // Stage 2: Specialized routing based on intent + category
      const decision = this.routeByCategory(classification);

      return decision;
    } catch (err) {
      console.error("Classifier failed:", err);
      // Fallback to gpt-5-mini on classifier failure
      return {
        intent: "unknown",
        category: "router_fallback",
        chosenModel: "gpt-5-mini",
        confidence: 0,
        reason: "Router fallback due to classifier error",
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

    // Safety: if confidence < 0.5, always default to gpt-5-mini
    if (confidence < 0.5) {
      chosenModel = "gpt-5-mini";
      reason = `Very low confidence (${confidence.toFixed(2)}), using safe default model`;
      return { intent, category, chosenModel, confidence, reason };
    }

    // If classifier returned a valid model and confidence is acceptable, use it
    if (
      confidence >= 0.6 &&
      classifierModel &&
      validModels.includes(classifierModel as ModelId)
    ) {
      chosenModel = classifierModel as ModelId;
      reason = classification.reason || `Selected ${chosenModel} for ${category}`;
      return { intent, category, chosenModel, confidence, reason };
    }

    // Fallback logic for low confidence (0.5 <= confidence < 0.6) or invalid model
    // Use cost-aware alternatives with Gemini included

    // Coding intent routing
    if (intent === "coding") {
      if (category === "coding_quick") {
        chosenModel = "gemini-2.5-flash";
        reason = "Low-confidence fallback for quick coding task (cost-aware)";
      } else if (category === "coding_review") {
        chosenModel = "gemini-2.5-pro";
        reason = "Low-confidence fallback for code review";
      } else if (category === "coding_debug") {
        chosenModel = "gemini-2.5-pro";
        reason = "Low-confidence fallback for debugging";
      } else if (category === "coding_complex_impl") {
        chosenModel = "gemini-2.5-pro";
        reason = "Low-confidence fallback for complex implementation";
      } else {
        // Unknown coding category
        chosenModel = "gemini-2.5-flash";
        reason = "General fallback for unclear coding category";
      }
    }
    // Writing intent routing
    else if (intent === "writing") {
      if (category === "writing_light") {
        chosenModel = "gemini-2.5-flash";
        reason = "Low-confidence fallback for light writing (cost-aware)";
      } else if (category === "writing_standard") {
        chosenModel = "gemini-2.5-pro";
        reason = "Low-confidence fallback for standard writing";
      } else if (category === "writing_high_stakes") {
        chosenModel = "gemini-2.5-pro";
        reason = "Low-confidence fallback for high-stakes writing";
      } else {
        // Unknown writing category
        chosenModel = "gemini-2.5-flash";
        reason = "General fallback for unclear writing category";
      }
    }
    // Analysis intent routing
    else if (intent === "analysis") {
      if (category === "analysis_complex") {
        chosenModel = "gemini-2.5-pro";
        reason = "Low-confidence fallback for complex analysis";
      } else {
        // analysis_standard or unknown
        chosenModel = "gemini-2.5-flash";
        reason = "Low-confidence fallback for standard analysis (cost-aware)";
      }
    }
    // Unknown intent
    else {
      chosenModel = "gpt-5-mini";
      reason = "Unknown intent, using general-purpose model";
    }

    return {
      intent,
      category,
      chosenModel,
      confidence,
      reason,
    };
  }
}

export const intentRouter = new IntentRouter();
