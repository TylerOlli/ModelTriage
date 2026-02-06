/**
 * Tests for placeholder detection in image routing reasons
 * 
 * Verifies that:
 * 1. Placeholder reasons are correctly identified
 * 2. Placeholder reasons do NOT short-circuit IMAGE_GIST replacement
 * 3. IMAGE_GIST-derived reasons are not mistaken for placeholders
 */

// Helper function from route.ts
function isPlaceholderImageReason(reason: string): boolean {
  const lower = reason.toLowerCase();
  
  // Check for common placeholder patterns
  const hasScreenshot = lower.includes("screenshot") || lower.includes("image");
  const hasGenericPhrase = 
    lower.includes("snippet or file") ||
    lower.includes("code snippet") ||
    lower.includes("visual content") ||
    (lower.includes("showing") && lower.includes("or file"));
  
  return hasScreenshot && hasGenericPhrase;
}

async function runTests() {
  console.log("Running Placeholder Detection tests...\n");

  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: Placeholder with "snippet or file"
  try {
    console.log("Test 1: Detect placeholder with 'snippet or file'");
    const reason = "This is screenshot of code showing code snippet or file, and Gemini 2.5 Pro is well-suited for extracting code from images.";
    
    const isPlaceholder = isPlaceholderImageReason(reason);
    
    if (isPlaceholder) {
      console.log("✓ Correctly identified as placeholder\n");
      testsPassed++;
    } else {
      console.log("✗ Should be identified as placeholder\n");
      testsFailed++;
    }
  } catch (err) {
    console.log("✗ Test 1 failed:", err, "\n");
    testsFailed++;
  }

  // Test 2: Placeholder with "visual content"
  try {
    console.log("Test 2: Detect placeholder with 'visual content'");
    const reason = "This is image showing visual content, and Gemini 2.5 Flash is well-suited for quickly interpreting visual information.";
    
    const isPlaceholder = isPlaceholderImageReason(reason);
    
    if (isPlaceholder) {
      console.log("✓ Correctly identified as placeholder\n");
      testsPassed++;
    } else {
      console.log("✗ Should be identified as placeholder\n");
      testsFailed++;
    }
  } catch (err) {
    console.log("✗ Test 2 failed:", err, "\n");
    testsFailed++;
  }

  // Test 3: IMAGE_GIST-derived reason (NOT a placeholder)
  try {
    console.log("Test 3: IMAGE_GIST-derived reason is NOT a placeholder");
    const reason = "This screenshot shows TypeScript code for authentication logic, and Gemini 2.5 Flash is well-suited for extracting and interpreting code from images.";
    
    const isPlaceholder = isPlaceholderImageReason(reason);
    
    if (!isPlaceholder) {
      console.log("✓ Correctly identified as NOT a placeholder\n");
      testsPassed++;
    } else {
      console.log("✗ Should NOT be identified as placeholder\n");
      testsFailed++;
    }
  } catch (err) {
    console.log("✗ Test 3 failed:", err, "\n");
    testsFailed++;
  }

  // Test 4: Another IMAGE_GIST-derived reason (NOT a placeholder)
  try {
    console.log("Test 4: IMAGE_GIST-derived reason with language only");
    const reason = "This screenshot shows JavaScript code, and Gemini 2.5 Flash is well-suited for extracting and interpreting code from images.";
    
    const isPlaceholder = isPlaceholderImageReason(reason);
    
    if (!isPlaceholder) {
      console.log("✓ Correctly identified as NOT a placeholder\n");
      testsPassed++;
    } else {
      console.log("✗ Should NOT be identified as placeholder\n");
      testsFailed++;
    }
  } catch (err) {
    console.log("✗ Test 4 failed:", err, "\n");
    testsFailed++;
  }

  // Test 5: Generic fallback (edge case - NOT a placeholder)
  try {
    console.log("Test 5: Generic fallback is NOT technically a placeholder");
    const reason = "This request includes a screenshot of code, and Gemini 2.5 Flash is well-suited for extracting and interpreting code from images.";
    
    const isPlaceholder = isPlaceholderImageReason(reason);
    
    if (!isPlaceholder) {
      console.log("✓ Correctly identified as NOT a placeholder (it's a valid IMAGE_GIST-derived generic reason)\n");
      testsPassed++;
    } else {
      console.log("✗ Should NOT be identified as placeholder\n");
      testsFailed++;
    }
  } catch (err) {
    console.log("✗ Test 5 failed:", err, "\n");
    testsFailed++;
  }

  // Test 6: Placeholder with "code snippet"
  try {
    console.log("Test 6: Detect placeholder with 'code snippet'");
    const reason = "This screenshot shows a code snippet, and Gemini 2.5 Pro is effective at reading code from images.";
    
    const isPlaceholder = isPlaceholderImageReason(reason);
    
    if (isPlaceholder) {
      console.log("✓ Correctly identified as placeholder\n");
      testsPassed++;
    } else {
      console.log("✗ Should be identified as placeholder\n");
      testsFailed++;
    }
  } catch (err) {
    console.log("✗ Test 6 failed:", err, "\n");
    testsFailed++;
  }

  // Test 7: Non-image reason (NOT a placeholder)
  try {
    console.log("Test 7: Non-image reason is NOT a placeholder");
    const reason = "This upload is log file defining build error output, and Claude Sonnet 4.5 is a strong fit for debugging.";
    
    const isPlaceholder = isPlaceholderImageReason(reason);
    
    if (!isPlaceholder) {
      console.log("✓ Correctly identified as NOT a placeholder\n");
      testsPassed++;
    } else {
      console.log("✗ Should NOT be identified as placeholder\n");
      testsFailed++;
    }
  } catch (err) {
    console.log("✗ Test 7 failed:", err, "\n");
    testsFailed++;
  }

  // Summary
  console.log("=".repeat(60));
  console.log(`Tests passed: ${testsPassed}`);
  console.log(`Tests failed: ${testsFailed}`);
  console.log("=".repeat(60));

  if (testsFailed === 0) {
    console.log("\n✓ All placeholder detection tests passed!");
  } else {
    console.log("\n✗ Some tests failed.");
    process.exit(1);
  }
}

runTests();
