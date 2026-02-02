/**
 * Unit tests for ModelRouter
 */

import { ModelRouter } from "@/lib/routing/router";

async function runTests() {
  console.log("Running ModelRouter tests...\n");

  const router = new ModelRouter();
  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: Code-related prompts
  try {
    console.log("Test 1: Code-related routing");
    const decision = router.route({
      prompt: "Write a function to sort an array",
      promptLength: 34,
    });

    if (decision.model === "mock-code-1" && decision.confidence === "high") {
      console.log(`  ✓ Routed to: ${decision.model}`);
      console.log(`  ✓ Reason: ${decision.reason}`);
      console.log(`  ✓ Confidence: ${decision.confidence}\n`);
      testsPassed++;
    } else {
      throw new Error(`Expected mock-code-1, got ${decision.model}`);
    }
  } catch (error) {
    console.error("  ✗ Test failed:", error);
    testsFailed++;
  }

  // Test 2: Short prompts use fast model
  try {
    console.log("Test 2: Short prompt routing");
    const decision = router.route({
      prompt: "Hello",
      promptLength: 5,
    });

    if (decision.model === "mock-fast-1") {
      console.log(`  ✓ Routed to: ${decision.model}`);
      console.log(`  ✓ Reason: ${decision.reason}\n`);
      testsPassed++;
    } else {
      throw new Error(`Expected mock-fast-1, got ${decision.model}`);
    }
  } catch (error) {
    console.error("  ✗ Test failed:", error);
    testsFailed++;
  }

  // Test 3: Long prompts use quality model
  try {
    console.log("Test 3: Long prompt routing");
    const longPrompt = "a".repeat(1500);
    const decision = router.route({
      prompt: longPrompt,
      promptLength: longPrompt.length,
    });

    if (decision.model === "mock-quality-1") {
      console.log(`  ✓ Routed to: ${decision.model}`);
      console.log(`  ✓ Reason: ${decision.reason}\n`);
      testsPassed++;
    } else {
      throw new Error(`Expected mock-quality-1, got ${decision.model}`);
    }
  } catch (error) {
    console.error("  ✗ Test failed:", error);
    testsFailed++;
  }

  // Test 4: Analytical prompts
  try {
    console.log("Test 4: Analytical prompt routing");
    const decision = router.route({
      prompt: "Analyze the pros and cons of serverless architecture",
      promptLength: 56,
    });

    if (decision.model === "mock-quality-1") {
      console.log(`  ✓ Routed to: ${decision.model}`);
      console.log(`  ✓ Reason: ${decision.reason}\n`);
      testsPassed++;
    } else {
      throw new Error(`Expected mock-quality-1, got ${decision.model}`);
    }
  } catch (error) {
    console.error("  ✗ Test failed:", error);
    testsFailed++;
  }

  // Test 4b: Analytical wins over code keywords
  try {
    console.log("Test 4b: Analytical intent with code keywords");
    const decision = router.route({
      prompt: "Compare React and Vue",
      promptLength: 20,
    });

    if (decision.model === "mock-quality-1" && decision.reason.includes("analysis")) {
      console.log(`  ✓ Routed to: ${decision.model}`);
      console.log(`  ✓ Reason: ${decision.reason}`);
      console.log(`  ✓ Analytical intent correctly prioritized over code keywords\n`);
      testsPassed++;
    } else {
      throw new Error(`Expected mock-quality-1 with analytical reason, got ${decision.model}`);
    }
  } catch (error) {
    console.error("  ✗ Test failed:", error);
    testsFailed++;
  }

  // Test 5: Fallback for generic prompts
  try {
    console.log("Test 5: Fallback routing");
    const decision = router.route({
      prompt: "Tell me something interesting about the weather today",
      promptLength: 52,
    });

    if (decision.model === "mock-balanced-1" && decision.confidence === "low") {
      console.log(`  ✓ Routed to: ${decision.model}`);
      console.log(`  ✓ Reason: ${decision.reason}`);
      console.log(`  ✓ Confidence: ${decision.confidence}\n`);
      testsPassed++;
    } else {
      throw new Error(`Expected fallback to mock-balanced-1, got ${decision.model}`);
    }
  } catch (error) {
    console.error("  ✗ Test failed:", error);
    testsFailed++;
  }

  // Test 6: Requested model override
  try {
    console.log("Test 6: Requested model override");
    const decision = router.route({
      prompt: "Any prompt",
      promptLength: 10,
      requestedModel: "custom-model-x",
    });

    if (decision.model === "custom-model-x" && decision.confidence === "high") {
      console.log(`  ✓ Routed to: ${decision.model}`);
      console.log(`  ✓ Reason: ${decision.reason}\n`);
      testsPassed++;
    } else {
      throw new Error(`Expected custom-model-x, got ${decision.model}`);
    }
  } catch (error) {
    console.error("  ✗ Test failed:", error);
    testsFailed++;
  }

  // Test 7: Creative prompts
  try {
    console.log("Test 7: Creative prompt routing");
    const decision = router.route({
      prompt: "Write a story about a robot learning to love",
      promptLength: 47,
    });

    if (decision.model === "mock-quality-1") {
      console.log(`  ✓ Routed to: ${decision.model}`);
      console.log(`  ✓ Reason: ${decision.reason}\n`);
      testsPassed++;
    } else {
      throw new Error(`Expected mock-quality-1, got ${decision.model}`);
    }
  } catch (error) {
    console.error("  ✗ Test failed:", error);
    testsFailed++;
  }

  // Test 8: All decisions have required fields
  try {
    console.log("Test 8: Decision structure validation");
    const decision = router.route({
      prompt: "Test prompt",
      promptLength: 11,
    });

    if (
      decision.model &&
      typeof decision.model === "string" &&
      decision.reason &&
      typeof decision.reason === "string" &&
      decision.confidence &&
      ["high", "medium", "low"].includes(decision.confidence)
    ) {
      console.log("  ✓ All required fields present");
      console.log("  ✓ Fields have correct types\n");
      testsPassed++;
    } else {
      throw new Error("Decision structure invalid");
    }
  } catch (error) {
    console.error("  ✗ Test failed:", error);
    testsFailed++;
  }

  // Summary
  console.log("=====================================");
  console.log(`Tests passed: ${testsPassed}`);
  console.log(`Tests failed: ${testsFailed}`);
  console.log("=====================================");

  if (testsFailed > 0) {
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch((error) => {
    console.error("Test execution failed:", error);
    process.exit(1);
  });
}

export { runTests };
