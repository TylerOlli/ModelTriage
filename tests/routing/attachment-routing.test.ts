/**
 * Tests for attachment-aware routing behavior
 * 
 * Key test scenarios:
 * 1. Uploaded code/text files → Always default to Claude Sonnet (never gpt-5-mini)
 * 2. No attachments + short prompt → Can use gpt-5-mini
 * 3. Image attachments → Routes to Gemini vision models
 * 4. Complex code with files → Escalates to gpt-5.2
 */

import { IntentRouter } from "../../lib/llm/intent-router";
import type { AttachmentContext } from "../../lib/attachments/types";

async function runTests() {
  console.log("Running Attachment-Aware Routing tests...\n");

  let testsPassed = 0;
  let testsFailed = 0;

  const router = new IntentRouter();

  // Test 1: Uploaded .ts file → Claude Sonnet (NOT gpt-5-mini)
  try {
    console.log("Test 1: Uploaded .ts file → Claude Sonnet (NOT gpt-5-mini)");
    const prompt = "Review this code for bugs";
    const context: AttachmentContext = {
      hasImages: false,
      hasTextFiles: true,
      imageCount: 0,
      textFileCount: 1,
      attachmentNames: ["app.ts"],
      attachmentTypes: ["text/plain"],
      textFileTypes: [".ts"],
      totalTextChars: 500,
      promptChars: prompt.length,
      summarized: false,
      attachments: [],
    };

    const decision = await router.route(prompt, false, context);

    console.log("  Decision:", {
      intent: decision.intent,
      category: decision.category,
      chosenModel: decision.chosenModel,
      confidence: decision.confidence.toFixed(2),
    });

    if (
      decision.chosenModel === "claude-sonnet-4-5-20250929" &&
      decision.intent === "coding" &&
      decision.reason?.includes("uploaded")
    ) {
      console.log("  ✓ Correctly routed to Claude Sonnet for uploaded file\n");
      testsPassed++;
    } else {
      throw new Error(
        `Expected claude-sonnet-4-5-20250929 with "uploaded" reason, got ${decision.chosenModel}`
      );
    }
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 2: Uploaded .js file → Claude Sonnet (NOT gpt-5-mini)
  try {
    console.log("Test 2: Uploaded .js file → Claude Sonnet");
    const prompt = "Optimize this function";
    const context: AttachmentContext = {
      hasImages: false,
      hasTextFiles: true,
      imageCount: 0,
      textFileCount: 1,
      attachmentNames: ["utils.js"],
      attachmentTypes: ["application/javascript"],
      textFileTypes: [".js"],
      totalTextChars: 800,
      promptChars: prompt.length,
      summarized: false,
      attachments: [],
    };

    const decision = await router.route(prompt, false, context);

    console.log("  Decision:", {
      chosenModel: decision.chosenModel,
      category: decision.category,
    });

    if (decision.chosenModel === "claude-sonnet-4-5-20250929") {
      console.log("  ✓ Correctly routed to Claude Sonnet\n");
      testsPassed++;
    } else {
      throw new Error(`Expected claude-sonnet, got ${decision.chosenModel}`);
    }
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 3: Uploaded .py file → Claude Sonnet (NOT gpt-5-mini)
  try {
    console.log("Test 3: Uploaded .py file → Claude Sonnet");
    const prompt = "Add type hints";
    const context: AttachmentContext = {
      hasImages: false,
      hasTextFiles: true,
      imageCount: 0,
      textFileCount: 1,
      attachmentNames: ["script.py"],
      attachmentTypes: ["text/x-python"],
      textFileTypes: [".py"],
      totalTextChars: 300,
      promptChars: prompt.length,
      summarized: false,
      attachments: [],
    };

    const decision = await router.route(prompt, false, context);

    console.log("  Decision:", {
      chosenModel: decision.chosenModel,
    });

    if (decision.chosenModel === "claude-sonnet-4-5-20250929") {
      console.log("  ✓ Correctly routed to Claude Sonnet\n");
      testsPassed++;
    } else {
      throw new Error(`Expected claude-sonnet, got ${decision.chosenModel}`);
    }
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 4: Complex multi-file upload → Escalate to gpt-5.2
  try {
    console.log("Test 4: Complex multi-file upload → Escalate to gpt-5.2");
    const prompt = "Refactor this architecture across all files";
    const context: AttachmentContext = {
      hasImages: false,
      hasTextFiles: true,
      imageCount: 0,
      textFileCount: 5,
      attachmentNames: ["api.ts", "routes.ts", "types.ts", "utils.ts", "config.ts"],
      attachmentTypes: [
        "text/plain",
        "text/plain",
        "text/plain",
        "text/plain",
        "text/plain",
      ],
      textFileTypes: [".ts", ".ts", ".ts", ".ts", ".ts"],
      totalTextChars: 15000, // Large file set
      promptChars: prompt.length,
      summarized: false,
      attachments: [],
    };

    const decision = await router.route(prompt, false, context);

    console.log("  Decision:", {
      chosenModel: decision.chosenModel,
      category: decision.category,
    });

    if (decision.chosenModel === "gpt-5.2" && decision.category === "code_complex") {
      console.log("  ✓ Correctly escalated to gpt-5.2 for complex analysis\n");
      testsPassed++;
    } else {
      throw new Error(`Expected gpt-5.2, got ${decision.chosenModel}`);
    }
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 5: No attachments, lightweight prompt → gpt-5-mini is OK
  try {
    console.log("Test 5: No attachments, lightweight prompt → gpt-5-mini is OK");
    const prompt = "What is a closure?";
    const context: AttachmentContext = {
      hasImages: false,
      hasTextFiles: false,
      imageCount: 0,
      textFileCount: 0,
      attachmentNames: [],
      attachmentTypes: [],
      textFileTypes: [],
      totalTextChars: 0,
      promptChars: prompt.length,
      summarized: false,
      attachments: [],
    };

    const decision = await router.route(prompt, false, context);

    console.log("  Decision:", {
      chosenModel: decision.chosenModel,
    });

    // For lightweight coding questions without attachments, gpt-5-mini is acceptable
    const acceptableModels = ["gpt-5-mini", "claude-sonnet-4-5-20250929"];
    if (acceptableModels.includes(decision.chosenModel)) {
      console.log(`  ✓ Correctly used ${decision.chosenModel} for lightweight prompt\n`);
      testsPassed++;
    } else {
      throw new Error(
        `Expected one of ${acceptableModels.join(", ")}, got ${decision.chosenModel}`
      );
    }
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 6: Image upload → Gemini Pro (not Flash for code extraction)
  try {
    console.log("Test 6: Image upload → Gemini Pro (for detailed code extraction)");
    const prompt = "Extract all the code from this screenshot, explain what it does, identify any bugs, and suggest improvements for better performance";
    const context: AttachmentContext = {
      hasImages: true,
      hasTextFiles: false,
      imageCount: 1,
      textFileCount: 0,
      attachmentNames: ["screenshot.png"],
      attachmentTypes: ["image/png"],
      textFileTypes: [],
      totalTextChars: 0,
      promptChars: prompt.length,
      summarized: false,
      attachments: [],
    };

    const decision = await router.route(prompt, false, context);

    console.log("  Decision:", {
      chosenModel: decision.chosenModel,
      intent: decision.intent,
    });

    if (decision.chosenModel === "gemini-2.5-pro" && decision.intent === "vision") {
      console.log("  ✓ Correctly routed to Gemini for image\n");
      testsPassed++;
    } else {
      throw new Error(
        `Expected gemini-2.5-pro with vision intent, got ${decision.chosenModel}`
      );
    }
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 7: Lightweight image → Gemini Flash
  try {
    console.log("Test 7: Lightweight image → Gemini Flash");
    const prompt = "What color is this?";
    const context: AttachmentContext = {
      hasImages: true,
      hasTextFiles: false,
      imageCount: 1,
      textFileCount: 0,
      attachmentNames: ["photo.jpg"],
      attachmentTypes: ["image/jpeg"],
      textFileTypes: [],
      totalTextChars: 0,
      promptChars: prompt.length,
      summarized: false,
      attachments: [],
    };

    const decision = await router.route(prompt, false, context);

    console.log("  Decision:", {
      chosenModel: decision.chosenModel,
      category: decision.category,
    });

    if (
      decision.chosenModel === "gemini-2.5-flash" &&
      decision.category === "vision_lightweight"
    ) {
      console.log("  ✓ Correctly used Gemini Flash for lightweight image\n");
      testsPassed++;
    } else {
      throw new Error(
        `Expected gemini-2.5-flash with vision_lightweight, got ${decision.chosenModel}`
      );
    }
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 8: Mixed attachments (image + text) → Prioritize vision
  try {
    console.log("Test 8: Mixed attachments (image + text) → Prioritize vision");
    const prompt = "Compare this screenshot to the code file";
    const context: AttachmentContext = {
      hasImages: true,
      hasTextFiles: true,
      imageCount: 1,
      textFileCount: 1,
      attachmentNames: ["screenshot.png", "code.ts"],
      attachmentTypes: ["image/png", "text/plain"],
      textFileTypes: [".ts"],
      totalTextChars: 500,
      promptChars: prompt.length,
      summarized: false,
      attachments: [],
    };

    const decision = await router.route(prompt, false, context);

    console.log("  Decision:", {
      chosenModel: decision.chosenModel,
      intent: decision.intent,
    });

    if (decision.chosenModel === "gemini-2.5-pro" && decision.intent === "vision") {
      console.log("  ✓ Correctly prioritized vision for mixed attachments\n");
      testsPassed++;
    } else {
      throw new Error(
        `Expected gemini-2.5-pro with vision intent, got ${decision.chosenModel}`
      );
    }
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 9: Verify NO gpt-5-mini for various uploaded file types
  try {
    console.log("Test 9: Verify NO gpt-5-mini for any uploaded file");
    const testCases = [
      { name: "app.ts", type: "text/plain", ext: ".ts" },
      { name: "script.py", type: "text/x-python", ext: ".py" },
      { name: "index.js", type: "application/javascript", ext: ".js" },
      { name: "README.md", type: "text/markdown", ext: ".md" },
    ];

    let allPassed = true;
    for (const file of testCases) {
      const context: AttachmentContext = {
        hasImages: false,
        hasTextFiles: true,
        imageCount: 0,
        textFileCount: 1,
        attachmentNames: [file.name],
        attachmentTypes: [file.type],
        textFileTypes: [file.ext],
        totalTextChars: 100,
        promptChars: 20,
        summarized: false,
        attachments: [],
      };

      const decision = await router.route("Review this", false, context);

      console.log(`  ${file.name}: ${decision.chosenModel}`);

      if (decision.chosenModel === "gpt-5-mini") {
        allPassed = false;
        throw new Error(
          `FAIL: ${file.name} routed to gpt-5-mini (should be claude-sonnet)`
        );
      }
      if (decision.chosenModel !== "claude-sonnet-4-5-20250929") {
        allPassed = false;
        throw new Error(
          `FAIL: ${file.name} routed to ${decision.chosenModel} (expected claude-sonnet)`
        );
      }
    }

    if (allPassed) {
      console.log("  ✓ All file uploads correctly avoid gpt-5-mini\n");
      testsPassed++;
    }
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log(`Tests passed: ${testsPassed}`);
  console.log(`Tests failed: ${testsFailed}`);
  console.log("=".repeat(50));

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error("Test execution failed:", error);
  process.exit(1);
});
