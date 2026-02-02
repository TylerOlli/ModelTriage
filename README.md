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
├── .specify/            # Product specifications
├── docs/                # Documentation
└── package.json         # Dependencies
```

## Specifications

This project is built strictly according to specifications in `.specify/`:
- `product.md` - Product definition
- `conventions.md` - Technical conventions
- `user-stories.md` - User stories
- `requirements.md` - Functional requirements
