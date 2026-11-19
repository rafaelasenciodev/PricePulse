# Product Scope

Status: Draft. Scope is a hypothesis; each item is confirmed when its feature reaches Phase 0.

## Initial capabilities

Product catalogue · Product listings · Price observations · Price history · User accounts · Watchlists · Price alerts · Scheduled price checks · Alert evaluation · Notification management · Dashboard and analytics

"Watchlist" and "Price alert" may turn out to be one concept or two. This is an open question ([OQ-04](../domain/open-questions.md)).

## In scope (initial)

- A **simulated price provider** producing realistic, clearly labelled price series (step changes, promotions, outages).
- A provider **port** so that real adapters can be added later without changing the domain.
- Registered users who track listings and create target-price alerts.
- Evaluation of new price observations against alerts, and production of notifications.
- Price history viewing.

## Out of scope (for now)

| Item | Why |
|---|---|
| Scraping any retailer | Project policy: no retailer is scraped. The project does not rely on practices whose terms of use and legal standing it has not assessed |
| Amazon / Keepa integration | Not used initially. Their terms of use and costs have not been evaluated by the project; they could be considered later as adapters |
| Microservices | Not planned. A modular monolith is the proposed approach, pending evaluation |
| Mandatory AI/LLM features | Core must work without them; AI is optional and later |
| Browser extension, mobile app, payments, multi-country UI | Not needed to validate the domain |
| Price forecasting | Not needed to validate the domain; evaluating it meaningfully would require real price data, which the project does not use initially |

## Explicitly deferred decisions

| Decision | Deferred until |
|---|---|
| Background job mechanism (Celery vs Postgres-backed queue vs other) | Scheduled checks feature; will be an ADR |
| Whether Redis is needed | Only if a concrete need appears |
| Authentication mechanism (cookie session vs JWT) | Accounts feature |
| Real data provider | Until a candidate provider's terms of use, cost and rules on storing and displaying prices have been evaluated |
| Deployment platform | Before first deployment |
| AI integrations (OpenAI, RAG, n8n) | After the core works; must be optional |

## Planned feature order (tentative, not committed)

1. **Create Price Alert** ← current
2. To be derived from what feature 1 reveals (likely: price observation ingestion, alert evaluation, notifications).
