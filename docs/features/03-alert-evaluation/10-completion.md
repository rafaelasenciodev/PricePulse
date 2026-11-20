# 03 — Alert Evaluation: Completion (Phase 10)

Status: Approved

The close of the feature: what was built, the decisions that shaped it, how it was verified, what the architecture review found, what it does not do and what comes next. It links to the documents of each phase and does not repeat them. Like [feature 02](../02-price-observation/10-completion.md), it holds the verification (section 4) and the architecture review (section 5) itself, instead of separate documents.

## 1. Summary

When a Provider records a price, the system compares the Current Price of that Listing with the Target Price of each of its Active Price Alerts. Each alert that is reached becomes Triggered and gets one Notification, a stored record that its owner must be told. Repeating the evaluation changes nothing, two evaluations at the same time produce one Notification, and an evaluation that a failure left half done is finished by the next one.

The feature runs end to end with in-memory storage. It does not deliver Notifications, offer a way to read alerts or Notifications, or evaluate on a schedule. The only trigger is the recording of a price, and the only visible result is a line in the log of the development server. Those are separate features or decisions, recorded in the [discovery](00-discovery.md).

## 2. What was implemented

| Phase | Result | Where |
|---|---|---|
| 0 Discovery | Problem, scope and 6 questions, all decided | [Discovery](00-discovery.md) |
| 1 Language and rules | 2 new terms, 1 refined, 10 business rules and 2 questions decided | [Glossary](../../domain/ubiquitous-language.md), [Rules](01-business-rules.md) |
| 2 Scenarios | 19 Gherkin scenarios tagged with their rules | [Scenarios](02-scenarios.feature) |
| 3 Domain model | Two behaviours of `PriceAlert`, one immutable record (`Notification`), 4 decisions | [Domain model](03-domain-model.md) |
| 4 Contract | One use case, no application errors, three ports, 8 decisions | [Use case contract](04-use-case-contract.md) |
| 5 Use case | `Notification`, `PriceAlert.isReachedBy` and `trigger`, `EvaluatePriceAlerts`; `ObservedAt` moved to `shared` | `backend/src/price-alerts/`, `backend/src/shared/domain/` |
| 6 Adapters | In-memory `NotificationRepository` and `CurrentPriceSource`, and the two new operations of the repository of alerts, with reusable contract tests | `backend/src/price-alerts/adapters/` |
| 7 Composition | The policy that evaluates after each recording, the log line, the demo Price Alert. No endpoint | `backend/src/evaluation-trigger.ts`, `backend/src/composition-root.ts`, `backend/src/main.ts` |
| 8 Testing | 85 tests of the feature, a traceability guard for the third feature | Section 4 |
| 9 Architecture review | 8 findings: 3 resolved, 1 accepted as a limitation | Section 5 |

The feature changed 24 source files (470 insertions, 38 deletions, among them the move of `ObservedAt`) and 18 test files (1,230 insertions). No dependency was added.

## 3. Decisions that shaped the feature

| Area | Decision | Recorded in |
|---|---|---|
| Scope | Alerts are evaluated and a Notification is produced and stored. Delivery, channels, reading and scheduling are out | [Discovery](00-discovery.md), Q1 |
| Trigger | The unit of work is a use case that evaluates one Listing and is idempotent. Something outside both features starts it | Discovery, Q2 |
| Order of writes | First the Notification, unique per alert, then the alert becomes Triggered. No Unit of Work | Discovery, Q3; [Contract](04-use-case-contract.md), decision 8 |
| Which price | The Current Price at the moment of the Evaluation, stated in the Notification with its Observed At | Discovery, Q4 |
| Interrupted evaluation | An existing Notification decides: the alert becomes Triggered whatever the price is now | [Rules](01-business-rules.md), R1 and BR-06 |
| Unknown Listing | Nothing to evaluate, and not an error | Rules, R2 and BR-10 |
| Where it lives | In the module `price-alerts`. A new module would not have been able to import `PriceAlert`, and moving the alert to `shared` was weighed and rejected | [Domain model](03-domain-model.md), decision A |
| Model | `Notification` is its own immutable record, identified by its Price Alert. `PriceAlert` stays immutable and `trigger` returns a new one. `ObservedAt` moves to `shared` | Domain model, decisions B, C, D |
| Failures | One alert that fails does not stop the others. The run returns `failed` and does not raise it | Contract, decision 5 |

### Decisions of Phase 7

They were taken in the phase and are recorded here, because no document describes them.

| # | Decision | Status |
|---|---|---|
| 1 | The Composition Root starts the Evaluation by wrapping the recording of a price. The recording itself does not change (BR-11 of feature 02) | Verified |
| 2 | The Evaluation runs after every recording that succeeds, a new one or a repeated one. Being idempotent, a repeat by the Provider finishes an Evaluation that failed before | Verified |
| 3 | If the Evaluation fails, the response of the recording does not change. The failure is reported to the log | Verified |
| 4 | The Evaluation runs inside the request, with `await`. The tests read its effects right after the response | Verified |
| 5 | The outcome goes to a function `onEvaluation`. By default it writes a line to the log for each Notification produced and a warning for each failure | Verified |
| 6 | The development server starts with a demo Price Alert of `demo-user-1` for `headphones-shop-a`, with a Target Price of 80.00 EUR | Implemented. `main.ts` has no test, and it was checked by hand |

### Effect on the other features

- **Feature 01.** `CreatePriceAlert` and its contract do not change. Its repository port gains two operations, and its in-memory adapter implements them.
- **Feature 02.** Its use case and contract do not change. `ObservedAt` moved to `shared`, and its HTTP layer now types the recorder as `PriceObservationRecorder`, only `execute`, so that a wrapped use case fits.
- **The scenario SC-21 of feature 02**, "Recording a Price Observation does not evaluate Price Alerts", describes the recording. It is still true of the use case `RecordPriceObservation`, which has no port to alerts, and a test pins it. It is no longer true of the whole system: the Composition Root now evaluates after a recording received over HTTP. The documents of feature 02 are not reopened. The test that proved SC-21 through HTTP now calls the use case directly, with a comment that says why.

## 4. Verification

- **Tests:** 515 test cases in 31 files, all passing, of which 85 belong to this feature: domain 16, use case 27, adapters and contracts of the ports 23, wiring through HTTP 9 and the policy of the trigger 10. The guard of traceability adds 7 and the architecture test 1.
- **Scenarios:** all 19 have tests, read from the titles. SC-01 to SC-07 and SC-11 are also tested in the domain, and SC-01, 03, 05, 10 and 12 also through HTTP. The rest are tested in the use case with the real in-memory adapters, which is where their rules live. Every rule has a scenario, so the guard has no exemption.
- **Traceability:** `tests/traceability.test.ts` now checks the three features. The evaluation lives in the module of feature 01, so its tests are told apart by folder and by file name, because the identifiers SC-nn repeat in each feature.
- **Coverage, as a diagnostic:** 100 % of lines, 99.8 % of statements and 98.4 % of branches, for the whole project. The same 4 branches as in feature 02 are not covered: three defensive and one of an old test double.
- **Deliberate errors:** 42 different changes were made, one at a time, in scratch copies of the code, and the tests were run after each: the domain (8), the use case (13), the adapters (10), the wiring (6) and the review (5). One change of the adapters was tried twice, in two phases, and is counted once. The tests detected all of them in the end. **Two were not detected at first** and led to tests: saving an alert that was never added was accepted, and saving found the alert by owner and not by identifier. A control change, introduced on purpose, survived as it should. The changes were chosen by hand and are not a systematic mutation tool, so they measure what was tried and not everything possible. `main.ts` has no test.
- **By hand:** the development server was started and a price of 90.00 and then one of 79.90 were recorded as the provider. The second produced one line in the log, with the alert, its owner `demo-user-1`, the Target Price of 80.00, the Current Price of 79.90 and its Observed At. A third recording did not repeat it. The Swagger page was not looked at in a browser.

## 5. Architecture review

Criteria: direction of dependencies, separation of responsibilities, purity of the domain, coupling, cohesion, error handling, transaction boundaries, idempotency, maintainability. It was done by reading the code, the dependency test and the results of section 4. It did not measure performance or load and was not a security review.

| Criterion | Result |
|---|---|
| Direction of dependencies | Correct. The new code imports only its own domain, `shared` and its ports. A feature never imports another, and the Composition Root and the new module of the trigger are the only places that know both |
| Purity of the domain | Correct. `Notification` and the new behaviours of `PriceAlert` do no input or output and do not read the clock |
| Cohesion | Acceptable. The use case has 114 lines and about 10 decision points, and reads in the numbered steps of the contract |
| Error handling | Correct. A failure of one alert is returned and does not stop the rest. A failure of the source of prices is not about an alert and is raised |
| Transactions and idempotency | Correct. Two atomic writes, ordered so that a repeat is safe, and one Notification per alert guaranteed by uniqueness |

| # | Finding | Outcome |
|---|---|---|
| 1 | A race between creating an alert and recording a price can leave an alert Active although the Current Price already reaches its target. The creation reads the price, then the price falls and the Listing is evaluated while the alert is not stored yet, and the alert is stored afterwards. It was reproduced in a scratch test | **Accepted as a limitation.** A periodic sweep, the option C of the discovery, would fix it and any other lost Evaluation. The alternative, evaluating after each creation too, was not chosen |
| 2 | The Composition Root held the policy of when to evaluate as well as the wiring | **Resolved.** The policy moved to `evaluation-trigger.ts`, with its own layer in the architecture test |
| 3 | The rule that the Current Price is the one of the latest observation was written twice in the Composition Root | **Resolved.** It is a single function |
| 4 | The type `Pick<RecordPriceObservation, "execute">` was repeated in four places | **Resolved.** It is `PriceObservationRecorder` |
| 5 | The Evaluation runs inside the request that records, and every Active alert of the Listing is loaded. The latency grows with the number of alerts | **Noted** for persistence and scale |
| 6 | Saving an alert replaces it without a condition | **Noted.** It is safe while Active to Triggered is the only change. It must be conditional when alerts can be cancelled or modified |
| 7 | The constructor of `PriceAlert` is public, and `trigger` uses it. How a stored alert is rebuilt is still open | **Noted** for persistence |
| 8 | `failed` carries `Error` instances, which cannot be serialised | **Noted** for the first consumer other than the log |

## 6. What the process revealed

| When | What | Result |
|---|---|---|
| Phase 1 | The rules left two cases open: a Notification exists and the price has risen, and a Listing that does not exist | Decided as R1 and R2, and recorded as BR-06 and BR-10 |
| Phase 3 | The alternative that the evaluation lives in a new module, with the alert moved to `shared`, was weighed | Rejected. The reasons are in the model, and it can be revisited when scheduling or delivery appear |
| Phases 5 and 6 | The deliberate errors of Phase 5 showed that the port did not say what saving an alert that was never added does | The contract of the port was completed in Phase 6 and a test added |
| Phase 6 | A deliberate error showed that saving by owner and not by identifier went unnoticed | A case was added to the contract of the repository |
| Phase 7 | A test of feature 02 stated that recording does not touch an alert, which stopped being true over HTTP | It now tests the use case. See section 3 |
| Phase 7 | The architecture test forbids the Composition Root to import `shared` | The report names the Listing as text. The rule was not changed |
| Phase 7 | The identifiers SC-nn collided again, now between the wiring tests of two features | Ownership of tests by file name, as for the folder of the evaluation |
| Phase 8 | The coverage diagnostic showed three gaps that were behaviour: the log line, a failure that is not an `Error`, and a new alert after a Triggered one | Tests were added, and `logEvaluation` was exported for it |
| Phase 9 | A race that the model did not foresee, found by reading how the creation and the evaluation use the price | Finding 1 |

## 7. Known limitations

- Storage is in memory. Nothing persists, and the uniqueness of Notifications has been tested only in memory.
- A Notification is stored and nothing else: it is not delivered, there is no channel and there is no way to read alerts or Notifications over HTTP. The only visible result is the log of the development server.
- The Evaluation starts only when a price is recorded. There is no periodic sweep, so a lost Evaluation, or the race of finding 1, is repaired only by the next recording.
- The Evaluation runs inside the request that records, and its cost grows with the alerts of the Listing.
- Saving an alert replaces it, and the model has one change of state, from Active to Triggered.
- A Triggered alert is never reactivated: alerts are one-shot (BR-11 of feature 01).
- Only one demo Price Alert exists in the development server, and `main.ts` has no test.
- The deliberate errors were chosen by hand.
- The tests have run on one version of Node, 25.9, although the minimum declared is 22. No continuous integration runs them, how the application is built for production is not decided, and the repository has no licence.

## 8. Architectural trade-offs

| Choice | Benefit | Cost |
|---|---|---|
| Evaluation inside the module of Price Alerts | Reuses the alert and its rule of "reached" without copying them | The module grows, and `Notification` may have to move if a feature of delivery needs it |
| The Notification is a record apart from the alert | Two small writes and no aggregate loaded for a record that nothing reads yet | The consistency between them depends on the order of the writes and on persistence |
| Order of writes instead of a Unit of Work | No new mechanism, and a repeat finishes what failed | A crash in between leaves a Notification of an alert that is still Active until the next Evaluation |
| Evaluate after every recording, repeated ones too | A repeat by the Provider repairs a failed Evaluation | One more read of the alerts per repeat |
| A failed Evaluation does not change the response of the recording | The observation is stored and the Provider is not told otherwise | The failure is visible only in the log |
| A policy module that joins two features | The Composition Root stays wiring, and neither feature knows the other | A new layer in the architecture test |
| One alert that fails does not stop the others | One alert with inconsistent data does not block the rest | The caller must read `failed` |

## 9. Documentation volume and method

This feature was closed with the full method, as agreed, and this is the point at which to decide whether to lighten it. The documents of phases 0 to 4 have this many lines:

| Feature | Lines | Files |
|---|---|---|
| 01 | 635 | 5 |
| 02 | 750 | 5 |
| 03 | 711 | 5 |

A completion document and, in feature 01, two more documents come on top. These are the repeated parts that were found:

- The mapping of the scenarios to their handling is written twice, in the domain model and in the contract: 43 lines in this feature, 6 % of the documents.
- The alternatives of a decision are told in the discovery, in the model and in the contract.
- The introduction of each document, and the column of origin in the rules, restate what the discovery already says.

**Proposal.** From the next feature: the discovery and the rules in one document, the model and the contract in one document of design with a single table of scenarios, the scenarios as they are, and the phases 8 and 9 as sections of the completion, as in features 02 and 03. The saving is an estimate from the redundancies listed, and not a measurement: **between a sixth and a fifth** of the documents of phases 0 to 4, more if each alternative is told once. It is less than the third that was first said. Where the domain is delicate, such as money, dates or concurrency, the phases would stay separate.

Changing the method means changing [`docs/features/README.md`](../README.md), which is approved. It is not changed here: it is a decision of the author, taken after this document is approved.

The assessment of section 9 of [the completion of feature 02](../02-price-observation/10-completion.md) still holds. What stood out in this feature is that the tests that earn their keep are those of the use case with its real adapters, and the contract of each port.

## 10. Follow-up

**Next features.** The discovery left outside this feature delivery and channels, accounts and emails, reading alerts and Notifications, cancelling, pausing and modifying alerts, the price simulator, scheduling, price history and persistence. A feature of reads would give the log line a visible form, and a periodic sweep would close finding 1.

**For the persistence feature.** Enforce one Notification per Price Alert with a unique constraint and test it. Index Active alerts by Listing, because the Evaluation reads them, and make `save` conditional on the state that was read. Decide how a stored alert is rebuilt. Make the contract tests of the repositories run against the database adapters.

**Open questions of the project.** See [`open-questions.md`](../../domain/open-questions.md).

## 11. Completion checklist

- [x] Phases 0 to 9 completed
- [x] Documentation of Phase 10 written (this document)
- [x] The documents of Phase 10 are approved by the author: this document, and the domain model and the contract with their decision statuses updated
- [x] The README and the documentation indexes describe this feature
- [ ] The decision on the method of documentation of section 9 is taken
- [ ] The feature is merged into `develop` and `develop` into `main`, and the version is tagged (done by the developer, [ADR-0002](../../adr/0002-branching-model.md))
- [ ] A licence is chosen before the repository is published
