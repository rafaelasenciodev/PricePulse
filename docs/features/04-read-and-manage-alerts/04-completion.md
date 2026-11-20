# 04 — Read and Manage Price Alerts: Completion (Stage 5)

Status: Approved

The close of the feature: what was built, the decisions and their status, how it was verified, what the review found, what it does not do and what comes next. It links to the documents of each stage and does not repeat them. It is the first feature developed with the [method of five stages](../README.md).

## 1. Summary

A User can see their Price Alerts, read one, change the Target Price of one that is still Active, or cancel it. Nobody else can see or change them. An alert has a creation moment, and a Cancelled alert is not evaluated again and lets the User create another one for the same Listing.

It runs end to end over HTTP with in-memory storage. It does not pause alerts, read Notifications or the price history, authenticate for real or have an interface. Those are separate features, listed in the [discovery](01-discovery.md).

## 2. What was built

| Stage | Result | Where |
|---|---|---|
| 1 Understand | 7 questions decided, 9 rules, 2 new terms and one refined | [Discovery and rules](01-discovery.md), [glossary](../../domain/ubiquitous-language.md) |
| 2 Scenarios | 22 Gherkin scenarios, 5 of them with several examples | [Scenarios](02-scenarios.feature) |
| 3 Design | The model, 4 use cases, the ports and the way in, 8 decisions | [Design](03-design.md) |
| 4a Domain and use cases | `CreatedAt`, `Cancelled`, `cancel`, `changeTargetPrice`, the conditional save and four use cases | `backend/src/price-alerts/domain/`, `.../application/` |
| 4b Ports and adapters | The contract of the reading operations, run against the in-memory adapter | `backend/src/price-alerts/adapters/`, `backend/tests/price-alerts/management/` |
| 4c Way in | `GET /price-alerts`, `GET /price-alerts/{alertId}`, `PATCH /price-alerts/{alertId}`, three new error codes, the wiring | `backend/src/price-alerts/http/`, `backend/src/composition-root.ts` |
| 4d Verification and review | Traceability of the fourth feature, 8 findings | Sections 4 and 5 |

The feature changed 22 source files (677 insertions, 51 deletions) and 32 test files (2,034 insertions), part of them the mechanical change that gave every alert a creation moment. No dependency was added.

## 3. Decisions and their status

The status of every decision of the discovery and the design is recorded here, and only here.

| Decision | Status | Evidence |
|---|---|---|
| Q1 Scope: list, read one, modify the Target Price, cancel | Verified | The 22 scenarios |
| Q2 An alert of another User is answered as one that does not exist | Verified | SC-06 at four levels: use case, repository, API and the whole application |
| Q3 Cancelling is a state, `Cancelled`. Cancelling twice succeeds, and a Triggered one cannot be cancelled | Verified | SC-08 to SC-12 |
| Q4 Only the Target Price of an Active alert can change | Verified | SC-14 to SC-19 |
| Q5 The alert has a creation moment, and the list is newest first | Verified | SC-01, SC-22, and the contract of the repository |
| Q6 A save is conditional on the state that was read | Verified, in memory only | SC-20, SC-21 and the contract of the repository |
| Q7 What the list shows, and the filter by state | Verified | SC-01, SC-02 |
| D1 `CreatedAt` is a Value Object | Verified | Its own tests, and the creation moment through every use case |
| D2 `cancel` and `changeTargetPrice` belong to `PriceAlert`, which stays immutable | Verified | Domain tests |
| D3 `Clock` is a port of the module, and the Composition Root gives both features the same clock | Verified | A test of the wiring |
| D4 The save is conditional on the state read, and a save of the state already stored is harmless | Verified, in memory only | The contract of the port. See section 6 |
| D5 The list is paginated with `limit` and `offset`, and answers with the total | Verified | The contract of the port, and the API |
| D6 Three new application errors: `AlertNotFound`, `AlertNotActive`, `AlertConflict` | Verified | The use cases and the API |
| D7 One resource, `/price-alerts/{alertId}`, and PATCH for both changes | Verified | The API, the documentation and a run by hand |
| D8 The queries are by owner, so authorisation is part of the question | Verified | The contract of the port |

### Effect on the other features

- **Feature 01.** `CreatePriceAlert` takes a `Clock`, and the alert and its answer gain `createdAt`. Its documents are not reopened.
- **Feature 03.** The Evaluation saves with the state it read, and an alert that changed meanwhile goes to its `failed` list. Its rules do not change.
- **The API.** The answer to creating an alert now has `createdAt`, and the state `cancelled` can appear in the answers.

## 4. Verification

- **Tests:** 724 test cases in 43 files, all passing. About 190 are in files of this feature: domain 29, use cases 64, contract of the repository and its adapter 26, the API 62 (with its documentation) and the whole application 10. Others were added to existing files, such as the contract of the conditional save.
- **Scenarios:** all 22 have tests, read from the titles. The traceability guard now covers the four features, and this one has no exemption. Each scenario is tested at two or more levels, except SC-21 (the Evaluation) and SC-22 (the creation).
- **Coverage, as a diagnostic:** 100 % of lines, 99.8 % of statements and 98.5 % of branches. The five branches that are not covered are defensive or cannot be reached.
- **Deliberate errors:** 80 changes were made, one at a time, in scratch copies of the code, and the tests were run after each. **77 were detected and 3 changed nothing observable.** Several times a gap was seen by reading the tests before trying, and it was closed, for example a `find` that would ignore the identifier, or a currency fixed to EUR. The changes were chosen by hand and are not a systematic tool, and `main.ts` has no test.
- **By hand:** the development server was started and, with a User token, the demo alert was listed, read, given a new Target Price and cancelled. Cancelling it again answered 200, the token of another User answered 404, and the documentation listed the new routes.

## 5. Architecture review

Dependencies point inward, and the architecture test passes. Authorisation is part of the queries by owner, so the port never hands over the alert of another User. A technical failure is not turned into a business error, and the cancel and the modification are idempotent. A change is one conditional write, which a database would do as an update that checks the state.

| # | Finding | Outcome |
|---|---|---|
| 1 | The bounds of the pagination (20 by default, 100 at most) live only in the schema of the way in | **Accepted.** The port says that the caller checks them. It is reviewed if another way in appears |
| 2 | The default `limit` is in the schema and in the handler, and the second is redundant | **Accepted** as a safeguard |
| 3 | "Save, and if the state changed, `AlertConflict`" is written twice | **Accepted.** A third use would justify extracting it |
| 4 | The group of the routes of reading and managing is optional, and always given in production | **Accepted** (design decision 5, to leave the tests of the other features as they are). It can be made required in a clean-up |
| 5 | A Notification can stay stored for an alert that was cancelled (the consequence of Q6) | **Noted** for the feature of Notifications |
| 6 | Two changes of the Target Price at the same time both succeed, and the last one stays | **Noted.** The save looks at the state only |
| 7 | Twelve test files build alerts by hand and seven use the new helper | **Left.** A clean-up of little value |

## 6. What the process revealed

| When | What | Result |
|---|---|---|
| 4a | A strict condition on the state would have failed two Evaluations at the same time, a case of feature 03 that already had a test | The save was refined: one already in the state it would have is harmless. It is written in the design, which was approved |
| 4a | The work was split into smaller stops than the plan: the conditional save, then the reads, then the changes | Each one was reviewed and committed on its own |
| 4a | A test of the race simulated the wrong version of the alert | It was a mistake of the test, found and fixed |
| 4c | The numbers of a URL arrive as text, and the validation is strict on purpose | A hook converts `limit` and `offset` only on that route, if they are digits. Nothing else is accepted |
| 4d | The tests of this feature share the module and the identifiers SC-nn with other features | Each feature declares its test files by folder and by file name, and where its rules are |

## 7. Known limitations

- Storage is in memory, and the conditional save and the uniqueness have been tested only there ([ADR-0003](../../adr/0003-persistence-deferred.md)).
- Alerts cannot be paused and resumed. Notifications and the price history cannot be read. There is no interface.
- Authentication is still the demo tokens.
- The race between creating an alert and recording a price (feature 03, finding 1) is not changed.
- Modifying reads the Current Price and then saves, and the price can move in between, as when creating.
- The bounds of the pagination are checked only by the way in, and the tests have run on one version of Node, 25.9. No continuous integration runs them, and the repository has no licence.

## 8. Documentation volume

This is the first feature of the method of five stages. The documents of its first three stages have 510 lines (discovery and rules 148, scenarios 231, design 131), and those of the first three features had 635, 750 and 711 for their phases 0 to 4. It is 28 % fewer lines than the last one, but the features are not alike, so it is a sign and not a measure. The scenarios are now the longest document, as they were, and the saving came mostly from not writing separate documents for the rules and for the contract.

## 9. Follow-up

**Next features,** in the order of [ADR-0003](../../adr/0003-persistence-deferred.md) and of the plan agreed so far: real authentication and accounts, with its own ADR; reading Notifications and the price history; the web interface; then persistence, with its ADR, and the deployment.

**For the persistence feature.** Index the alerts by owner, newest first and then by identifier, for the list. Make the conditional save an update that checks the state, and run the contracts of the repository against the database adapter. The other points of the earlier completions still stand.

## 10. Completion checklist

- [x] Stages 1 to 4 completed
- [x] Documentation of stage 5 written (this document)
- [x] This document is approved by the author
- [x] The README and the documentation indexes describe this feature
- [ ] The feature is merged into `develop` with `--no-ff`, and `develop` into `main` and tagged (done by the developer, [ADR-0002](../../adr/0002-branching-model.md))
- [ ] A licence is chosen before the repository is published
