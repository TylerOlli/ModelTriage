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
import type { AttachmentContext } from "../../lib/llm/intent-router";

async function runTests() {
  console.log("Running Attachment-Aware Routing tests...\n");

  let testsPassed = 0;
  let testsFailed = 0;

  const router = new IntentRouter();

  // Test 1: Uploaded .ts file → Claude Sonnet (NOT gpt-5-mini)
  try {
    console.log("Test 1: Uploaded .ts file with React component → Descriptive reason");
    const prompt = "Review this code for bugs";
    const sampleContent = `import React from 'react';

export const TodoList = () => {
  const [items, setItems] = useState([]);
  return <div>Todo List</div>;
};`;
    
    const context: AttachmentContext = {
      hasImages: false,
      hasTextFiles: true,
      imageCount: 0,
      textFileCount: 1,
      attachmentNames: ["TodoList.tsx"],
      textFileTypes: [".tsx"],
      totalTextChars: sampleContent.length,
      promptChars: prompt.length,
      attachments: [{
        type: "text",
        filename: "TodoList.tsx",
        content: sampleContent,
        extension: ".tsx",
      }],
    };

    const decision = await router.route(prompt, false, context);

    console.log("  Decision:", {
      intent: decision.intent,
      category: decision.category,
      chosenModel: decision.chosenModel,
      confidence: decision.confidence.toFixed(2),
      reason: decision.reason,
    });

    if (
      decision.chosenModel === "claude-sonnet-4-5-20250929" &&
      decision.intent === "coding" &&
      (decision.reason?.includes("React") || decision.reason?.includes("TypeScript"))
    ) {
      console.log("  ✓ Correctly routed to Claude Sonnet with descriptive reason\n");
      testsPassed++;
    } else {
      throw new Error(
        `Expected claude-sonnet-4-5-20250929 with React/TypeScript-aware reason, got ${decision.chosenModel}: ${decision.reason}`
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
      textFileTypes: [],
      totalTextChars: 0,
      promptChars: prompt.length,
      attachments: [{
        type: "image",
        filename: "screenshot.png",
      }],
    };

    const decision = await router.route(prompt, false, context);

    console.log("  Decision:", {
      chosenModel: decision.chosenModel,
      intent: decision.intent,
      reason: decision.reason,
    });

    if (
      decision.chosenModel === "gemini-3-pro-preview" &&
      decision.intent === "vision" &&
      decision.reason?.includes("screenshot of code")
    ) {
      console.log("  ✓ Correctly routed to Gemini with image-aware reason\n");
      testsPassed++;
    } else {
      throw new Error(
        `Expected gemini-3-pro-preview with code-aware reason, got ${decision.chosenModel}: ${decision.reason}`
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
      decision.chosenModel === "gemini-3-flash-preview" &&
      decision.category === "vision_lightweight"
    ) {
      console.log("  ✓ Correctly used Gemini Flash for lightweight image\n");
      testsPassed++;
    } else {
      throw new Error(
        `Expected gemini-3-flash-preview with vision_lightweight, got ${decision.chosenModel}`
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

    if (decision.chosenModel === "gemini-3-pro-preview" && decision.intent === "vision") {
      console.log("  ✓ Correctly prioritized vision for mixed attachments\n");
      testsPassed++;
    } else {
      throw new Error(
        `Expected gemini-3-pro-preview with vision intent, got ${decision.chosenModel}`
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

  // Test 10: Terminal error image → Generic reason (specific details come during streaming)
  try {
    console.log("Test 10: Terminal error image → Image-aware reason");
    const prompt = "What does this error mean and how do I fix it?";
    const context: AttachmentContext = {
      hasImages: true,
      hasTextFiles: false,
      imageCount: 1,
      textFileCount: 0,
      attachmentNames: ["terminal-error.png"],
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
      reason: decision.reason,
    });

    // Note: Specific image descriptions (e.g., "terminal error") are extracted during 
    // streaming from the vision model's actual response. At routing time, we expect
    // a generic image-aware reason.
    if (
      decision.intent === "vision" &&
      decision.reason?.includes("image") &&
      decision.reason?.length > 0
    ) {
      console.log("  ✓ Generated generic image-aware reason (specifics come during streaming)\n");
      testsPassed++;
    } else {
      throw new Error(
        `Expected generic image-aware reason, got: ${decision.reason}`
      );
    }
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 11: UI screenshot → Generic reason (specific details come during streaming)
  try {
    console.log("Test 11: UI screenshot → Image-aware reason");
    const prompt = "Review this UI design and suggest improvements";
    const context: AttachmentContext = {
      hasImages: true,
      hasTextFiles: false,
      imageCount: 1,
      textFileCount: 0,
      attachmentNames: ["ui-mockup.png"],
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
      reason: decision.reason,
    });

    // Note: Specific image descriptions (e.g., "UI screenshot", "form interface") 
    // are extracted during streaming from the vision model's actual response. 
    // At routing time, we expect a generic image-aware reason.
    if (
      decision.intent === "vision" &&
      decision.reason?.includes("image") &&
      decision.reason?.length > 0
    ) {
      console.log("  ✓ Generated generic image-aware reason (specifics come during streaming)\n");
      testsPassed++;
    } else {
      throw new Error(`Expected generic image-aware reason, got: ${decision.reason}`);
    }
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 12: Generic image → Fallback reason
  try {
    console.log("Test 12: Generic image → Fallback reason");
    const prompt = "Tell me about this";
    const context: AttachmentContext = {
      hasImages: true,
      hasTextFiles: false,
      imageCount: 1,
      textFileCount: 0,
      attachmentNames: ["photo.jpg"],
      textFileTypes: [],
      totalTextChars: 0,
      promptChars: prompt.length,
      attachments: [{
        type: "image",
        filename: "photo.jpg",
      }],
    };

    const decision = await router.route(prompt, false, context);

    console.log("  Decision:", {
      chosenModel: decision.chosenModel,
      reason: decision.reason,
    });

    if (
      decision.intent === "vision" &&
      decision.reason?.includes("image") &&
      decision.reason?.length > 0
    ) {
      console.log("  ✓ Generated generic image-aware reason\n");
      testsPassed++;
    } else {
      throw new Error(`Expected image-aware reason, got: ${decision.reason}`);
    }
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 13: Log file with error → Descriptive gist-based reason
  try {
    console.log("Test 13: Log file with error → Descriptive gist-based reason");
    const prompt = "What went wrong?";
    const logContent = `[2024-01-15 10:30:45] ERROR: Build failed
at Object.<anonymous> (/app/build.js:45:12)
TypeError: Cannot read property 'map' of undefined
    at processFiles (/app/utils.js:23:15)`;
    
    const context: AttachmentContext = {
      hasImages: false,
      hasTextFiles: true,
      imageCount: 0,
      textFileCount: 1,
      attachmentNames: ["build.log"],
      textFileTypes: [".log"],
      totalTextChars: logContent.length,
      promptChars: prompt.length,
      attachments: [{
        type: "text",
        filename: "build.log",
        content: logContent,
        extension: ".log",
      }],
    };

    const decision = await router.route(prompt, false, context);

    console.log("  Decision:", {
      chosenModel: decision.chosenModel,
      reason: decision.reason,
    });

    if (
      decision.chosenModel === "claude-sonnet-4-5-20250929" &&
      decision.reason?.toLowerCase().includes("log") &&
      decision.reason?.toLowerCase().includes("error")
    ) {
      console.log("  ✓ Generated log file gist-based reason\n");
      testsPassed++;
    } else {
      throw new Error(`Expected log-aware reason, got: ${decision.reason}`);
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
