/**
 * Tests for fit breakdown schema validation
 */

import {
  validateFitBreakdown,
  safeValidateFitBreakdown,
  createDefaultFitBreakdown,
  mapToDisplayScore,
  calculateOverallFit,
  type FitBreakdown,
  type FitDimension,
  FIT_DIMENSION_INFO,
} from "../../lib/llm/score-breakdown";

async function runTests() {
  console.log("Running FitBreakdown Schema tests...\n");

  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: Valid complete fit breakdown
  try {
    console.log("Test 1: Valid complete fit breakdown");
    const validBreakdown: FitBreakdown = {
      shortWhy: "This model excels at systematic error analysis.",
      overallFit: { raw: 9, display: 9.7 },
      fitBreakdown: [
        { key: "reasoningFit", label: "Reasoning Fit", raw: 9.5, display: 9.9, note: "Strong reasoning" },
        { key: "outputMatch", label: "Output Match", raw: 9, display: 9.7, note: "Excellent format" },
        { key: "costEfficiency", label: "Cost Efficiency", raw: 8, display: 9.4, note: "Good value" },
      ],
    };

    const result = validateFitBreakdown(validBreakdown);
    if (result && result.overallFit.display === 9.7) {
      console.log("  ✓ Valid breakdown accepted\n");
      testsPassed++;
    } else {
      throw new Error("Validation failed unexpectedly");
    }
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 2: Display score must be >= 7
  try {
    console.log("Test 2: Display score must be >= 7");
    const invalidBreakdown = {
      shortWhy: "Test explanation",
      overallFit: { raw: 5, display: 6.5 }, // Display too low
      fitBreakdown: [
        { key: "reasoningFit", label: "Reasoning Fit", raw: 5, display: 6.5, note: "Test note" },
      ],
    };

    try {
      validateFitBreakdown(invalidBreakdown);
      throw new Error("Should have rejected display score < 7");
    } catch (validationError) {
      console.log("  ✓ Low display score rejected\n");
      testsPassed++;
    }
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 3: mapToDisplayScore function
  try {
    console.log("Test 3: mapToDisplayScore always returns 7-10");
    const testCases = [
      { raw: 0, expectedMin: 7, expectedMax: 7.1 },
      { raw: 5, expectedMin: 8.4, expectedMax: 8.6 },
      { raw: 10, expectedMin: 9.9, expectedMax: 10 },
    ];

    for (const testCase of testCases) {
      const display = mapToDisplayScore(testCase.raw);
      if (display < 7 || display > 10) {
        throw new Error(`Display score ${display} out of range for raw ${testCase.raw}`);
      }
      if (display < testCase.expectedMin || display > testCase.expectedMax) {
        throw new Error(`Display score ${display} not in expected range for raw ${testCase.raw}`);
      }
    }

    console.log("  ✓ All mappings in 7-10 range\n");
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 4: calculateOverallFit weighted average
  try {
    console.log("Test 4: calculateOverallFit computes weighted average");
    const dimensions: FitDimension[] = [
      { key: "reasoningFit", label: "Reasoning Fit", raw: 10, display: 10, note: "Perfect" },
      { key: "outputMatch", label: "Output Match", raw: 10, display: 10, note: "Perfect" },
      { key: "costEfficiency", label: "Cost Efficiency", raw: 10, display: 10, note: "Perfect" },
      { key: "speedFit", label: "Speed Fit", raw: 10, display: 10, note: "Perfect" },
    ];

    const overallFit = calculateOverallFit(dimensions);
    
    if (overallFit.raw !== 10 || overallFit.display !== 10) {
      throw new Error(`Expected 10, got raw=${overallFit.raw}, display=${overallFit.display}`);
    }

    console.log("  ✓ Weighted average calculation correct\n");
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 5: Note length validation
  try {
    console.log("Test 5: Note must be 4-50 chars");
    const invalidBreakdown = {
      shortWhy: "Test explanation",
      overallFit: { raw: 8, display: 9.4 },
      fitBreakdown: [
        { key: "reasoningFit", label: "Reasoning Fit", raw: 8, display: 9.4, note: "ABC" }, // Too short
      ],
    };

    try {
      validateFitBreakdown(invalidBreakdown);
      throw new Error("Should have rejected short note");
    } catch (validationError) {
      console.log("  ✓ Short note rejected\n");
      testsPassed++;
    }
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 6: Safe validation success
  try {
    console.log("Test 6: safeValidateFitBreakdown returns success for valid data");
    const validBreakdown = {
      shortWhy: "Model excels at this task",
      overallFit: { raw: 8.5, display: 9.6 },
      fitBreakdown: [
        { key: "reasoningFit", label: "Reasoning Fit", raw: 9, display: 9.7, note: "Strong reasoning" },
        { key: "outputMatch", label: "Output Match", raw: 8, display: 9.4, note: "Good format" },
      ],
    };

    const result = safeValidateFitBreakdown(validBreakdown);
    if (result.success && result.data) {
      console.log("  ✓ Safe validation returned success\n");
      testsPassed++;
    } else {
      throw new Error("Safe validation should have succeeded");
    }
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 7: Safe validation error
  try {
    console.log("Test 7: safeValidateFitBreakdown returns error for invalid data");
    const invalidBreakdown = {
      shortWhy: "Too short",
      overallFit: { raw: 11, display: 11 }, // Raw too high
      fitBreakdown: [],
    };

    const result = safeValidateFitBreakdown(invalidBreakdown);
    if (!result.success && result.error) {
      console.log("  ✓ Safe validation returned error\n");
      testsPassed++;
    } else {
      throw new Error("Safe validation should have returned error");
    }
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 8: Default fit breakdown
  try {
    console.log("Test 8: createDefaultFitBreakdown creates valid breakdown");
    const defaultBreakdown = createDefaultFitBreakdown();
    
    validateFitBreakdown(defaultBreakdown);
    
    // Check all display scores are >= 7
    if (defaultBreakdown.overallFit.display < 7) {
      throw new Error("Overall fit display < 7");
    }
    
    for (const dim of defaultBreakdown.fitBreakdown) {
      if (dim.display < 7) {
        throw new Error(`${dim.key} display score < 7`);
      }
    }

    console.log("  ✓ Default breakdown valid with display >= 7\n");
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 9: FIT_DIMENSION_INFO completeness
  try {
    console.log("Test 9: FIT_DIMENSION_INFO has metadata for dimensions");
    const requiredDimensions = [
      "reasoningFit",
      "outputMatch",
      "costEfficiency",
      "speedFit",
      "recencyFit",
    ];

    for (const dimension of requiredDimensions) {
      const info = FIT_DIMENSION_INFO[dimension];
      if (!info || !info.label || !info.description) {
        throw new Error(`Missing metadata for ${dimension}`);
      }
    }

    console.log("  ✓ All dimension metadata present\n");
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Summary
  console.log("═".repeat(50));
  console.log(`Tests passed: ${testsPassed}`);
  console.log(`Tests failed: ${testsFailed}`);
  console.log(`Total: ${testsPassed + testsFailed}`);
  console.log("═".repeat(50));

  process.exit(testsFailed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
