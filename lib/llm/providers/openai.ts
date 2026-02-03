/**
 * OpenAI provider implementation
 */

import OpenAI from "openai";
import type { LLMRequest, LLMResponse } from "../types";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function runOpenAI(request: LLMRequest): Promise<LLMResponse> {
  const startTime = Date.now();

  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: request.prompt,
        },
      ],
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 1000,
    });

    const latencyMs = Date.now() - startTime;
    const text = completion.choices[0]?.message?.content || "";

    return {
      text,
      model: "gpt-5-mini",
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : "Unknown error";

    return {
      text: "",
      model: "gpt-5-mini",
      latencyMs,
      error: errorMessage,
    };
  }
}
