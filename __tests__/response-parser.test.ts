/**
 * Unit tests for response parser
 */

import { parseResponse } from "../lib/response-parser";

function runTests() {
  console.log("Running response parser tests...\n");

  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: Fenced code block with language
  try {
    console.log("Test 1: Fenced code block with language");
    const input = `Here's some TypeScript code:

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`

That's a greeting function.`;

    const segments = parseResponse(input);

    if (segments.length !== 3) {
      throw new Error(`Expected 3 segments, got ${segments.length}`);
    }

    if (segments[0].type !== "text") {
      throw new Error("First segment should be text");
    }

    if (segments[1].type !== "code" || segments[1].language !== "typescript") {
      throw new Error("Second segment should be code with typescript language");
    }

    if (!segments[1].content.includes("function greet")) {
      throw new Error("Code content should include function definition");
    }

    if (segments[2].type !== "text") {
      throw new Error("Third segment should be text");
    }

    console.log("  ✓ Fenced code block parsed correctly\n");
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 2: Fenced code block without language
  try {
    console.log("Test 2: Fenced code block without language");
    const input = `Example code:

\`\`\`
const x = 42;
console.log(x);
\`\`\`

Done.`;

    const segments = parseResponse(input);

    if (segments.length !== 3) {
      throw new Error(`Expected 3 segments, got ${segments.length}`);
    }

    if (segments[1].type !== "code" || segments[1].language !== undefined) {
      throw new Error("Code segment should have no language");
    }

    console.log("  ✓ Fenced code without language parsed correctly\n");
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 3: Mixed prose and multiple code blocks
  try {
    console.log("Test 3: Mixed prose and multiple code blocks");
    const input = `First paragraph.

\`\`\`js
const a = 1;
\`\`\`

Middle text.

\`\`\`python
def hello():
    print("hi")
\`\`\`

Last paragraph.`;

    const segments = parseResponse(input);

    if (segments.length !== 5) {
      throw new Error(`Expected 5 segments, got ${segments.length}`);
    }

    const codeSegments = segments.filter((s) => s.type === "code");
    if (codeSegments.length !== 2) {
      throw new Error("Should have 2 code segments");
    }

    if (codeSegments[0].language !== "js") {
      throw new Error("First code block should be js");
    }

    if (codeSegments[1].language !== "python") {
      throw new Error("Second code block should be python");
    }

    console.log("  ✓ Multiple code blocks parsed correctly\n");
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 4: Unfenced multi-line code detection
  try {
    console.log("Test 4: Unfenced multi-line code detection");
    const input = `Here's the solution:

function calculateSum(arr) {
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i];
  }
  return sum;
}

That function adds up array elements.`;

    const segments = parseResponse(input);

    const codeSegments = segments.filter((s) => s.type === "code");
    if (codeSegments.length !== 1) {
      throw new Error(`Should detect 1 unfenced code block, got ${codeSegments.length}`);
    }

    if (!codeSegments[0].content.includes("function calculateSum")) {
      throw new Error("Code content should include function");
    }

    console.log("  ✓ Unfenced code detected correctly\n");
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 5: Normal text isn't wrapped as code
  try {
    console.log("Test 5: Normal text not mistaken for code");
    const input = `This is a paragraph with some words.

Another paragraph here.

And a third one.`;

    const segments = parseResponse(input);

    const codeSegments = segments.filter((s) => s.type === "code");
    if (codeSegments.length !== 0) {
      throw new Error(`Normal text shouldn't be treated as code, got ${codeSegments.length} code segments`);
    }

    console.log("  ✓ Normal text not mistaken for code\n");
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Test 6: JSON-like structures detected as code
  try {
    console.log("Test 6: JSON structures detected as code");
    const input = `Here's the config:

{
  "name": "my-app",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.0.0"
  }
}

That's the package.json structure.`;

    const segments = parseResponse(input);

    const codeSegments = segments.filter((s) => s.type === "code");
    if (codeSegments.length !== 1) {
      throw new Error(`Should detect JSON as code, got ${codeSegments.length} code segments`);
    }

    console.log("  ✓ JSON detected as code\n");
    testsPassed++;
  } catch (err) {
    console.error(`  ✗ FAILED: ${err}\n`);
    testsFailed++;
  }

  // Summary
  console.log("=".repeat(50));
  console.log(`Tests passed: ${testsPassed}`);
  console.log(`Tests failed: ${testsFailed}`);
  console.log("=".repeat(50));

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests();
