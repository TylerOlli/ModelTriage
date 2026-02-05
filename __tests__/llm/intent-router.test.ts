/**
 * Tests for intent-aware LLM router
 */

import { IntentRouter } from "@/lib/llm/intent-router";

async function runTests() {
  console.log("Running Intent Router tests...\n");

  let testsPassed = 0;
  let testsFailed = 0;

  const router = new IntentRouter();

  // Test 1: Coding debug - should route to gpt-5.2
  try {
    console.log("Test 1: Coding debug → gpt-5.2");
    const prompt = "Fix this Next.js build error: TypeError: Cannot read property 'map' of undefined";
    
    const decision = await router.route(prompt);
    
    console.log("  Decision:", {
      intent: decision.intent,
      category: decision.category,
      chosenModel: decision.chosenModel,
      confidence: decision.confidence.toFixed(2),
    });

    if (decision.intent === "coding" && decision.chosenModel === "gpt-5.2") {
      console.log("  ✓ Correctly routed to gpt-5.2 for debugging\n");
      testsPassed++;
    } else {
      throw new Error(`Expected gpt-5.2, got ${decision.chosenModel}`);
    }
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 2: Coding review - should route to claude-opus
  try {
    console.log("Test 2: Coding review → claude-opus-4-5-20251101");
    const prompt = "Refactor this function for better readability and maintainability. Here's the code: function processData(d){return d.map(x=>x*2).filter(y=>y>10)}";
    
    const decision = await router.route(prompt);
    
    console.log("  Decision:", {
      intent: decision.intent,
      category: decision.category,
      chosenModel: decision.chosenModel,
      confidence: decision.confidence.toFixed(2),
    });

    if (decision.intent === "coding" && decision.chosenModel === "claude-opus-4-5-20251101") {
      console.log("  ✓ Correctly routed to claude-opus for code review\n");
      testsPassed++;
    } else {
      throw new Error(`Expected claude-opus-4-5-20251101, got ${decision.chosenModel}`);
    }
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 3: Coding quick - should route to claude-sonnet
  try {
    console.log("Test 3: Coding quick → claude-sonnet-4-5-20250929");
    const prompt = "Write a TypeScript helper function to format currency values";
    
    const decision = await router.route(prompt);
    
    console.log("  Decision:", {
      intent: decision.intent,
      category: decision.category,
      chosenModel: decision.chosenModel,
      confidence: decision.confidence.toFixed(2),
    });

    if (decision.intent === "coding" && decision.chosenModel === "claude-sonnet-4-5-20250929") {
      console.log("  ✓ Correctly routed to claude-sonnet for quick coding\n");
      testsPassed++;
    } else {
      throw new Error(`Expected claude-sonnet-4-5-20250929, got ${decision.chosenModel}`);
    }
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 4: Writing standard - should route to claude-sonnet
  try {
    console.log("Test 4: Writing standard → claude-sonnet-4-5-20250929");
    const prompt = "Rewrite this email to sound more firm and professional while maintaining politeness";
    
    const decision = await router.route(prompt);
    
    console.log("  Decision:", {
      intent: decision.intent,
      category: decision.category,
      chosenModel: decision.chosenModel,
      confidence: decision.confidence.toFixed(2),
    });

    if (decision.intent === "writing" && decision.chosenModel === "claude-sonnet-4-5-20250929") {
      console.log("  ✓ Correctly routed to claude-sonnet for standard writing\n");
      testsPassed++;
    } else {
      throw new Error(`Expected claude-sonnet-4-5-20250929, got ${decision.chosenModel}`);
    }
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 5: Writing high-stakes - should route to claude-opus
  try {
    console.log("Test 5: Writing high-stakes → claude-opus-4-5-20251101");
    const prompt = "Draft a sensitive executive announcement about company restructuring that will affect employees";
    
    const decision = await router.route(prompt);
    
    console.log("  Decision:", {
      intent: decision.intent,
      category: decision.category,
      chosenModel: decision.chosenModel,
      confidence: decision.confidence.toFixed(2),
    });

    if (decision.intent === "writing" && decision.chosenModel === "claude-opus-4-5-20251101") {
      console.log("  ✓ Correctly routed to claude-opus for high-stakes writing\n");
      testsPassed++;
    } else {
      throw new Error(`Expected claude-opus-4-5-20251101, got ${decision.chosenModel}`);
    }
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 6: Writing light - should route to claude-haiku
  try {
    console.log("Test 6: Writing light → claude-haiku-4-5-20251001");
    const prompt = "Summarize this paragraph in 2 sentences: [long text here about technology trends]";
    
    const decision = await router.route(prompt);
    
    console.log("  Decision:", {
      intent: decision.intent,
      category: decision.category,
      chosenModel: decision.chosenModel,
      confidence: decision.confidence.toFixed(2),
    });

    if (decision.intent === "writing" && decision.chosenModel === "claude-haiku-4-5-20251001") {
      console.log("  ✓ Correctly routed to claude-haiku for light writing\n");
      testsPassed++;
    } else {
      throw new Error(`Expected claude-haiku-4-5-20251001, got ${decision.chosenModel}`);
    }
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 7: Analysis standard - should route to gpt-5-mini
  try {
    console.log("Test 7: Analysis standard → gpt-5-mini");
    const prompt = "Compare the pros and cons of using React vs Vue for a new project";
    
    const decision = await router.route(prompt);
    
    console.log("  Decision:", {
      intent: decision.intent,
      category: decision.category,
      chosenModel: decision.chosenModel,
      confidence: decision.confidence.toFixed(2),
    });

    if (decision.intent === "analysis" && decision.chosenModel === "gpt-5-mini") {
      console.log("  ✓ Correctly routed to gpt-5-mini for analysis\n");
      testsPassed++;
    } else {
      throw new Error(`Expected gpt-5-mini, got ${decision.chosenModel}`);
    }
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 8: Analysis complex - should route to gpt-5.2
  try {
    console.log("Test 8: Analysis complex → gpt-5.2");
    const prompt = "Analyze the architectural tradeoffs between microservices and monolith, considering performance, scalability, team size, and deployment complexity";
    
    const decision = await router.route(prompt);
    
    console.log("  Decision:", {
      intent: decision.intent,
      category: decision.category,
      chosenModel: decision.chosenModel,
      confidence: decision.confidence.toFixed(2),
    });

    if (decision.intent === "analysis" && decision.chosenModel === "gpt-5.2") {
      console.log("  ✓ Correctly routed to gpt-5.2 for complex analysis\n");
      testsPassed++;
    } else {
      throw new Error(`Expected gpt-5.2, got ${decision.chosenModel}`);
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
