# 05 — Notifications and Price History: Completion (Stage 5)

Status: In Review

The close of the feature: what was built, the decisions and their status, how it was verified, what the review found, what it does not do and what comes next. It links to the documents of each stage and does not repeat them. It is the second feature developed with the [method of five stages](../README.md).

## 1. Summary

A User can read the Notifications of their own Price Alerts, newest first, and anyone with a User's token can read the Price History of a Listing: its Price Observations, newest first, in pages, optionally within a range of time. Reading changes nothing.

It runs end to end over HTTP with in-memory storage. It does not deliver Notifications, mark them as read, summarise the history, authenticate for real or have an interface of its own. Those are separate features, listed in the [discovery](01-discovery.md).

## 2. What was built

| Stage | Result | Where |
|---|---|---|
| 1 Understand | 7 questions decided, 9 rules, one new term | [Discovery and rules](01-discovery.md), [glossary](../../domain/ubiquitous-language.md) |
| 2 Scenarios | 20 Gherkin scenarios, 6 of them with several examples | [Scenarios](02-scenarios.feature) |
| 3 Design | The range of the history, 2 use cases, 2 ports and an authenticator, 7 decisions | [Design](03-design.md) |
| 4a Domain and use cases | `ObservedAtRange`, `ListNotifications`, `ReadPriceHistory` | `backend/src/price-observations/domain/`, `backend/src/price-alerts/application/`, `backend/src/price-observations/application/` |
| 4b Ports and adapters | The contracts of `findByOwner` and `findByListing`, run against the in-memory adapters | `backend/tests/price-alerts/notifications/`, `backend/tests/price-observations/history/` |
| 4c Way in | `GET /notifications`, `GET /listings/{listingId}/price-observations`, a plugin with its own authentication for the history, the error code `INVALID_RANGE`, the wiring | `backend/src/price-alerts/http/`, `backend/src/price-observations/http/`, `backend/src/composition-root.ts` |
| 4d Verification and review | Traceability of the fifth feature, 8 findings | Sections 4 and 5 |

The feature changed 26 source files (548 insertions, 66 deletions) and 19 test files (1,538 insertions). No dependency was added.

## 3. Decisions and their status

The status of every decision of the discovery and the design is recorded here, and only here.

| Decision | Status | Evidence |
|---|---|---|
| Q1 Scope: the Notifications of the User, and the Price History of a Listing | Verified | The 20 scenarios |
| Q2 Notifications newest first by the Observed At of the price that reached the target, and by alert identifier on a tie | Verified | The contract of the port, the use case and the API |
| Q3 Only the list of Notifications, with no read of one | Implemented | An absence: no test pins down that the route does not exist |
| Q4 Any signed-in User reads the history, and a Provider's token is not valid | Verified | SC-07, SC-08, and the wiring with both credentials |
| Q5 The history has every observation, with a range `from` included and `to` excluded | Verified | SC-10 to SC-18, and the contract of the port |
| Q6 A Listing that does not exist is not found | Verified | SC-15 at three levels |
| Q7 Pages with `limit` and `offset`, 20 by default and 100 at most, and the total | Verified | The contracts, the use cases and the API |
| D1 Each repository gains one operation that reads a page and its total | Verified | The contracts of the two ports |
| D2 `ListNotifications` is in the module of Price Alerts and `ReadPriceHistory` in the one of Price Observations | Implemented | The architecture test keeps the layers, but no test pins down the module |
| D3 `ObservedAtRange` is a Value Object | Verified | Its own tests: the start is included, the end is excluded, and two ranges that meet share nothing |
| D4 The history has its own plugin, its own hook and a port `UserAuthenticator` | Verified | The wiring: the same path answers each method with its own credential |
| D5 The Notifications join the group `priceAlertManagement`, and the history is an optional group | Verified | The documentation tests: without the group the route is not served or documented |
| D6 An invalid range is `InvalidRange` and answers 422 | Verified | The use case and the API |
| D7 The helper of the numbers of a URL and the bounds of the pages are written once per module | Implemented | A structural choice. See finding 1 |

### Effect on the other features

- **Feature 03.** `NotificationRepository` gains `findByOwner`, and the view of a Notification moves to its own file. The Evaluation does not change.
- **Feature 02.** `PriceObservationRepository` gains `findByListing`, and the module gains a plugin and a port. Recording a price does not change.
- **Feature 04.** The group `priceAlertManagement` gains `listNotifications`, which changed the tests that build it.

## 4. Verification

- **Tests:** 898 test cases in 52 files, all passing, of which 166 are in files of this feature: the range 17, the use cases 40, the contracts of the ports and their adapters 35, the API 49 with its documentation 10, and the whole application 15.
- **Scenarios:** all 20 have tests, read from the titles, and none needed one added at the end. The traceability guard covers the five features, and this one has no exemption.
- **Coverage, as a diagnostic:** 100 % of functions, 99.6 % of lines, 99.5 % of statements and 97.7 % of branches. The two lines that are not covered are re-throws of an error that `ObservedAt` and `ObservedAtRange` cannot raise, and the branches are the tie-breaks between identifiers that are identical, which cannot exist.
- **Deliberate errors:** 62 changes were made, one at a time, in scratch copies of the code, and the tests were run after each. **All 62 were detected.** For the two new ports, the contract alone, run against its adapter, detected all 12 that were tried. The changes were chosen by hand and are not a systematic tool, and `main.ts` has no test.
- **By hand:** the development server was started. The history of a Listing was read with a User's token, and the Provider's token was refused with 401. A price that reached the demo alert produced one Notification that its owner read and the other User did not. A range with a page gave the right total, a start that is not an instant gave 422, and the documentation listed the routes and the two new tags. The Swagger page itself was not looked at in a browser.

## 5. Architecture review

Dependencies point inward and the architecture test passes. The two credentials are not mixed, and a change to real authentication touches one place, the adapter of the Composition Root. The order of the lists and the inclusive start and exclusive end of the range are part of the contracts of the ports, so a database has to answer the same.

| # | Finding | Outcome |
|---|---|---|
| 1 | The reading of the `Bearer` token is written in 3 places, and the helper of the numbers of a URL, the bounds of the pages and `Unauthenticated` in 2 | **Accepted** (decision D7). Real authentication rewrites these hooks, and that is the moment for a shared HTTP layer and its architecture rule |
| 2 | `buildApp` has 3 optional groups and about 200 lines | **Accepted.** They can be made required when the tests of the other features are cleaned |
| 3 | A limit out of range answers 400 and an invalid range 422 | **Accepted** (decision D6), and documented |
| 4 | Pagination by `offset` costs more the deeper the page is in a database, and a chart with many points must ask for them 100 at a time | **Noted** for persistence and the interface |
| 5 | A page and its total are two answers of the same query | **Noted** |
| 6 | The Notification of a cancelled alert stays listed, and the list does not say the state of the alert | **Noted** for the interface, which will cross it with the alerts |
| 7 | Any signed-in User reads the history of any Listing, and there is no limit of requests | **Noted.** It is what was decided, and it is reviewed with real accounts |
| 8 | A Notification shows its `owner`, which is the User who asks | **Left** |

## 6. What the process revealed

| When | What | Result |
|---|---|---|
| 4a | `ObservedAt` is strict and asks for seconds, and a helper of a test wrote a moment without them | A mistake of the test, found and fixed |
| 4a | The double of the repository in the test of recording a price had to implement the new operation | It fails if the use case calls it, which it must not |
| 4b | The contract run alone against its adapter detected all the errors tried | The contracts are enough for a database adapter to be held to |
| 4c | The route of the history shares its path with the recording of prices, and the two need different credentials | A plugin of its own for each, because a hook belongs to its plugin |
| 4c | The design had settled every decision of the stop, so no plan was asked for separately | It was said when the stop began, and the two small choices were reported at the end |
| 4d | The tests of this feature share modules and the identifiers SC-nn with other features | Each feature declares its test files by folder and by file name, as before |

## 7. Known limitations

- Storage is in memory, and the uniqueness and the orders have been tested only there ([ADR-0003](../../adr/0003-persistence-deferred.md)).
- Notifications are not delivered, have no read state and cannot be read one by one. The history is the data, with no summary or aggregate.
- Authentication is still the demo tokens, and any User reads any history.
- The only interface is the interactive documentation of the development server.
- The race between creating an alert and recording a price (feature 03, finding 1) is not changed.
- The tests have run on one version of Node, 25.9. No continuous integration runs them, `main.ts` has no test, and the repository has no licence.

## 8. Documentation volume

The documents of the first three stages have 470 lines (discovery and rules 146, scenarios 216, design 108). The previous feature had 510, and the last of the earlier method 711. It is 8 % fewer lines than the last feature, but the two are not alike, so it is a sign and not a measure. The scenarios are still the longest document.

## 9. Follow-up

**Next features,** in the order of [ADR-0003](../../adr/0003-persistence-deferred.md) and of the plan agreed so far: real authentication and accounts, with its own ADR and the shared HTTP layer of finding 1; the web interface; then persistence and the deployment, each with its ADR.

**For the persistence feature.** Index the Notifications by owner, newest Observed At first and then by alert identifier, and the observations by Listing, newest Observed At first and then by Provider, with the range as a condition on the Observed At. Run the contracts of the two ports against the database adapters. The other points of the earlier completions still stand.

## 10. Completion checklist

- [x] Stages 1 to 4 completed
- [x] Documentation of stage 5 written (this document)
- [ ] This document is approved by the author
- [ ] The README and the documentation indexes describe this feature
- [ ] The feature is merged into `develop` with `--no-ff`, and `develop` into `main` and tagged (done by the developer, [ADR-0002](../../adr/0002-branching-model.md))
- [ ] A licence is chosen before the repository is published
