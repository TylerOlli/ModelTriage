# Product

## One sentence
ModelTriage is a decision and verification layer that helps developers evaluate LLM outputs by routing prompts to the most appropriate model and optionally comparing responses to surface meaningful differences.

## Primary user
Developers and technical teams who use large language models in real applications and need confidence in output quality, consistency, cost, and latency.

## Core problem
As the number of capable AI models grows, users are forced to manually choose models without clear guidance, visibility into tradeoffs, or reliable ways to verify correctness. Side-by-side comparisons often create noise rather than clarity, and model updates can introduce silent regressions.

## Core value
ModelTriage introduces judgment and transparency into model usage by:
- Selecting an appropriate model automatically
- Explaining why a model was chosen
- Allowing optional verification across multiple models
- Highlighting agreement, disagreement, and omissions instead of raw output dumps

This reduces cognitive load while increasing trust in AI-assisted work.

## What ModelTriage is
- A tool for evaluating and verifying LLM outputs
- A decision layer between users and AI models
- Infrastructure for model comparison, not a chatbot

## What ModelTriage is not
- A general-purpose chat application
- A manual multi-model playground
- An autonomous agent system
- A replacement for application-specific business logic

## Explicit non-goals (MVP)
- User accounts, authentication, or billing
- Long-term prompt or history storage across devices
- Enterprise features such as organizations, permissions, or audit logs
- Automated actions taken on external systems
- Fully learned or self-optimizing routing in the initial release

> If a feature is not described in this file, it must not be implemented.