# ModelTriage Documentation

Technical documentation for the ModelTriage codebase.

## Getting Started
- [Development Guide](./development.md) - Setup, testing, and development workflow
- [Architecture Overview](./architecture.md) - System design and key components

## Core Features

### Prompt Execution
- [Streaming API](./streaming-api.md) - How streaming responses work
- [Routing](./routing.md) - Intent-based model selection
- [Attachment-Aware Routing](./attachment-aware-routing.md) - Routing with file context

### File Attachments
- [File Attachments](./file-attachments.md) - Text and image attachment processing
- [Drag-and-Drop Attachments](./drag-drop-attachments.md) - Drag-and-drop implementation
- [Drag-and-Drop Testing](./drag-drop-testing.md) - Testing guide for drag-drop feature

### Comparison Mode
- [Comparison Mode](./comparison-mode.md) - Multi-model side-by-side comparison
- [Safe Mode Switching](./safe-mode-switching.md) - Safe mode switching with result preservation

### UI & UX
- [UI States](./ui-states.md) - Application states and transitions
- [Execution Correctness](./execution-correctness.md) - Handling edge cases and errors

## Operations
- [Deployment Checklist](./deployment-checklist.md) - Production deployment steps
- [Persistence](./persistence.md) - Database and data persistence

## Finding Documentation

### By Topic
- **Adding features**: Start with `architecture.md` to understand the system
- **File uploads**: See `file-attachments.md` and `drag-drop-attachments.md`
- **Model routing**: See `routing.md` and `attachment-aware-routing.md`
- **UI changes**: See `ui-states.md` and specific feature docs
- **Deployment**: See `deployment-checklist.md` and `../DEPLOYMENT.md`

### By File Type
- **Implementation guides**: `*-attachments.md`, `*-mode.md`
- **Testing guides**: `*-testing.md`
- **System design**: `architecture.md`, `routing.md`, `streaming-api.md`
- **Operations**: `deployment*.md`, `development.md`

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
