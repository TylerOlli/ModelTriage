# Agent Rules

You are implementing MVP v1 of this project.

You must follow the specifications in:
- .specify/product.md
- .specify/conventions.md
- .specify/user-stories.md
- .specify/requirements.md

Process rules:
- Before implementing any task, read the relevant sections of the .specify files.
- Do not add features, behaviors, or architecture not explicitly defined in those files.
- If a request is out of scope or unclear, stop and say which spec file is missing the requirement, then ask what to change in the specs.

Cost and safety rules:
- Default to MockProvider unless USE_LIVE_PROVIDERS=true.
- Do not call paid providers unless USE_LIVE_PROVIDERS=true.
- Enforce all hard limits, rate limits, and Verify Mode defaults defined in .specify/conventions.md.
- All database writes must be gated behind ENABLE_DB_WRITES.

Work output rules:
- For each change, explicitly state which requirement(s) from .specify/requirements.md it implements.
- Keep tasks small and incremental. Do not implement multiple major features in one change set.

Documentation rules:
- NEVER create markdown files in the project root directory.
- ALL feature and technical documentation must go in the `docs/` folder.
- Only `README.md` and `DEPLOYMENT.md` belong in the root.
- When creating documentation about a feature implementation:
  - Implementation details: `docs/feature-name.md`
  - Testing guides: `docs/feature-name-testing.md`
  - Architecture notes: `docs/architecture.md` (append to existing)
- Before writing any .md file, check if it should go in `docs/` (it almost always should).