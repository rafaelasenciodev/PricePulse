# 02 — Price Observation: Domain Model (Phase 3)

Status: Draft

The domain model of the feature. It is derived from the [business rules](01-business-rules.md) and validated against the [scenarios](02-scenarios.feature). Only what those justify is modelled. Every decision in section 4 is **Proposed** until the author approves it.

## 1. Where each business rule lives

| Rule | Lives in | Why |
|---|---|---|
| BR-03, BR-04 | Domain | They depend only on the value itself: a Price that may be absent, and not negative |
| BR-05 | Domain, for the comparison | The currency of the Price must be the one of the Listing. The model is handed the currency of the Listing and does not need to know where it comes from. The decimals are already an invariant of `Price` |
| BR-09, BR-10 | Domain, for comparing content; application and persistence, for finding the stored one | The domain answers whether two observations have the same content. Finding one with the same Provider, Listing and Observed At is a lookup (see decision A) |
| BR-12 | Domain | A comparison between the Observed At and the moment of recording, which the model is handed. The value of the tolerance is carried to Phase 4 |
| BR-01, BR-02 | Application | They depend on external information (identity, catalogue) |
| BR-06 | Application and persistence | Storing every valid observation is not a rule of a single observation |
| BR-07 | Application, through a port (see decision B) | It needs the observations of a Listing, which no single observation sees |
| BR-08 | Nothing to model | It follows from BR-07: the Current Price comes from the greatest Observed At, so the order of arrival changes nothing |
| BR-11 | Nothing to model | It states the absence of a reaction. The model has no reference to Price Alerts |
| BR-13 | Application | The closed set of Providers belongs to authentication, not to the domain (see decision D) |

## 2. The model

### `PriceObservation`

An immutable record, with no operation that changes it after creation. It holds:

- the Provider that supplied it, as a `ProviderId`;
- the Listing, as a `ListingId`;
- its `ObservedAt`;
- its Price, as a `Price` that may be absent.

It references the Provider and the Listing **by identifier only**. Both belong to other parts of the system.

It has no identifier of its own. Its identity is the combination of Provider, Listing and Observed At, which is what BR-09 and BR-10 use to recognise a resend.

Behaviour in this feature:

- **Creation (`record`).** It takes the Provider, the Listing, the Observed At, the Price (which may be absent), the currency of the Listing and the moment of recording. It rejects the creation if the Price is negative (BR-04), if its currency is not the one of the Listing (BR-05), or if the Observed At is later than the moment of recording beyond the tolerance (BR-12). Without a Price, the checks on the Price do not apply (BR-03).
- **Comparison of content.** Whether another observation has the same Price, or both have none (BR-09, BR-10).

### Value Objects

| Value Object | Purpose | Invariants |
|---|---|---|
| `Price` | An amount in a currency. **Already exists** in feature 01 and is reused | A valid number held as integer minor units, with the decimals of the currency (BR-05). It accepts negative amounts, so the rule of BR-04 is checked by `PriceObservation` |
| `ObservedAt` | The moment a Provider saw the state of a Listing | A valid instant. It can be compared with another, and two with the same instant are equal |
| `ProviderId`, `ListingId` | Typed identifiers. `ListingId` already exists | None beyond being identifiers. They prevent mixing identifiers of different kinds |

### Domain errors

The domain raises one error per broken rule, in the groups of feature 01:

| Group | Errors | Meaning |
|---|---|---|
| A mistake of the Provider (`InvalidValue`) | `InvalidAmount`, `TooManyDecimals` (existing), `NegativePrice` (BR-04, new), `InvalidObservedAt` (new, an instant that is not valid) | The value given cannot be accepted |
| A business rule | `ObservationCurrencyMismatch` (BR-05, new), `ObservedInTheFuture` (BR-12, new) | The observation breaks a rule of the Listing or of time |
| Internal | `UnsupportedCurrency` (existing) | Data the system cannot handle. Not a mistake of the Provider |

The existing `CurrencyMismatch` is not reused for BR-05. In feature 01 it signals an internal inconsistency between a Target Price and a catalogue price. Here a currency different from the one of the Listing is a mistake of the Provider, and it needs its own error.

A Conflict (BR-10) is not a domain error. It appears when the application compares the new observation with the stored one, and it is defined in the use case contract.

## 3. Not modelled, and why

| Not modelled | Reason |
|---|---|
| Provider as an entity | Q11d: it is an identifier with no lifecycle. The set of valid Providers is closed and belongs to authentication |
| Price History as an aggregate or concept | Q12: history is out of this feature. The stored observations are enough to build it later |
| Current Price as a stored or modelled concept | Q8: it is derived from the observations (decision B) |
| The moment of recording as an attribute | No rule or scenario reads it. It is only an input to BR-12, so it is not stored |
| Domain events | Q9: recording emits no event |
| Domain services | Not needed. The comparison lives in `PriceObservation` |
| Stock quantity | The project does not model it. Without a Price, a Listing is unavailable |
| Price Alert, User, Listing | Other features. Here they are not referenced at all, except the Listing by identifier |

## 4. Decisions

| ID | Decision | Status |
|---|---|---|
| A | `PriceObservation` is an immutable record whose identity is Provider, Listing and Observed At. Each one is its own aggregate. The history of a Listing is not an aggregate | Proposed |
| B | The Current Price is obtained through a port that returns the latest observation of a Listing by Observed At. No domain function and no stored copy | Proposed |
| C | `ObservedAt` is a Value Object, not a bare date | Proposed |
| D | `ProviderId` is a typed identifier. The closed set of Providers lives in authentication, not in the domain | Proposed |

### Decision A in detail

- **Chosen:** a small immutable aggregate. The rule "one observation per Provider, Listing and Observed At" (BR-09, BR-10) is checked by the application and guaranteed by persistence, as in decision A of feature 01.
- **Alternative rejected:** one aggregate per Listing that contains its observations. The invariant would live inside the aggregate, but it would load the whole history to record one observation, and this feature never needs the history.
- **Consequence to handle later:** two simultaneous identical resends could both pass the application check. The uniqueness guarantee in persistence is therefore mandatory. It is defined in the use case contract (Phase 4).

### Decision B in detail

- **Chosen:** a port that answers "the latest observation of this Listing", so that BR-07 is a query and not a copy. It keeps one source of truth (Q8) and the order of arrival does not matter (BR-08).
- **Alternative rejected:** a domain function that receives all the observations and picks the latest. It would force loading the whole history to know one price.
- **Alternative rejected in the discovery:** storing the Current Price next to the observations (Q8), because two writes can disagree.
- **Consequence to handle later:** the rule "greatest Observed At" becomes the contract of a port, which every adapter must respect, and so must be covered by adapter contract tests. The `ListingReader` of feature 01 will use this port (Phase 4).

### Decision C in detail

- **Chosen:** `ObservedAt` is a Value Object holding an instant. It is the time that orders observations (Q3) and is part of the identity (BR-09), so it needs equality by value, which a `Date` does not have. It also keeps the model from holding a mutable object and rejects an invalid instant at the edge.
- **Alternative:** use `Date` directly. Simpler, with fewer types. The cost is mutability and comparison by reference, so identity would have to be compared by hand.

### Decision D in detail

- **Chosen:** a branded identifier like `UserId`. The Provider is not an entity (Q11d). Which identifiers are valid, and that a credential maps to one of them, is a matter of the authenticator (BR-01, BR-13).

## 5. Validation against the scenarios

Every scenario must be expressible with this model. If one is not, the work returns to Discovery, Language and Rules, or Scenarios.

| Scenario | Handled by |
|---|---|
| SC-01 | Creation of `PriceObservation`; BR-01 and BR-02 in the application; the Provider is the authenticated one |
| SC-02 | A `PriceObservation` without a Price. The Current Price is absent (decision B) |
| SC-03 | `PriceObservation` accepts a Price of zero; only negative ones are rejected |
| SC-04, SC-05 | Every observation is stored; the latest by Observed At defines the Current Price (decision B) |
| SC-06, SC-07 | The latest observation without a Price means no Current Price; a later one with a Price restores it |
| SC-08 | The port finds no observation, so there is no Current Price |
| SC-09 | An older observation is stored; the Current Price comes from the greatest Observed At, so it does not change |
| SC-10, SC-11 | `PriceObservation` compares the Observed At with the moment of recording |
| SC-12 | `PriceObservation` invariant (negative Price) |
| SC-13 | `Price` invariant (decimals of the currency) |
| SC-14 | `PriceObservation`: the currency of the Price against the one of the Listing |
| SC-15 | Application: the Listing lookup |
| SC-16, SC-17 | Application: authentication of the Provider; a User is not a Provider |
| SC-18, SC-19, SC-20 | Application: lookup by identity; comparison of content in `PriceObservation` |
| SC-21 | The model has no reference to Price Alerts, so nothing can evaluate them |

**Result:** all 21 scenarios are expressible. No new business rule and no new term was needed.

## 6. Carried to Phase 4

- Where `Price` and `ListingId` live. Both are used by two features and today sit in the module of feature 01.
- The value of the tolerance of BR-12, and where the clock comes from.
- Concurrency: how the uniqueness guarantee works and what happens when it fails.
- The order in which several broken rules are reported.
- The port that returns the latest observation, and how `ListingReader` of feature 01 uses it. The demo data that gives a Current Price today must come from observations.
- The mapping of domain errors to application errors, including the Conflict.
- How the Provider is authenticated and how the credential maps to a `ProviderId`.
