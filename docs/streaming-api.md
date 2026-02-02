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
| `model` | string | No | `"mock-model-1"` | Model identifier |
| `maxTokens` | number | No | `800` | Maximum output tokens |

### Example Request

```bash
curl -X POST http://localhost:3000/api/stream \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello, how are you?"}'
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
import { MockProvider } from '@/lib/providers/mock-provider';

const provider = new MockProvider();
const response = provider.stream('Hello!');

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

By default, the API uses `MockProvider` unless `USE_LIVE_PROVIDERS=true`:

- **Development**: MockProvider (no API costs)
- **Production**: Real providers (OpenAI, Anthropic) when flag is set

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
