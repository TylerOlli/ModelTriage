/**
 * Parse API request - supports both JSON and multipart/form-data
 */

export interface ParsedRequest {
  prompt: string;
  models?: string[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  previousPrompt?: string;
  previousResponse?: string;
  files: File[];
}

/**
 * Parse request body - handles both JSON and multipart/form-data
 */
export async function parseInferenceRequest(
  request: Request
): Promise<ParsedRequest> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    // Parse multipart form data
    const formData = await request.formData();

    const prompt = formData.get("prompt") as string;
    const modelsRaw = formData.get("models") as string | null;
    const temperatureRaw = formData.get("temperature") as string | null;
    const maxTokensRaw = formData.get("maxTokens") as string | null;
    const streamRaw = formData.get("stream") as string | null;
    const previousPromptRaw = formData.get("previousPrompt") as string | null;
    const previousResponseRaw = formData.get("previousResponse") as string | null;

    // Parse JSON fields
    const models = modelsRaw ? JSON.parse(modelsRaw) : undefined;
    const temperature = temperatureRaw ? parseFloat(temperatureRaw) : undefined;
    const maxTokens = maxTokensRaw ? parseInt(maxTokensRaw, 10) : undefined;
    const stream = streamRaw === "true";

    // Collect files
    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith("file_") && value instanceof File) {
        files.push(value);
      }
    }

    return {
      prompt,
      models,
      temperature,
      maxTokens,
      stream,
      previousPrompt: previousPromptRaw || undefined,
      previousResponse: previousResponseRaw || undefined,
      files,
    };
  } else {
    // Parse JSON
    const body = await request.json();
    return {
      prompt: body.prompt,
      models: body.models,
      temperature: body.temperature,
      maxTokens: body.maxTokens,
      stream: body.stream,
      previousPrompt: body.previousPrompt,
      previousResponse: body.previousResponse,
      files: [],
    };
  }
}
