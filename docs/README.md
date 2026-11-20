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
| [ADR-0004: Users authenticate with server-side sessions, scrypt and a bearer token](adr/0004-authentication.md) | Approved |
| [ADR-0005: The web interface is a single-page application served by the backend, with the session in a cookie](adr/0005-web-interface.md) | Approved |
| [ADR-0006: Data is kept in PostgreSQL, through its driver and SQL written by hand](adr/0006-postgresql.md) | Approved |
| [ADR-0007: The public demo runs on Render, with its database in Neon](adr/0007-deployment-platform.md) | Approved |

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

### 04 — Read and Manage Price Alerts

The first feature of the [method of five stages](features/README.md). The code is in the same folders as feature 01, because the module of Price Alerts holds it.

| Stage | Document | Status |
|---|---|---|
| 1 Understand | [Discovery and rules](features/04-read-and-manage-alerts/01-discovery.md) | Approved |
| 2 Scenarios | [Scenarios](features/04-read-and-manage-alerts/02-scenarios.feature) | Approved |
| 3 Design | [Design](features/04-read-and-manage-alerts/03-design.md) | Approved |
| 4 Build | [Application layer](../backend/src/price-alerts/application/), [adapters](../backend/src/price-alerts/adapters/) and [HTTP layer](../backend/src/price-alerts/http/) | Implemented |
| 5 Close | [Completion](features/04-read-and-manage-alerts/04-completion.md) | Approved |

### 05 — Notifications and Price History

The second feature of the [method of five stages](features/README.md). The code is in the modules of Price Alerts and of Price Observations.

| Stage | Document | Status |
|---|---|---|
| 1 Understand | [Discovery and rules](features/05-notifications-and-price-history/01-discovery.md) | Approved |
| 2 Scenarios | [Scenarios](features/05-notifications-and-price-history/02-scenarios.feature) | Approved |
| 3 Design | [Design](features/05-notifications-and-price-history/03-design.md) | Approved |
| 4 Build | [Alerts application layer](../backend/src/price-alerts/application/), [observations application layer](../backend/src/price-observations/application/) and their [HTTP layers](../backend/src/price-observations/http/) | Implemented |
| 5 Close | [Completion](features/05-notifications-and-price-history/04-completion.md) | Approved |

### 06 — Accounts and Authentication

The third feature of the [method of five stages](features/README.md), and the first built on an ADR ([ADR-0004](adr/0004-authentication.md)). The code is in a new module, `accounts`, and in the Composition Root.

| Stage | Document | Status |
|---|---|---|
| 1 Understand | [Discovery and rules](features/06-accounts-and-authentication/01-discovery.md) | Approved |
| 2 Scenarios | [Scenarios](features/06-accounts-and-authentication/02-scenarios.feature) | Approved |
| 3 Design | [Design](features/06-accounts-and-authentication/03-design.md) | Approved |
| 4 Build | [Domain](../backend/src/accounts/domain/), [application layer](../backend/src/accounts/application/), [adapters](../backend/src/accounts/adapters/) and [HTTP layer](../backend/src/accounts/http/) | Implemented |
| 5 Close | [Completion](features/06-accounts-and-authentication/04-completion.md) | Approved |

### 07 — Listings Catalogue

The fourth feature of the [method of five stages](features/README.md). The code is in the module of Price Observations, which holds the Catalogue, and in the Composition Root.

| Stage | Document | Status |
|---|---|---|
| 1 Understand | [Discovery and rules](features/07-listings-catalogue/01-discovery.md) | Approved |
| 2 Scenarios | [Scenarios](features/07-listings-catalogue/02-scenarios.feature) | Approved |
| 3 Design | [Design](features/07-listings-catalogue/03-design.md) | Approved |
| 4 Build | [Application layer](../backend/src/price-observations/application/), [adapters](../backend/src/price-observations/adapters/) and [HTTP layer](../backend/src/price-observations/http/) | Implemented |
| 5 Close | [Completion](features/07-listings-catalogue/04-completion.md) | Approved |

### 08 — Session Cookie

The fifth feature of the [method of five stages](features/README.md). It has no stage of ports and adapters, because it has none. The code is in the shared module, in the plugins of Users and in the Composition Root.

| Stage | Document | Status |
|---|---|---|
| 1 Understand | [Discovery and rules](features/08-session-cookie/01-discovery.md) | Approved |
| 2 Scenarios | [Scenarios](features/08-session-cookie/02-scenarios.feature) | Approved |
| 3 Design | [Design](features/08-session-cookie/03-design.md) | Approved |
| 4 Build | [Shared HTTP module](../backend/src/shared/http/), [Accounts](../backend/src/accounts/http/) and the [Composition Root](../backend/src/composition-root.ts) | Implemented |
| 5 Close | [Completion](features/08-session-cookie/04-completion.md) | Approved |

### 09 — Web Interface

The sixth feature of the [method of five stages](features/README.md), and the first with a project of its own, `frontend/`. It builds the interface that [ADR-0005](adr/0005-web-interface.md) decided: sign in, register, the Catalogue and creating a Price Alert, in Spanish.

| Stage | Document | Status |
|---|---|---|
| 1 Understand | [Discovery and rules](features/09-web-interface/01-discovery.md) | Approved |
| 2 Scenarios | [Scenarios](features/09-web-interface/02-scenarios.feature) | Approved |
| 3 Design | [Design](features/09-web-interface/03-design.md) | Approved |
| 4 Build | [The interface](../frontend/src/), and in the backend [serving it](../backend/src/app.ts) and [`main.ts`](../backend/src/main.ts) | Implemented |
| 5 Close | [Completion](features/09-web-interface/04-completion.md) | Approved |

### 10 — My Alerts and My Notifications

The seventh feature of the [method of five stages](features/README.md), and the second half of the interface of [feature 09](features/09-web-interface/04-completion.md): the Price Alerts of a person, with changing the Target Price and cancelling, and their Notifications, in Spanish.

| Stage | Document | Status |
|---|---|---|
| 1 Understand | [Discovery and rules](features/10-my-alerts-and-notifications/01-discovery.md) | Approved |
| 2 Scenarios | [Scenarios](features/10-my-alerts-and-notifications/02-scenarios.feature) | Approved |
| 3 Design | [Design](features/10-my-alerts-and-notifications/03-design.md) | Approved |
| 4 Build | [The interface](../frontend/src/) | Implemented |
| 5 Close | [Completion](features/10-my-alerts-and-notifications/04-completion.md) | Approved |

### 11 — Persistence

The eighth feature of the [method of five stages](features/README.md). It keeps what the system stores in PostgreSQL, and changes nothing that a person can see. The code is in the adapters of the three modules, in `database/` and in the Composition Root.

| Stage | Document | Status |
|---|---|---|
| 1 Understand | [Discovery and rules](features/11-persistence/01-discovery.md) | Approved |
| 2 Scenarios | [Scenarios](features/11-persistence/02-scenarios.feature) | Approved |
| 3 Design | [Design](features/11-persistence/03-design.md) | Approved |
| 4 Build | [The database layer](../backend/src/database/), the adapters of [Accounts](../backend/src/accounts/adapters/postgres.ts), [Price Alerts](../backend/src/price-alerts/adapters/postgres.ts) and [Price Observations](../backend/src/price-observations/adapters/postgres.ts), and [`storage.ts`](../backend/src/storage.ts) | Implemented |
| 5 Close | [Completion](features/11-persistence/04-completion.md) | Approved |

### 12 — Deployment

The ninth feature of the [method of five stages](features/README.md). It lets the server run as a public demo with simulated data, and decides where it is deployed. Nothing is deployed yet. The code is in the settings of the server, the reset command, the route of the demo and the notice of the interface.

| Stage | Document | Status |
|---|---|---|
| 1 Understand | [Discovery and rules](features/12-deployment/01-discovery.md) | Approved |
| 2 Scenarios | [Scenarios](features/12-deployment/02-scenarios.feature) | Approved |
| 3 Design | [Design](features/12-deployment/03-design.md) | Approved |
| 4 Build | [The settings](../backend/src/settings.ts), [the reset](../backend/src/reset-demo.ts) and [the notice](../frontend/src/ui/DemoNotice.tsx) | Implemented |
| 5 Close | [Completion](features/12-deployment/04-completion.md) | Approved |

### 13 — Interface Redesign

The tenth feature of the [method of five stages](features/README.md). It gives the interface a new look with Tailwind CSS, shows the Catalogue as cards, and draws the Price History of a Listing as a chart. The backend and the API do not change.

| Stage | Document | Status |
|---|---|---|
| 1 Understand | [Discovery and rules](features/13-interface-redesign/01-discovery.md) | Approved |
| 2 Scenarios | [Scenarios](features/13-interface-redesign/02-scenarios.feature) | Approved |
| 3 Design | [Design](features/13-interface-redesign/03-design.md) | Approved |
| 4 Build | [The screens](../frontend/src/ui/), [the styles](../frontend/src/index.css) and [the points of the chart](../frontend/src/ui/chartPoints.ts) | Implemented |
| 5 Close | [Completion](features/13-interface-redesign/04-completion.md) | Draft |
