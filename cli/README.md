# modeltriage-cli

> Intelligent LLM routing from your terminal.

## Quick Start

```bash
npm install -g modeltriage-cli

mt auth login mt_your_api_key
mt ask "Explain quicksort"
```

## Requirements

- Node.js 18+
- ModelTriage Pro plan (for API key)

## Commands

```
mt ask <prompt>             Send a prompt (auto-selects best model)
mt ask <prompt> -f file.ts  Attach files for context
mt compare <prompt> -m a,b  Compare models side-by-side
mt usage                    Check daily request count
mt models                   List available models
mt auth login <key>         Save your API key
mt auth logout              Remove stored key
mt auth status              Show auth state
```

## Documentation

See [docs/cli.md](../docs/cli.md) for full documentation.
