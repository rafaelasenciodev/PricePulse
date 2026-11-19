# 01 — Create Price Alert: Completion (Phase 10)

Status: Approved

The close of the feature: what was built, the decisions that shaped it, how it was verified, what it does not do and what comes next. It links to the documents of each phase and does not repeat them.

## 1. Summary

A User who has signed in creates a Price Alert for a Listing with a Target Price. The alert is stored Active so that a later feature can evaluate it. Repeating the same request is harmless, and concurrent requests produce exactly one alert.

The feature runs end to end over HTTP with in-memory storage. It does not evaluate alerts, notify anyone, persist data, or manage alerts after creating them. Those are separate features, decided in the [discovery](00-discovery.md).

## 2. What was implemented

| Phase | Result | Where |
|---|---|---|
| 0 Discovery | Problem, scope and 11 questions, all decided | [Discovery](00-discovery.md) |
| 1 Language and rules | 12 terms and 11 business rules | [Glossary](../../domain/ubiquitous-language.md), [Rules](01-business-rules.md) |
| 2 Scenarios | 18 Gherkin scenarios tagged with their rules | [Scenarios](02-scenarios.feature) |
| 3 Domain model | One aggregate, two Value Objects, typed identifiers | [Domain model](03-domain-model.md) |
| 4 Contract | One use case, four application errors, two ports | [Use case contract](04-use-case-contract.md) |
| 5 Use case | `CreatePriceAlert` and its ports | `backend/src/price-alerts/application/` |
| 6 Adapters | In-memory catalogue and repository | `backend/src/price-alerts/adapters/` |
| 7 HTTP and composition | `POST /listings/{listingId}/price-alerts`, Composition Root, development server, interactive API documentation (OpenAPI and Swagger UI, development only) | `backend/src/price-alerts/http/`, `backend/src/composition-root.ts` |
| 8 Testing | 162 tests, traceability and coverage diagnostic | [Test plan](08-test-plan.md) |
| 9 Architecture review | 10 findings, 7 resolved, an architecture test | [Architecture review](09-architecture-review.md) |

The code is about 900 lines in 21 files, and the tests about 1,350 lines in 12 files.

## 3. Decisions that shaped the feature

| Area | Decision | Recorded in |
|---|---|---|
| Scope | An alert targets a Listing, not a Product. A User has one Active alert per Listing. Only creation is in scope: cancel, pause and modify come later | [Discovery](00-discovery.md) |
| Target Price | Inclusive threshold (price less than or equal to the target). A target that is already reached is rejected. The target is in the currency of the Listing | [Discovery](00-discovery.md) |
| Lifecycle | An alert is Active when created and is one-shot: it ends when its target is reached and the User is notified | [Discovery](00-discovery.md), BR-11 |
| Repeated request | The same request returns the existing alert. This takes precedence over the check of an already reached target | BR-08, found in Phase 2 |
| Model | `PriceAlert` is a small aggregate. The rule "one Active alert per User and Listing" is checked by the application and guaranteed by persistence | [Domain model](03-domain-model.md), decision A |
| Contract | Authentication outside the use case; a fixed order of checks; concurrency solved with a uniqueness guarantee and a repeated read, with no Unit of Work | [Contract](04-use-case-contract.md), decisions 1 to 6 |
| Language | TypeScript for the backend | [ADR-0001](../../adr/0001-typescript-backend.md) |
| Branches | A simplified Git Flow, one branch per feature | [ADR-0002](../../adr/0002-branching-model.md) |

## 4. Verification

- **Tests:** 162 test cases in 12 files, all passing. The levels are domain, use case, adapter contracts, API, wiring, traceability and architecture. The API tests include the interactive documentation, checked not to drift from what the API answers.
- **Scenarios:** 17 of 18 have tests. SC-05 has none by design. SC-14 is tested through the API only, because the use case never sees authentication. See the [test plan](08-test-plan.md).
- **Coverage, as a diagnostic:** 100 % of lines and 95.0 % of branches. No threshold was set, and no test was written only to raise it.
- **Deliberate errors:** 48 errors were introduced in scratch copies of the code and the tests detected all of them. One more, in `main.ts`, cannot be detected because that file has no test, and it was checked by running it.
- **By hand:** the server was started and sent real HTTP requests, the instructions of the README were followed from a clean clone of the repository, and the interactive documentation was fetched from the running server, its page and its files included.

## 5. What the process revealed

| When | What | Result |
|---|---|---|
| Phase 2 | Two approved rules gave opposite answers to a retried request when the price had already fallen | BR-08 was given precedence over BR-05 |
| Phase 3 | Modelling the scenarios showed that one state was missing | The term Triggered was added to the glossary. No rule was needed |
| Phase 5 | The implementation was ported to another language | The design documents did not change |
| Phase 8 | A coverage diagnostic found a failure path of the repository that no test ran | A test was added |
| Phase 8 | An assumption about HTTP content types was wrong | It was checked with a probe and the test corrected |
| Phase 9 | Seven weaknesses: a platform import in the domain, a mutable status, a forced type, a manual list of errors, and others | All seven resolved and verified |
| Phase 10 | After the language change the contract and the model had drifted from the code | Both were aligned and reopened for review |
| Phase 10 | Adding the API documentation made the architecture test fail, because `app.ts` used two packages its rule did not allow | The rule was changed on purpose: only `app` may use the two documentation plugins |

## 6. Known limitations

- Storage is in memory. Nothing persists, and the uniqueness guarantee has been tested only in memory.
- There is no real authentication. Fixed demo tokens stand in for it.
- Alerts can be created but not listed, read, cancelled, paused or modified.
- An alert is never triggered: evaluating prices and notifying Users are later features, so BR-11 is stated but not applied.
- Only EUR and USD are supported. Formatting for currencies without decimals exists in the code but cannot be reached or tested until one is supported.
- `Price` accepts negative amounts. A decision of the model, recorded in a test: only the Target Price must be positive.
- The tests have run on one version of Node, 25.9, although the minimum declared is 22.
- `main.ts` has no automated test.
- The interactive documentation exists only in the development server. It was checked through HTTP requests and tests, not looked at in a browser.
- No continuous integration runs the tests.
- How the application is built for production is not decided.
- The repository has no licence.

## 7. Architectural trade-offs

| Choice | Benefit | Cost |
|---|---|---|
| A small aggregate, uniqueness outside it | Simple model with only what the rules need | The guarantee depends on persistence, which must enforce it |
| Money as integer minor units | Exact, with no dependency | Only currencies in a table are supported |
| Asynchronous ports from the start | A database adapter fits without changing the use case | Every call and every test is asynchronous |
| Authentication before the body is validated, unknown fields rejected | A request that is not authenticated learns nothing, and the owner can never come from the body | A client that sends an extra field gets a 400 |
| Validation errors share a base class | No list of errors to remember | The classification must be kept, and a test pins it |
| Two different 409 responses told apart by a code | Both are conflicts with the state of the system | A client must read the code |
| Tests that read the documents and the imports | Traceability and architecture cannot rot silently | Those tests depend on the layout of the files |
| API documentation generated from the validation schemas | The documentation cannot describe something other than what is enforced, and tests check it against the real answers | Two more runtime dependencies and 30 more packages in total (from 48 to 78 of runtime). It is off unless asked for |
| A branch and a merge per feature | The history shows each feature as a block | Extra steps for a single author |

## 8. Follow-up

**Next features.** The product scope anticipates ingesting price observations, evaluating alerts and notifying Users. The discovery also left cancel, pause and modify for later, and the Users and login feature will replace the demo authentication.

**For the persistence feature.** Enforce BR-07 with a partial unique index over owner and Listing for Active alerts and test it. Make the adapter contract tests reusable. Decide how stored alerts are rebuilt, because the constructor of `PriceAlert` is public.

**Open questions of the project.** See [`open-questions.md`](../../domain/open-questions.md): whether a real data provider will be added, where the contexts are bounded, and whether the user account is a context of its own.

## 9. Completion checklist

- [x] Phases 0 to 9 completed
- [x] Documentation of Phase 10 written
- [x] The documents that were in review are approved by the author: domain model, contract, test plan, architecture review, both ADRs and this document
- [ ] The feature is merged into `develop` and `develop` into `main`, and the version is tagged (done by the developer, [ADR-0002](../../adr/0002-branching-model.md))
- [ ] A licence is chosen before the repository is published
