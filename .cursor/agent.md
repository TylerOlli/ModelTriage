# Agent Rules

## Development Philosophy

This project is evolving from MVP to a full product with real users. The focus is on **shipping quality features quickly** while maintaining good documentation.

## Documentation Strategy

### Technical Documentation (`docs/` folder)
- ALWAYS create feature documentation in `docs/` as you implement
- Document implementation details, architecture decisions, and testing approaches
- Keep technical docs up-to-date as the source of truth for how the system works

### Product Specifications (`.specify/` folder)
- Use SpecKit for **strategic feature planning** only (major features like auth, billing, API design)
- Skip specs for **tactical improvements** (UI enhancements, bug fixes, small features)
- Specs are useful for thinking through edge cases, not as an implementation gate
- Update specs in batches (every few weeks) to reflect what was actually shipped

## Implementation Rules

### When implementing features:
- Implement features directly based on user requests
- No need to check or update specs for small/medium features
- Focus on working code and good documentation
- For major architectural changes, consider writing specs first

### Code quality:
- Keep changes focused and incremental
- Write tests for complex logic
- Document non-obvious decisions
- Follow existing patterns and conventions

### Cost and safety:
- Default to MockProvider unless USE_LIVE_PROVIDERS=true
- Do not call paid providers unless USE_LIVE_PROVIDERS=true
- Enforce all hard limits and rate limits
- All database writes must be gated behind ENABLE_DB_WRITES

## Documentation Rules

### File organization:
- NEVER create markdown files in the project root directory
- ALL feature and technical documentation must go in the `docs/` folder
- Only `README.md` and `DEPLOYMENT.md` belong in the root

### When documenting features:
- Implementation details: `docs/feature-name.md`
- Testing guides: `docs/feature-name-testing.md`
- Architecture notes: append to `docs/architecture.md`
- Before writing any .md file, check if it should go in `docs/` (it almost always should)

### Documentation priorities:
1. Technical accuracy (how it actually works)
2. Completeness (edge cases, error handling, constraints)
3. Examples and testing guidance
4. Keep it current as code changes