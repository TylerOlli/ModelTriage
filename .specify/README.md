# When to Use SpecKit

## Current Project Phase
**Status**: Phase 1 Monetization shipped. Planning Phase 2 (API + Payments).  
**Priority**: Ship Phase 2 monetization to enable revenue, then evaluate Phase 3 (teams/enterprise).

### Phase Summary
| Phase | Status | Scope |
|-------|--------|-------|
| MVP | Shipped | Core prompt execution, routing, comparison, attachments, history |
| Phase 1: Auth & Usage | Shipped | Supabase Auth, roles, usage limits, multi-page architecture, dashboard, account |
| Phase 2: API & Payments | Planned | Stripe integration, API key access for Pro users |
| Future | Not scoped | Teams, enterprise, learned routing |

## Use SpecKit For (Strategic Planning)

### ✅ Major Features That Need Careful Planning
- ~~Authentication and user management~~ (Phase 1 — shipped)
- Billing and payment systems (Phase 2 — next)
- Public API design (Phase 2 — next)
- Multi-tenancy / team workspaces (Future)
- Significant architecture changes (e.g., switching databases)
- Features that affect many parts of the system

### Process for Major Features:
1. Use `@speckit.specify` to write user stories and requirements
2. Use `@speckit.plan` to break down implementation
3. Use `@speckit.tasks` to track progress
4. Implement incrementally
5. Update specs to reflect what was actually shipped

## Don't Use SpecKit For (Tactical Improvements)

### ❌ Small/Medium Features That Can Be Shipped Quickly
- UI improvements (drag-and-drop, better forms, visual polish)
- Bug fixes and error handling improvements
- Performance optimizations
- Small integrations
- Feature enhancements to existing functionality

### Process for Tactical Improvements:
1. Implement directly based on user request
2. Write documentation in `docs/` folder as you go
3. Focus on working code and good tests
4. No need to update specs

## Keeping Specs Current

### Batch Update Strategy (Every 2-4 weeks)
- Review what features were shipped
- Update `requirements.md` with new functionality
- Update `user-stories.md` if major workflows changed
- Add notes about what worked / didn't work
- Specs serve as **historical record** and **onboarding documentation**

### What to Document in Specs vs Docs

**`.specify/` (Product Strategy)**
- User stories and acceptance criteria
- Feature requirements and constraints
- Product vision and non-goals
- High-level architecture decisions

**`docs/` (Technical Reference)**
- Implementation details
- API documentation
- Testing guides
- Architecture diagrams
- How systems actually work

## Bottom Line

**Specs = Product thinking tool**  
**Docs = Developer reference**  
**Code = Source of truth**

Use SpecKit when you need to **think deeply** about a feature before building it. Skip it when you need to **move fast** on well-understood improvements.
