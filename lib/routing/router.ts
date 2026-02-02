/**
 * Rules-based model router
 * Phase 1: Simple pattern-based routing with explanations
 */

import type { RoutingDecision, RoutingContext } from "./types";

// Available models (using MockProvider, but representing different "models")
const MODELS = {
  FAST: "mock-fast-1",
  BALANCED: "mock-balanced-1",
  QUALITY: "mock-quality-1",
  CODE: "mock-code-1",
  FALLBACK: "mock-balanced-1",
} as const;

export class ModelRouter {
  /**
   * Select the most appropriate model based on prompt analysis
   */
  route(context: RoutingContext): RoutingDecision {
    const { prompt, requestedModel } = context;

    // If a specific model was requested, use it
    if (requestedModel) {
      return {
        model: requestedModel,
        reason: "User requested specific model",
        confidence: "high",
      };
    }

    // Analyze prompt to determine best model
    const promptLower = prompt.toLowerCase();
    const promptLength = prompt.length;

    // Rule 1: Questions and analytical tasks (highest priority)
    if (this.isAnalytical(promptLower)) {
      return {
        model: MODELS.QUALITY,
        reason: "Optimized for analysis and reasoning",
        confidence: "high",
      };
    }

    // Rule 2: Code-related prompts
    if (this.isCodeRelated(promptLower)) {
      return {
        model: MODELS.CODE,
        reason: "Optimized for code generation and technical content",
        confidence: "high",
      };
    }

    // Rule 3: Creative writing
    if (this.isCreative(promptLower)) {
      return {
        model: MODELS.QUALITY,
        reason: "Enhanced for creative and narrative tasks",
        confidence: "high",
      };
    }

    // Rule 4: Long, complex prompts (> 1000 chars) - use quality model
    if (promptLength > 1000) {
      return {
        model: MODELS.QUALITY,
        reason: "Enhanced reasoning for detailed prompt",
        confidence: "high",
      };
    }

    // Rule 5: Very short prompts (< 50 chars) - use fast model
    if (promptLength < 50) {
      return {
        model: MODELS.FAST,
        reason: "Quick response for short prompt",
        confidence: "medium",
      };
    }

    // Fallback: balanced model for general use
    return {
      model: MODELS.FALLBACK,
      reason: "General-purpose model for balanced performance",
      confidence: "low",
    };
  }

  /**
   * Check if prompt is code-related
   */
  private isCodeRelated(prompt: string): boolean {
    const codeKeywords = [
      "code",
      "function",
      "class",
      "algorithm",
      "debug",
      "implement",
      "programming",
      "script",
      "api",
      "database",
      "sql",
      "javascript",
      "python",
      "typescript",
      "react",
      "component",
      "error",
      "bug",
      "refactor",
      "syntax",
    ];

    return codeKeywords.some((keyword) => prompt.includes(keyword));
  }

  /**
   * Check if prompt is analytical
   */
  private isAnalytical(prompt: string): boolean {
    const analyticalKeywords = [
      "analyze",
      "compare",
      "evaluate",
      "explain",
      "why",
      "how",
      "what are the",
      "difference between",
      "pros and cons",
      "advantages",
      "disadvantages",
      "consider",
      "assess",
    ];

    return analyticalKeywords.some((keyword) => prompt.includes(keyword));
  }

  /**
   * Check if prompt is creative
   */
  private isCreative(prompt: string): boolean {
    const creativeKeywords = [
      "write a story",
      "create a",
      "imagine",
      "creative",
      "narrative",
      "poem",
      "song",
      "fiction",
      "character",
      "plot",
      "brainstorm",
      "ideas for",
    ];

    return creativeKeywords.some((keyword) => prompt.includes(keyword));
  }
}

// Singleton instance
export const modelRouter = new ModelRouter();
