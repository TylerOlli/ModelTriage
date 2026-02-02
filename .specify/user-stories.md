# User Stories

## Prompt execution (single-answer mode)

### 1. Submit a prompt
As a user, I want to submit a single prompt so that I can receive an AI-generated response without choosing a model.

Acceptance criteria:
- A single text input accepts plain text
- Submitting the prompt triggers exactly one model execution by default
- Verify Mode is OFF by default
- A loading state is shown immediately after submission

---

### 2. Stream a response
As a user, I want to see the response stream as it is generated so that I can read results without waiting for completion.

Acceptance criteria:
- Output is streamed using Server-Sent Events (SSE)
- Tokens appear progressively in the UI
- Partial output remains visible if streaming ends early
- The UI does not buffer the entire response before rendering

---

### 3. View routing explanation
As a user, I want to see which model was selected and why so that model choice is transparent.

Acceptance criteria:
- The selected model name is displayed
- A short, human-readable reason for the selection is shown
- If routing fails, a clear fallback model is used and indicated

---

## Verify Mode (optional, higher cost)

### 4. Enable Verify Mode
As a user, I want to enable Verify Mode so that I can compare outputs across multiple models for higher-stakes prompts.

Acceptance criteria:
- Verify Mode is clearly labeled as higher cost and higher latency
- Verify Mode must be explicitly enabled before execution
- When enabled, Verify Mode runs multiple models in parallel
- Verify Mode defaults to two models and cannot exceed the configured maximum

---

### 5. View side-by-side responses
As a user, I want to see multiple model responses side by side so that I can compare quality and content easily.

Acceptance criteria:
- Each model response is rendered in its own panel
- Panels stream independently
- A failure in one panel does not affect other panels
- The page does not crash if one model errors

---

### 6. View a diff summary
As a user, I want a concise summary of agreement and disagreement so that I can understand differences without reading every response in full.

Acceptance criteria:
- A diff summary section is displayed in Verify Mode
- The summary highlights:
  - agreement
  - disagreement
  - omissions
  - conflicting assumptions
- The summary does not block rendering of model outputs
- If a diff cannot be generated, the UI degrades gracefully

---

## Cost, latency, and reliability

### 7. View latency and cost metadata
As a user, I want to see latency and estimated cost so that I can understand tradeoffs between models.

Acceptance criteria:
- Latency is displayed per model execution
- Token usage or estimated cost is displayed when available
- Missing cost or token data does not break the UI

---

### 8. Handle model failures gracefully
As a user, I want clear feedback when a model fails so that I understand what happened without losing other results.

Acceptance criteria:
- Errors are isolated to the affected model panel
- Error messages are human-readable
- Other model outputs continue to render normally
- The page remains usable after an error

---

## Feedback and persistence (minimal)

### 9. Select a preferred response
As a user, I want to mark a response as preferred so that my feedback can be recorded for future improvement.

Acceptance criteria:
- A user can select one response as preferred
- Selection is confirmed visually in the UI
- Feedback is stored only when persistence is enabled
- Feedback storage respects all persistence and feature-flag conventions

---

## Safeguards and limits

### 10. Enforce usage limits
As a user, I want the system to prevent excessive usage so that costs and performance remain predictable.

Acceptance criteria:
- Prompt length limits are enforced in the UI
- Output token limits are enforced per model request
- Verify Mode cannot exceed the configured model maximum
- Requests exceeding rate limits are blocked with a clear message