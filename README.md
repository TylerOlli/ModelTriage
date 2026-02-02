# ModelTriage

LLM decision and verification layer

## Development

Install dependencies:
```bash
npm install
```

Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Test the MockProvider:
```bash
npm run test:mock     # Run unit tests
npm run demo:mock     # Run streaming demo
```

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Runtime:** Node.js
- **Deployment:** Vercel

## Project Structure

```
modeltriage/
├── app/                  # App Router directory
│   ├── layout.tsx       # Root layout
│   ├── page.tsx         # Home page
│   └── globals.css      # Global styles
├── lib/                  # Core library code
│   └── providers/       # LLM provider interfaces and implementations
│       ├── types.ts     # Provider interface definitions
│       ├── mock-provider.ts  # Mock provider for development
│       └── index.ts     # Exports
├── __tests__/           # Test files
│   └── providers/       # Provider tests
├── scripts/             # Utility scripts
├── .specify/            # Product specifications
├── docs/                # Documentation
└── package.json         # Dependencies
```

## MockProvider

The `MockProvider` simulates an LLM with streaming for development and testing:

- **No external API calls** - Fully deterministic, works offline
- **Streaming simulation** - Returns async iterators of text chunks
- **Deterministic output** - Same prompt always produces the same response
- **Provider interface** - Implements the standard `Provider` interface that real providers (OpenAI, Anthropic) will implement

### Cost Control

By default, the application uses `MockProvider` unless `USE_LIVE_PROVIDERS=true` is set. This ensures:
- No accidental API costs during development
- Fast, reliable testing
- Predictable behavior

## Specifications

This project is built strictly according to specifications in `.specify/`:
- `product.md` - Product definition
- `conventions.md` - Technical conventions
- `user-stories.md` - User stories
- `requirements.md` - Functional requirements
