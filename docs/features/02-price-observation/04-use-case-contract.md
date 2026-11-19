# 02 — Price Observation: Application Use Case Contract (Phase 4)

Status: Approved

The contract of the use case that realises this feature. It builds on the [business rules](01-business-rules.md), the [scenarios](02-scenarios.feature) and the [domain model](03-domain-model.md). It describes what the use case asks for, what it returns and what it needs from the outside. It does not describe HTTP or persistence technology.

Identifiers such as UC-01 are numbered within each feature, like BR and SC. This UC-01 is not the one of feature 01.

## UC-01 — Record Price Observation

A Provider reports the Price of a Listing at a point in time, or that it had none. The use case validates the report and stores a Price Observation, or returns the one that already exists.

**Precondition.** The Provider is already identified when the use case is called (decision 1).

### Input

| Data | Origin | Notes |
|---|---|---|
| `provider` | The authentication of the request, never a value supplied by the client | BR-01 |
| `listingId` | The request | |
| `observedAt` | The request | Text in ISO 8601 with an explicit time zone, such as `"2026-11-19T10:00:00Z"`. The instant at which the Provider saw the Listing |
| `price` | The request | Either absent, or an `amount` as text such as `"79.90"` together with a `currency`. Absent means the Listing was unavailable (BR-03) |

Unlike feature 01, the currency is part of the input: BR-05 requires a Price in another currency to be rejected, so it must be possible to send one (decision 8).

### Output

| Data | Notes |
|---|---|
| `observation` | The Price Observation: `provider`, `listingId`, `observedAt` (as text) and `price` (`amount` and `currency`, or absent) |
| `recorded` | `true` if a new Price Observation was stored, `false` if an existing one with the same content was returned (BR-09) |

### Expected application errors

| Error | Rules | When |
|---|---|---|
| `ListingNotFound` | BR-02 | The Listing does not exist |
| `InvalidObservation` | BR-04, BR-05, BR-12 | The Observed At is not a valid instant or is later than the moment of recording beyond the tolerance; the amount cannot be read as a number, is negative or has more decimals than the currency allows; or the currency is not the one of the Listing. The message tells which |
| `ObservationConflict` | BR-10 | A Price Observation with the same Provider, Listing and Observed At is stored with different content |

Reading the amount and the Observed At is a matter of the format of the input and is not a business rule of its own. Technical failures and inconsistent data from the catalogue are not business errors. They are internal errors and are outside this contract.

## Flow and order of checks

When several rules are broken by the same request, the first one in this order is reported (decision 3).

1. Look up the Listing. If it does not exist: `ListingNotFound`.
2. Build the Price Observation. The currency is compared with the one of the Listing before the amount is read. If anything is invalid: `InvalidObservation`. The order of the individual checks inside this step is not a business rule.
3. Look for a stored Price Observation with the same Provider, Listing and Observed At.
   - Found, same content: return it with `recorded = false`.
   - Found, different content: `ObservationConflict`.
4. Store the Price Observation and return it with `recorded = true`.

Step 3 comes after step 2, so a resend is validated again. A resend that was valid when it was first recorded is still valid, because its Observed At only moves further into the past.

## Ports

The use case depends on three ports, defined by the application. It does not know what lies behind them. All their operations are asynchronous, except the clock, which has no reason to wait (see [ADR-0001](../../adr/0001-typescript-backend.md)).

| Port | Operation | Contract |
|---|---|---|
| `ListingCatalogue` | Find a Listing by identifier | Returns the currency of the Listing, or nothing if it does not exist |
| `PriceObservationRepository` | Find a Price Observation by Provider, Listing and Observed At | Returns it, or nothing |
| `PriceObservationRepository` | Add a Price Observation | Fails with `ObservationAlreadyExists` if one with the same Provider, Listing and Observed At is stored. The failure is handled inside the use case and is not exposed to the caller |
| `PriceObservationRepository` | Find the latest Price Observation of a Listing | Returns the one with the greatest Observed At, or nothing. **It is not used by this use case**: it defines the Current Price (BR-07) for whoever needs it. When several share the greatest Observed At the result is not defined (BR-13) |
| `Clock` | Get the current moment | The moment of recording used by BR-12 |

### Dependencies of the use case

The domain model (`PriceObservation`, `Price`, `ObservedAt`, identifiers) and the three ports. Nothing else: no HTTP, no persistence technology, no external provider.

### The tolerance of BR-12

The use case holds the tolerance as a constant and hands it to the model with the moment of recording. The value proposed is **5 minutes**: enough to absorb differences between the clocks of a Provider and of the system, and short enough that an observation dated in the future cannot stay as the Current Price for long. It is a design parameter, not a business rule, and it can change without touching BR-12 (decision 5).

## Concurrency and transaction boundary

Two simultaneous requests with the same identity can both find nothing in step 3 and both try to add.

- Persistence must guarantee that there is at most one Price Observation per Provider, Listing and Observed At. When adding violates that guarantee, the repository fails with `ObservationAlreadyExists`.
- On that failure the use case repeats from step 3. It then returns the existing one if the content is the same, or `ObservationConflict` if it is different. If the repetition fails again, the failure is an internal error.
- The only data written is one Price Observation, and the repository's add operation is atomic. The use case therefore needs no Unit of Work. The read of the Listing belongs to another part of the system and does not take part in the transaction.

## Effect on feature 01

Decision B of the domain model and Q8 of the discovery make the Current Price derive from the observations. The consequences for feature 01 are limited:

- The use case of feature 01, its contract and its `ListingReader` port **do not change**. The use case still receives the currency and the Current Price of a Listing from one read.
- What changes is the adapter behind `ListingReader`: the currency comes from `ListingCatalogue` and the Current Price from the latest Price Observation of the Listing. Where that adapter is built, and the demo data in `main.ts`, change with it (Phases 6 and 7).
- The documents of feature 01 are not reopened. Its README section on demo data is updated in Phase 10 of this feature.

## Decisions

| ID | Decision | Status |
|---|---|---|
| 1 | Authentication is handled outside the use case. The use case receives an identified Provider. A caller who is not authenticated, or a User who is not a Provider (BR-01, SC-16, SC-17), is rejected at the HTTP boundary | Accepted |
| 2 | The output indicates whether the Price Observation was recorded or already existed | Accepted |
| 3 | The order of checks is the one in the flow above | Accepted |
| 4 | Concurrency is resolved with a persistence uniqueness guarantee and a repeated read, without a Unit of Work | Accepted |
| 5 | The moment of recording comes from a `Clock` port, so that tests control it. The tolerance of BR-12 is a constant of the use case, with a value of 5 minutes | Accepted |
| 6 | Three ports: `ListingCatalogue`, `PriceObservationRepository` (find, add, find latest) and `Clock` | Accepted |
| 7 | No identifier is generated: the identity of a Price Observation is its Provider, Listing and Observed At | Accepted |
| 8 | The input carries the currency of the Price. It is compared with the one of the Listing before the amount is read, so that an unsupported currency is reported as not the one of the Listing and not as an internal error | Accepted |
| 9 | Three application errors: `ListingNotFound`, `InvalidObservation` and `ObservationConflict`. A future Observed At and a different currency are cases of `InvalidObservation` | Accepted |
| 10 | The use case, the contract and the `ListingReader` port of feature 01 do not change. Only the adapter behind that port and the composition change | Accepted |
| 11 | `Price` and `ListingId` move to a shared module, because two features use them. The module of feature 01 and the new one both depend on it | Accepted |

Alternatives considered:

- **Decision 1:** an optional Provider inside the use case that raises a not-authenticated error. More self-contained, but it mixes identity with business logic, as in feature 01.
- **Decision 4:** locks or serializable isolation. They work, but they are heavier and less portable.
- **Decision 5:** the caller supplies the moment of recording in the request. It would let a client choose the moment against which its own Observed At is judged. A fixed constant in the model was also considered; it was rejected because the value is a design parameter and not a business rule.
- **Decision 6:** reusing the `ListingReader` of feature 01. It returns the Current Price, which this use case does not need and which now depends on this feature's own data, so recording would depend on its own output.
- **Decision 9:** a separate error for the future Observed At and another for the currency. A caller can do nothing different for each, so one error with a message is enough for now. They can be split later without changing the rules.
- **Decision 11:** the new module imports `Price` and `ListingId` from the module of feature 01. It avoids moving files, but makes the Price Observations depend on Price Alerts, which is the wrong direction. Duplicating the types was rejected because two versions of `Price` would drift. The cost of the chosen option is that code of feature 01 moves and the architecture test of the dependency rules must be extended.

## Traceability to the scenarios

| Scenario | Outcome in the use case |
|---|---|
| SC-01, SC-03 | Recorded, `recorded = true` |
| SC-02 | Recorded without a Price, `recorded = true` |
| SC-04, SC-05 | Recorded. The Current Price follows from `find latest` |
| SC-06, SC-07, SC-08 | Not an outcome of this use case: the Current Price is read through `find latest` (decision 6) |
| SC-09 | Recorded. Nothing in the flow depends on the order of arrival |
| SC-10 | The Observed At is within the tolerance (step 2): recorded |
| SC-11 | `InvalidObservation` (step 2) |
| SC-12, SC-13 | `InvalidObservation` (step 2) |
| SC-14 | `InvalidObservation` (step 2). The currency is compared first (decision 8) |
| SC-15 | `ListingNotFound` (step 1) |
| SC-16, SC-17 | Rejected before the use case, at the HTTP boundary (decision 1) |
| SC-18 | Existing Price Observation returned, `recorded = false` (step 3) |
| SC-19, SC-20 | `ObservationConflict` (step 3) |
| SC-21 | The use case has no port to Price Alerts, so it cannot evaluate them |

## Out of this contract

The HTTP interface, the credential of the Provider and the mapping of errors to responses (Phase 7), including how a User who is not a Provider is told apart from a caller who is not authenticated. The persistence schema and the uniqueness mechanism (infrastructure), and the in-memory adapters (Phase 6).
