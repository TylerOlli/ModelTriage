# ModelTriage CLI

> `modeltriage-cli` (alias: `mt`) — intelligent LLM routing from your terminal.

## Installation

```bash
npm install -g modeltriage-cli
```

## Authentication

The CLI requires a Pro plan API key. Generate one from your [account page](https://modeltriage.com/account).

```bash
# Save your API key
mt auth login mt_your_key_here

# Check auth status
mt auth status

# Remove stored key
mt auth logout
```

Keys are stored locally at `~/.config/modeltriage-cli/config.json`.

### Development mode

For local development, override the server URL:

```bash
mt auth set-url http://localhost:3000
```

## Commands

### `mt ask` — Send a prompt

```bash
mt ask "Explain quicksort in Python"

# Override model selection
mt ask "Debug this error" --model gpt-5

# Attach files for context
mt ask "Review this code" --file src/app.ts --file src/utils.ts

# Pipe from stdin
cat error.log | mt ask "What's causing this crash?"

# Multiple file attachments
mt ask "Refactor for performance" -f main.py -f helpers.py

# Control generation
mt ask "Write a haiku" --temperature 1.5 --max-tokens 100

# Output as JSON (for scripting)
mt ask "Summarize this" --json
```

### `mt compare` — Compare models

Run the same prompt through multiple models side-by-side:

```bash
mt compare "Explain monads" --models gpt-5,claude-sonnet-4-5

# Three-way comparison
mt compare "Write a REST API" --models gpt-5,claude-sonnet-4-5,gemini-3-flash

# JSON output
mt compare "Hello world in Rust" --models gpt-5,gemini-3-flash --json
```

### `mt usage` — Check daily usage

```bash
mt usage

# JSON output for scripting
mt usage --json
```

Output:

```
Today's Usage

  ████████░░░░░░░░░░░░░░░░░░░░░░  42/200 (21%)

  Remaining: 158 requests
  Resets at midnight UTC
```

### `mt models` — List available models

```bash
mt models

# JSON output
mt models --json
```

## Available Models

| Model | Provider | Notes |
|-------|----------|-------|
| `gpt-5` | OpenAI | Versatile, strong at coding |
| `gpt-5-mini` | OpenAI | Fast, cost-efficient |
| `gpt-5.2` | OpenAI | Latest, vision-capable |
| `claude-sonnet-4-5` | Anthropic | Balanced, vision-capable |
| `claude-opus-4-5` | Anthropic | Strongest reasoning, vision |
| `gemini-3-flash` | Google | Fastest, vision-capable |
| `gemini-3-pro` | Google | High quality, vision-capable |

## Rate Limits

API key requests share the same daily limit as web UI usage:

- **Pro plan**: 200 requests/day (configurable via `PRO_DAILY_LIMIT` env var)
- Limits reset at midnight UTC
- Rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Used`) are included in every API response

## Architecture

The CLI is a **thin client** — all prompt routing, model selection, and LLM inference happens on the ModelTriage server. The CLI handles:

- Local API key storage (`conf` — XDG-compliant config)
- HTTP requests to `/api/stream`
- SSE stream parsing and terminal rendering
- File reading and attachment encoding

No prompts or responses are stored locally.

## Files

```
cli/
├── package.json          # npm package config
├── tsconfig.json         # TypeScript config
└── src/
    ├── index.ts          # Entry point + command registration
    ├── config.ts         # API key + server URL persistence
    ├── api.ts            # HTTP client for ModelTriage API
    └── commands/
        ├── auth.ts       # auth login/logout/status/set-url
        ├── prompt.ts     # ask command (streaming)
        ├── compare.ts    # compare command (multi-model)
        ├── usage.ts      # usage stats
        └── models.ts     # model list
```
