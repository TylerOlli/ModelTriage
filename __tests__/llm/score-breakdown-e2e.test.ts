/**
 * End-to-end test demonstrating the "Why this model?" feature
 * 
 * This test simulates the full flow from routing decision to UI display
 */

import { intentRouter } from "../../lib/llm/intent-router";
import { safeValidateScoreBreakdown } from "../../lib/llm/score-breakdown";

async function testE2E() {
  console.log("=".repeat(60));
  console.log("END-TO-END TEST: 'Why this model?' Feature");
  console.log("=".repeat(60));
  console.log();

  const testPrompts = [
    {
      name: "Quick Code Task",
      prompt: "Write a function to check if a number is prime",
      expectedIntent: "coding",
    },
    {
      name: "Complex Analysis",
      prompt: "Analyze the architectural tradeoffs between event-driven and request-driven microservices in a distributed system handling 1M+ requests per second",
      expectedIntent: "analysis",
    },
    {
      name: "High-Stakes Writing",
      prompt: "Draft an executive summary for the board regarding Q4 financial restructuring",
      expectedIntent: "writing",
    },
  ];

  let allPassed = true;

  for (const test of testPrompts) {
    console.log("─".repeat(60));
    console.log(`TEST: ${test.name}`);
    console.log("─".repeat(60));
    console.log(`Prompt: "${test.prompt.substring(0, 80)}${test.prompt.length > 80 ? '...' : ''}"`);
    console.log();

    try {
      // 1. Route the prompt (as the API does)
      const decision = await intentRouter.route(test.prompt);

      console.log("✓ Step 1: Routing Decision");
      console.log(`  Model: ${decision.chosenModel}`);
      console.log(`  Intent: ${decision.intent}`);
      console.log(`  Category: ${decision.category}`);
      console.log(`  Confidence: ${(decision.confidence * 100).toFixed(0)}%`);
      console.log();

      // 2. Validate score breakdown exists
      if (!decision.scoreBreakdown) {
        throw new Error("Score breakdown is missing from routing decision");
      }
      console.log("✓ Step 2: Score Breakdown Present");

      // 3. Validate schema
      const validation = safeValidateScoreBreakdown(decision.scoreBreakdown);
      if (!validation.success) {
        throw new Error(`Score breakdown validation failed: ${validation.error}`);
      }
      console.log("✓ Step 3: Schema Validation Passed");

      // 4. Check all required dimensions are present
      const requiredDimensions = [
        'reasoningComplexity',
        'outputStructure', 
        'tokenVolume',
        'costSensitivity',
        'latencySensitivity',
        'recencyRequirement'
      ];

      for (const dim of requiredDimensions) {
        const dimension = decision.scoreBreakdown[dim as keyof typeof decision.scoreBreakdown];
        if (!dimension) {
          throw new Error(`Missing required dimension: ${dim}`);
        }
        if (dimension.score < 0 || dimension.score > 10) {
          throw new Error(`Invalid score for ${dim}: ${dimension.score}`);
        }
        if (dimension.rationale.length < 5 || dimension.rationale.length > 80) {
          throw new Error(`Invalid rationale length for ${dim}: ${dimension.rationale.length}`);
        }
      }
      console.log("✓ Step 4: All Required Dimensions Valid");

      // 5. Display scoring breakdown (as UI would)
      console.log();
      console.log("📊 Scoring Breakdown (UI Preview):");
      console.log();
      
      const breakdown = decision.scoreBreakdown;
      const labels: Record<string, string> = {
        reasoningComplexity: "Reasoning Complexity",
        outputStructure: "Output Structure",
        tokenVolume: "Token Volume",
        costSensitivity: "Cost Sensitivity",
        latencySensitivity: "Latency Sensitivity",
        recencyRequirement: "Recency Requirement",
        safetySensitivity: "Safety Sensitivity",
      };

      for (const [key, dimension] of Object.entries(breakdown)) {
        if (dimension) {
          const label = labels[key] || key;
          const score = `[${dimension.score}]`.padEnd(5);
          console.log(`  ${label.padEnd(25)} ${score} ${dimension.rationale}`);
        }
      }

      console.log();
      console.log(`✅ ${test.name} PASSED`);
      console.log();

    } catch (error) {
      console.error(`❌ ${test.name} FAILED:`, error);
      console.log();
      allPassed = false;
    }
  }

  console.log("=".repeat(60));
  if (allPassed) {
    console.log("✅ ALL E2E TESTS PASSED");
    console.log();
    console.log("The 'Why this model?' feature is fully functional:");
    console.log("  • Routing decisions include score breakdowns");
    console.log("  • Schema validation ensures data integrity");
    console.log("  • All dimensions are properly scored and rationalized");
    console.log("  • UI can safely render the breakdown");
    process.exit(0);
  } else {
    console.log("❌ SOME TESTS FAILED");
    process.exit(1);
  }
}

testE2E().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
