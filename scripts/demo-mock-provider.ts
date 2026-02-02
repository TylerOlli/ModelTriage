/**
 * Demo script showing MockProvider streaming in action
 * Run with: npm run demo:mock
 */

import { MockProvider } from "@/lib/providers/mock-provider";

async function demo() {
  console.log("=== MockProvider Streaming Demo ===\n");

  const provider = new MockProvider(100); // 100ms delay between chunks

  const prompts = [
    "Hello world",
    "Write some code",
    "Give me a list of items",
  ];

  for (const prompt of prompts) {
    console.log(`\nPrompt: "${prompt}"`);
    console.log("─".repeat(50));

    const response = provider.stream(prompt);

    // Stream and display chunks as they arrive
    process.stdout.write("Response: ");
    for await (const chunk of response.chunks) {
      process.stdout.write(chunk.content);
    }
    console.log("\n");

    // Get metadata after streaming completes
    const metadata = await response.metadata;
    console.log(`Model: ${metadata.model}`);
    console.log(`Provider: ${metadata.provider}`);
    console.log(`Latency: ${metadata.latency}ms`);
    console.log(`Tokens: ${metadata.tokenUsage?.total}`);
  }

  console.log("\n=== Demo Complete ===");
}

demo().catch(console.error);
