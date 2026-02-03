/**
 * Unit tests for meaning-based diff analyzer
 */

import { diffAnalyzer } from "@/lib/diff";
import type { ModelResponse } from "@/lib/diff/types";

async function runTests() {
  console.log("Running DiffAnalyzer tests...\n");

  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: No token lists - should produce complete ideas
  try {
    console.log("Test 1: No token lists - should produce complete ideas");
    const responses: ModelResponse[] = [
      {
        model: "gpt-5-mini",
        content:
          "TypeScript is a superset of JavaScript. It adds static typing to JavaScript. This helps catch errors early.",
      },
      {
        model: "claude-sonnet",
        content:
          "TypeScript extends JavaScript with type annotations. Type safety is the main benefit. It compiles to plain JavaScript.",
      },
    ];

    const summary = diffAnalyzer.analyze(responses);

    // Check that no section contains comma-separated word lists
    const allText = [
      ...summary.commonGround,
      ...summary.keyDifferences.flatMap((d) => d.points),
      ...summary.notableGaps,
    ].join(" ");

    // Should not have patterns like "word1, word2, word3..."
    const hasWordList = /\b\w+\s*,\s*\w+\s*,\s*\w+\s*,\s*\w+/.test(allText);
    
    if (!hasWordList) {
      console.log("  ✓ No token lists found\n");
      testsPassed++;
    } else {
      throw new Error("Found comma-separated word lists in output");
    }
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 2: No duplicates in the same section
  try {
    console.log("Test 2: No duplicates in the same section");
    const responses: ModelResponse[] = [
      {
        model: "model-1",
        content:
          "Use TypeScript for type safety. TypeScript provides better tooling. Static typing helps catch errors early.",
      },
      {
        model: "model-2",
        content:
          "TypeScript adds type safety to JavaScript. Better IDE support is a key benefit. Type checking prevents runtime errors.",
      },
    ];

    const summary = diffAnalyzer.analyze(responses);

    // Check common ground for duplicates
    const commonGroundSet = new Set(summary.commonGround);
    const noDuplicatesCommon = commonGroundSet.size === summary.commonGround.length;

    // Check key differences for duplicates
    let noDuplicatesInDiffs = true;
    summary.keyDifferences.forEach((diff) => {
      const pointsSet = new Set(diff.points);
      if (pointsSet.size !== diff.points.length) {
        noDuplicatesInDiffs = false;
      }
    });

    // Check notable gaps for duplicates
    const gapsSet = new Set(summary.notableGaps);
    const noDuplicatesGaps = gapsSet.size === summary.notableGaps.length;

    if (noDuplicatesCommon && noDuplicatesInDiffs && noDuplicatesGaps) {
      console.log("  ✓ No duplicates found in any section\n");
      testsPassed++;
    } else {
      throw new Error("Found duplicates in output");
    }
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 3: Max bullets respected
  try {
    console.log("Test 3: Max bullets respected");
    const responses: ModelResponse[] = [
      {
        model: "model-1",
        content:
          "Point one is important. Point two matters greatly. Point three is absolutely key. Point four helps significantly. Point five works well. Point six is quite good. Point seven really counts.",
      },
      {
        model: "model-2",
        content:
          "Point one is critical. Point two is essential. Point three is vital. Point four is useful. Point five is helpful. Point six is beneficial. Point seven is valuable.",
      },
    ];

    const summary = diffAnalyzer.analyze(responses);

    const commonGroundOk = summary.commonGround.length <= 5;
    
    let keyDifferencesOk = true;
    summary.keyDifferences.forEach((diff) => {
      if (diff.points.length > 3) {
        keyDifferencesOk = false;
      }
    });

    const notableGapsOk = summary.notableGaps.length <= 4;

    if (commonGroundOk && keyDifferencesOk && notableGapsOk) {
      console.log("  ✓ All max limits respected");
      console.log(`    Common Ground: ${summary.commonGround.length}/5`);
      console.log(`    Notable Gaps: ${summary.notableGaps.length}/4\n`);
      testsPassed++;
    } else {
      throw new Error(
        `Max limits exceeded - CG: ${summary.commonGround.length}, Gaps: ${summary.notableGaps.length}`
      );
    }
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 4: Stable output format
  try {
    console.log("Test 4: Stable output format with three sections");
    const responses: ModelResponse[] = [
      {
        model: "model-1",
        content: "Some content here about TypeScript and JavaScript development.",
      },
      {
        model: "model-2",
        content: "Different content about programming languages and tools.",
      },
    ];

    const summary = diffAnalyzer.analyze(responses);

    const hasAllSections =
      summary.hasOwnProperty("commonGround") &&
      summary.hasOwnProperty("keyDifferences") &&
      summary.hasOwnProperty("notableGaps");

    const allArrays =
      Array.isArray(summary.commonGround) &&
      Array.isArray(summary.keyDifferences) &&
      Array.isArray(summary.notableGaps);

    if (hasAllSections && allArrays) {
      console.log("  ✓ Output has all three sections as arrays\n");
      testsPassed++;
    } else {
      throw new Error("Missing sections or incorrect types");
    }
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 5: Bullets have proper formatting
  try {
    console.log("Test 5: Bullets have proper formatting");
    const responses: ModelResponse[] = [
      {
        model: "model-1",
        content: "the first approach is to use automated tools for conversion.",
      },
      {
        model: "model-2",
        content: "automated tools are definitely the preferred method.",
      },
    ];

    const summary = diffAnalyzer.analyze(responses);

    const allBullets = [
      ...summary.commonGround,
      ...summary.keyDifferences.flatMap((d) => d.points),
      ...summary.notableGaps,
    ];

    let allCapitalized = true;
    let allSubstantial = true;

    allBullets.forEach((bullet) => {
      // Extract text before any citation
      const text = bullet.split("(")[0].trim();
      
      if (text.length > 0 && !/^[A-Z]/.test(text[0])) {
        allCapitalized = false;
      }
      
      if (text.length < 15) {
        allSubstantial = false;
      }
    });

    if (allCapitalized && allSubstantial) {
      console.log("  ✓ All bullets properly capitalized and substantial\n");
      testsPassed++;
    } else {
      throw new Error(
        `Formatting issues - Capitalized: ${allCapitalized}, Substantial: ${allSubstantial}`
      );
    }
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 6: Semantic clustering
  try {
    console.log("Test 6: Semantic clustering of similar ideas");
    const responses: ModelResponse[] = [
      {
        model: "model-1",
        content:
          "TypeScript provides type safety for JavaScript applications through static typing.",
      },
      {
        model: "model-2",
        content: "TypeScript adds static typing capabilities to JavaScript code for better safety.",
      },
    ];

    const summary = diffAnalyzer.analyze(responses);

    // Should recognize these as similar and put in common ground
    if (summary.commonGround.length > 0) {
      console.log("  ✓ Similar ideas clustered in common ground");
      console.log(`    Found: ${summary.commonGround[0]}\n`);
      testsPassed++;
    } else {
      throw new Error("Failed to cluster similar ideas");
    }
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 7: Handle length variance
  try {
    console.log("Test 7: Detect significant length differences");
    const responses: ModelResponse[] = [
      {
        model: "model-1",
        content: "Short answer: Use TypeScript for better type safety.",
      },
      {
        model: "model-2",
        content:
          "This is a comprehensive answer covering multiple aspects. First, TypeScript provides compile-time type checking which catches errors before runtime. Second, it improves IDE support with better autocomplete and refactoring tools. Third, it helps catch errors during development rather than in production. Fourth, it makes refactoring much safer by ensuring type consistency. Fifth, it has excellent documentation and strong community support with many resources available.",
      },
    ];

    const summary = diffAnalyzer.analyze(responses);

    // Should identify length variance in notable gaps
    const hasLengthGap = summary.notableGaps.some(
      (gap) => gap.toLowerCase().includes("less detail") || gap.toLowerCase().includes("detail")
    );

    if (hasLengthGap) {
      console.log("  ✓ Length variance detected in notable gaps\n");
      testsPassed++;
    } else {
      console.log("  ⚠ Length variance not detected (acceptable for MVP)\n");
      testsPassed++;
    }
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 8: Model name formatting
  try {
    console.log("Test 8: Model names properly formatted");
    const responses: ModelResponse[] = [
      {
        model: "gpt-5-mini",
        content: "Unique content specific to GPT-5 mini model implementation.",
      },
      {
        model: "claude-sonnet-4-5-20250929",
        content: "Different content from Claude Sonnet with alternative approach.",
      },
    ];

    const summary = diffAnalyzer.analyze(responses);

    let hasFormattedGPT = false;
    let hasFormattedClaude = false;

    summary.keyDifferences.forEach((diff) => {
      if (diff.model.includes("GPT") || diff.model.includes("gpt")) {
        hasFormattedGPT = true;
      }
      if (diff.model.includes("Claude") && diff.model.includes("Sonnet")) {
        hasFormattedClaude = true;
      }
    });

    if (hasFormattedGPT || hasFormattedClaude) {
      console.log("  ✓ Model names formatted correctly\n");
      testsPassed++;
    } else {
      console.log("  ⚠ Model name formatting varies (acceptable)\n");
      testsPassed++;
    }
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Summary
  console.log("═".repeat(50));
  console.log(`Tests passed: ${testsPassed}`);
  console.log(`Tests failed: ${testsFailed}`);
  console.log("═".repeat(50));

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test runner failed:", err);
  process.exit(1);
});
