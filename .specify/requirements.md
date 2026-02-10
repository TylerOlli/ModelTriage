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

---

## File attachments

- The system must allow users to attach up to 3 files per request.
- The system must support text file attachments:
  - `.txt`, `.log`, `.json`, `.md`, `.ts`, `.tsx`, `.js`, `.jsx`, `.env`, `.yml`, `.yaml`
- The system must support image file attachments:
  - `.png`, `.jpg` (`.jpeg`), `.webp`
- The system must enforce file size limits:
  - Text files: 2MB maximum per file
  - Images: 5MB maximum per file
- The system must enforce attachment count limits:
  - Maximum 3 files total per request
  - Maximum 2 images per request
- The system must process text files with automatic truncation:
  - Maximum 20,000 characters per text file
  - Maximum 35,000 characters total across all text files
  - Files exceeding limits must be truncated with clear indication to the user
- The system must process images with automatic optimization:
  - Resize to maximum dimension of 1024px (maintaining aspect ratio)
  - Apply compression (JPEG/WebP: 80% quality, PNG: level 7)
- The system must provide smart summarization:
  - If total text exceeds 12,000 characters, generate an LLM summary
  - Use gpt-5-mini for summarization to minimize cost
  - Send summary instead of raw text to the main model
- The system must only send images to vision-capable models:
  - In auto-routing mode: automatically select a vision-capable model if images are attached
  - In Compare mode: filter to only vision-capable models or return error if none selected
- The system must display security warnings:
  - "⚠️ Avoid including secrets or sensitive data. Attachments are sent to the model."
- The system must not persist uploaded files:
  - Process files in-memory only
  - Compatible with serverless runtime
- The system must display attachment indicators:
  - File chips showing icon, name, size, and remove button
  - Counter showing X/3 files attached

---

## Drag-and-drop file upload

- The system must support drag-and-drop file upload on the prompt input area.
- The system must provide visual feedback when dragging files over the prompt:
  - Blue border and ring on textarea
  - Semi-transparent overlay with paperclip icon and "Drop files to attach" message
  - Display remaining file slots if files already attached
- The system must validate dropped files against supported file types.
- The system must prevent drag-and-drop when:
  - Streaming is in progress
  - Maximum file count (3) is already reached
- The system must handle multiple files dropped simultaneously:
  - Attach all valid files
  - Show error message for any invalid file types
  - Enforce total file count limit
- The system must prevent browser's default file-open behavior.
- The system must handle nested drag events without flickering.
- Drag-and-drop must integrate seamlessly with the existing "Attach Files" button.

---

## Attachment-aware routing

- The system must adjust model routing based on attachment type.
- When text files are uploaded:
  - Always route to strong coding models (Claude Sonnet 4.5)
  - Never downgrade to fast/cheap models like gpt-5-mini
  - Bypass lightweight prompt detection
- When images are uploaded:
  - Only route to vision-capable models
  - Prefer vision-optimized models (Gemini 2.5 Pro, Claude Opus 4.5)
- The system must generate text gists for better routing decisions:
  - Analyze file content and prompt together
  - Use gist to inform model selection
- The system must generate image gists for vision models:
  - Vision models generate IMAGE_GIST during streaming
  - Use structured schema for image analysis
  - Upgrade routing reason with better context
- The system must detect file complexity:
  - Simple configuration files vs complex code
  - Adjust routing confidence based on complexity

---

## Prompt history

- The system must maintain a history of recent prompts.
- The system must store the last 10 prompts in localStorage.
- The system must deduplicate consecutive identical prompts.
- The system must provide a "History" button to access previous prompts.
- The system must display history in a dropdown popover:
  - Show all saved prompts with truncation for long prompts
  - Click to reuse a previous prompt
  - Provide "Clear all history" action
- History must persist across browser sessions via localStorage.
- History must be session-specific (not shared across devices).

---

## Conversation continuation

- The system must support follow-up prompts with conversation context.
- After receiving a response, the system must display "Ask a follow-up" button.
- When a follow-up is initiated:
  - Include previous prompt and response as context
  - Send to the same model that provided the original response
  - Clearly indicate continuation with visual feedback
- The system must change prompt placeholder to "Ask a follow-up question..." when in continuation mode.
- In Compare mode, the system must provide inline follow-up input:
  - Textarea below each comparison result
  - Send follow-up to all models used in comparison
  - Include full comparison context
- The system must allow users to break continuation and start fresh:
  - "Clear" button resets conversation context
  - Starting a new prompt without follow-up breaks the chain

---

## Safe mode switching

- The system must detect when a user attempts to switch modes while results are present.
- When results exist, the system must display an inline confirmation before switching:
  - Warning message explaining results will be cleared
  - "Cancel" and "Switch mode" buttons
  - Orange warning styling for visibility
- The system must preserve previous results when switching modes:
  - Store Auto-select results: response, metadata, routing, error
  - Store Compare results: modelPanels, diffSummary
  - Keep in component state (session-only, no localStorage)
- After mode switch, the system must offer to restore previous results:
  - Display "Restore previous results" button
  - Clicking restores exact previous state
  - Button dismissed after restoration
- If no results exist, mode switching must proceed immediately without confirmation.
- Mode switching UI must include smooth animations (fade-in, slide-in).

---

## Enhanced UI states

- The system must display streaming stage indicators:
  - "Connecting..." - Initial connection
  - "Routing..." - Model selection in progress
  - "Contacting model..." - Request sent to provider
  - "Streaming..." - Receiving response
- The system must provide a Reset button for the prompt input:
  - Require double-click confirmation to prevent accidental clear
  - First click: show "Click again to clear"
  - Second click within timeout: clear prompt
- The system must display character count with warning state:
  - Show "X / 4,000" character counter
  - Turn red when over limit
  - Disable submit when over limit
- The system must display attachment file chips:
  - Icon (📄 for text, 🖼️ for images)
  - Filename and size
  - Remove button (X)
  - Gray background with border
- The system must show file counter when files attached:
  - Display "X/3" next to "Attach Files" button
- The system must display security warnings for attachments:
  - Yellow background warning about sensitive data