/**
 * Test script for streaming API
 * Tests SSE streaming from the API route
 * 
 * Run with: npm run test:stream
 * Make sure dev server is running first: npm run dev
 */

async function testStreamAPI() {
  console.log("=== Testing Stream API ===\n");

  const testPrompts = [
    "Hello, how are you?",
    "Write some code for me",
    "Give me a list",
  ];

  for (const prompt of testPrompts) {
    console.log(`\nPrompt: "${prompt}"`);
    console.log("─".repeat(50));

    try {
      const response = await fetch("http://localhost:3000/api/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error("Error:", error);
        continue;
      }

      if (!response.body) {
        console.error("No response body");
        continue;
      }

      // Read SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      process.stdout.write("Response: ");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));

            if (data.type === "chunk") {
              process.stdout.write(data.content);
            } else if (data.type === "metadata") {
              console.log("\n");
              console.log(`Model: ${data.metadata.model}`);
              console.log(`Provider: ${data.metadata.provider}`);
              console.log(`Latency: ${data.metadata.latency}ms`);
              console.log(`Tokens: ${data.metadata.tokenUsage?.total}`);
            } else if (data.type === "error") {
              console.error("\nError:", data.error);
            }
          }
        }
      }
    } catch (error) {
      console.error("Request failed:", error);
    }
  }

  console.log("\n=== Test Complete ===");
}

// Test validation
async function testValidation() {
  console.log("\n=== Testing Input Validation ===\n");

  // Test 1: Missing prompt
  console.log("Test 1: Missing prompt");
  try {
    const response = await fetch("http://localhost:3000/api/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const result = await response.json();
    console.log(`  Status: ${response.status}`);
    console.log(`  Error: ${result.error}`);
  } catch (error) {
    console.error("  Failed:", error);
  }

  // Test 2: Prompt too long
  console.log("\nTest 2: Prompt exceeds max length");
  try {
    const longPrompt = "a".repeat(4001);
    const response = await fetch("http://localhost:3000/api/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: longPrompt }),
    });
    const result = await response.json();
    console.log(`  Status: ${response.status}`);
    console.log(`  Error: ${result.error}`);
  } catch (error) {
    console.error("  Failed:", error);
  }

  console.log("\n=== Validation Tests Complete ===");
}

async function main() {
  console.log("Make sure the dev server is running (npm run dev)\n");
  
  await testStreamAPI();
  await testValidation();
}

main().catch(console.error);
