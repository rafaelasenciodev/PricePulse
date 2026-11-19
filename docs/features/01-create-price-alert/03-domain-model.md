# 01 — Create Price Alert: Domain Model (Phase 3)

Status: In Review

The domain model of the feature. It is derived from the [business rules](01-business-rules.md) and validated against the [scenarios](02-scenarios.feature). Only what those justify is modelled.

## 1. Where each business rule lives

| Rule | Lives in | Why |
|---|---|---|
| BR-03, BR-04 | Domain | They depend only on the value itself |
| BR-05, BR-06 | Domain | A comparison between two prices handed to the model. The model does not need to know where the Current Price comes from |
| BR-09, BR-11 | Domain | State of the Price Alert |
| BR-01, BR-02 | Application | They depend on external information (identity, catalogue) |
| BR-07, BR-08 | Application and persistence | They involve several Price Alerts at once, which no single aggregate sees (see decision A) |
| BR-10 | Nothing to model | It states the absence of restrictions |

## 2. The model

### Aggregate root: `PriceAlert`

An entity with its own identity. It holds:

- its identifier;
- the owner, as a `UserId`;
- the watched Listing, as a `ListingId`;
- its `TargetPrice`;
- its `AlertStatus`.

It references the User and the Listing **by identifier only**. Both belong to other parts of the system.

Behaviour in this feature: **creation**. Creating a Price Alert takes the owner, the Listing, the Target Price and the Current Price of the Listing, which may be absent. It rejects the creation if a Current Price is present and the Target Price is reached by it (BR-05). When there is no Current Price, that check does not apply (BR-06). A new Price Alert is Active (BR-09).

### Value Objects

| Value Object | Purpose | Invariants |
|---|---|---|
| `Price` | An amount in a currency | The amount is a valid number held exactly, as an integer number of minor units, and its decimals do not exceed what the currency allows (BR-04). Prices in different currencies cannot be compared. [ADR-0001](../../adr/0001-typescript-backend.md) explains why the amount is held this way |
| `TargetPrice` | The price at which a User wants to be notified | Greater than zero (BR-03). It answers whether a given Price reaches it: the Price is less than or equal to the Target Price (BR-05). Two Target Prices with the same value are equal |
| `AlertId`, `UserId`, `ListingId` | Typed identifiers | None beyond being identifiers. They prevent mixing identifiers of different kinds |

### `AlertStatus`

Two values: **Active** and **Triggered**. The transition from Active to Triggered (BR-11) is applied by the feature that evaluates alerts and is not modelled here. Triggered exists in this feature because scenario SC-17 needs a Price Alert that is no longer Active.

The status is read-only: it can change only through an operation of the aggregate, and this feature has none.

### Domain errors

The domain raises one error per broken rule or invariant, in three groups:

| Group | Errors | Meaning |
|---|---|---|
| A mistake of the User (`InvalidValue`) | `InvalidAmount`, `TooManyDecimals` (BR-04), `NonPositiveTargetPrice` (BR-03) | The value given cannot be accepted. The application reports all of them as an invalid Target Price |
| A business rule | `TargetAlreadyReached` (BR-05) | The Current Price already reaches the Target Price |
| Internal | `UnsupportedCurrency`, `CurrencyMismatch` | Data from the catalogue that the system cannot handle. Not a mistake of the User |

The mapping to application errors is in the use case contract.

## 3. Not modelled, and why

| Not modelled | Reason |
|---|---|
| User, Listing, Product, Retailer | They belong to accounts and the catalogue. Here they are referenced by identifier |
| Domain events | No scenario requires anything to react to the creation of a Price Alert |
| Domain services | Not needed. The comparison lives in `TargetPrice` |
| Watchlist, Notification, price observations | Later features (BR-10, scope of the discovery) |
| Transition Active → Triggered | Belongs to the feature that evaluates alerts |

## 4. Decisions

| ID | Decision | Status |
|---|---|---|
| A | `PriceAlert` is the aggregate. The rule "one Active Price Alert per User and Listing" (BR-07, BR-08) is checked by the application and guaranteed by persistence | Accepted |
| B | `AlertStatus` has two values, Active and Triggered. Triggered is added to the glossary | Accepted |
| C | `TargetPrice` is a Value Object of its own, next to `Price` | Accepted |

### Decision A in detail

BR-07 concerns several Price Alerts at once, so no single `PriceAlert` can enforce it.

- **Chosen:** keep `PriceAlert` as a small aggregate. The use case looks for an existing Active Price Alert of the same User and Listing, and persistence adds a uniqueness guarantee as a safety net.
- **Alternative rejected:** an aggregate per User and Listing that contains its Price Alerts. The invariant would live inside the aggregate, but the aggregate would accumulate the whole history of alerts, while this feature only ever needs one Active alert.
- **Consequence to handle later:** two simultaneous requests could both pass the application check. The persistence guarantee is therefore mandatory, not optional. It is defined in the use case contract (Phase 4).

## 5. Validation against the scenarios

Every scenario must be expressible with this model. If one is not, the work returns to Discovery, Language and Rules, or Scenarios.

| Scenario | Handled by |
|---|---|
| SC-01 | Creation of `PriceAlert`; BR-01 and BR-02 in the application |
| SC-02 | Creation without Current Price |
| SC-03 | `TargetPrice` does not reach a higher Price |
| SC-04 | The application builds the Target Price in the Listing's currency; `Price` carries the currency |
| SC-05 | The model has no email or Watchlist attribute, so nothing can require them |
| SC-06, SC-07 | Uniqueness is scoped to owner and Listing (application and persistence); other owners and Listings do not conflict |
| SC-08, SC-09, SC-10 | `TargetPrice` reached by the Current Price at creation time |
| SC-11 | `TargetPrice` invariant (greater than zero) |
| SC-12 | `Price` invariant (decimals of the currency) |
| SC-13 | Application: the Listing lookup |
| SC-14 | Application: the signed-in User |
| SC-15, SC-16, SC-18 | Application: the lookup of an Active Price Alert for the owner and Listing, and equality of `TargetPrice` |
| SC-17 | `AlertStatus`: a Triggered Price Alert is not Active, so it is not found by that lookup |

**Result:** all 18 scenarios are expressible. No new business rule was needed. One new term, Triggered, was added to the glossary because SC-17 requires it (decision B).

## 6. Carried to Phase 4

- Concurrency: how the uniqueness guarantee works and what happens when it fails.
- The order in which several broken rules are reported.
- Where the Current Price and the currency of the Listing come from, and how the use case obtains them.
- Generation of identifiers and transaction boundaries.

## Revisions

- 2026-11-19: aligned with the TypeScript implementation. `Price` is held as integer minor units and its amount must be a valid number. The domain errors are named and grouped. The status of a Price Alert is read-only. No decision changed.
