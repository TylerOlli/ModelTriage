# Agent Rules

## Development Philosophy

This project is evolving from MVP to a full product with real users. Focus on **shipping quality features quickly** while maintaining good documentation.

## Documentation Strategy

### Technical Documentation (`docs/` folder)
- ALWAYS create feature documentation in `docs/` as you implement
- Document implementation details, architecture decisions, and testing approaches
- Keep technical docs current as the source of truth

### Product Specifications (`.specify/` folder)
- Use SpecKit for **strategic feature planning** (auth, billing, major integrations)
- Skip specs for tactical improvements (UI enhancements, bug fixes, small features)
- Update specs in batches (every few weeks) to reflect what shipped

## Implementation Rules

### When implementing:
- Implement directly based on user requests (most common path)
- **Read before writing** - Always read files before editing to understand context
- **Reuse and extend** - Look for existing patterns and extend them (don't duplicate)
- **Be aware**: Multiple AI tools work on this codebase - respect existing implementations
- Focus on working code and good documentation in `docs/`

### Code quality:
- Keep changes focused and incremental
- Follow existing patterns (state management, error handling, naming, styling)
- Document non-obvious decisions

### Cost and safety:
- Default to MockProvider unless USE_LIVE_PROVIDERS=true
- Do not call paid providers unless USE_LIVE_PROVIDERS=true
- Enforce all hard limits and rate limits
- All database writes must be gated behind ENABLE_DB_WRITES

## Documentation Rules

### File organization:
- NEVER create markdown files in the project root directory
- ALL feature documentation must go in the `docs/` folder
- Only `README.md` and `DEPLOYMENT.md` belong in the root

### When documenting features:
- Implementation details: `docs/feature-name.md`
- Testing guides: `docs/feature-name-testing.md`
- Include code examples, edge cases, and testing checklists
