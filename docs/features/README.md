# Feature methodology

Status: In Review

Every feature goes through five stages. A stage ends with an explicit approval, and the build stage has several stops, so that each layer of the feature can be reviewed. Documents are created when their stage begins; none are created in advance.

Features 01 to 03 were developed with an earlier method of eleven phases. Their documents are kept as they are (see [The earlier method](#the-earlier-method)).

## Stages

| Stage | Name | What it produces | Approval |
|---|---|---|---|
| 1 | Understand | `01-discovery.md`: the business problem, actors, scope (what is in and what is not), the questions with their options and decision, the business rules, and the new terms for the glossary | Yes |
| 2 | Scenarios | `02-scenarios.feature`: Gherkin scenarios of observable behaviour: happy paths, sad paths and edge cases that follow from the rules | Yes |
| 3 | Design | `03-design.md`: what is modelled and why, each use case (input, output, errors, order of checks, ports, transaction boundary), the decisions that were really discussed with their alternatives, and one table of where each scenario is handled | Yes |
| 4 | Build | Code and tests, in small commits, with the four stops below. No documents | Yes, after each stop |
| 5 | Close | `04-completion.md`: what was built, the decisions and their status, how it was verified, what the review found, limitations and next steps. The README and the documentation indexes are updated | Yes |

### The stops of the build stage

| Stop | What is built |
|---|---|
| a | The domain and the use cases, with their tests. They know nothing about HTTP or persistence |
| b | The ports, and their adapters and repositories: in memory first, a database adapter when persistence exists. Each port has contract tests that any adapter must pass |
| c | The way in: endpoints (GET, POST, PUT, PATCH or DELETE, as the feature needs), request and response schemas, the mapping of application errors to HTTP responses, and the wiring in the Composition Root. When a frontend exists, the screens of the feature |
| d | Verification and review: that the scenarios and rules are covered at the right levels, and a review of dependency direction, domain purity, error handling, transaction boundaries, idempotency where relevant, and maintainability. What needs changing is changed before the feature is closed |

A new decision that appears while building stops the work until it is decided. Introducing deliberate errors to check the tests is optional, and it is worth doing where a mistake is costly: money, dates and concurrency.

## How the stages relate

**Stage 1 may iterate.** Answers to the questions can raise new ones. The stage ends when the blocking questions are resolved and the scope is approved.

**Scenarios come before the design.** They are written first, so that the design is shaped by the required behaviour and not the reverse.

**The design is validated against the scenarios.** Every scenario must be expressible with it. If one is not, the work goes back to the stage that owns the gap:

- a missing question, an unclear scope or a missing rule: back to stage 1;
- a scenario that is wrong or incomplete: back to stage 2.

**Tests are written while building,** at each stop, not left until the end. The project's regular test runner is enough. No dedicated BDD framework is introduced unless a concrete reason justifies it.

## What is written once

- A fact is written in one place and linked from the others. The table that says where each scenario is handled is in the design, and the status of each decision is in the completion.
- The alternatives are told only for decisions that were really discussed.
- A decision that affects the whole project (language, database, authentication, frontend stack, deployment) is an ADR in [`docs/adr/`](../adr/), not a decision of a feature.
- A document of a stage fits in about 150 lines. If it needs far more, the feature is probably too big, and it is split.

## Scenarios

Gherkin describes expected behaviour as a business observer would see it. It does not describe implementation details such as endpoints, tables or classes.

## Traceability

Traceability is deliberately lightweight. Where it adds value, the following identifiers link the artefacts of a feature:

| Identifier | Refers to |
|---|---|
| `BR-01` | A business rule |
| `SC-01` | A behavioural scenario |
| `UC-01` | An application use case |
| `TC-01` | A test case, where an identifier is useful |

Scenarios can reference the business rules they exercise through Gherkin tags (for example `@BR-01`). Tests reference the scenario or business rule they verify when that is practical. The aim is that a reader can follow a rule to its scenarios and tests, not that every artefact carries an identifier.

## Status vocabulary

Two kinds of status are kept separate.

**Document status** describes the state of a document.

| Status | Meaning |
|---|---|
| Draft | Being written; content may change freely |
| In Review | Submitted for review; changes follow the review |
| Approved | Explicitly approved; later changes reopen the review |

**Decision status** describes the state of an individual decision.

| Status | Meaning |
|---|---|
| Proposed | Suggested; not yet discussed |
| Under Review | Being evaluated, with alternatives considered |
| Accepted | Explicitly approved; not yet realised in code |
| Implemented | Realised in code |
| Verified | Confirmed by tests or review |

A decision is not described as Accepted until it has been explicitly approved. In the design, the decisions are Accepted when the design is approved. Their later status is recorded once, in the completion.

## Principles

- Business rules are not assumed. Ambiguities are recorded as questions and resolved explicitly.
- Aggregates, Value Objects and patterns are introduced only with a stated justification.
- Tests verify behaviour and business rules, not coverage figures.
- A document exists to settle something or to explain it to a reader. If it repeats another one, it links to it instead.
- Every completed feature must be understandable by another developer.

## The earlier method

Features 01 to 03 followed eleven phases. Their documents keep their names and are not migrated. This is how the phases map to the stages:

| Phases | Stage |
|---|---|
| 0 Discovery, 1 Domain Language and Business Rules | 1 Understand |
| 2 Behavioural Scenarios | 2 Scenarios |
| 3 Domain Modelling, 4 Application Use Case Contract | 3 Design |
| 5 Use Case Implementation, 6 In-memory Adapters, 7 HTTP and Application Composition | 4 Build, stops a to c |
| 8 Testing, 9 Architecture Review | 4 Build, stop d |
| 10 Documentation and Completion | 5 Close |

## Features

| # | Feature | State |
|---|---|---|
| 01 | [Create Price Alert](01-create-price-alert/00-discovery.md) | Phase 10 — Documentation and Completion (done, pending merge) |
| 02 | [Price Observation](02-price-observation/00-discovery.md) | Phase 10 — Documentation and Completion (done, pending merge) |
| 03 | [Alert Evaluation](03-alert-evaluation/00-discovery.md) | Phase 10 — Documentation and Completion (done, pending merge) |
| 04 | [Read and Manage Price Alerts](04-read-and-manage-alerts/01-discovery.md) | Stage 5 — Close (done, pending merge) |
| 05 | [Notifications and Price History](05-notifications-and-price-history/01-discovery.md) | Stage 5 — Close (done, pending merge) |
| 06 | [Accounts and Authentication](06-accounts-and-authentication/01-discovery.md) | Stage 5 — Close (done, pending merge) |
| 07 | [Listings Catalogue](07-listings-catalogue/01-discovery.md) | Stage 5 — Close (done, pending merge) |
| 08 | [Session Cookie](08-session-cookie/01-discovery.md) | Stage 5 — Close (done, pending merge) |
| 09 | [Web Interface](09-web-interface/01-discovery.md) | Stage 5 — Close (done, pending merge) |
| 10 | [My Alerts and My Notifications](10-my-alerts-and-notifications/01-discovery.md) | Stage 5 — Close (done, pending merge) |
