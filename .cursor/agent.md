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

### Before starting major features:

**Silently evaluate these criteria:**
1. Does this involve user accounts, authentication, or billing/payments?
2. Is this a major provider integration (new LLM provider, external API)?
3. Will this change the core routing logic or model selection strategy?
4. Will this affect the database schema or data persistence layer?
5. Does this involve security, rate limiting, or cost control mechanisms?
6. Will this require changes across 5+ files or multiple systems?

**If 2+ criteria match:**
Suggest using SpecKit before implementing:

"This looks like a strategic feature (auth/billing/routing/etc.) that would benefit from planning. Would you like me to use SpecKit to create specs first? This would help us:
- Think through edge cases and security implications
- Document acceptance criteria and requirements
- Break down the implementation into phases

Takes ~10-15 minutes upfront but ensures we don't miss important details. Or I can implement directly - your call!"

**If user declines or says "just implement":**
Proceed without SpecKit and document in `docs/` as usual.

### When implementing features:
- Implement features directly based on user requests (most common path)
- No need to check or update specs for small/medium features
- Focus on working code and good documentation
- Document in `docs/` as you build

### Integration and reuse:
- **ALWAYS look for existing patterns before adding new code**
- Reuse existing components, utilities, and handlers when possible
- Extend existing features rather than creating parallel implementations
- If you need similar functionality to something that exists, find and reuse it first

### When making changes:
- **Read before writing** - Always read the file/component before editing
- Check for existing similar functionality in the codebase
- Follow established patterns (state management, error handling, naming, styling)

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

### Working with multiple AI assistants:
- **Be context-aware**: Different AI tools may have worked on this codebase
- Don't assume you know the full history - read existing code first
- If you see patterns you don't recognize, follow them (they exist for a reason)
- When asked "why does X work this way?", investigate before speculating

### Performance and user experience:
- Show feedback immediately, stream responses, keep animations subtle (300ms transitions)
- Test with realistic data (3 files, long prompts, large images)

## Documentation Rules

### File organization:
- NEVER create markdown files in the project root directory
- ALL feature and technical documentation must go in the `docs/` folder
- Only `README.md` and `DEPLOYMENT.md` belong in the root

### When documenting features:
- Implementation details: `docs/feature-name.md`
- Testing guides: `docs/feature-name-testing.md`
- Architecture notes: append to `docs/architecture.md`
- Include code examples, edge cases, and testing checklists

### Documentation priorities:
1. Technical accuracy (how it actually works)
2. Completeness (edge cases, error handling, constraints)
3. Examples and testing guidance
4. Keep it current as code changes

## Error Handling and Edge Cases

### Always consider:
- What happens if the API fails?
- What if the user has slow internet?
- What if they try to do two things at once?
- What if they upload a large file or switch modes while streaming?

### Patterns to follow:
- Isolate errors (one failure shouldn't break everything)
- Show user-friendly error messages (no stack traces)
- Provide recovery actions ("Try again" button)
- Disable actions during processing (prevent double-submit)

## UI/UX Consistency

Match existing patterns: blue for primary actions, gray for neutral, orange for warnings. Use emoji icons (📎🖼️📄), rounded-lg buttons, 300ms fade animations. Keep interactions subtle and consistent with the codebase style.
