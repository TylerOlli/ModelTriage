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

---

## File attachments

### 11. Attach files to prompts
As a user, I want to attach files (text and images) to my prompts so that I can ask questions about specific documents or get analysis of images.

Acceptance criteria:
- Can attach up to 3 files per request
- Supported text files: .txt, .log, .json, .md, .ts, .tsx, .js, .jsx, .env, .yml, .yaml
- Supported images: .png, .jpg, .webp
- Text files are automatically truncated if too large
- Images are automatically optimized and resized
- File chips display with icon, name, size, and remove button
- Security warning displayed about sensitive data

### 12. Drag and drop files
As a user, I want to drag files directly onto the prompt input so that I can quickly attach files without using the file picker.

Acceptance criteria:
- Can drag files anywhere over the prompt area
- Blue highlight and overlay appear when dragging
- Dropped files are validated and attached
- Invalid file types show clear error message
- Multiple files can be dropped at once
- Works seamlessly with "Attach Files" button

### 13. Smart routing with attachments
As a user, I want the system to automatically select appropriate models based on my attachments so that I get the best analysis for my content.

Acceptance criteria:
- Code files route to strong coding models (Claude Sonnet 4.5)
- Images route to vision-capable models only
- File content analyzed for better routing decisions
- Image gist generated for vision models
- Never downgrade to fast models when files are uploaded

---

## Prompt history and reuse

### 14. Access prompt history
As a user, I want to see my recent prompts so that I can reuse or modify previous questions.

Acceptance criteria:
- History button appears when prompts have been submitted
- Dropdown shows last 10 prompts
- Click a prompt to reuse it
- Can clear all history
- History persists across browser sessions
- No consecutive duplicate prompts saved

---

## Conversation continuation

### 15. Ask follow-up questions
As a user, I want to ask follow-up questions that reference my previous prompt and response so that I can have a conversation without repeating context.

Acceptance criteria:
- "Ask a follow-up" button appears after receiving response
- Previous prompt and response included as context
- Placeholder changes to indicate follow-up mode
- In Compare mode, inline follow-up input available
- Can break continuation and start fresh with Clear button
- Visual indicator shows when in continuation mode

---

## Safe mode switching

### 16. Switch modes safely
As a user, I want confirmation before switching modes when I have results so that I don't accidentally lose my work.

Acceptance criteria:
- Warning appears when attempting to switch with results present
- Can cancel or confirm the switch
- Previous results are stored temporarily
- "Restore previous results" button appears after switch
- Can restore exact previous state
- No confirmation needed if no results exist
- Smooth animations during transitions

---

# Phase 1: Monetization — Auth & Usage (shipped)

## Authentication

### 17. Sign up and log in
As a user, I want to create an account and log in so that I can access higher usage limits and personalized features.

Acceptance criteria:
- Login/signup modal with email and password fields
- Toggle between login and signup modes
- Password strength requirements enforced (8+ chars, uppercase, lowercase, number)
- Clear error messages for invalid credentials or duplicate accounts
- Successful signup creates a free-tier account automatically
- Auth state persists across page reloads

---

### 18. View my usage
As a user, I want to see how many requests I've used today so that I know when I'm approaching my limit.

Acceptance criteria:
- User menu shows usage bar (used / daily limit)
- Upgrade banner appears when approaching the limit
- Auth gate blocks requests when limit exceeded
- Anonymous users see lifetime usage and prompt to sign up
- Free users see daily usage and prompt to upgrade
- Usage resets at midnight UTC for authenticated users

---

## Multi-page navigation

### 19. Navigate between pages
As a user, I want to access different sections of ModelTriage so that I can view pricing, learn about the product, and manage my account.

Acceptance criteria:
- Shared navigation bar on all pages
- Public pages (Pricing, About) visible to all users
- Authenticated pages (Dashboard) visible only when signed in
- Sign-in button visible when logged out, styled for visual weight
- Protected pages redirect to homepage if not authenticated

---

### 20. View pricing plans
As a user, I want to see what's included in each plan so that I can decide whether to upgrade.

Acceptance criteria:
- Free and Pro plans displayed side-by-side with feature lists
- Pro plan visually highlighted
- Current plan indicated for signed-in users
- FAQ section answers common questions
- CTA buttons appropriate to user state (sign up, current plan, coming soon)

---

### 21. Learn about ModelTriage
As a visitor, I want to understand what ModelTriage does so that I can decide whether to try it.

Acceptance criteria:
- Clear explanation of core functionality
- Supported models listed
- Privacy guarantees explained
- No authentication required to view

---

## Dashboard and analytics

### 22. View my routing history
As a user, I want to see my past routing decisions so that I can understand how my prompts are being classified and routed.

Acceptance criteria:
- Table of routing decisions with model, task type, time, and expected success
- Expandable detail rows with full classification and scoring
- Prompt text displayed from client-side cache (matched by hash)
- "—" shown when prompt not in local cache (privacy-safe)
- Paginated for performance

---

### 23. View my usage analytics
As a user, I want to see charts of my usage patterns so that I can understand my consumption.

Acceptance criteria:
- Daily usage bar chart (last 14 days)
- Stats cards showing total requests, today's count, remaining quota
- Model distribution breakdown (which models were used most)
- All data fetched from authenticated API endpoint

---

## Account management

### 24. Manage my account
As a user, I want to change my password, export my data, and delete my account so that I have full control over my information.

Acceptance criteria:
- Profile section shows email and current plan
- Can change password with strength validation
- Can download all personal data as JSON
- Can delete account with explicit confirmation
- Deletion removes all data (profile, usage, routing decisions)
- Signed out and redirected to homepage after deletion

---

# Phase 2: Monetization — Payments & CLI (planned)

## Payments

### 25. Purchase Pro plan
As a free user, I want to upgrade to Pro so that I can get higher usage limits and CLI access.

Acceptance criteria:
- Clicking upgrade on pricing page initiates Stripe Checkout
- Successful payment upgrades role to "pro" immediately
- Usage limits increase after upgrade
- Subscription cancellation downgrades to "free"
- Payment failure handled gracefully with notification

---

### 26. Manage my subscription
As a Pro user, I want to manage my subscription so that I can update payment methods or cancel.

Acceptance criteria:
- "Manage subscription" link on account page opens Stripe Customer Portal
- Can update payment method
- Can cancel subscription (downgrades to free at end of billing period)
- Can view invoice history
- Account page shows current subscription status

---

## API key access

### 27. Create and manage API keys
As a Pro user, I want to generate API keys so that I can use ModelTriage from the CLI or other tools.

Acceptance criteria:
- Can create API keys with optional labels
- Full key value shown once on creation with copy button (never shown again)
- Key list shows label, key prefix (`mt_abc1...`), created date, last used
- Can revoke individual keys
- Maximum of 5 active keys per user
- Free users see locked section with upgrade prompt

---

### 28. Authenticate via API key
As a developer, I want to authenticate with an API key so that I can use ModelTriage outside the browser.

Acceptance criteria:
- `Authorization: Bearer mt_...` header authenticates the request
- API flows through the same routing and streaming pipeline as the web UI
- Usage counts against the same daily Pro limit
- Rate limit headers included in all API-key-authenticated responses
- 401 returned for invalid or revoked keys
- 403 returned for free users attempting API key access
- 429 returned when limit exceeded with details in response body

---

## CLI tool

### 29. Install and authenticate the CLI
As a developer, I want to install a CLI tool so that I can use ModelTriage from my terminal.

Acceptance criteria:
- Install globally via `npm install -g modeltriage-cli`
- Binary is named `mt`
- `mt auth login` prompts for API key (user copies from account page)
- Key saved to `~/.config/modeltriage/config.json`
- `mt auth logout` removes saved key
- `mt auth status` shows user email, plan, and key prefix
- Clear error message if key is invalid or expired

---

### 30. Run prompts from the terminal
As a developer, I want to send prompts from my terminal so that I can get AI responses without leaving my workflow.

Acceptance criteria:
- `mt "prompt text"` sends prompt and streams response
- Routing info displayed before response (model name and reason)
- Response streamed in real-time as chunks arrive
- Basic markdown formatting rendered (bold, code blocks, lists)
- Loading spinner shown while waiting for first chunk
- Errors shown as clear messages (no stack traces)

---

### 31. Attach files from the terminal
As a developer, I want to attach files to CLI prompts so that I can ask questions about my code or logs.

Acceptance criteria:
- `mt "prompt" --file path/to/file` attaches a file
- Multiple files: `--file a.ts --file b.ts` (up to 3)
- Stdin pipe: `cat error.log | mt "debug this"`
- File size and type limits match web UI constraints
- Clear error messages for unsupported or oversized files

---

### 32. Compare models from the terminal
As a developer, I want to run comparison mode from the CLI so that I can verify responses across models.

Acceptance criteria:
- `mt "prompt" --compare` runs comparison mode
- Each model's response displayed sequentially with model name label
- Diff summary shown at the end
- Free users compare 2 models, Pro users compare 3

---

### 33. Check usage from the terminal
As a developer, I want to see my usage stats from the CLI so that I know how many requests I have left.

Acceptance criteria:
- `mt usage` shows current plan, today's count, remaining quota
- `mt models` lists available models
- `mt --help` shows all commands and flags
- `mt --version` shows CLI version

---

### 34. Control CLI output format
As a developer, I want to control how the CLI formats output so that I can pipe it to other tools.

Acceptance criteria:
- `--no-color` disables color output for piping
- `--json` outputs raw JSON instead of formatted text
- Default output uses colors and markdown formatting
- Both flags work with all commands