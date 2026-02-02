# ModelTriage

## Overview
ModelTriage is an AI decision layer that intelligently selects, evaluates, and verifies large language model (LLM) outputs. Instead of forcing users to manually choose between different AI models or compare multiple responses themselves, ModelTriage performs triage: it routes a prompt to the most appropriate model, explains why that model was chosen, and optionally compares outputs to surface meaningful differences.

ModelTriage is designed as infrastructure, not a chat toy. It treats AI models as interchangeable tools and focuses on outcome quality, cost, latency, and trust.

Primary domain: **modeltriage.com**  
Product/app domains: **modeltriage.ai**, **modeltriage.app**  
Developer/docs domain: **modeltriage.dev**

---

## Purpose
The purpose of ModelTriage is to solve a growing problem in the AI ecosystem:

- There are many capable AI models, each with different strengths
- Users are forced to manually choose models without clear guidance
- Side‑by‑side comparisons create noise, not clarity
- Model updates introduce silent regressions
- Cost and latency tradeoffs are rarely visible

ModelTriage introduces judgment, learning, and explainability into model selection.

---

## Core Use Cases

### 1. Intelligent Model Routing
Users submit a single prompt. ModelTriage automatically selects the most appropriate model based on:
- Prompt type (code, writing, analysis, planning, etc.)
- User preference (speed vs quality)
- Historical user feedback
- Cost and latency constraints

The user receives one answer by default, without needing to think about which model to use.

---

### 2. Verification and Comparison (Verify Mode)
For higher‑stakes prompts, users can enable Verify mode.

ModelTriage:
- Runs the prompt across multiple models in parallel
- Displays responses side by side
- Highlights agreement, disagreement, omissions, and conflicting assumptions

This treats disagreement as signal rather than noise and improves trust in AI outputs.

---

### 3. Learning From User Preference
When users select the best response or provide feedback, ModelTriage learns:
- Which models perform best for which prompt categories
- Individual user preferences
- Cost vs quality tradeoffs

Over time, routing becomes personalized and adaptive.

---

### 4. Cost and Latency Awareness
Every request records:
- Model used
- Response time
- Token usage
- Estimated cost

This enables transparent optimization and future budgeting features.

---

## What Makes ModelTriage Different

- Not just multi‑model chat: it makes decisions
- Not manual comparison: it highlights only what matters
- Not static routing: it learns over time
- Not opaque: it explains why a model was chosen

ModelTriage fills the missing decision layer between users and AI models.

---

## High‑Level Architecture

### Components
1. **Frontend (Web App)**
   - Prompt input
   - Single‑answer default view
   - Verify / Compare mode
   - Diff summary panel
   - Feedback controls

2. **Model Gateway (Backend)**
   - Unified interface for multiple AI providers
   - Parallel execution support
   - Streaming responses
   - Provider abstraction

3. **Routing Engine**
   - Prompt classification
   - Rule‑based routing (initial)
   - Learned routing (feedback‑driven)

4. **Diff & Verification Engine**
   - Response segmentation
   - Agreement and disagreement detection
   - Omission and contradiction analysis

5. **Storage Layer**
   - Prompts
   - Responses
   - Feedback
   - Metrics

---

## Technologies (Initial Stack)

### Frontend
- Next.js
- TypeScript
- Server‑side rendering
- Streaming UI support

### Backend
- Node.js or FastAPI
- REST endpoints
- Server‑sent events or WebSockets

### AI Providers (initial)
- OpenAI
- Anthropic
- Google (optional)
- Local models via Ollama (optional)

### Data Layer
- PostgreSQL
- Prisma or equivalent ORM

### Infrastructure
- Docker for local development
- Environment‑based API key management (BYO keys initially)

---

## Data Model (Core Tables)

- Users
- Prompts
- Responses
- Feedback

Each response stores:
- Model name
- Latency
- Token usage
- Estimated cost
- User rating or selection

---

## Routing Strategy

### Phase 1: Rules
- Keyword and structure‑based prompt classification
- Category‑to‑model mapping
- User‑selected preference (fast vs best)

### Phase 2: Learning
- Track win rates per model per category
- Personalize routing per user
- Light exploration to avoid stagnation

### Phase 3: Advanced
- Prompt embeddings for clustering
- Bandit‑style exploration
- Regression detection

---

## Diff and Verification Strategy

Initial implementation uses LLM‑assisted analysis to produce:
- What all models agree on
- Key differences
- Missing information per response
- Conflicting claims

Future versions may include:
- Embedding‑based semantic diffing
- Claim‑level graphs
- Confidence scoring

---

## Development Plan

### Milestone 1: Foundation
- Single‑model chat working end‑to‑end
- Model gateway abstraction

### Milestone 2: Multi‑Model Verify Mode
- Parallel model execution
- Side‑by‑side responses

### Milestone 3: Diff Summary
- Agreement and difference panel

### Milestone 4: Feedback Loop
- Best response selection
- Rating storage

### Milestone 5: Routing Logic
- Rule‑based routing
- User preference integration

### Milestone 6: Learning
- Win‑rate based routing
- Metrics dashboard

---

## Long‑Term Vision

ModelTriage can evolve into:
- A regression testing platform for AI prompts
- A safety and verification layer for enterprises
- A cost‑aware AI orchestration engine
- A developer tool for prompt and model evaluation

The name and architecture are intentionally future‑proof and modality‑agnostic.

---

## Positioning

ModelTriage is not positioned as a chatbot. It is positioned as:

> A decision and verification layer for AI models.

This framing reflects the real value of the system and aligns with long‑term AI infrastructure needs.

---

## Summary

ModelTriage provides a structured, explainable, and adaptive way to work with multiple AI models. It reduces cognitive load, improves trust, and demonstrates senior‑level AI systems thinking.

This project is designed to be useful, extensible, and credible both in production and on GitHub.
