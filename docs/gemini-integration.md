# Google Gemini Integration

## Overview
Integrated Google Gemini as a third LLM provider alongside OpenAI and Anthropic.

## Files Changed

### 1. **lib/llm/providers/gemini.ts** (NEW)
- Created new provider using `@google/genai` SDK
- Implements `LLMRequest -> LLMResponse` interface
- Supports temperature and maxTokens configuration
- Returns latency, token usage, and error handling

### 2. **lib/llm/types.ts**
- Added two new model IDs to `ModelId` union:
  - `gemini-2.5-flash` - Fast and efficient
  - `gemini-2.5-pro` - Advanced capabilities

### 3. **lib/llm/router.ts**
- Imported `runGemini` provider
- Added routing cases for Gemini models
- Updated error message with supported Gemini models

### 4. **lib/llm/intent-router.ts**
- Updated classifier prompt to include Gemini models as routing options
- Gemini Flash for: coding_quick, writing_light, analysis_standard
- Gemini Pro for: coding_complex_impl, writing_standard, analysis_complex
- Updated routing logic to accept classifier's model choice

### 5. **src/app/page.tsx**
- Added Gemini models to `availableModels` array in UI
- Both models now appear in Advanced mode model selector

## Environment Setup
```bash
# Add to .env.local
GEMINI_API_KEY=your_api_key_here
```

## Testing

### Single-Answer Mode (Auto-routing)
1. Go to http://localhost:3000
2. Ensure "Advanced" toggle is OFF
3. Submit a prompt like: "Summarize this text in 3 bullet points: ..."
4. The classifier may automatically select `gemini-2.5-flash` for light tasks

### Verify Mode (Manual Selection)
1. Turn ON the "Advanced" toggle
2. Select models to compare:
   - ✅ gpt-5-mini
   - ✅ gemini-2.5-flash
   - ✅ gemini-2.5-pro
3. Submit a prompt like: "What is the best LLM for code generation?"
4. You should see side-by-side responses from selected models

### Example Test Request
```bash
curl -X POST http://localhost:3000/api/stream \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a hello world function in Python",
    "models": ["gpt-5-mini", "gemini-2.5-flash"]
  }'
```

Expected response structure:
```json
{
  "routing": { "mode": "manual" },
  "results": [
    {
      "modelId": "gpt-5-mini",
      "text": "...",
      "latencyMs": 2000,
      ...
    },
    {
      "modelId": "gemini-2.5-flash",
      "text": "...",
      "latencyMs": 1500,
      ...
    }
  ]
}
```

## Key Features
- ✅ Gemini models integrated into existing provider abstraction
- ✅ No changes to API contract or frontend request shape
- ✅ **Auto-routing actively selects Gemini models for appropriate tasks**
  - gemini-2.5-flash: cost-aware alternative for light tasks (confidence < 0.6)
  - gemini-2.5-pro: alternative for complex tasks (confidence < 0.6)
- ✅ Manual selection allows side-by-side comparison with other providers
- ✅ Token usage and latency tracked per request
- ✅ Graceful error handling per model

## Auto-Routing with Gemini

Gemini models are now part of the intelligent routing system:

### When Gemini is Selected
- **gemini-2.5-flash** (cost-efficient):
  - Light coding tasks (confidence < 0.6)
  - Quick summaries and rewrites (confidence < 0.6)
  - Standard analysis (confidence < 0.6)

- **gemini-2.5-pro** (advanced):
  - Complex implementations (confidence < 0.6)
  - Code review and debugging (confidence < 0.6)
  - High-stakes writing fallback (confidence < 0.6)
  - Complex analysis (confidence < 0.6)

### Cost Controls
- Prefers gemini-2.5-flash over gemini-2.5-pro when both viable
- Will not select gemini-2.5-pro for trivial prompts
- Very low confidence (< 0.5) defaults to gpt-5-mini instead

## Notes
- Gemini Flash is optimized for speed and cost-efficiency
- Gemini Pro provides more advanced capabilities
- API route runs in Node.js runtime (required for SDK)
- All provider calls are parallel and isolated (one failure doesn't affect others)
