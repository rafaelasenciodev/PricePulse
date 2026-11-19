# 01 — Create Price Alert: Application Use Case Contract (Phase 4)

Status: In Review

The contract of the use case that realises this feature. It builds on the [business rules](01-business-rules.md), the [scenarios](02-scenarios.feature) and the [domain model](03-domain-model.md). It describes what the use case asks for, what it returns and what it needs from the outside. It does not describe HTTP or persistence technology.

## UC-01 — Create Price Alert

A User asks to be notified when the Current Price of a Listing reaches a Target Price. The use case validates the request and stores a Price Alert, or returns the one that already exists.

**Precondition.** The User is already identified when the use case is called (decision 1).

### Input

| Data | Origin | Notes |
|---|---|---|
| `owner` | The authentication of the request, never a value supplied by the client | BR-01 |
| `listingId` | The request | |
| `targetAmount` | The request | Only the amount, as text such as `"80.00"`. The currency is not sent: it is the currency of the Listing (BR-04) |

### Output

| Data | Notes |
|---|---|
| `alert` | The Price Alert: `id`, `listingId`, `targetAmount` (as text), `currency` and `status` |
| `created` | `true` if a new Price Alert was stored, `false` if an existing Active one was returned (BR-08) |

### Expected application errors

| Error | Rules | When |
|---|---|---|
| `ListingNotFound` | BR-02 | The Listing does not exist |
| `InvalidTargetPrice` | BR-03, BR-04 | The amount cannot be read as a number, is not greater than zero, or has more decimals than the currency of the Listing allows. Reading the amount is a matter of the format of the input and is not a business rule of its own |
| `DuplicateAlert` | BR-07, BR-08 | The User already has an Active Price Alert for the Listing with a different Target Price |
| `TargetAlreadyReached` | BR-05 | The Listing has a Current Price and it reaches the Target Price |

Technical failures and inconsistent data from the catalogue are not business errors. They are internal errors and are outside this contract.

## Flow and order of checks

When several rules are broken by the same request, the first one in this order is reported (decision 3).

1. Look up the Listing. If it does not exist: `ListingNotFound`.
2. Build the Target Price from `targetAmount` and the currency of the Listing. If it is invalid: `InvalidTargetPrice`.
3. Look for an Active Price Alert of the `owner` for that Listing.
   - Found, same Target Price: return it with `created = false`.
   - Found, different Target Price: `DuplicateAlert`.
4. If the Listing has a Current Price and it reaches the Target Price: `TargetAlreadyReached`. Without a Current Price this check is skipped (BR-06).
5. Create the Price Alert (Active, BR-09) and store it. Return it with `created = true`.

Step 3 comes before step 4, so BR-08 takes precedence over BR-05.

## Ports

The use case depends on two ports, defined by the application. It does not know what lies behind them. All their operations are asynchronous, which is a consequence of the language (see [ADR-0001](../../adr/0001-typescript-backend.md)).

| Port | Operation | Contract |
|---|---|---|
| `ListingReader` | Get a Listing by identifier | Returns the currency of the Listing and its Current Price, or no Current Price. Returns nothing if the Listing does not exist. Currency and price come from the same read |
| `PriceAlertRepository` | Find the Active Price Alert of an owner for a Listing | Returns it, or nothing. A Triggered Price Alert is never returned |
| `PriceAlertRepository` | Add a Price Alert | Fails with `ActiveAlertAlreadyExists` if the owner already has an Active Price Alert for that Listing. This failure is handled inside the use case and is not exposed to the caller |

### Dependencies of the use case

The domain model (`PriceAlert`, `Price`, `TargetPrice`, identifiers) and the two ports. Nothing else: no HTTP, no persistence technology, no external provider.

## Concurrency and transaction boundary

Two simultaneous requests can both find no Active Price Alert in step 3 and both try to add one.

- Persistence must guarantee that an owner has at most one Active Price Alert per Listing. When adding violates that guarantee, the repository fails with `ActiveAlertAlreadyExists`.
- On that failure the use case repeats from step 3. It then returns the existing Price Alert if the Target Price is the same, or `DuplicateAlert` if it is different. If the repetition fails again, the failure is an internal error.
- The only data written is one Price Alert, and the repository's add operation is atomic. The use case therefore needs no Unit of Work. The read of the Listing belongs to another part of the system and does not take part in the transaction.

## Decisions

| ID | Decision | Status |
|---|---|---|
| 1 | Authentication is handled outside the use case. The use case receives an identified User. "Not signed in" (BR-01, SC-14) is rejected at the HTTP boundary | Accepted |
| 2 | The output indicates whether the Price Alert was created or already existed | Accepted |
| 3 | The order of checks is the one in the flow above | Accepted |
| 4 | Concurrency is resolved with a persistence uniqueness guarantee and a repeated read, without a Unit of Work | Accepted |
| 5 | The use case generates the `AlertId` itself, with no port. No scenario requires controlling it | Accepted |
| 6 | Two ports, `ListingReader` and `PriceAlertRepository`, with the contracts above. Currency and Current Price come from a single read | Accepted |

Alternatives considered:

- **Decision 1:** an optional user inside the use case that raises a not-authenticated error. More self-contained, but it mixes identity with business logic.
- **Decision 4:** locks or serializable isolation. They work, but they are heavier and less portable.
- **Decision 6:** a separate port for the Current Price. It would split one coherent read into two.

## Traceability to the scenarios

| Scenario | Outcome in the use case |
|---|---|
| SC-01, SC-03 | Created, `created = true` |
| SC-02 | Created; the check in step 4 is skipped |
| SC-04 | The Target Price takes the currency of the Listing in step 2 |
| SC-05 | No check requires a verified email or a Watchlist |
| SC-06, SC-07 | The search in step 3 is scoped to owner and Listing, so it finds nothing |
| SC-08, SC-09, SC-10 | `TargetAlreadyReached` (step 4) |
| SC-11, SC-12 | `InvalidTargetPrice` (step 2) |
| SC-13 | `ListingNotFound` (step 1) |
| SC-14 | Rejected before the use case, at the HTTP boundary (decision 1) |
| SC-15 | `DuplicateAlert` (step 3) |
| SC-16 | Existing Price Alert returned, `created = false` (step 3) |
| SC-17 | The search in step 3 ignores Triggered, so a new one is created |
| SC-18 | Step 3 returns the existing one before step 4 can reject |

## Out of this contract

The HTTP interface and the mapping of errors to responses (Phase 7), the persistence schema and the uniqueness mechanism (infrastructure), and the in-memory adapters (Phase 6).

## Revisions

- 2026-11-19: aligned with the TypeScript implementation. The input names are in camelCase and the amount is text. The output fields are named. The operations of the ports are asynchronous. Reading the amount as a number is stated under `InvalidTargetPrice`. No decision changed.
