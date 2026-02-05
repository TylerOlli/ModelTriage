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
coding_quick → claude-sonnet-4-5-20250929 OR gemini-2.5-flash
coding_review → claude-opus-4-5-20251101
coding_debug → gpt-5.2
coding_complex_impl → gpt-5.2 OR gemini-2.5-pro
writing_light → claude-haiku-4-5-20251001 OR gemini-2.5-flash
writing_standard → claude-sonnet-4-5-20250929 OR gemini-2.5-pro
writing_high_stakes → claude-opus-4-5-20251101
analysis_standard → gpt-5-mini OR gemini-2.5-flash
analysis_complex → gpt-5.2 OR gemini-2.5-pro

Required JSON format:
{
  "intent": "coding|writing|analysis|unknown",
  "category": "<category_from_above>",
  "chosenModel": "<exact_model_id_from_above>",
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

    // If classifier returned a valid model and confidence is good, use it
    if (
      confidence >= 0.6 &&
      classifierModel &&
      validModels.includes(classifierModel as ModelId)
    ) {
      chosenModel = classifierModel as ModelId;
      reason = classification.reason || `Selected ${chosenModel} for ${category}`;
    }
    // Fallback logic for low confidence or invalid model
    else if (intent === "coding") {
      chosenModel = "gpt-5-mini";
      reason = "Low-confidence fallback for coding task";
    } else if (intent === "writing") {
      chosenModel = "claude-sonnet-4-5-20250929";
      reason = "Low-confidence fallback for writing task";
    } else if (intent === "analysis") {
      chosenModel = "gpt-5-mini";
      reason = "Low-confidence fallback for analysis task";
    } else {
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
