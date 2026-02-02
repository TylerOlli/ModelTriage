# Requirements

## Prompt execution (single-answer mode)

- The system must provide a single text input for prompt submission.
- The system must accept plain text prompts up to the configured maximum length.
- The system must execute exactly one model request by default.
- The system must not require the user to select a model in single-answer mode.
- The system must display a loading state immediately after prompt submission.
- Verify Mode must be disabled by default for all new prompt executions.

---

## Streaming output

- The system must stream model output using Server-Sent Events (SSE).
- The system must render output incrementally as tokens are received.
- The system must not buffer the full model response before rendering.
- Partial output must remain visible if streaming ends early.
- Streaming failures must not crash the page.

---

## Routing and transparency

- The system must select a model using rules-based routing.
- The system must display the selected model name to the user.
- The system must display a short, human-readable explanation for the model selection.
- If routing fails, the system must fall back to a default model and indicate that fallback occurred.

---

## Verify Mode execution

- The system must provide an explicit control to enable Verify Mode before execution.
- The system must clearly communicate increased cost and latency when Verify Mode is enabled.
- When Verify Mode is enabled, the system must execute multiple models in parallel.
- Verify Mode must default to two models.
- Verify Mode must not exceed the configured maximum number of models.
- Verify Mode execution must respect all configured cost and usage limits.

---

## Side-by-side response rendering

- The system must render each model response in a separate panel in Verify Mode.
- Each model panel must stream independently.
- A failure in one model panel must not affect other panels.
- The system must remain usable if one or more models fail.

---

## Diff summary

- The system must display a diff summary section in Verify Mode.
- The diff summary must identify:
  - areas of agreement
  - areas of disagreement
  - omissions
  - conflicting assumptions
- The diff summary must not block rendering of model outputs.
- If a diff summary cannot be generated, the system must degrade gracefully and indicate the failure.

---

## Cost, latency, and metadata display

- The system must record latency per model execution.
- The system must display latency to the user per model execution.
- The system must record token usage when provided by the model.
- The system must display estimated cost when available.
- Missing token or cost data must not break the UI.

---

## Error handling and resilience

- Errors must be isolated to the affected model execution.
- Error messages must be human-readable.
- Errors must not terminate other in-progress model executions.
- The system must remain interactive after an error occurs.

---

## Feedback capture (minimal persistence)

- The system must allow a user to select one response as preferred.
- The preferred response selection must be reflected visually in the UI.
- Feedback must only be persisted when persistence is enabled.
- Feedback persistence must respect all persistence conventions and feature flags.

---

## Usage limits and safeguards

- The system must enforce the maximum prompt length.
- The system must enforce the maximum output token limit per model request.
- The system must enforce the maximum number of models allowed in Verify Mode.
- The system must enforce per-session rate limits.
- Requests that exceed limits must be blocked with a clear, user-facing message.

---

## Persistence (MVP)

- The system must support a working database connection.
- Database writes must be gated behind the ENABLE_DB_WRITES feature flag.
- The system must persist only:
  - request metadata (model name, latency, token usage, estimated cost, timestamp)
  - optional user feedback (preferred response, rating)
- The system must not persist:
  - full prompt text
  - full raw model outputs
  - user profiles or long-term identities
- Persistence must be safe to disable in local development without breaking functionality.