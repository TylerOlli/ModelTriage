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

Categories & Models:
coding_quick → claude-sonnet-4-5-20250929
coding_review → claude-opus-4-5-20251101
coding_debug → gpt-5.2
coding_complex_impl → gpt-5.2
writing_light → claude-haiku-4-5-20251001
writing_standard → claude-sonnet-4-5-20250929
writing_high_stakes → claude-opus-4-5-20251101
analysis_standard → gpt-5-mini
analysis_complex → gpt-5.2

Required JSON format:
{
  "intent": "coding|writing|analysis|unknown",
  "category": "<category_from_above>",
  "chosenModel": "<model_from_above>",
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
    const { intent, category, confidence } = classification;
    let chosenModel: ModelId;
    let reason: string;

    // Coding intent routing
    if (intent === "coding") {
      if (confidence < 0.6) {
        chosenModel = "gpt-5-mini";
        reason = "Low-confidence fallback for coding task";
      } else if (category === "coding_quick") {
        chosenModel = "claude-sonnet-4-5-20250929";
        reason = classification.reason || "Quick coding task";
      } else if (category === "coding_review") {
        chosenModel = "claude-opus-4-5-20251101";
        reason = classification.reason || "Code review task";
      } else if (category === "coding_debug") {
        chosenModel = "gpt-5.2";
        reason = classification.reason || "Debugging task";
      } else if (category === "coding_complex_impl") {
        chosenModel = "gpt-5.2";
        reason = classification.reason || "Complex implementation task";
      } else {
        // Unknown coding category
        chosenModel = "gpt-5-mini";
        reason = "Low-confidence fallback for unclear coding category";
      }
    }
    // Writing intent routing
    else if (intent === "writing") {
      if (confidence < 0.6) {
        chosenModel = "claude-sonnet-4-5-20250929";
        reason = "Low-confidence fallback for writing task";
      } else if (category === "writing_light") {
        chosenModel = "claude-haiku-4-5-20251001";
        reason = classification.reason || "Light writing task";
      } else if (category === "writing_standard") {
        chosenModel = "claude-sonnet-4-5-20250929";
        reason = classification.reason || "Standard writing task";
      } else if (category === "writing_high_stakes") {
        chosenModel = "claude-opus-4-5-20251101";
        reason = classification.reason || "High-stakes writing task";
      } else {
        // Unknown writing category
        chosenModel = "claude-sonnet-4-5-20250929";
        reason = "Low-confidence fallback for unclear writing category";
      }
    }
    // Analysis intent routing
    else if (intent === "analysis") {
      if (confidence < 0.6 || category === "analysis_standard") {
        chosenModel = "gpt-5-mini";
        reason =
          confidence < 0.6
            ? "Low-confidence fallback for analysis task"
            : classification.reason || "Standard analysis task";
      } else if (category === "analysis_complex") {
        chosenModel = "gpt-5.2";
        reason = classification.reason || "Complex analysis task";
      } else {
        chosenModel = "gpt-5-mini";
        reason = "Fallback for unclear analysis category";
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
