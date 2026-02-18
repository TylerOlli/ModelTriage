/**
 * API Client
 *
 * Thin HTTP client for talking to the ModelTriage API.
 * All requests use the stored API key for authentication.
 */

import { getApiKey, getServerUrl } from "./config.js";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getHeaders(): Record<string, string> {
  const key = getApiKey();
  if (!key) {
    throw new Error("Not authenticated. Run `mt auth login` first.");
  }
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

/**
 * Send a prompt to the ModelTriage API and stream the response.
 * Returns a ReadableStream of SSE events.
 */
export async function streamPrompt(opts: {
  prompt: string;
  models?: string[];
  temperature?: number;
  maxTokens?: number;
  files?: Array<{ name: string; content: string; type: string }>;
}): Promise<Response> {
  const url = `${getServerUrl()}/api/stream`;

  const body: Record<string, unknown> = {
    prompt: opts.prompt,
    stream: true,
  };

  if (opts.models && opts.models.length > 0) {
    body.models = opts.models;
  }
  if (opts.temperature !== undefined) {
    body.temperature = opts.temperature;
  }
  if (opts.maxTokens !== undefined) {
    body.maxTokens = opts.maxTokens;
  }
  if (opts.files && opts.files.length > 0) {
    body.files = opts.files;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errorBody: Record<string, unknown> | undefined;
    try {
      errorBody = (await response.json()) as Record<string, unknown>;
    } catch {
      // Response may not be JSON
    }
    throw new ApiError(
      (errorBody?.error as string) || `Request failed with status ${response.status}`,
      response.status,
      errorBody
    );
  }

  return response;
}

/**
 * Send a non-streaming prompt (for comparison mode, returns JSON).
 */
export async function sendPrompt(opts: {
  prompt: string;
  models: string[];
  temperature?: number;
  maxTokens?: number;
  files?: Array<{ name: string; content: string; type: string }>;
}): Promise<{
  routing: Record<string, unknown>;
  results: Array<{
    modelId: string;
    success: boolean;
    text: string;
    model: string;
    latencyMs: number;
    error?: string;
  }>;
}> {
  const url = `${getServerUrl()}/api/stream`;

  const body: Record<string, unknown> = {
    prompt: opts.prompt,
    models: opts.models,
    stream: false,
  };

  if (opts.temperature !== undefined) {
    body.temperature = opts.temperature;
  }
  if (opts.maxTokens !== undefined) {
    body.maxTokens = opts.maxTokens;
  }
  if (opts.files && opts.files.length > 0) {
    body.files = opts.files;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let errorBody: Record<string, unknown> | undefined;
    try {
      errorBody = (await response.json()) as Record<string, unknown>;
    } catch {
      // Response may not be JSON
    }
    throw new ApiError(
      (errorBody?.error as string) || `Request failed with status ${response.status}`,
      response.status,
      errorBody
    );
  }

  return response.json();
}

/**
 * Get current usage stats.
 */
export async function getUsage(): Promise<{
  used: number;
  limit: number;
  remaining: number;
  rateLimit?: {
    limit: string;
    remaining: string;
    used: string;
  };
}> {
  // We parse rate limit headers from a lightweight stream request
  // But since there's no dedicated usage endpoint, we'll do a HEAD-like approach:
  // Send a minimal prompt to get the headers, OR we can call the dashboard API.
  // For now, we'll call the dashboard endpoint.
  const url = `${getServerUrl()}/api/dashboard`;

  const response = await fetch(url, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!response.ok) {
    let errorBody: Record<string, unknown> | undefined;
    try {
      errorBody = (await response.json()) as Record<string, unknown>;
    } catch {
      // Response may not be JSON
    }
    throw new ApiError(
      (errorBody?.error as string) || `Failed to fetch usage`,
      response.status,
      errorBody
    );
  }

  const data = await response.json();
  return {
    used: data.usage?.todayCount ?? 0,
    limit: data.usage?.dailyLimit ?? 200,
    remaining: Math.max(0, (data.usage?.dailyLimit ?? 200) - (data.usage?.todayCount ?? 0)),
  };
}

/**
 * Get rate limit info from response headers.
 */
export function parseRateLimitHeaders(response: Response): {
  limit: number;
  remaining: number;
  used: number;
} | null {
  const limit = response.headers.get("X-RateLimit-Limit");
  const remaining = response.headers.get("X-RateLimit-Remaining");
  const used = response.headers.get("X-RateLimit-Used");

  if (limit && remaining && used) {
    return {
      limit: parseInt(limit, 10),
      remaining: parseInt(remaining, 10),
      used: parseInt(used, 10),
    };
  }
  return null;
}
