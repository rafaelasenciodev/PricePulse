# Feature methodology

Status: Approved

Every feature is developed through the same sequence of phases. Each phase ends with an explicit approval before the next one begins. Documents are created when their phase begins; none are created in advance.

## Phases

| Phase | Name | What it produces |
|---|---|---|
| 0 | Feature Discovery | The business problem, actors, user goal, feature scope, ambiguities and the questions that must be answered |
| 1 | Domain Language and Business Rules | Agreed terminology (added to the project glossary) and the business rules, including invariants |
| 2 | Behavioural Scenarios using Gherkin | Scenarios describing observable behaviour: happy paths, sad paths, edge cases and relevant failures; acceptance criteria |
| 3 | Domain Modelling | The domain model (entities, Value Objects, aggregates, domain events where justified) with the reasoning behind each choice |
| 4 | Application Use Case Contract | For each use case: inputs and outputs, expected application errors, required ports, transaction boundaries and dependencies |
| 5 | Use Case Implementation | Application logic, independent of HTTP, persistence and external providers |
| 6 | In-memory Adapters | In-memory implementations of the required ports, so the application can be tested without external infrastructure |
| 7 | HTTP and Application Composition | The HTTP interface: request and response schemas, mapping of application errors to HTTP responses, dependency wiring and the Composition Root |
| 8 | Testing | Verification that the scenarios and business rules are covered at the appropriate levels: unit, domain, application, integration, contract, API and, when a frontend exists, end-to-end |
| 9 | Architecture Review | A review of dependency direction, separation of responsibilities, domain purity, coupling, cohesion, error handling, transaction boundaries, idempotency where relevant, and maintainability |
| 10 | Documentation and Completion | What was implemented, important decisions, tests executed, known limitations, architectural trade-offs and relevant ADRs |

Architecture Review (9) and Documentation and Completion (10) are separate activities. If the review finds problems that require changes, the work returns to the relevant earlier phase before the feature is documented as complete.

## How the phases relate

**Phase 0 may iterate.** Answers to discovery questions can raise new questions. Phase 0 ends only when the blocking questions are resolved and the feature scope is approved.

**Scenarios come before the model.** Gherkin scenarios (Phase 2) are written before domain modelling (Phase 3), so that the model is shaped by the required behaviour rather than the reverse.

**The model is validated against the scenarios.** At the end of Phase 3, every scenario must be expressible with the model. If it is not, the work goes back to the phase that owns the gap:

- a missing question or an unclear scope: back to Phase 0 (Discovery);
- a missing term or business rule: back to Phase 1 (Domain Language and Business Rules);
- a scenario that is wrong or incomplete: back to Phase 2 (Behavioural Scenarios).

**Tests are written progressively.** Executable tests are added while the feature is implemented (Phases 5 to 7), not left until the end. The project's regular test runner is sufficient; no dedicated BDD framework is introduced unless a concrete reason justifies it. Phase 8 is the point where the coverage of scenarios and rules is checked and the remaining test levels are completed.

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

**Decision status** describes the state of an individual decision recorded in a document.

| Status | Meaning |
|---|---|
| Proposed | Suggested; not yet discussed |
| Under Review | Being evaluated, with alternatives considered |
| Accepted | Explicitly approved; not yet realised in code |
| Implemented | Realised in code |
| Verified | Confirmed by tests or review |

A decision is not described as Accepted until it has been explicitly approved.

## Principles

- Business rules are not assumed. Ambiguities are recorded as questions and resolved explicitly.
- Aggregates, Value Objects and patterns are introduced only with a stated justification.
- Tests verify behaviour and business rules, not coverage figures.
- Every completed feature must be understandable by another developer.

## Features

| # | Feature | Current phase |
|---|---|---|
| 01 | [Create Price Alert](01-create-price-alert/00-discovery.md) | Phase 10 — Documentation and Completion (in progress) |
