/**
 * Meaning-based diff analyzer for comparing model responses
 * Produces user-friendly summaries with complete ideas, not word lists
 */

import type { ModelResponse, DiffSummary, ModelDifferences } from "./types";

interface Claim {
  text: string;
  model: string;
  normalized: string;
}

interface ClaimCluster {
  claims: Claim[];
  models: Set<string>;
  representativeText: string;
}

export class DiffAnalyzer {
  private readonly MAX_COMMON_GROUND = 5;
  private readonly MAX_KEY_DIFFERENCES_PER_MODEL = 3;
  private readonly MAX_NOTABLE_GAPS = 4;
  private readonly MIN_CLAIM_LENGTH = 20;
  private readonly SIMILARITY_THRESHOLD = 0.3;

  /**
   * Generate a meaning-based diff summary from multiple model responses
   */
  analyze(responses: ModelResponse[]): DiffSummary {
    if (responses.length < 2) {
      return {
        commonGround: [],
        keyDifferences: [],
        notableGaps: [],
      };
    }

    // Extract claims (sentences/ideas) from each model
    const allClaims = responses.flatMap((r) =>
      this.extractClaims(r.content, r.model)
    );

    if (allClaims.length === 0) {
      return {
        commonGround: [],
        keyDifferences: [],
        notableGaps: [],
      };
    }

    // Cluster similar claims
    const clusters = this.clusterClaims(allClaims);

    // Generate summary sections
    const commonGround = this.generateCommonGround(clusters, responses.length);
    const keyDifferences = this.generateKeyDifferences(clusters, responses);
    const notableGaps = this.generateNotableGaps(responses, clusters);

    return {
      commonGround,
      keyDifferences,
      notableGaps,
    };
  }

  /**
   * Extract meaningful claims (sentences or clauses) from text
   */
  private extractClaims(text: string, model: string): Claim[] {
    // Split into sentences
    const sentences = text
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= this.MIN_CLAIM_LENGTH);

    // Further split long sentences by common conjunctions/delimiters
    const claims: Claim[] = [];
    for (const sentence of sentences) {
      // Split on semicolons, em dashes, or "however", "but", etc.
      const parts = sentence.split(/[;—]|(?:\s+(?:however|but|though|although)\s+)/i);

      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.length >= this.MIN_CLAIM_LENGTH) {
          claims.push({
            text: trimmed,
            model,
            normalized: this.normalizeClaim(trimmed),
          });
        }
      }
    }

    return claims;
  }

  /**
   * Normalize a claim for comparison (lowercase, remove extra whitespace, etc.)
   */
  private normalizeClaim(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Calculate similarity between two normalized claims using Jaccard similarity
   */
  private calculateSimilarity(claim1: string, claim2: string): number {
    const words1 = new Set(claim1.split(" "));
    const words2 = new Set(claim2.split(" "));

    const intersection = new Set([...words1].filter((w) => words2.has(w)));
    const union = new Set([...words1, ...words2]);

    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  /**
   * Cluster similar claims together
   */
  private clusterClaims(claims: Claim[]): ClaimCluster[] {
    const clusters: ClaimCluster[] = [];
    const processed = new Set<number>();

    for (let i = 0; i < claims.length; i++) {
      if (processed.has(i)) continue;

      const cluster: ClaimCluster = {
        claims: [claims[i]],
        models: new Set([claims[i].model]),
        representativeText: claims[i].text,
      };

      // Find similar claims
      for (let j = i + 1; j < claims.length; j++) {
        if (processed.has(j)) continue;

        const similarity = this.calculateSimilarity(
          claims[i].normalized,
          claims[j].normalized
        );

        if (similarity >= this.SIMILARITY_THRESHOLD) {
          cluster.claims.push(claims[j]);
          cluster.models.add(claims[j].model);
          processed.add(j);

          // Use the shortest claim as representative (usually clearer)
          if (claims[j].text.length < cluster.representativeText.length) {
            cluster.representativeText = claims[j].text;
          }
        }
      }

      clusters.push(cluster);
      processed.add(i);
    }

    return clusters;
  }

  /**
   * Generate "Common Ground" section - ideas mentioned by most/all models
   */
  private generateCommonGround(
    clusters: ClaimCluster[],
    totalModels: number
  ): string[] {
    // Filter clusters that appear in at least half of the models
    const threshold = Math.max(2, Math.ceil(totalModels / 2));
    const commonClusters = clusters
      .filter((c) => c.models.size >= threshold)
      .sort((a, b) => b.models.size - a.models.size) // Sort by number of models
      .slice(0, this.MAX_COMMON_GROUND);

    return commonClusters.map((cluster) => {
      const text = this.formatClaimAsBullet(cluster.representativeText);
      const modelList =
        cluster.models.size === totalModels
          ? "all models"
          : `${cluster.models.size}/${totalModels} models`;
      return `${text} (${modelList})`;
    });
  }

  /**
   * Generate "Key Differences" section - unique contributions per model
   */
  private generateKeyDifferences(
    clusters: ClaimCluster[],
    responses: ModelResponse[]
  ): ModelDifferences[] {
    const differences: ModelDifferences[] = [];

    for (const response of responses) {
      // Find clusters unique to this model (or mentioned by very few models)
      const uniqueClusters = clusters
        .filter(
          (c) =>
            c.models.has(response.model) &&
            (c.models.size === 1 || c.models.size <= 2)
        )
        .sort((a, b) => {
          // Prioritize truly unique (size 1) over shared with one other
          if (a.models.size !== b.models.size) {
            return a.models.size - b.models.size;
          }
          // Then by claim length (prefer substantial claims)
          return b.representativeText.length - a.representativeText.length;
        })
        .slice(0, this.MAX_KEY_DIFFERENCES_PER_MODEL);

      if (uniqueClusters.length > 0) {
        const points = uniqueClusters.map((cluster) =>
          this.formatClaimAsBullet(cluster.representativeText)
        );

        differences.push({
          model: this.formatModelName(response.model),
          points,
        });
      }
    }

    return differences;
  }

  /**
   * Generate "Notable Gaps" section - missing aspects or weak points
   */
  private generateNotableGaps(
    responses: ModelResponse[],
    clusters: ClaimCluster[]
  ): string[] {
    const gaps: string[] = [];

    // Check for significant length variance
    const lengths = responses.map((r) => r.content.length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const maxDiff = Math.max(...lengths) - Math.min(...lengths);

    if (maxDiff > avgLength * 0.5) {
      const shortestModel = responses.reduce((min, r) =>
        r.content.length < min.content.length ? r : min
      );
      gaps.push(
        `${this.formatModelName(shortestModel.model)} provides notably less detail than other models`
      );
    }

    // Check for models missing common topics - be specific about what's missing
    const commonClusters = clusters.filter(
      (c) => c.models.size >= Math.ceil(responses.length / 2)
    );

    for (const response of responses) {
      const missingTopics = commonClusters.filter(
        (c) => !c.models.has(response.model)
      );

      if (missingTopics.length >= 2) {
        // Show specific example of what's missing
        const exampleTopic = this.formatClaimAsBullet(
          missingTopics[0].representativeText
        );
        const topicPreview = exampleTopic.substring(0, 50);
        
        gaps.push(
          `${this.formatModelName(response.model)} skips topics like "${topicPreview}..." covered by other models`
        );
      }
    }

    // Check for conflicting approaches
    const hasStepByStep = responses.some((r) =>
      /step[s]?[\s:]/i.test(r.content)
    );
    const hasHighLevel = responses.some(
      (r) => r.content.length < avgLength * 0.7
    );

    if (hasStepByStep && hasHighLevel && responses.length >= 2) {
      gaps.push(
        "Models vary in approach: some provide step-by-step details while others focus on high-level concepts"
      );
    }

    return gaps.slice(0, this.MAX_NOTABLE_GAPS);
  }

  /**
   * Format a claim as a bullet point (ensure it reads well)
   */
  private formatClaimAsBullet(text: string): string {
    // Ensure first letter is capitalized
    let formatted = text.charAt(0).toUpperCase() + text.slice(1);

    // Remove trailing punctuation if present
    formatted = formatted.replace(/[.!?]+$/, "");

    // Trim to reasonable length if too long
    if (formatted.length > 150) {
      formatted = formatted.substring(0, 147) + "...";
    }

    return formatted;
  }

  /**
   * Format model name for display
   */
  private formatModelName(model: string): string {
    // Convert "gpt-5-mini" to "GPT-5 Mini", "claude-sonnet-4-5-20250929" to "Claude Sonnet"
    if (model.startsWith("gpt-")) {
      return model
        .split("-")
        .map((p, i) => (i === 0 ? p.toUpperCase() : p))
        .join("-")
        .replace(/-(\d)/, "-$1");
    }

    if (model.startsWith("claude-")) {
      const parts = model.split("-");
      // Extract model type (opus, sonnet, haiku)
      const type = parts.find((p) =>
        ["opus", "sonnet", "haiku"].includes(p.toLowerCase())
      );
      return type
        ? `Claude ${type.charAt(0).toUpperCase()}${type.slice(1)}`
        : "Claude";
    }

    return model;
  }
}

export const diffAnalyzer = new DiffAnalyzer();
