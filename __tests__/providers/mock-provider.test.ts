/**
 * Unit tests for MockProvider streaming behavior
 */

import { MockProvider } from "@/lib/providers/mock-provider";

async function runTests() {
  console.log("Running MockProvider tests...\n");

  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: Streaming returns chunks in order
  try {
    console.log("Test 1: Streaming returns chunks in order");
    const provider = new MockProvider(10); // Fast delay for testing
    const prompt = "Hello world";
    const response = provider.stream(prompt);

    const receivedChunks: string[] = [];
    for await (const chunk of response.chunks) {
      receivedChunks.push(chunk.content);
      console.log(`  Received chunk ${receivedChunks.length}: "${chunk.content}"`);
    }

    if (receivedChunks.length > 0) {
      console.log("  ✓ Received chunks in order\n");
      testsPassed++;
    } else {
      throw new Error("No chunks received");
    }
  } catch (error) {
    console.error("  ✗ Test failed:", error);
    testsFailed++;
  }

  // Test 2: Deterministic output (same prompt -> same output)
  try {
    console.log("Test 2: Deterministic output");
    const provider = new MockProvider(10);
    const prompt = "Test prompt";

    const response1 = provider.stream(prompt);
    const chunks1: string[] = [];
    for await (const chunk of response1.chunks) {
      chunks1.push(chunk.content);
    }

    const response2 = provider.stream(prompt);
    const chunks2: string[] = [];
    for await (const chunk of response2.chunks) {
      chunks2.push(chunk.content);
    }

    const output1 = chunks1.join("");
    const output2 = chunks2.join("");

    if (output1 === output2) {
      console.log(`  ✓ Same prompt produces same output`);
      console.log(`    Output: "${output1}"\n`);
      testsPassed++;
    } else {
      throw new Error("Outputs differ for same prompt");
    }
  } catch (error) {
    console.error("  ✗ Test failed:", error);
    testsFailed++;
  }

  // Test 3: Different prompts produce different outputs
  try {
    console.log("Test 3: Different prompts produce different outputs");
    const provider = new MockProvider(10);

    const response1 = provider.stream("Prompt A");
    const chunks1: string[] = [];
    for await (const chunk of response1.chunks) {
      chunks1.push(chunk.content);
    }

    const response2 = provider.stream("Prompt B");
    const chunks2: string[] = [];
    for await (const chunk of response2.chunks) {
      chunks2.push(chunk.content);
    }

    const output1 = chunks1.join("");
    const output2 = chunks2.join("");

    if (output1 !== output2) {
      console.log("  ✓ Different prompts produce different outputs\n");
      testsPassed++;
    } else {
      throw new Error("Same output for different prompts");
    }
  } catch (error) {
    console.error("  ✗ Test failed:", error);
    testsFailed++;
  }

  // Test 4: Metadata is provided
  try {
    console.log("Test 4: Metadata is provided");
    const provider = new MockProvider(10);
    const prompt = "Test";
    const response = provider.stream(prompt);

    // Consume stream
    for await (const _ of response.chunks) {
      // Just consume
    }

    const metadata = await response.metadata;

    if (
      metadata.provider === "mock" &&
      metadata.model &&
      typeof metadata.latency === "number" &&
      metadata.tokenUsage
    ) {
      console.log("  ✓ Metadata provided correctly");
      console.log(`    Provider: ${metadata.provider}`);
      console.log(`    Model: ${metadata.model}`);
      console.log(`    Latency: ${metadata.latency}ms`);
      console.log(`    Tokens: ${metadata.tokenUsage.total}\n`);
      testsPassed++;
    } else {
      throw new Error("Metadata incomplete");
    }
  } catch (error) {
    console.error("  ✗ Test failed:", error);
    testsFailed++;
  }

  // Test 5: Done flag is set on last chunk
  try {
    console.log("Test 5: Done flag is set correctly");
    const provider = new MockProvider(10);
    const response = provider.stream("Test");

    let lastChunk;
    let chunkCount = 0;
    for await (const chunk of response.chunks) {
      chunkCount++;
      if (chunk.done && chunkCount < 2) {
        throw new Error("Done flag set too early");
      }
      lastChunk = chunk;
    }

    if (lastChunk?.done) {
      console.log(`  ✓ Done flag set on last chunk (${chunkCount} total chunks)\n`);
      testsPassed++;
    } else {
      throw new Error("Done flag not set on last chunk");
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
