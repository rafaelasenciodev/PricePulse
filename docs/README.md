# PricePulse documentation

Status: Draft · In Review · Approved (see [status vocabulary](features/README.md#status-vocabulary)) · ⬜ not started

## Product

| Document | Status |
|---|---|
| [Product vision](product/product-vision.md) | Draft |
| [Product scope](product/product-scope.md) | Draft |
| Functional requirements | ⬜ (derived feature by feature) |
| Non-functional requirements | ⬜ |

## Domain

| Document | Status |
|---|---|
| [Ubiquitous language](domain/ubiquitous-language.md) | Approved |
| [Candidate domain concepts](domain/candidate-concepts.md) | Draft |
| [Open domain questions](domain/open-questions.md) | Draft |
| Bounded Contexts | ⬜ |
| Domain model | ⬜ |

## Architecture

| Document | Status |
|---|---|
| Architecture overview | ⬜ |
| [ADR-0001: The backend is written in TypeScript](adr/0001-typescript-backend.md) | Approved |
| [ADR-0002: A simplified Git Flow organises the branches](adr/0002-branching-model.md) | Approved |
| [ADR-0003: Persistence is deferred and the in-memory adapters stay](adr/0003-persistence-deferred.md) | Approved |

## Quality

| Document | Status |
|---|---|
| Testing strategy | ⬜ |
| Coding standards | ⬜ |
| Definition of Done | ⬜ |

## Features

Methodology: [features/README.md](features/README.md).

### 01 — Create Price Alert

| Phase | Document | Status |
|---|---|---|
| 0 Feature Discovery | [Discovery](features/01-create-price-alert/00-discovery.md) | Approved |
| 1 Domain Language and Business Rules | [Business rules](features/01-create-price-alert/01-business-rules.md) | Approved |
| 2 Behavioural Scenarios | [Scenarios](features/01-create-price-alert/02-scenarios.feature) | Approved |
| 3 Domain Modelling | [Domain model](features/01-create-price-alert/03-domain-model.md) | Approved |
| 4 Application Use Case Contract | [Use case contract](features/01-create-price-alert/04-use-case-contract.md) | Approved |
| 5 Use Case Implementation | [Application layer](../backend/src/price-alerts/application/) | Implemented |
| 6 In-memory Adapters | [Adapters](../backend/src/price-alerts/adapters/) | Implemented |
| 7 HTTP and Application Composition | [HTTP layer](../backend/src/price-alerts/http/) and [Composition Root](../backend/src/composition-root.ts) | Implemented |
| 8 Testing | [Test plan](features/01-create-price-alert/08-test-plan.md) | Approved |
| 9 Architecture Review | [Architecture review](features/01-create-price-alert/09-architecture-review.md) | Approved |
| 10 Documentation and Completion | [Completion](features/01-create-price-alert/10-completion.md), [ADR-0001](adr/0001-typescript-backend.md) and [ADR-0002](adr/0002-branching-model.md) | Approved |

### 02 — Price Observation

Phases 8 and 9 are recorded as sections of the completion document, not as separate documents.

| Phase | Document | Status |
|---|---|---|
| 0 Feature Discovery | [Discovery](features/02-price-observation/00-discovery.md) | Approved |
| 1 Domain Language and Business Rules | [Business rules](features/02-price-observation/01-business-rules.md) | Approved |
| 2 Behavioural Scenarios | [Scenarios](features/02-price-observation/02-scenarios.feature) | Approved |
| 3 Domain Modelling | [Domain model](features/02-price-observation/03-domain-model.md) | Approved |
| 4 Application Use Case Contract | [Use case contract](features/02-price-observation/04-use-case-contract.md) | Approved |
| 5 Use Case Implementation | [Application layer](../backend/src/price-observations/application/) | Implemented |
| 6 In-memory Adapters | [Adapters](../backend/src/price-observations/adapters/) | Implemented |
| 7 HTTP and Application Composition | [HTTP layer](../backend/src/price-observations/http/) and [Composition Root](../backend/src/composition-root.ts) | Implemented |
| 8 Testing | [Verification](features/02-price-observation/10-completion.md#4-verification) | Approved |
| 9 Architecture Review | [Architecture review](features/02-price-observation/10-completion.md#5-architecture-review) | Approved |
| 10 Documentation and Completion | [Completion](features/02-price-observation/10-completion.md) | Approved |

### 03 — Alert Evaluation

Phases 8 and 9 are recorded as sections of the completion document, not as separate documents. The evaluation lives in the module of Price Alerts, so its code is in the same folders as feature 01.

| Phase | Document | Status |
|---|---|---|
| 0 Feature Discovery | [Discovery](features/03-alert-evaluation/00-discovery.md) | Approved |
| 1 Domain Language and Business Rules | [Business rules](features/03-alert-evaluation/01-business-rules.md) | Approved |
| 2 Behavioural Scenarios | [Scenarios](features/03-alert-evaluation/02-scenarios.feature) | Approved |
| 3 Domain Modelling | [Domain model](features/03-alert-evaluation/03-domain-model.md) | Approved |
| 4 Application Use Case Contract | [Use case contract](features/03-alert-evaluation/04-use-case-contract.md) | Approved |
| 5 Use Case Implementation | [Application layer](../backend/src/price-alerts/application/) | Implemented |
| 6 In-memory Adapters | [Adapters](../backend/src/price-alerts/adapters/) | Implemented |
| 7 HTTP and Application Composition | [Evaluation trigger](../backend/src/evaluation-trigger.ts) and [Composition Root](../backend/src/composition-root.ts) | Implemented |
| 8 Testing | [Verification](features/03-alert-evaluation/10-completion.md#4-verification) | Approved |
| 9 Architecture Review | [Architecture review](features/03-alert-evaluation/10-completion.md#5-architecture-review) | Approved |
| 10 Documentation and Completion | [Completion](features/03-alert-evaluation/10-completion.md) | Approved |
