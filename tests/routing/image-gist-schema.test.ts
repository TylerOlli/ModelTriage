/**
 * Tests for IMAGE_GIST schema parsing and routing reason generation
 * 
 * This test verifies that the system can:
 * 1. Parse IMAGE_GIST JSON from vision model responses
 * 2. Generate descriptive routing reasons based on certainty level
 * 3. Handle high certainty (specific) vs low certainty (generic) cases
 */

import { parseImageGist, generateRoutingReasonFromGist, type ImageGist } from "../../lib/attachments/image-gist-schema";

async function runTests() {
  console.log("Running IMAGE_GIST Schema tests...\n");

  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: Parse high-certainty code screenshot
  try {
    console.log("Test 1: Parse high-certainty TypeScript code gist");
    const response = `IMAGE_GIST: {"kind":"code_screenshot","language":"TypeScript","purpose":"authentication logic","certainty":"high"}

The TypeScript code in the image implements user authentication...`;
    
    const { gist, cleanedResponse } = parseImageGist(response);
    
    if (
      gist &&
      gist.kind === "code_screenshot" &&
      gist.language === "TypeScript" &&
      gist.purpose === "authentication logic" &&
      gist.certainty === "high"
    ) {
      console.log("✓ Successfully parsed IMAGE_GIST");
      console.log(`  - Gist:`, gist);
      console.log(`  - Cleaned response starts with: "${cleanedResponse.substring(0, 50)}..."`);
      
      const reason = generateRoutingReasonFromGist(gist, "Gemini 2.5 Flash");
      console.log(`  - Reason: ${reason}`);
      
      if (reason.includes("TypeScript") && reason.includes("authentication logic")) {
        console.log("✓ Generated specific reason mentioning language and purpose\n");
        testsPassed++;
      } else {
        console.log("✗ Reason is too generic\n");
        testsFailed++;
      }
    } else {
      console.log(`✗ Failed: Got gist=${JSON.stringify(gist)}\n`);
      testsFailed++;
    }
  } catch (err) {
    console.log("✗ Test 1 failed:", err, "\n");
    testsFailed++;
  }

  // Test 2: Parse low-certainty code screenshot
  try {
    console.log("Test 2: Parse low-certainty code gist (unknown language)");
    const response = `IMAGE_GIST: {"kind":"code_screenshot","language":"unknown","purpose":"unknown","certainty":"low"}

The code in the image appears to...`;
    
    const { gist, cleanedResponse } = parseImageGist(response);
    
    if (gist && gist.certainty === "low") {
      console.log("✓ Successfully parsed low-certainty IMAGE_GIST");
      console.log(`  - Gist:`, gist);
      
      const reason = generateRoutingReasonFromGist(gist, "Gemini 2.5 Flash");
      console.log(`  - Reason: ${reason}`);
      
      if (reason.includes("screenshot of code") && !reason.includes("unknown")) {
        console.log("✓ Generated safe generic reason without specifics\n");
        testsPassed++;
      } else {
        console.log("✗ Reason should be generic but not mention 'unknown'\n");
        testsFailed++;
      }
    } else {
      console.log(`✗ Failed: Got gist=${JSON.stringify(gist)}\n`);
      testsFailed++;
    }
  } catch (err) {
    console.log("✗ Test 2 failed:", err, "\n");
    testsFailed++;
  }

  // Test 3: Parse terminal output with high certainty
  try {
    console.log("Test 3: Parse high-certainty terminal output gist");
    const response = `IMAGE_GIST: {"kind":"terminal_output","language":"bash","purpose":"npm build error","certainty":"high"}

The terminal output shows an npm build error...`;
    
    const { gist, cleanedResponse } = parseImageGist(response);
    
    if (
      gist &&
      gist.kind === "terminal_output" &&
      gist.certainty === "high"
    ) {
      console.log("✓ Successfully parsed terminal output IMAGE_GIST");
      console.log(`  - Gist:`, gist);
      
      const reason = generateRoutingReasonFromGist(gist, "Gemini 2.5 Pro");
      console.log(`  - Reason: ${reason}`);
      
      // Simplified template: treats terminal as "bash code for X"
      if (reason.includes("bash") && reason.includes("npm build error")) {
        console.log("✓ Generated reason with bash and purpose\n");
        testsPassed++;
      } else {
        console.log("✗ Reason should mention bash and purpose\n");
        testsFailed++;
      }
    } else {
      console.log(`✗ Failed: Got gist=${JSON.stringify(gist)}\n`);
      testsFailed++;
    }
  } catch (err) {
    console.log("✗ Test 3 failed:", err, "\n");
    testsFailed++;
  }

  // Test 4: Parse UI screenshot with high certainty
  try {
    console.log("Test 4: Parse high-certainty UI screenshot gist");
    const response = `IMAGE_GIST: {"kind":"ui_screenshot","language":"React","purpose":"login form interface","certainty":"high"}

This UI shows a login form...`;
    
    const { gist, cleanedResponse } = parseImageGist(response);
    
    if (
      gist &&
      gist.kind === "ui_screenshot" &&
      gist.certainty === "high"
    ) {
      console.log("✓ Successfully parsed UI screenshot IMAGE_GIST");
      console.log(`  - Gist:`, gist);
      
      const reason = generateRoutingReasonFromGist(gist, "Gemini 2.5 Flash");
      console.log(`  - Reason: ${reason}`);
      
      // Simplified template: treats UI as "React code for X"
      if (reason.includes("React") && reason.includes("login form interface")) {
        console.log("✓ Generated reason with React and purpose\n");
        testsPassed++;
      } else {
        console.log("✗ Reason should mention React and purpose\n");
        testsFailed++;
      }
    } else {
      console.log(`✗ Failed: Got gist=${JSON.stringify(gist)}\n`);
      testsFailed++;
    }
  } catch (err) {
    console.log("✗ Test 4 failed:", err, "\n");
    testsFailed++;
  }

  // Test 5: Parse diagram with high certainty
  try {
    console.log("Test 5: Parse high-certainty diagram gist");
    const response = `IMAGE_GIST: {"kind":"diagram","language":"UML","purpose":"system architecture flow","certainty":"high"}

The diagram illustrates...`;
    
    const { gist, cleanedResponse } = parseImageGist(response);
    
    if (
      gist &&
      gist.kind === "diagram" &&
      gist.certainty === "high"
    ) {
      console.log("✓ Successfully parsed diagram IMAGE_GIST");
      console.log(`  - Gist:`, gist);
      
      const reason = generateRoutingReasonFromGist(gist, "Gemini 2.5 Pro");
      console.log(`  - Reason: ${reason}`);
      
      // Simplified template: treats diagram as "UML code for X"
      if (reason.includes("UML") && reason.includes("system architecture flow")) {
        console.log("✓ Generated reason with UML and purpose\n");
        testsPassed++;
      } else {
        console.log("✗ Reason should mention UML and purpose\n");
        testsFailed++;
      }
    } else {
      console.log(`✗ Failed: Got gist=${JSON.stringify(gist)}\n`);
      testsFailed++;
    }
  } catch (err) {
    console.log("✗ Test 5 failed:", err, "\n");
    testsFailed++;
  }

  // Test 6: Parse response without IMAGE_GIST
  try {
    console.log("Test 6: Handle response without IMAGE_GIST");
    const response = `The code in the image does something...`;
    
    const { gist, cleanedResponse } = parseImageGist(response);
    
    if (gist === null && cleanedResponse === response) {
      console.log("✓ Correctly handled missing IMAGE_GIST");
      console.log(`  - Gist: null`);
      console.log(`  - Response unchanged\n`);
      testsPassed++;
    } else {
      console.log(`✗ Failed: Expected null gist and unchanged response\n`);
      testsFailed++;
    }
  } catch (err) {
    console.log("✗ Test 6 failed:", err, "\n");
    testsFailed++;
  }

  // Test 7: JavaScript API handler with high certainty
  try {
    console.log("Test 7: Parse JavaScript API handler gist");
    const response = `IMAGE_GIST: {"kind":"code_screenshot","language":"JavaScript","purpose":"REST API endpoint handler","certainty":"high"}

This JavaScript code defines an API endpoint...`;
    
    const { gist } = parseImageGist(response);
    
    if (gist && gist.language === "JavaScript" && gist.certainty === "high") {
      const reason = generateRoutingReasonFromGist(gist, "Gemini 2.5 Flash");
      console.log(`  - Reason: ${reason}`);
      
      if (reason.includes("JavaScript") && reason.includes("REST API endpoint handler")) {
        console.log("✓ Generated specific reason with language and purpose\n");
        testsPassed++;
      } else {
        console.log("✗ Reason should be specific\n");
        testsFailed++;
      }
    } else {
      console.log(`✗ Failed parsing\n`);
      testsFailed++;
    }
  } catch (err) {
    console.log("✗ Test 7 failed:", err, "\n");
    testsFailed++;
  }

  // Test 8: Low certainty terminal output
  try {
    console.log("Test 8: Parse low-certainty terminal output");
    const response = `IMAGE_GIST: {"kind":"terminal_output","language":"unknown","purpose":"unknown","certainty":"low"}

The terminal shows some output...`;
    
    const { gist } = parseImageGist(response);
    
    if (gist && gist.certainty === "low") {
      const reason = generateRoutingReasonFromGist(gist, "Gemini 2.5 Pro");
      console.log(`  - Reason: ${reason}`);
      
      // Simplified template: unknown language = generic code fallback
      if (reason.includes("screenshot of code") && !reason.includes("unknown")) {
        console.log("✓ Generated generic fallback reason\n");
        testsPassed++;
      } else {
        console.log("✗ Reason should be generic without 'unknown'\n");
        testsFailed++;
      }
    } else {
      console.log(`✗ Failed parsing\n`);
      testsFailed++;
    }
  } catch (err) {
    console.log("✗ Test 8 failed:", err, "\n");
    testsFailed++;
  }

  // Summary
  console.log("=".repeat(60));
  console.log(`Tests passed: ${testsPassed}`);
  console.log(`Tests failed: ${testsFailed}`);
  console.log("=".repeat(60));

  if (testsFailed === 0) {
    console.log("\n✓ All IMAGE_GIST schema tests passed!");
  } else {
    console.log("\n✗ Some tests failed.");
    process.exit(1);
  }
}

runTests();
