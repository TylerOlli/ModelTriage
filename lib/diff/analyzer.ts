/**
 * Natural language comparison summary generator for model responses
 * Uses LLM to produce human-readable summaries focused on ideas, not text diffs
 */

import type { ModelResponse, DiffSummary, ModelDifferences } from "./types";
import { routeToProvider } from "../llm/router";
import type { LLMRequest } from "../llm/types";

export class DiffAnalyzer {
  private readonly MAX_RESPONSE_LENGTH_PER_MODEL = 3000; // Truncate long responses to fit in LLM context
  private readonly SUMMARY_MAX_TOKENS = 400; // Output tokens for summary
  private readonly SUMMARY_TIMEOUT_MS = 12000;

  /**
   * Generate a natural-language comparison summary using an LLM
   */
  async analyze(responses: ModelResponse[]): Promise<DiffSummary> {
    if (responses.length < 2) {
      return {
        commonGround: [],
        keyDifferences: [],
        notableGaps: [],
      };
    }

    try {
      // Truncate responses if needed to avoid context overflow
      const truncatedResponses = responses.map((r) => ({
        model: r.model,
        content:
          r.content.length > this.MAX_RESPONSE_LENGTH_PER_MODEL
            ? r.content.substring(0, this.MAX_RESPONSE_LENGTH_PER_MODEL) + "..."
            : r.content,
      }));

      // Build prompt for summary generation
      const summaryPrompt = this.buildSummaryPrompt(truncatedResponses);

      // Call LLM to generate summary
      const llmRequest: LLMRequest = {
        prompt: summaryPrompt,
        temperature: 0.0,
        maxTokens: this.SUMMARY_MAX_TOKENS,
      };

      // Use Claude Haiku for fast, cheap, reliable summary generation
      // (GPT-5-mini has issues with reasoning tokens consuming output budget)
      const response = await Promise.race([
        routeToProvider("claude-haiku-4-5-20251001", llmRequest),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Summary generation timeout")),
            this.SUMMARY_TIMEOUT_MS
          )
        ),
      ]);

      console.log("Summary LLM response:", {
        hasText: !!response.text,
        textLength: response.text?.length || 0,
        hasError: !!response.error,
        error: response.error,
        model: response.model,
        latencyMs: response.latencyMs,
      });

      // Check for errors first
      if (response.error) {
        throw new Error(`LLM error: ${response.error}`);
      }

      if (!response.text || response.text.trim().length === 0) {
        throw new Error("No summary text received from LLM");
      }

      // Parse the LLM response into structured sections
      return this.parseSummaryResponse(response.text, responses);
    } catch (err) {
      console.error("Failed to generate comparison summary:", err);
      console.error("Error details:", {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      // Return fallback summary
      return this.generateFallbackSummary(responses);
    }
  }

  /**
   * Build the prompt for the LLM to generate a comparison summary
   */
  private buildSummaryPrompt(responses: ModelResponse[]): string {
    const modelNames = responses.map((r) => this.formatModelName(r.model));
    const responsesText = responses
      .map(
        (r, i) =>
          `[Response ${i + 1} - ${this.formatModelName(r.model)}]\n${r.content}`
      )
      .join("\n\n---\n\n");

    return `You are comparing ${responses.length} AI model responses to the same user prompt. Your task is to create a concise, natural-language comparison summary.

Models being compared: ${modelNames.join(", ")}

${responsesText}

---

Create a comparison summary with exactly 3 sections:

1) Common Ground (2-5 bullet points)
Write natural language statements of what most or all models agree on. Focus on shared ideas, recommendations, or approaches. Do NOT quote verbatim; paraphrase the shared concepts.

2) Key Differences (grouped by model, 1-3 points per model)
For each model that has unique emphasis or a different approach, explain what it uniquely contributed. Use plain language. If a model includes code examples or specific configurations, describe them briefly (e.g. "includes a sample tsconfig") rather than copying the code. Focus on themes like: setup/tooling, strategy, migration order, depth of examples, framework-specific details.

3) Notable Gaps (1-4 bullet points)
Identify important topics that one or more models failed to cover or covered weakly. Be specific about what concept is missing, not just "model X omits details."

Rules:
- Write in plain, human language
- Avoid quoting more than 10 words from any response
- NO code blocks or JSON fragments in the summary
- Be concise but informative
- Do not mention routing, confidence, or that this is AI-generated
- Each bullet must be a complete thought

Format your response exactly as:

Common Ground:
- [statement]
- [statement]
...

Key Differences:
${modelNames.map((name) => `${name}:\n- [statement]\n- [statement]`).join("\n\n")}

Notable Gaps:
- [statement]
- [statement]
...`;
  }

  /**
   * Parse the LLM summary response into structured format
   */
  private parseSummaryResponse(
    summaryText: string,
    responses: ModelResponse[]
  ): DiffSummary {
    const lines = summaryText.split("\n").map((l) => l.trim());

    const commonGround: string[] = [];
    const keyDifferences: ModelDifferences[] = [];
    const notableGaps: string[] = [];

    let currentSection: "common" | "differences" | "gaps" | null = null;
    let currentModel: string | null = null;
    let currentModelPoints: string[] = [];

    for (const line of lines) {
      // Detect section headers
      if (/^Common Ground:?$/i.test(line)) {
        currentSection = "common";
        continue;
      } else if (/^Key Differences:?$/i.test(line)) {
        currentSection = "differences";
        // Flush previous model if any
        if (currentModel && currentModelPoints.length > 0) {
          keyDifferences.push({
            model: currentModel,
            points: [...currentModelPoints],
          });
          currentModelPoints = [];
        }
        continue;
      } else if (/^Notable Gaps:?$/i.test(line)) {
        currentSection = "gaps";
        // Flush previous model if any
        if (currentModel && currentModelPoints.length > 0) {
          keyDifferences.push({
            model: currentModel,
            points: [...currentModelPoints],
          });
          currentModelPoints = [];
          currentModel = null;
        }
        continue;
      }

      // Skip empty lines
      if (line.length === 0) continue;

      // In Key Differences section, detect model names
      if (currentSection === "differences") {
        // Check if line is a model name (e.g., "GPT-5 Mini:" or "Claude Sonnet:")
        const modelMatch = line.match(/^([A-Z][\w\s.-]+):$/);
        if (modelMatch) {
          // Flush previous model
          if (currentModel && currentModelPoints.length > 0) {
            keyDifferences.push({
              model: currentModel,
              points: [...currentModelPoints],
            });
            currentModelPoints = [];
          }
          currentModel = modelMatch[1].trim();
          continue;
        }
      }

      // Parse bullet points
      const bulletMatch = line.match(/^[-•*]\s*(.+)$/);
      if (bulletMatch) {
        const content = bulletMatch[1].trim();
        if (content.length > 0) {
          if (currentSection === "common") {
            commonGround.push(content);
          } else if (currentSection === "differences" && currentModel) {
            currentModelPoints.push(content);
          } else if (currentSection === "gaps") {
            notableGaps.push(content);
          }
        }
      }
    }

    // Flush final model in Key Differences
    if (currentModel && currentModelPoints.length > 0) {
      keyDifferences.push({
        model: currentModel,
        points: [...currentModelPoints],
      });
    }

    // Validate and cap lengths
    return {
      commonGround: commonGround.slice(0, 5),
      keyDifferences: keyDifferences.map((d) => ({
        model: d.model,
        points: d.points.slice(0, 3),
      })),
      notableGaps: notableGaps.slice(0, 4),
    };
  }

  /**
   * Generate a simple fallback summary if LLM call fails
   */
  private generateFallbackSummary(responses: ModelResponse[]): DiffSummary {
    const modelNames = responses.map((r) => this.formatModelName(r.model));

    return {
      commonGround: [
        `All ${responses.length} models provided responses to the prompt`,
      ],
      keyDifferences: responses.map((r) => ({
        model: this.formatModelName(r.model),
        points: [
          r.content.length > 1000
            ? "Provides detailed, comprehensive response"
            : "Provides concise response",
        ],
      })),
      notableGaps: [
        "Comparison summary could not be generated automatically. Review individual responses above.",
      ],
    };
  }

  /**
   * Format model name for display
   */
  private formatModelName(model: string): string {
    // Convert "gpt-5-mini" to "GPT-5 Mini"
    if (model.startsWith("gpt-")) {
      const parts = model.split("-");
      return parts
        .map((p, i) => {
          if (i === 0) return p.toUpperCase();
          if (/^\d/.test(p)) return p; // numbers stay as-is
          return p.charAt(0).toUpperCase() + p.slice(1);
        })
        .join(" ");
    }

    // Convert "claude-sonnet-4-5-20250929" to "Claude Sonnet"
    if (model.startsWith("claude-")) {
      const parts = model.split("-");
      const type = parts.find((p) =>
        ["opus", "sonnet", "haiku"].includes(p.toLowerCase())
      );
      return type
        ? `Claude ${type.charAt(0).toUpperCase()}${type.slice(1)}`
        : "Claude";
    }

    // Convert "gemini-2.5-flash" to "Gemini 2.5 Flash"
    if (model.startsWith("gemini-")) {
      const parts = model.split("-");
      return parts
        .map((p, i) => {
          if (i === 0) return p.charAt(0).toUpperCase() + p.slice(1);
          return p.charAt(0).toUpperCase() + p.slice(1);
        })
        .join(" ");
    }

    return model;
  }
}

export const diffAnalyzer = new DiffAnalyzer();
