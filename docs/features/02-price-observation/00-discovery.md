# 02 — Price Observation: Feature Discovery (Phase 0)

Status: Approved. Every question below has a **Decision** line with status Accepted. Q13 and Q14 were left open in Phase 0 and decided in Phase 1. *Lean* lines record the proposal that was discussed.

## 1. The business problem

A Listing's price changes over time, and the system can only alert on or show a price that it has recorded. Today nothing records prices: the Current Price used by [feature 01](../01-create-price-alert/00-discovery.md) comes from fixed demo data.

The system needs a way to receive what a price provider saw for a Listing, and to keep it.

## 2. Initial premise (hypothesis)

> A price provider reports the price and availability of a Listing at a point in time. The system validates the report and stores it as a Price Observation, so that the Current Price of the Listing can be known and later features can evaluate alerts and show history.

## 3. Actors

| Actor | Role in this feature |
|---|---|
| **Price provider** | Reports observations. Primary actor. Today it is the simulator; real adapters may exist later. It is not a User |
| **System** | Validates and stores the observation |
| User | Not an actor here. Reads nothing and writes nothing in this feature |

## 4. Goal

"Record that this Listing had this price, or was unavailable, at this moment, and keep it."

## 5. Scope of this feature

**Is:** receiving one observation of one Listing from an authenticated provider, validating it and storing it; deriving the Current Price of a Listing from the stored observations; an HTTP entry point for providers, with a simulated authentication.

**Is not:** generating observations (the simulator), scheduling price checks, evaluating alerts, emitting events, notifying, reading or showing price history, real provider authentication, creating Listings. Each is a separate feature or decision.

**Scope approved** for Phase 0 (see section 10).

## 6. Domain concepts involved

Price Observation (new), Listing, Price, Current Price, and the provider that supplies the observation. Price Observation and the provider's identity are not yet in the glossary; Phase 1 is where they become language. See [candidate concepts](../../domain/candidate-concepts.md).

## 7. Ambiguities and questions

Each question shows the options, a *lean* (the proposal discussed) and the **Decision** taken. Questions marked **●** had to be resolved before Phase 0 could close.

### ● Q1 — What is a Price Observation?

*Why it matters:* feature 01 treated "no price" as one case. An observation must say how it is expressed.

| Option | Meaning | Trade-off |
|---|---|---|
| A | An observation always has a price; "unavailable" is another thing without a price | Two kinds of record |
| B | An observation has an availability; only an available one has a price | One record, no contradictory state |
| C | Price and availability are independent | Allows combinations that mean nothing |

*Lean:* **B**.

**Decision (Accepted):** B. A Price Observation records the availability of a Listing at a point in time and, only when it is available, its price. An unavailable observation has no price. A price that is not known is expressed as unavailable, never as an amount of zero.

**Revised (Accepted, Phase 2):** While writing the scenarios, the two data of option B (availability and price) were seen to allow contradictory combinations that needed a scenario to reject them. The decision is simplified to one datum: a Price Observation has a price that may be absent. With a price, the Listing is available at that price. Without one, the Listing is unavailable. Contradictions cannot be expressed, and the behaviour is the one decided above. "Unavailable" means that no price is offered at that moment; it is not a stock quantity, which the project does not model.

### ● Q2 — How far does this feature go?

| Option | Includes |
|---|---|
| A | Recording an observation |
| B | A, plus the simulator that generates price series |
| C | B, plus periodic scheduling |

*Lean:* **A**. The simulator and the scheduling are features of their own, and the job mechanism is not decided.

**Decision (Accepted):** A. The domain receives observations and does not know who produces them.

### ● Q3 — Which time governs?

An observation carries the time the provider saw the price (`observedAt`). Arrival order is not reliable with retries and queues.

**Decision (Accepted):**
- (a) The Current Price of a Listing comes from the observation with the greatest `observedAt`.
- (b) An observation older than the latest one is accepted and stored, because it is valid history. It does not change the Current Price.

### ● Q4 — Is every observation stored, or only changes?

| Option | Effect |
|---|---|
| A | Every observation | Faithful history, shows "checked and unchanged" |
| B | Only when the price, or its absence, changes | Less data, loses that information |

*Lean:* **A**. Compaction is a later optimisation.

**Decision (Accepted):** A. Every valid observation is stored.

### ● Q5 — Resends and idempotency

**Decision (Accepted):** If the same provider sends again an observation for the same Listing and the same `observedAt` with the same content, the existing one is returned as a success and nothing is duplicated. If the content differs (a different price, or a price against none), the request is rejected as a conflict and the stored observation is not overwritten.

### ● Q6 — Validation of price and currency

**Decision (Accepted):**
- (a) The price of an observation is greater than or equal to zero. A negative price is rejected. Zero is valid and means free: a Listing may be offered at no cost.
- (b) The currency is the currency of the Listing. A different currency is rejected. There is no conversion.
- (c) The price has at most the precision of the currency, as in [feature 01, Q6](../01-create-price-alert/00-discovery.md).

Note: the Target Price remains greater than zero (feature 01). A Current Price of zero reaches any Target Price, because the threshold is inclusive.

### ● Q7 — Unknown Listing

**Decision (Accepted):** An observation of a Listing that does not exist is rejected with an explicit error. This feature does not create catalogue entries.

### ● Q8 — Relation with the Current Price of feature 01

| Option | Effect |
|---|---|
| A | The Current Price is **derived** from the latest observation; the catalogue keeps only identity and currency | A single source of truth. Requires changing `ListingReader` of feature 01 |
| B | The Current Price is **stored** and updated when an observation is recorded | Two writes that can disagree |

*Lean:* **A**.

**Decision (Accepted):** A. The Current Price is derived from the observations. This changes how feature 01 obtains it (the `ListingReader` port and its demo data), so part of feature 01 is touched. The change is limited to where the Current Price comes from; the rules of feature 01 do not change. The exact change is scoped in Phase 4.

### ● Q9 — Does recording an observation evaluate alerts?

| Option | Effect |
|---|---|
| A | No. Evaluation is another feature that reads observations | Simple boundary |
| B | Yes, synchronously in the same use case | Couples two features |
| C | An event is emitted for evaluation to consume | Requires deciding mechanism and delivery guarantees now |

*Lean:* **A**.

**Decision (Accepted):** A. Recording does not evaluate alerts and emits no event. Whether an event is needed is decided in the evaluation feature.

### Q10 — Who records an observation, and how?

**Decision (Accepted):**
- (a) The actor is a price provider, not a User.
- (b) The feature has an HTTP entry point for providers.
- (c) Authentication is simulated: a fixed demo credential for the provider, separate from the demo tokens of Users, so that a User cannot record prices. When real authentication exists, only the adapter changes, as in feature 01.
- (d) The shape of the endpoint is decided in Phase 7.

### Q11 — Does an observation say where it comes from?

An observation records which provider supplied it, not which Retailer sells the Listing (the Listing already carries that). It answers the product vision's requirement that simulated data is labelled as such.

**Decision (Accepted):**
- (a) Each observation carries the identifier of its provider.
- (b) The identifier comes from the authenticated provider, not from the request body, so a provider cannot declare itself another, in the same way as the owner of a Price Alert in feature 01.
- (c) In the simulation, the demo credential is the provider `simulator`.
- (d) The provider is an identifier, not an entity with a lifecycle. The set of valid providers is closed for now.

### Q12 — Price history

**Decision (Accepted):** Reading or showing price history is out of this feature. Observations are stored so that it can be built later.

### Q13 — Several providers for the same Listing (open)

Q5 identifies a resend by provider, Listing and `observedAt`. If two providers report the same Listing at the same `observedAt` with different prices, Q3 does not say which one defines the Current Price.

*Lean:* with a single provider (`simulator`) the case cannot occur, so leave it undecided and record it as a limitation. It must be resolved before a second provider exists.

**Decision (Accepted, Phase 1):** Recorded as a rule, BR-13. The set of Providers is closed and has a single one; a second Provider is not admitted until a rule decides which observation defines the Current Price.

### Q14 — An `observedAt` in the future (open)

Whether an observation dated later than the moment it is received is rejected, and with what tolerance for clock differences. It needs a clock, which affects the use case contract.

*Lean:* reject it, because it would become the Current Price and stay there. The tolerance is a design detail for Phase 1.

**Decision (Accepted, Phase 1):** Recorded as a rule, BR-12. An observation later than the moment it is recorded is rejected, with a small tolerance for clock differences. The value of the tolerance is set in Phase 4.

## 8. Resolution

Questions Q1 to Q12 were resolved in Phase 0 (see the Decision lines in section 7). Q13 and Q14 were carried to Phase 1 and decided there. The decisions are summarised as business rules in [Phase 1](01-business-rules.md).

## 9. Out of this feature (recorded so they are not lost)

Price simulator · scheduling of price checks · alert evaluation and events · notifications · price history · real provider authentication · several providers for one Listing · currency conversion · compaction of unchanged observations · creating or changing Listings.

## 10. Exit criteria for Phase 0

- [x] Questions marked ● answered
- [x] Scope boundary (section 5) approved
- [x] User approves moving to Phase 1 (domain language and business rules)
