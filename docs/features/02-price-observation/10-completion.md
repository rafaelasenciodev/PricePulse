# 02 — Price Observation: Completion (Phase 10)

Status: Approved

The close of the feature: what was built, the decisions that shaped it, how it was verified, what the architecture review found, what it does not do and what comes next. It links to the documents of each phase and does not repeat them. Unlike [feature 01](../01-create-price-alert/10-completion.md), it holds the verification (section 4) and the architecture review (section 5) itself, instead of separate documents.

## 1. Summary

A Provider reports the Price of a Listing at a point in time, or that the Listing had none. The system stores the Price Observation, and the Current Price of a Listing follows from the stored ones: it is the Price of the observation with the greatest Observed At. Repeating the same report is harmless, a repeat with other content is a Conflict, and concurrent reports produce exactly one observation.

The feature runs end to end over HTTP with in-memory storage, and it changes where Price Alerts (feature 01) read the Current Price from. It does not simulate prices, schedule anything, evaluate alerts, notify anyone, persist data or list the history of a Listing. Those are separate features or later decisions, recorded in the [discovery](00-discovery.md).

## 2. What was implemented

| Phase | Result | Where |
|---|---|---|
| 0 Discovery | Problem, scope and 14 questions, all decided (Q13 and Q14 in Phase 1) | [Discovery](00-discovery.md) |
| 1 Language and rules | 4 new terms and one refined (Current Price), 13 business rules | [Glossary](../../domain/ubiquitous-language.md), [Rules](01-business-rules.md) |
| 2 Scenarios | 21 Gherkin scenarios tagged with their rules | [Scenarios](02-scenarios.feature) |
| 3 Domain model | One immutable record per observation, two Value Objects, a typed identifier | [Domain model](03-domain-model.md) |
| 4 Contract | One use case, three application errors, three ports | [Use case contract](04-use-case-contract.md) |
| 5 Use case | `RecordPriceObservation` and its ports | `backend/src/price-observations/application/` |
| 6 Adapters | In-memory catalogue and repository, and a system clock | `backend/src/price-observations/adapters/` |
| 7 HTTP and composition | `POST /listings/{listingId}/price-observations`, a separate credential for Providers, the Composition Root that connects both features | `backend/src/price-observations/http/`, `backend/src/composition-root.ts` |
| 8 Testing | 209 tests of the feature, a traceability guard for both features | Section 4 |
| 9 Architecture review | 7 findings, 2 resolved | Section 5 |

The code of the feature is about 720 lines in 18 files, and its tests about 1,700 lines in 11 files. No dependency was added: `package.json` did not change.

## 3. Decisions that shaped the feature

| Area | Decision | Recorded in |
|---|---|---|
| Absence of Price | A Price Observation may have no Price: the Listing is unavailable. An unknown Price is never zero. Zero is valid and means free | BR-03, BR-04. Revised in Phase 2 |
| Current Price | It is not stored: it is derived from the latest observation by Observed At. An older observation is stored and does not change it | BR-07, BR-08, [Domain model](03-domain-model.md), decision B |
| Identity | A Price Observation is identified by Provider, Listing and Observed At. There is no generated identifier | BR-09, contract decision 7 |
| Resends | The same content returns the stored observation (200). Other content is a Conflict (409) | BR-09, BR-10 |
| Time | An Observed At later than the moment of recording is rejected, with a tolerance of 5 minutes for clock differences. The tolerance is a parameter of the use case, not a business rule | BR-12, contract decision 5 |
| Providers | A Provider is an identifier. The set of Providers is closed and has one member, the simulator. A second one is not admitted until a rule decides which observation wins a tie | BR-13, domain model decision D |
| Boundary | Recording does not evaluate Price Alerts and emits no event | BR-11 |
| Contract | Authentication outside the use case. A fixed order of checks. Concurrency solved with a uniqueness guarantee and one repeated read, with no Unit of Work. A `Clock` port | [Contract](04-use-case-contract.md), decisions 1, 3, 4, 5 |
| Shared code | `Price` and `ListingId` moved to a shared module, because two features use them | Contract decision 11 |
| Effect on feature 01 | Its use case and contract did not change. Only the adapter behind its `ListingReader` and the composition did | Contract decision 10 |

## 4. Verification

- **Tests:** 420 test cases in 25 files, all passing, of which 209 belong to this feature. By level: domain 47, use case 44, adapters and repository contract 24, HTTP 78 (API, documentation, error mapping, authentication) and 16 for the derivation of the Current Price. The Composition Root, architecture and traceability tests are shared with feature 01.
- **Scenarios:** all 21 have tests, read from the test titles and not from comments. SC-16 and SC-17 are tested through the API only, because the use case never sees authentication. SC-06 to SC-08 are tested through the Current Price, because they are not outcomes of the use case. BR-13 has no scenario by design, and the traceability test records that exemption and fails if it stops being true.
- **Traceability:** `tests/traceability.test.ts` now checks both features. Identifiers such as SC-04 exist in each feature, so each feature declares which test files are its own and a title is never counted for the other. The Composition Root tests cite the scenarios of this feature and belong to it.
- **Coverage, as a diagnostic:** 100 % of lines, 99.7 % of statements and 98.1 % of branches, for the whole project. No threshold was set. Four branches are not covered, and none expresses behaviour: three are defensive code that cannot be reached today, and one is the failure of a test double.
- **Deliberate errors:** 49 changes were made, one at a time, in a scratch copy of the code, and the tests were run after each. 44 were detected. Two of the 5 that were not detected were control changes that do not alter behaviour, introduced on purpose to check the procedure. The other three change nothing observable: an empty bearer token is already rejected by the next line, and a minute 60 or an invalid time offset are already rejected by `Date.parse`, and the tests for those cases exist. The changes were chosen by hand and are not a systematic mutation tool, so they measure what was tried and not everything possible. `main.ts` has no test, so it was not evaluated.
- **By hand:** the development server was started and the examples of the README were run against it with real HTTP requests: a Price Alert, a Price Observation of the provider, a second Price Alert that then saw the new Current Price, and a User token refused on the observations route. The interactive documentation was not looked at in a browser; it is checked by tests that call the application over HTTP.

## 5. Architecture review

Criteria: direction of dependencies, separation of responsibilities, purity of the domain, coupling, cohesion, error handling, transaction boundaries, idempotency, maintainability. The review was done by reading the code, the dependency test and the results of section 4. It did not measure performance or load and was not a security review.

| Criterion | Result |
|---|---|
| Direction of dependencies | Correct. The domain imports only `shared`, the application only the domain, adapters and HTTP the application. A feature never imports another, and the architecture test enforces it. The Composition Root is the only place that knows both features |
| Purity of the domain | Correct. No input or output. The moment of recording enters as data, and the tolerance as a parameter |
| Separation of responsibilities | Correct. Authentication belongs to the HTTP boundary and the use case receives an identified Provider. The Provider never comes from the body |
| Error handling | Correct. Business errors are told apart from technical ones, which end as a 500 that reveals nothing. A uniqueness failure of the repository is handled inside the use case and never reaches the caller |
| Transactions and idempotency | Correct. One atomic write, a bounded retry and idempotent resends, tested with simultaneous requests |
| Cost of the design | No pattern without a use. There is no Unit of Work, no event bus and no class hierarchy beyond the errors |

| # | Finding | Outcome |
|---|---|---|
| 1 | `app.ts` took the type `HttpError` from the module of feature 01, and feature 02 had its own copy | **Resolved.** `app.ts` declares it. Each feature keeps a local interface of the same shape, because a feature cannot import `app.ts` |
| 2 | The input type of the domain had the same name as the use case, `RecordPriceObservation` | **Resolved.** Renamed `PriceObservationInput` |
| 3 | A test double of feature 01, `setCurrentPrice`, looked like dead code | **Withdrawn.** It is used by three tests of feature 01. The finding came from a search that cut its output |
| 4 | `Unauthenticated`, `HttpError` and the reading of the bearer token are repeated in both features | **Left on purpose.** With two copies an abstraction costs more than the duplication. It is revisited with a third feature |
| 5 | The currency is compared twice: in the use case, to respect the order of checks, and in the domain | **Kept.** The domain protects its invariant whoever calls it |
| 6 | `findLatest` scans every observation in memory | **Noted** for the persistence feature (section 8) |
| 7 | When two Providers share the greatest Observed At, the result is undefined and the in-memory adapter returns the first one stored | **Already documented** in BR-13 and tested. It is safe while the set of Providers is closed |

One observation came from the deliberate errors: `ObservedAt.fromIsoString` checks the minute, the second and the offset, but `Date.parse` rejects those cases too. Only hour 24 and dates that do not exist need the explicit check. It was left as it is.

## 6. What the process revealed

| When | What | Result |
|---|---|---|
| Phase 2 | Writing the scenarios led to reviewing the content of a Price Observation | It was simplified to an optional Price, with its absence meaning unavailable, and the scenarios were trimmed (BR-03) |
| Phase 3 | The Current Price could have been a stored copy, a domain function or a query | It became a query over the observations, with no stored copy (decision B) |
| Phase 5 | `Price` and `ListingId` were needed by a second feature | They moved to a shared module (contract decision 11), and the architecture test was extended |
| Phase 7 | The translation of errors to HTTP lived in the module of feature 01, and the application imported it, so a second feature had no place to add its errors | Each feature translates its own errors, and the application tries them in turn and handles what none recognises |
| Phase 8 | The traceability test checked only feature 01, and the identifiers of both features collide | It was made to check each feature with its own test files |
| Phase 8 | A first reading of the tests suggested three scenarios had no API test | Wrong: the titles of table-driven tests do not carry the identifier. They were covered |
| Phase 9 | A finding of the review was wrong (finding 3) | It was found before any change, by searching the whole repository |
| Phase 10 | The deliberate errors showed that three checks are redundant | Recorded, not changed |

## 7. Known limitations

- Storage is in memory. Nothing persists, and the uniqueness guarantee has been tested only in memory.
- There is no real authentication of Providers. A fixed demo token stands in for it.
- Prices are not simulated, and nothing records observations on a schedule. The development server records the first observations when it starts.
- There is no way to read an observation or the history of a Listing.
- The set of Providers is closed and has one member (BR-13).
- Concurrency is tested with simultaneous calls in a single process, not against a database.
- Only EUR and USD are supported, as in feature 01.
- The deliberate errors were chosen by hand and `main.ts` has no test.
- The tests have run on one version of Node, 25.9, although the minimum declared is 22.
- No continuous integration runs the tests, and how the application is built for production is not decided.
- The repository has no licence.

## 8. Architectural trade-offs

| Choice | Benefit | Cost |
|---|---|---|
| Current Price derived, not stored | One source of truth, and no copy to keep in step | Every read of it queries the latest observation. A database needs an index for that |
| Identity made of Provider, Listing and Observed At | A resend is recognised without an identifier or a key from the client | Two Providers with the same Observed At are undefined until a rule decides (BR-13) |
| Uniqueness guaranteed by persistence, one repeated read | No lock and no Unit of Work | The guarantee depends on persistence, which must enforce it |
| Currency compared before the amount is read | An unsupported currency is reported as an invalid observation and not as an internal error | The domain repeats a check that the use case already made |
| A clock as a port and a tolerance as a parameter | Tests control time, and the tolerance can change without touching the rule | One more port |
| Each feature translates its own errors | A new feature adds its own translator and changes nothing else | Small repeated declarations, until a third feature justifies sharing them |
| Tests at several levels for the same scenario | A failure points to a layer | Changing a rule means changing tests in several files |

## 9. What would be kept in a smaller project

This feature applied the full method of [`docs/features/README.md`](../README.md). The method has a cost, and not every part of it pays for itself in every project. This is how the parts looked at the end of the feature, for a project that is smaller or has one author:

| Part | Assessment |
|---|---|
| Scenarios and business rules with identifiers, before the model | Worth keeping. They are cheap and settle questions of behaviour before there is code |
| Tests of the use case and of the API over in-memory adapters | Worth keeping. They are the ones that make a refactor safe |
| A shared contract of tests for each port | Worth keeping. A database adapter is judged by the same tests |
| The architecture test | Worth keeping. It replaces a review that a single author does not have |
| Small commits that the author reviews | Worth keeping |
| The same scenario tested at three or four levels | Could be reduced to the lowest level where it makes sense, plus one API test per error path |
| Tests of the generated API documentation | Could be reduced to one smoke test |
| Automatic traceability of rules, scenarios and tests | Pays for itself with many rules. In a small project, tags and clear test titles are enough |
| Eleven phases with an approval after each | Could be merged for simple features: discovery, rules and scenarios in one document, and phases 5 to 7 without stopping. Keep them separate when the domain is delicate, such as money and dates |

The test that decides it is: which test would be needed to refactor without fear? Whatever answers that stays.

For measure, this feature has about 720 lines of code and 1,700 of tests, and the whole project about 1,800 and 3,400.

## 10. Follow-up

**Next features.** The discovery left outside this feature the simulation of prices, scheduling, the history of prices and the evaluation of alerts (BR-11, Q2, Q9, Q10d, Q12). Replacing the fixed Provider token with real authentication is a later decision as well.

**For the persistence feature.** Enforce the identity with a unique constraint over Provider, Listing and Observed At and test it. Index the observations by Listing and Observed At, because the Current Price reads the latest one. Make the contract tests of the repository run against the database adapter.

**Open questions of the project.** See [`open-questions.md`](../../domain/open-questions.md).

## 11. Completion checklist

- [x] Phases 0 to 9 completed
- [x] Documentation of Phase 10 written (this document)
- [x] The documents of Phase 10 are approved by the author: this document, and the domain model and the contract with their decision statuses updated
- [x] The README and the documentation indexes describe this feature
- [ ] The feature is merged into `develop` and `develop` into `main`, and the version is tagged (done by the developer, [ADR-0002](../../adr/0002-branching-model.md))
- [ ] A licence is chosen before the repository is published
