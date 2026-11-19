# 01 — Create Price Alert: Test Plan and Verification (Phase 8)

Status: Approved

How the feature is verified, and what that verification does and does not show. The tests are executable and live in `backend/tests/`. The inputs are the [business rules](01-business-rules.md), the [scenarios](02-scenarios.feature), the [domain model](03-domain-model.md) and the [use case contract](04-use-case-contract.md).

## 1. Principle

Tests verify behaviour and business rules, not coverage figures. Code coverage is used once, as a **diagnostic** to find code that no test runs. It has no minimum threshold and no test was written only to raise it.

## 2. Levels

162 test cases, all passing. Run with `npm test` in `backend/`.

| Level | What it verifies | Location | Cases |
|---|---|---|---|
| Domain | Invariants of `Price`, `TargetPrice` and `PriceAlert` (BR-03, BR-04, BR-05, BR-06, BR-09, BR-11) | `tests/price-alerts/domain/` | 50 |
| Application | The use case: each scenario, the order of checks (decision 3), concurrency (decision 4) and failures that are not business errors | `tests/price-alerts/application/` | 33 |
| Adapter contract | The in-memory adapters honour the contract of their ports, including the uniqueness guarantee | `tests/price-alerts/adapters/` | 11 |
| API | Status codes, error codes and bodies, authentication (SC-14), the mapping of every application error, and the interactive documentation, which is checked not to drift from what the API answers | `tests/price-alerts/http/` | 46 |
| Wiring | The Composition Root connects HTTP, use case and adapters | `tests/composition-root.test.ts` | 5 |
| Traceability | The chain rule → scenario → test does not break (section 4) | `tests/traceability.test.ts` | 6 |
| Architecture | Dependencies point inward: no layer imports what it may not, no package outside its layer, no cycles (see the [architecture review](09-architecture-review.md)) | `tests/architecture.test.ts` | 11 |

No end-to-end tests exist: there is no frontend yet.

## 3. Traceability

Scenarios tag the rules they exercise (`@BR-nn`) and tests cite the scenario in their title (`SC-nn`). Counts are test cases whose full name cites the scenario, including its group.

| Scenario | Rules | Domain | Application | API |
|---|---|---|---|---|
| SC-01 | 01, 02, 05, 09 | 2 | 1 | 1 |
| SC-02 | 06, 09 | 1 | 1 | – |
| SC-03 | 05 | 2 | 1 | – |
| SC-04 | 04 | – | 1 | – |
| SC-05 | 10 | – | – | – |
| SC-06 | 07, 10 | – | 1 | – |
| SC-07 | 07 | – | 1 | 1 |
| SC-08 | 05 | 3 | 2 | 1 |
| SC-09 | 05 | 3 | 2 | – |
| SC-10 | 05 | 2 | 1 | – |
| SC-11 | 03 | 2 | 2 | 2 |
| SC-12 | 04 | 2 | 1 | 1 |
| SC-13 | 02 | – | 1 | 1 |
| SC-14 | 01 | – | – | 7 |
| SC-15 | 07, 08 | – | 1 | 1 |
| SC-16 | 08 | – | 2 | 1 |
| SC-17 | 07, 11 | 1 | 1 | – |
| SC-18 | 05, 08 | – | 1 | – |

Every business rule is exercised by at least one scenario:

| Rule | Scenarios |
|---|---|
| BR-01 | SC-01, SC-14 |
| BR-02 | SC-01, SC-13 |
| BR-03 | SC-11 |
| BR-04 | SC-04, SC-12 |
| BR-05 | SC-01, SC-03, SC-08, SC-09, SC-10, SC-18 |
| BR-06 | SC-02 |
| BR-07 | SC-06, SC-07, SC-15, SC-17 |
| BR-08 | SC-15, SC-16, SC-18 |
| BR-09 | SC-01, SC-02 |
| BR-10 | SC-05, SC-06 |
| BR-11 | SC-17 |

### Exceptions

| Item | Why it has no test of its own |
|---|---|
| SC-05 | BR-10 states the absence of restrictions. The command carries no email or Watchlist data, so nothing can require them. A test would repeat SC-01 |
| BR-10, "no limit per User" | Same reason. It is an absence, not a behaviour |
| BR-11 | It is applied by a later feature. Here it is only supported: SC-17 checks that a Triggered Price Alert is not Active |

## 4. The traceability test

`tests/traceability.test.ts` reads the scenarios, the business rules and the **titles** of the tests (not their comments, so a comment saying a scenario is untested does not count as a test). It fails if:

- a tag in the scenarios points to a rule that does not exist;
- a business rule is exercised by no scenario;
- a scenario has no test and no entry in its list of exemptions, which carries the reason;
- an exemption is stale, because the scenario now has a test.

## 5. Failures that are not business errors

The contract says some failures are internal errors that must reach the caller unchanged. They are tested at the application level and, for the catalogue case, through the API:

| Failure | Expected |
|---|---|
| The catalogue holds a currency the system does not support | Propagates as an internal error, not as an invalid target. The API answers 500 |
| A Current Price in a different currency than its Listing | Propagates as an internal error |
| The repository fails while adding | Propagates unchanged |
| The uniqueness guarantee keeps failing | One retry, then an internal error |

## 6. Code coverage as a diagnostic

| | Lines | Branches |
|---|---|---|
| Before the Phase 8 tests | 97.5 % | 91 % |
| After | 100 % | 95 % |

The diagnostic found one case that the manual review had missed: a failure of the repository while adding. The application layer is fully covered. Five branches remain unexecuted, none of them worth a test:

| Where | Why |
|---|---|
| `price.ts`, fallback `?? "0"` | The regular expression always captures that group. The fallback exists only to satisfy the compiler |
| `price.ts`, zero-decimal formatting | No supported currency has zero decimals (only EUR and USD). It becomes reachable, and needs a test, when such a currency is added |
| `errors.ts`, two defensive checks | They guard against values that Fastify never produces |
| `in-memory.ts`, unknown Listing in a test helper | A helper for tests, not part of the port |

After the interactive documentation was added the figures are 100 % of lines and 95.0 % of branches.

Run with `npm run coverage` in `backend/`.

## 7. Mutation checks

During implementation, 26 deliberate errors were introduced in scratch copies of the code, such as an exclusive threshold, a missing retry, an `await` between the uniqueness check and the insertion, authentication after validation, or a removed scenario tag. **All 26 made at least one test fail.** The architecture review (Phase 9) added three more, also detected. The architecture test was checked with 11 deliberate violations, all detected. One more error, removing the production guard of `main.ts`, is not detected because `main.ts` has no test; it was verified by running the file. This was done by hand and is not part of the test suite, so it is evidence of the quality of the tests at this point and not a guard for the future.

The tests of the interactive documentation were checked with 8 more deliberate errors, such as a wrong status code in the documentation, a missing error code, a dropped security requirement and documentation served when it was not asked for. All were detected.

## 8. Known limitations

- Only in-memory adapters exist. There are no integration tests against a database.
- The contract tests of the adapters are written for the in-memory ones. They will be made reusable when a second adapter exists.
- The real HTTP server was checked by hand (13 requests against `main.ts`), not by an automated test. `app.inject()` covers the same pipeline except the network layer.
- `main.ts` (demo data and start-up) has no test.
- The interactive documentation was checked through HTTP requests, its page and its files included, and through tests. It was not looked at in a browser.
- No continuous integration runs the tests yet.
- Concurrency is tested with the in-memory repository. A real database needs its own test of the uniqueness guarantee.

## 9. How to run

From `backend/`:

| Command | Purpose |
|---|---|
| `npm test` | All tests |
| `npm run typecheck` | Type checking |
| `npm run coverage` | Tests with the coverage diagnostic |
