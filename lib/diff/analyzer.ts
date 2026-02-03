/**
 * Simple diff analyzer for comparing model responses
 * MVP: Basic text comparison for agreement/disagreement
 */

import type { ModelResponse, DiffSummary } from "./types";

export class DiffAnalyzer {
  /**
   * Generate a diff summary from multiple model responses
   */
  analyze(responses: ModelResponse[]): DiffSummary {
    if (responses.length < 2) {
      return {
        agreement: [],
        disagreement: [],
        omissions: [],
        conflictingAssumptions: [],
      };
    }

    const summary: DiffSummary = {
      agreement: [],
      disagreement: [],
      omissions: [],
      conflictingAssumptions: [],
    };

    // Simple word-based comparison
    const allWords = responses.map((r) => this.extractWords(r.content));
    const commonWords = this.findCommonWords(allWords);
    const uniqueWords = this.findUniqueWords(allWords);

    // Agreement: concepts present in all responses
    if (commonWords.length > 0) {
      const allCommonWords = commonWords.join(", ");
      summary.agreement.push(
        `All models mention similar concepts: ${allCommonWords}`
      );
    }

    // Disagreement: unique content per model
    uniqueWords.forEach((unique, idx) => {
      if (unique.length > 0) {
        const allUniqueWords = unique.join(", ");
        summary.disagreement.push(
          `${responses[idx].model} uniquely mentions: ${allUniqueWords}`
        );
      }
    });

    // Length-based analysis
    const lengths = responses.map((r) => r.content.length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.some((len) => Math.abs(len - avgLength) > avgLength * 0.3);

    if (variance) {
      summary.omissions.push(
        "Response lengths vary significantly - some models may be more concise or detailed"
      );
    }

    // Check for conflicting statements (simple heuristic)
    const hasNegation = responses.some((r) => 
      r.content.toLowerCase().includes("not ") || 
      r.content.toLowerCase().includes("never ") ||
      r.content.toLowerCase().includes("don't ")
    );
    
    const hasAffirmation = responses.some((r) => 
      r.content.toLowerCase().includes("yes") || 
      r.content.toLowerCase().includes("always") ||
      r.content.toLowerCase().includes("must")
    );

    if (hasNegation && hasAffirmation && responses.length >= 2) {
      summary.conflictingAssumptions.push(
        "Models may have different positions - review for potential contradictions"
      );
    }

    return summary;
  }

  /**
   * Extract meaningful words from text
   */
  private extractWords(text: string): string[] {
    // Simple tokenization - remove common words
    const stopWords = new Set([
      "the", "is", "a", "an", "and", "or", "but", "in", "on", "at",
      "to", "for", "of", "with", "by", "this", "that", "are", "was",
    ]);

    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3 && !stopWords.has(word));
  }

  /**
   * Find words common to all responses
   */
  private findCommonWords(wordSets: string[][]): string[] {
    if (wordSets.length === 0) return [];

    const firstSet = new Set(wordSets[0]);
    const common: string[] = [];

    for (const word of firstSet) {
      if (wordSets.every((ws) => ws.includes(word))) {
        common.push(word);
      }
    }

    return common;
  }

  /**
   * Find words unique to each response
   */
  private findUniqueWords(wordSets: string[][]): string[][] {
    return wordSets.map((words, idx) => {
      const otherWords = new Set(
        wordSets
          .filter((_, i) => i !== idx)
          .flat()
      );

      return words.filter((word) => !otherWords.has(word));
    });
  }
}

export const diffAnalyzer = new DiffAnalyzer();
