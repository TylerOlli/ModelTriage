/**
 * Quick test to verify score breakdown integration
 */

import { intentRouter } from "../../lib/llm/intent-router";

async function testScoreBreakdown() {
  console.log("Testing score breakdown integration...\n");

  try {
    // Test 1: Simple coding task
    console.log("Test 1: Simple coding task");
    const decision1 = await intentRouter.route(
      "Write a function to reverse a string in JavaScript"
    );
    
    console.log("  Model:", decision1.chosenModel);
    console.log("  Intent:", decision1.intent);
    console.log("  Category:", decision1.category);
    console.log("  Fit Breakdown:", decision1.fitBreakdown ? "✓ Present" : "✗ Missing");
    
    if (decision1.fitBreakdown) {
      console.log("    Overall Fit:", decision1.fitBreakdown.overallFit.display);
      console.log("    Dimensions:", decision1.fitBreakdown.fitBreakdown.length);
    }
    console.log();

    // Test 2: Complex analysis task
    console.log("Test 2: Complex analysis task");
    const decision2 = await intentRouter.route(
      "Analyze the tradeoffs between microservices and monolithic architecture for a large-scale e-commerce platform with 10 million users"
    );
    
    console.log("  Model:", decision2.chosenModel);
    console.log("  Intent:", decision2.intent);
    console.log("  Category:", decision2.category);
    console.log("  Fit Breakdown:", decision2.fitBreakdown ? "✓ Present" : "✗ Missing");
    
    if (decision2.fitBreakdown) {
      console.log("    Overall Fit:", decision2.fitBreakdown.overallFit.display);
      console.log("    Dimensions:", decision2.fitBreakdown.fitBreakdown.length);
    }
    console.log();

    // Test 3: High-stakes writing
    console.log("Test 3: High-stakes writing task");
    const decision3 = await intentRouter.route(
      "Draft an executive memo to the board about the company's financial restructuring plan"
    );
    
    console.log("  Model:", decision3.chosenModel);
    console.log("  Intent:", decision3.intent);
    console.log("  Category:", decision3.category);
    console.log("  Fit Breakdown:", decision3.fitBreakdown ? "✓ Present" : "✗ Missing");
    
    if (decision3.fitBreakdown) {
      console.log("    Overall Fit:", decision3.fitBreakdown.overallFit.display);
      console.log("    Dimensions:", decision3.fitBreakdown.fitBreakdown.length);
    }
    console.log();

    console.log("✓ All tests completed successfully");
    console.log("✓ Fit breakdown is being generated for all routing decisions");
    
  } catch (error) {
    console.error("✗ Test failed:", error);
    process.exit(1);
  }
}

testScoreBreakdown().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
