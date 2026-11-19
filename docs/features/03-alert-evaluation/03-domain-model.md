# 03 — Alert Evaluation: Domain Model (Phase 3)

Status: Approved

The domain model of the feature. It is derived from the [business rules](01-business-rules.md) and validated against the [scenarios](02-scenarios.feature). Only what those justify is modelled. Every decision below has status Accepted. For decision A, the alternative of moving the alert to the shared module was evaluated and rejected.

## 1. Where each business rule lives

| Rule | Lives in | Why |
|---|---|---|
| BR-01 | Domain, for "a Triggered alert is not reached by anything"; application, for finding only the Active alerts of a Listing | The domain answers whether an alert can be triggered. Finding the alerts of a Listing is a lookup |
| BR-02 | Domain | The comparison already exists in `TargetPrice` (Current Price less than or equal to the Target Price). The alert asks it |
| BR-03 | Domain | Without a Current Price an alert is not reached. It depends only on the value |
| BR-04 | Domain | A Notification states what the rule lists, and can only be produced for an alert that the Current Price reaches |
| BR-05 | Application and persistence | At most one Notification per Price Alert is not a rule of a single Notification. Persistence guarantees it, as for the Active alert in feature 01 |
| BR-06 | Application, with the transition in the domain | The order of the two changes is a sequence of steps. That an alert becomes Triggered only from Active is a rule of the alert |
| BR-07 | Nothing to model | It follows from BR-01, BR-05 and BR-06 |
| BR-08 | Nothing to model | It states an absence. A Notification has no channel and the feature has no port to deliver |
| BR-09 | Nothing to model | It states an absence. The use case has no operation that creates, cancels or modifies alerts, or changes observations |
| BR-10 | Application | A Listing that does not exist has no Active alerts, so there is nothing to find |

## 2. The model

### `PriceAlert` (existing aggregate, new behaviour)

It stays an immutable entity, as feature 01 left it (review of its Phase 9). Two behaviours are added:

- **`isReachedBy(currentPrice)`.** True only if the alert is Active, the Current Price is present and the Target Price is reached by it. A Triggered alert, or a missing Current Price, gives false (BR-01, BR-02, BR-03).
- **`trigger()`.** Returns the same alert as Triggered. It is only allowed from Active (BR-06). It does not change the alert it is called on.

### `Notification` (new)

An immutable record, like `PriceObservation`. It holds:

- the Price Alert it is about, as an `AlertId`;
- the owner, as a `UserId`;
- the Listing, as a `ListingId`;
- the Target Price, as a `TargetPrice`;
- the Current Price that reached it, as a `Price`;
- the `ObservedAt` of that Current Price.

It references the alert, the owner and the Listing **by identifier only**. It has no identifier of its own: its identity is the Price Alert, because there is at most one per alert (BR-05). It has no channel and no delivery state (BR-08).

Behaviour: **creation (`produce`).** It takes an alert, the Current Price and its Observed At, and copies what BR-04 lists. It is rejected if the alert is not reached by that price, so a Notification cannot exist for an alert that never reached its target.

### Value Objects

| Value Object | Purpose | Invariants |
|---|---|---|
| `Price`, `TargetPrice`, `ListingId`, `AlertId`, `UserId` | **Already exist** | Unchanged |
| `ObservedAt` | The moment a Provider saw a price | **Already exists** in feature 02. It moves to the shared module (decision C) |

### Domain errors

| Error | Meaning | Group |
|---|---|---|
| `AlertNotActive` (new) | `trigger()` on an alert that is not Active | Internal. The use case never triggers a Triggered alert, so it signals a defect |
| `TargetNotReached` (new) | A Notification was asked for an alert that the price does not reach | Internal, for the same reason |
| `CurrencyMismatch` (existing) | The Target Price and the Current Price are in different currencies | Internal. A Target Price is always in the currency of its Listing (BR-04 of feature 01), so a difference is inconsistent data |

None extends `InvalidValue`: no User or Provider supplies a value in this feature, so there is no mistake of a caller to report.

## 3. Not modelled, and why

| Not modelled | Reason |
|---|---|
| Delivery state, channel, read or unread | Out of scope (Q1, BR-08). The feature that delivers adds them |
| A separate Evaluation concept with a state | The Evaluation is a use case, not a thing that is stored. It has no lifecycle |
| Domain events | Q2: the Evaluation is started from outside and no event is produced |
| A `Notification` identifier | The identity is the Price Alert (BR-05). A feature that delivers may need one and can add it then |
| The notification inside the `PriceAlert` aggregate | See decision B |
| A domain service | Not needed. The comparison lives in the alert and in `TargetPrice` |

## 4. Decisions

| ID | Decision | Status |
|---|---|---|
| A | The evaluation lives in the module `price-alerts`, which gains `Notification` and the behaviour of `PriceAlert`. No new module | Implemented |
| B | `Notification` is its own immutable record, outside the `PriceAlert` aggregate, with the Price Alert as its identity | Verified |
| C | `ObservedAt` moves to the shared module, because two features use it | Verified |
| D | `PriceAlert` gets `isReachedBy` and `trigger` and stays immutable: `trigger` returns a new alert | Verified |

Statuses after the implementation. **Verified** means that tests confirm the decision; **Implemented** means that it is realised in code and no test pins it down.

- **A**: the evaluation lives in the module `price-alerts`, and the architecture test keeps its imports within the allowed layers. No test pins down the choice of module itself, so it stays Implemented.
- **B**: the Notification is tested as a record: what it copies, that it is refused for an alert that is not reached, and that it has no channel. The contract of its repository tests that there is one per Price Alert, including two additions that start together. The uniqueness has been verified only in memory.
- **C**: `ObservedAt` is tested in the shared module, and the architecture test keeps `shared` free of imports and the features apart, which is what two features sharing it relies on.
- **D**: `isReachedBy` and `trigger` are tested in the domain, including that `trigger` does not change the alert it is called on, and the deliberate errors on them were all detected.

### Decision A in detail

- **Chosen:** the module `price-alerts` holds the evaluation. The alerts, their Target Price and their rule of "reached" are already there, and the only foreign input is the Current Price, which feature 01 already receives from outside through the Composition Root.
- **Alternative considered:** a new module `alert-evaluation` with its own ports, as the discovery suggested as a candidate. A feature never imports another, so the new module could not use `PriceAlert` or `TargetPrice`. It would need its own view of the alerts and would repeat the comparison of BR-02, or `PriceAlert` and `TargetPrice` would have to move to `shared`, which holds what several features need and not what one feature owns.
- **Consequence to handle later:** the module grows. If the notifications feature needs `Notification` for delivery, it can read it through a port, or the record can be moved then. The module name `price-alerts` stays accurate: alerts and what happens to them.
- **Effect on the discovery:** section 9 of the discovery named the new module as a candidate. This decision chooses the other one, with the reasons above.

**The alternative evaluated at review: a new module, with `PriceAlert` and `TargetPrice` moved to `shared`.** It is a real option and it was weighed:

| | Keep it in `price-alerts` (proposed) | New module, alert in `shared` |
|---|---|---|
| What moves | Nothing | The whole domain of the alert: `PriceAlert`, `TargetPrice`, `AlertStatus`, `AlertId`, `UserId` and their errors, with their tests. `price-alerts` would keep no domain of its own |
| What `shared` is | What several features need and no one owns | It would also hold the aggregate of one concept, which the evaluation uses only because it works on alerts |
| Ports | The repository of alerts grows by two operations | Two ports over the same storage: the one of creation and a new one of evaluation. A database would sit behind both |
| Separation | The module holds creation and evaluation | The evaluation can grow on its own (events, scheduling, delivery) without touching the creation of alerts |

The criterion that moved `Price` and `ListingId` ("two features use it") is also met here, but those are values with no owner, and the alert has one. The separation is a real benefit, but it pays off when the evaluation grows, and today it is one use case. Moving the domain now is a large change for a benefit that is not needed yet, and the move can be made later, when scheduling or delivery appear, with the same tests as protection.

**Decision (Accepted):** keep the proposal. The alternative was reviewed with the author and rejected for the reasons above. It can be revisited when scheduling or delivery appear.

### Decision B in detail

- **Chosen:** the Notification is separate from the alert.
- **Alternative rejected:** the alert holds its Notification. One aggregate would make both changes atomic, but the discovery decided two steps with a uniqueness guarantee (Q3, option B), and the alert would be loaded and stored together with a record that is read by no one in this feature.
- **Alternative rejected:** a generated identifier for the Notification. The uniqueness per alert is needed anyway, so the identifier adds nothing now.
- **Consequence to handle later:** BR-05 depends on persistence, which must guarantee one Notification per alert. It is defined in the use case contract (Phase 4), as in features 01 and 02.

### Decision C in detail

- **Chosen:** `ObservedAt` moves to `shared/domain`, with its error `InvalidObservedAt`. A Notification states the Observed At of the price that reached the target, and the module of feature 02 cannot be imported.
- **Alternative rejected:** a copy in `price-alerts`. Two versions of a type that parses instants would drift, as the discovery of feature 02 already argued for `Price`.
- **Alternative rejected:** storing the instant as text. It loses validation and equality by instant, and its use would repeat what `ObservedAt` already does.
- **Cost:** code of feature 02 moves, as it did with `Price` and `ListingId`.

### Decision D in detail

- **Chosen:** `trigger` returns a new alert. It follows the review of feature 01, which made the status read-only.
- **Alternative rejected:** a mutable status. It was resolved against in feature 01.
- **Alternative rejected:** the use case changes the status itself. The rule "only from Active" would leave the domain.

## 5. Validation against the scenarios

Every scenario must be expressible with this model. If one is not, the work returns to Discovery, Language and Rules, or Scenarios.

| Scenario | Handled by |
|---|---|
| SC-01 | `isReachedBy`, `Notification.produce`, `trigger` |
| SC-02, SC-03 | `isReachedBy` with `TargetPrice`, which is inclusive |
| SC-04 | `isReachedBy`: a Price of zero is less than or equal to any Target Price |
| SC-05, SC-06 | `isReachedBy` with no Current Price is false. A Listing with no observation or an unavailable one has none |
| SC-07 | `isReachedBy` has no memory: it only sees the Current Price |
| SC-08, SC-09, SC-10 | Application: it asks about each Active alert of one Listing |
| SC-11 | `isReachedBy` is false for a Triggered alert |
| SC-12 | Application: an alert that is not Active is not looked at again, and a Notification that exists is not produced again |
| SC-13 | Application and persistence: the uniqueness of the Notification per alert |
| SC-14 | Application: the order Notification, then `trigger` |
| SC-15, SC-16 | Application: an existing Notification leads to `trigger` without asking the price (BR-06) |
| SC-17 | `Notification` has no channel and the feature has no port to deliver |
| SC-18 | The use case has no operation other than `trigger` and producing a Notification |
| SC-19 | Application: no Active alerts for a Listing that does not exist |

**Result:** all 19 scenarios are expressible. No new business rule and no new term was needed.

## 6. Carried to Phase 4

- The input and output of the use case, and the application errors, if any.
- The ports: the Active alerts of a Listing and the change of state of an alert (new operations of the repository of alerts), the Notification (find by alert and add, with a uniqueness failure), and the Current Price of a Listing with its Observed At.
- How the Current Price with its Observed At reaches the module, through the Composition Root as in feature 01.
- The uniqueness of the Notification per alert and what happens when adding it fails because of a concurrent Evaluation.
- Several alerts and failures: what happens to the others when one fails (for example with `CurrencyMismatch`).
- The order of checks inside the use case and whether a Notification that exists is looked up before or after the price (SC-15, SC-16).
- How the Evaluation is started and where the line of the development log is written (Q2, Q6). The wiring is built in Phase 7.
- The change to `PriceAlertRepository`, and its relation to the contract of feature 01, which is not reopened.
