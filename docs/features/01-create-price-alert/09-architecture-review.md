# 01 — Create Price Alert: Architecture Review (Phase 9)

Status: In Review

A review of the implementation of the feature against the design that was approved. It is based on measurements of the code and on reading it, and every change it led to was verified by the tests. It covers the [domain model](03-domain-model.md), the [use case contract](04-use-case-contract.md) and the code in `backend/src/`.

## 1. Scope and method

Criteria: direction of dependencies, separation of responsibilities, purity of the domain, coupling, cohesion, error handling, transaction boundaries, idempotency, maintainability.

Method: a script that reads the imports of every source file and builds the dependency graph between layers (looking for forbidden edges and cycles), measures size and branching, and searches for public mutable state and forced type assertions. It was run once before the changes and once after. The script is a one-off tool and is not part of the repository, so this evidence does not protect the design in the future (see section 6).

Not covered: performance, load and a security review beyond what the feature touches.

## 2. Result by criterion

| Criterion | Result |
|---|---|
| Direction of dependencies | All dependencies point inward: `domain` depends on nothing internal, `application` on `domain` only, `http` on `application` and `domain`, `adapters` on `application` and `domain`. The Composition Root is the only place that knows the concrete adapters |
| Cycles | None between files |
| Purity of the domain | The domain imports no package and no platform module (before: `node:crypto`) |
| Separation of responsibilities | HTTP translates requests and errors; the use case orchestrates; the domain holds the rules; adapters hold the storage. No layer does another's job |
| Coupling | A single runtime dependency (`fastify`), confined to `http`. The use case knows its collaborators only through two ports |
| Cohesion | Small, focused files. The largest, the use case, has 116 lines and 15 decision points, and is readable thanks to its numbered steps |
| Error handling | Business errors are classified by type, not by a list that must be remembered. Unexpected errors reach the caller unchanged and are reported as a generic 500 with no cause |
| Transaction boundary | One atomic write. Reads of the Listing belong to another part of the system. Consistent with the contract |
| Idempotency | A repeated request with the same target returns the same Price Alert. Concurrent requests resolve to exactly one Price Alert, tested with real simultaneous calls |
| Maintainability | 136 tests tracing to the scenarios and rules, and a test that keeps that trace from breaking |

## 3. Findings and resolution

| # | Finding | Resolution |
|---|---|---|
| F1 | The domain imported `node:crypto` to generate identifiers | **Resolved.** `newAlertId` uses `crypto.randomUUID()` from the Web Crypto standard. The domain imports nothing |
| F2 | `PriceAlert.status` was public and mutable, and a test wrote to it, bypassing the invariant that BR-11 protects | **Resolved.** `status` is read-only. The test builds the Triggered Price Alert with the constructor |
| F3 | The constructor of `PriceAlert` is public, so an Active Price Alert can be built without the creation rules | **Observed, no action.** It is needed to rebuild Price Alerts from storage. Revisit with the persistence adapter, possibly with an explicit restore operation |
| F4 | The route forced the type of the owner with `as UserId`, trusting that the authentication hook had run | **Resolved.** `ownerOf` checks it and refuses the request if the owner is missing. Tested |
| F5 | `adapters/` depended on `http/` through the in-memory authenticator | **Resolved.** The authenticator moved to `http/`, next to its port. `adapters/` no longer imports `http/` |
| F6 | The use case is the largest unit of code | **Observed, no action.** Well tested and readable. It would be split if it grew |
| F7 | Domain errors were translated by a hand-written list of three classes: a new validation could be forgotten and become a 500 instead of a 422 | **Resolved.** `InvalidValue` is the common base of the three validation errors, and the use case catches it. A test pins which errors belong to it and which do not |
| F11 | `main.ts` starts with public demo tokens and nothing prevented deploying it | **Resolved.** It refuses to start when `NODE_ENV` is `production`. Verified by running it; it has no automated test |
| F12 | `Price` accepts negative amounts. A negative Current Price from a catalogue would make any Target Price "already reached" | **Observed, no action.** A decision of the domain model, recorded in a test. Forbidding it means returning to Phase 3 |
| F16 | `@types/node` was version 26 while the project declares Node 22 as the minimum, so the compiler would accept APIs missing in Node 22 | **Resolved.** Pinned to version 22 |

## 4. Measured effect

| | Before | After |
|---|---|---|
| External imports in the domain | 1 (`node:crypto`) | 0 |
| Dependencies from `adapters` to `http` | 1 | 0 |
| Public mutable fields in entities | 1 | 0 |
| Forced type assertions outside the identifier factories | 1 | 0 |
| Tests | 128 | 136 |
| Line coverage / branch coverage | 100 % / 95 % | 100 % / 94.9 % |

The branch figure dropped by a tenth of a point because the new guard code added defensive branches. The line figure is unchanged. Coverage is a diagnostic, not a target.

## 5. Open points

**For the persistence feature**
- The uniqueness guarantee of BR-07 exists only as a requirement in the contract. The database must enforce it (a partial unique index over owner and Listing for Active Price Alerts), and it needs its own test.
- The adapter contract tests must become reusable so that the database adapter is held to the same expectations.
- F3: decide how stored Price Alerts are rebuilt.

**For the documentation phase**
- The contract names the input `target_amount`, `listing_id` and `owner`; the code uses `targetAmount`, `listingId` and `owner`, and the amount is text.
- The domain model does not mention `InvalidAmount`, that amounts are held as integer minor units, or `InvalidValue`.
- The index and status tables of `docs/` still describe the feature as being in Phase 3.

**Not automated**
The rules of the review, such as "the domain imports nothing" or "`adapters` does not import `http`", were checked once. Nothing fails if a later change breaks them. An architecture test that reads the imports, in the same way as the traceability test, would keep them true.

## 6. Conclusion

The implementation follows the approved design. Dependencies point inward, the domain is free of any platform, business errors are classified without a list to maintain, and concurrency and idempotency behave as the contract says. The review found no flaw that required returning to an earlier phase. The changes it led to were small and are verified by the tests.
