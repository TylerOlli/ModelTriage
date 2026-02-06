# Streaming API Documentation

## Overview

The streaming API endpoint provides Server-Sent Events (SSE) for real-time LLM response streaming.

## Endpoint

**URL:** `/api/stream`  
**Method:** `POST`  
**Runtime:** Node.js  
**Content-Type:** `application/json`

## Request

### Body Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `prompt` | string | Yes | - | The input prompt (max 4,000 characters) |
| `model` | string | No | `"mock-model-1"` | Model identifier (single-answer mode) |
| `models` | string[] | No | - | Array of model identifiers (Verify Mode, 2-3 models) |
| `maxTokens` | number | No | `800` | Maximum output tokens |

### Example Requests

**Single-Answer Mode:**

```bash
curl -X POST http://localhost:3000/api/stream \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello, how are you?"}'
```

**Verify Mode (2-3 models):**

```bash
curl -X POST http://localhost:3000/api/stream \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Compare React and Vue", "models": ["model-1", "model-2"]}'
```

## Response

### SSE Event Types

The API streams events in SSE format: `data: {json}\n\n`

#### 1. Chunk Event

Sent multiple times as content is generated.

```json
{
  "type": "chunk",
  "content": "text content",
  "done": false
}
```

#### 2. Metadata Event

Sent once after streaming completes.

```json
{
  "type": "metadata",
  "metadata": {
    "model": "mock-model-1",
    "provider": "mock",
    "latency": 450,
    "tokenUsage": {
      "prompt": 10,
      "completion": 35,
      "total": 45
    },
    "estimatedCost": 0
  }
}
```

#### 3. Error Event

Sent if an error occurs during streaming.

**Per-Model Error (Verify Mode):**

Isolated to a specific panel. Other models continue processing.

```json
{
  "type": "error",
  "modelId": "model-1",
  "error": "Provider timeout"
}
```

**Global Error:**

Affects the entire stream (all panels in Verify Mode).

```json
{
  "type": "error",
  "error": "Invalid request"
}
```

## Error Responses

### 400 Bad Request

Returned for validation errors:

```json
{
  "error": "Prompt is required and must be a string"
}
```

```json
{
  "error": "Prompt exceeds maximum length of 4,000 characters"
}
```

```json
{
  "error": "Verify Mode requires at least 2 models"
}
```

```json
{
  "error": "Maximum 3 models allowed in Verify Mode"
}
```

### 500 Internal Server Error

Returned for server errors:

```json
{
  "error": "Internal server error"
}
```

## Client Examples

### JavaScript (Fetch API)

```javascript
const response = await fetch('/api/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: 'Hello!' })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const text = decoder.decode(value);
  const lines = text.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      console.log(data);
    }
  }
}
```

### TypeScript (with Provider interface)

```typescript
import { streamGemini } from '@/lib/llm/providers/gemini';

const request = { prompt: 'Hello!', images: [] };
const response = streamGemini(request, 'gemini-2.5-flash');

// Stream chunks
for await (const chunk of response.chunks) {
  console.log(chunk.content);
}

// Get metadata
const metadata = await response.metadata;
console.log(metadata);
```

## Testing

### Unit Tests
```bash
npm run test:mock
```

### API Integration Tests
```bash
npm run test:stream  # Requires dev server running
```

### Browser Test Client
Open [http://localhost:3000/test-stream.html](http://localhost:3000/test-stream.html)

## Implementation Details

### Streaming Behavior

- **No buffering**: Chunks are sent as they arrive from the provider
- **Request-scoped**: Each request creates a new stream (no persistent connections)
- **Independent**: One stream per request, isolated error handling
- **Clean closure**: Stream closes automatically on completion or error

### Limits (per spec)

- Max prompt length: 4,000 characters
- Max output tokens: 800 (default)
- Rate limiting: 10 requests per session per 5 minutes (to be implemented)

### Provider Usage

The API uses real LLM providers:

- **OpenAI**: GPT models (gpt-5-mini, gpt-5.2)
- **Anthropic**: Claude models (Opus, Sonnet, Haiku)
- **Google**: Gemini models (Flash, Pro)

## Conventions

Following `.specify/conventions.md`:

✅ Node.js runtime (not Edge)  
✅ SSE for streaming transport  
✅ No buffering before sending  
✅ Validates input length  
✅ Enforces max output tokens  
✅ No database writes  
✅ Isolated error handling  
✅ Safe for serverless deployment
