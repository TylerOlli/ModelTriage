# ModelTriage Documentation

Technical documentation for the ModelTriage codebase.

## Getting Started
- [Development Guide](./development.md) — Setup, testing, and development workflow
- [Architecture Overview](./architecture.md) — System design, folder structure, data flow
- [Deployment Checklist](./deployment-checklist.md) — Production deployment steps

## Core Features

### Prompt Execution
- [Streaming API](./streaming-api.md) — SSE streaming endpoint, event types, request/response format
- [Routing](./routing.md) — Intent-based model selection pipeline
- [Attachment-Aware Routing](./attachment-aware-routing.md) — Routing with file/image context
- [Auto-Select Latency Optimization](./auto-select-latency-optimization.md) — Fast-path routing for common patterns

### Model Selection Transparency
- [Fit Scoring](./fit-scoring.md) — "Why this model?" confidence-forward scoring system
- [Score Breakdown](./score-breakdown.md) — Expandable score breakdown panel implementation
- [Grid Layout](./grid-layout.md) — Modern grid layout for the fit scoring panel

### File Attachments
- [File Attachments](./file-attachments.md) — Text and image attachment processing
- [Drag-and-Drop Attachments](./drag-drop-attachments.md) — Drag-and-drop implementation
- [Drag-and-Drop Testing](./drag-drop-testing.md) — Testing guide for drag-drop feature
- [File Upload Validation](./file-upload-validation.md) — Denylist-based file type validation
- [Attachments Redesign](./attachments-redesign.md) — Visual redesign of attachment UI

### Comparison Mode
- [Comparison Mode](./comparison-mode.md) — Multi-model side-by-side comparison
- [Execution Correctness](./execution-correctness.md) — Concurrent run prevention and error isolation

### Multi-Page Architecture
- [Multi-Page Architecture](./multi-page-architecture.md) — Pages, navigation, auth guards
- [Prompt Cache](./prompt-cache.md) — Client-side prompt hash ↔ text cache for dashboard

### UI & UX
- [UI States](./ui-states.md) — Application states and transitions
- [Reasoning Expand/Collapse](./reasoning-expand-collapse.md) — Expandable routing reasoning text
- [Follow-Up Composer Unification](./followup-composer-unification.md) — Unified follow-up input component

### Data & Persistence
- [Persistence](./persistence.md) — Database schema and data persistence

## Internal / Historical

These documents capture past decisions, spec rewrites, and strategy changes:

- [Documentation Strategy](./documentation-strategy.md) — Documentation hierarchy and workflow
- [Spec Rewrite Changelog](./spec-rewrite-changelog.md) — Changelog from the spec rewrite
- [Spec Gap Analysis](./spec-gap-analysis.md) — Pre-rewrite gap analysis
- [Spec Rewrite Complete](./spec-rewrite-complete.md) — Spec rewrite completion summary

## Finding Documentation

### By Topic
- **Architecture**: Start with `architecture.md` for system overview
- **Adding pages**: See `multi-page-architecture.md` for page structure and auth
- **Model routing**: See `routing.md`, `attachment-aware-routing.md`, `fit-scoring.md`
- **File uploads**: See `file-attachments.md` and `drag-drop-attachments.md`
- **Dashboard**: See `multi-page-architecture.md` and `prompt-cache.md`
- **UI changes**: See `ui-states.md` and specific feature docs
- **Deployment**: See `deployment-checklist.md`

### By File Type
- **Implementation guides**: `*-attachments.md`, `*-mode.md`, `*-architecture.md`
- **Testing guides**: `*-testing.md`
- **System design**: `architecture.md`, `routing.md`, `streaming-api.md`
- **Operations**: `deployment-checklist.md`, `development.md`

## Documentation Standards

### When Adding New Documentation
1. Create in `docs/` folder (never in project root)
2. Use descriptive kebab-case filenames (e.g., `feature-name.md`)
3. Include: Overview, Implementation details, Edge cases, Testing
4. Add entry to this README
5. Keep docs updated as code changes

### For Testing Documentation
- Create separate `*-testing.md` files for comprehensive test plans
- Include: Test scenarios, Expected behavior, Visual checklists
- Make tests actionable and specific

### For Implementation Documentation
- Explain the "why" behind decisions
- Document constraints and limitations
- Include code examples where helpful
- Link to related documentation

## Contributing

When implementing new features:
1. Write technical documentation as you code
2. Document edge cases and error handling
3. Add testing guidance
4. Update this README with links to new docs

**Source of truth**: The code and these docs, not specs.
