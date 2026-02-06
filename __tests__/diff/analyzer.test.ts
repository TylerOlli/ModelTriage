/**
 * Unit tests for LLM-based comparison summary generator
 */

import { diffAnalyzer } from "@/lib/diff";
import type { ModelResponse } from "@/lib/diff/types";

async function runTests() {
  console.log("Running DiffAnalyzer tests (LLM-based natural language summaries)...\n");

  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: Generates valid summary structure
  try {
    console.log("Test 1: Generates valid summary structure");
    const responses: ModelResponse[] = [
      {
        model: "gpt-5-mini",
        content:
          "To migrate from JavaScript to TypeScript, start by renaming .js files to .ts. Install TypeScript with npm install -D typescript. Initialize a tsconfig.json with tsc --init. Enable strict mode for best results. Gradually add type annotations to your code.",
      },
      {
        model: "claude-sonnet-4-5-20250929",
        content:
          "JavaScript to TypeScript migration should be incremental. First, install TypeScript as a dev dependency. Create a tsconfig.json with sensible defaults like strict: true and esModuleInterop: true. Rename files one module at a time. Use any types initially if needed, then tighten them. Run tsc --noEmit to check types without building.",
      },
    ];

    const summary = await diffAnalyzer.analyze(responses);

    // Check structure
    if (!Array.isArray(summary.commonGround)) {
      throw new Error("commonGround is not an array");
    }
    if (!Array.isArray(summary.keyDifferences)) {
      throw new Error("keyDifferences is not an array");
    }
    if (!Array.isArray(summary.notableGaps)) {
      throw new Error("notableGaps is not an array");
    }

    console.log("  ✓ Summary has correct structure");
    console.log(`  Common Ground: ${summary.commonGround.length} items`);
    console.log(`  Key Differences: ${summary.keyDifferences.length} models`);
    console.log(`  Notable Gaps: ${summary.notableGaps.length} items\n`);
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 2: Respects max limits
  try {
    console.log("Test 2: Respects max limits (2-5 common, 1-3 per model, 1-4 gaps)");
    const responses: ModelResponse[] = [
      {
        model: "gpt-5-mini",
        content: "A".repeat(500) + " TypeScript provides type safety and better tooling.",
      },
      {
        model: "claude-sonnet-4-5-20250929",
        content: "B".repeat(500) + " TypeScript improves code quality and maintainability.",
      },
    ];

    const summary = await diffAnalyzer.analyze(responses);

    if (summary.commonGround.length > 5) {
      throw new Error(`Common Ground exceeds max (${summary.commonGround.length} > 5)`);
    }

    for (const diff of summary.keyDifferences) {
      if (diff.points.length > 3) {
        throw new Error(`Key Differences for ${diff.model} exceeds max (${diff.points.length} > 3)`);
      }
    }

    if (summary.notableGaps.length > 4) {
      throw new Error(`Notable Gaps exceeds max (${summary.notableGaps.length} > 4)`);
    }

    console.log("  ✓ All sections respect max limits\n");
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 3: No large code blocks in summary
  try {
    console.log("Test 3: No large code blocks in summary");
    const responses: ModelResponse[] = [
      {
        model: "gpt-5-mini",
        content: `Here's how to set up TypeScript:
\`\`\`json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true
  }
}
\`\`\`
This config enables strict mode.`,
      },
      {
        model: "claude-sonnet-4-5-20250929",
        content: "For TypeScript setup, create a tsconfig.json with strict mode enabled. Use ES2020 as the target.",
      },
    ];

    const summary = await diffAnalyzer.analyze(responses);

    const allText = [
      ...summary.commonGround,
      ...summary.keyDifferences.flatMap((d) => d.points),
      ...summary.notableGaps,
    ].join(" ");

    // Check for code blocks (triple backticks or excessive curly braces/brackets)
    const hasCodeBlock = /```/.test(allText) || /\{[^}]{50,}\}/.test(allText);

    if (hasCodeBlock) {
      throw new Error("Summary contains code blocks or large JSON fragments");
    }

    console.log("  ✓ No code blocks found in summary\n");
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 4: Handles insufficient responses gracefully
  try {
    console.log("Test 4: Handles insufficient responses (< 2) gracefully");
    const responses: ModelResponse[] = [
      {
        model: "gpt-5-mini",
        content: "TypeScript is great.",
      },
    ];

    const summary = await diffAnalyzer.analyze(responses);

    if (
      summary.commonGround.length !== 0 ||
      summary.keyDifferences.length !== 0 ||
      summary.notableGaps.length !== 0
    ) {
      throw new Error("Summary should be empty for < 2 responses");
    }

    console.log("  ✓ Returns empty summary for insufficient responses\n");
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 5: Produces natural language (no word lists)
  try {
    console.log("Test 5: Produces natural language, not word lists");
    const responses: ModelResponse[] = [
      {
        model: "gpt-5-mini",
        content: "Use TypeScript for type safety, better IDE support, and early error detection.",
      },
      {
        model: "claude-sonnet-4-5-20250929",
        content: "TypeScript provides static typing, improved refactoring, and enhanced code quality.",
      },
    ];

    const summary = await diffAnalyzer.analyze(responses);

    const allText = [
      ...summary.commonGround,
      ...summary.keyDifferences.flatMap((d) => d.points),
      ...summary.notableGaps,
    ].join(" ");

    // Should not have patterns like "word1, word2, word3, word4" (comma-separated lists)
    const hasWordList = /\b\w+\s*,\s*\w+\s*,\s*\w+\s*,\s*\w+/.test(allText);

    if (hasWordList) {
      throw new Error("Summary contains comma-separated word lists");
    }

    console.log("  ✓ Summary uses natural language\n");
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Summary
  console.log("=".repeat(50));
  console.log(`Tests passed: ${testsPassed}`);
  console.log(`Tests failed: ${testsFailed}`);
  console.log("=".repeat(50));

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test runner failed:", err);
  process.exit(1);
});
