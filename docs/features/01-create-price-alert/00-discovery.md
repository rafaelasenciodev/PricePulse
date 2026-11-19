# 01 — Create Price Alert: Feature Discovery (Phase 0)

Status: Approved. Every question below has a **Decision** line with status Accepted. *Lean* lines record the proposal that was discussed.

## 1. The business problem

A shopper sees a product at a price they consider too high. They do not want to keep checking. They want the system to remember a price they *would* pay and tell them when it is reached.

Today the only way is manual checking: tedious, easy to forget, and blind to short-lived prices.

## 2. Initial premise (hypothesis)

> A registered user can create a price alert for a product listing from a particular retailer by specifying a target price. The system stores the alert so it can evaluate future price observations.

## 3. Actors

| Actor | Role in this feature |
|---|---|
| **Shopper** (registered user) | Creates the alert. Primary actor |
| **System** | Validates and stores the alert. (Evaluating it later is *not* part of this feature) |
| Price provider (simulator) | Not an actor here; relevant only as the origin of the listing's price |

## 4. User goal

"Tell me when *this* listing reaches *this price*, so I can buy it at a price I chose."

## 5. Scope of this feature

**Is:** capturing the user's intent and storing it durably in a valid, usable state.

**Is not:** evaluating alerts, sending notifications, scheduling price checks, ingesting prices, pausing/editing/deleting alerts, registration/login. Each will be its own feature. Where this feature needs them (an authenticated user, an existing listing), it *assumes* them.

**Scope approved** for Phase 0 (see section 10).

## 6. Domain concepts involved

User, Product Listing (with Product and Retailer as context), Price (amount + currency), Target Price, Price Alert. See [candidate concepts](../../domain/candidate-concepts.md). Not yet defined; Phase 1 is where they become language.

## 7. Ambiguities and questions

Each question shows why it matters, the options, a *lean* (the proposal discussed) and the **Decision** taken. Questions marked **●** had to be resolved before Phase 0 could close.

### ● Q1 — What is a Product, what is a Listing, how do they relate? (OQ-01, OQ-02)

*Why it matters:* it decides what an alert points at.

| Option | Meaning | Trade-off |
|---|---|---|
| A. Alert targets a **Listing** (as in your premise) | "Notify me when *this retailer's* offer reaches X" | Simple, precise, one price per alert. Cannot express "cheapest anywhere" |
| B. Alert targets a **Product** | "Notify me when *any* retailer offers X" | More valuable to users, but needs "lowest across listings" semantics and multiple retailers |
| C. Both | | More rules; premature |

*Lean:* **A** for feature 1. Product-level alerts become a later feature if wanted. In A, a Product is context (shown to the user), not something the alert references. Do you agree? And is "a Product is the same thing sold by several retailers; a Listing is one retailer's offer of it" the right working definition?

**Decision (Accepted):** The alert targets a Listing. A Product is context only. Working definitions confirmed: a Product is the same item sold by several retailers; a Listing is one retailer's offer of it. Product-level alerts are out of this feature.

### ● Q2 — Who creates Products and Listings?

*Why it matters:* decides whether this feature touches catalogue logic.

*Lean:* neither. Listings already exist (from a seeded catalogue/simulator); this feature only checks that the listing exists. Catalogue management is a separate feature. OK?

**Decision (Accepted):** Listings already exist (preloaded catalogue). This feature only checks that the Listing exists. Creating catalogue entries is out of this feature.

### ● Q3 — Can the same user have several alerts for the same listing? (OQ-03)

| Option | Effect |
|---|---|
| One **active** alert per user+listing; a second is rejected (or replaces the first) | Simple, prevents duplicate notifications |
| Unlimited alerts | Allows e.g. "at 100" and "at 80" thresholds; more notifications, more rules |

*Lean:* one active alert per user+listing, rejecting a duplicate with a clear error. Reject vs replace is your call.

**Decision (Accepted):** A user may have at most one active alert per Listing. A second one is rejected. Refined by Q10.

### ● Q4 — May the target price be at or above the current price? (OQ-05)

| Option | Effect |
|---|---|
| Reject: target must be below the current price | Alert is never already satisfied. But requires knowing the current price, and it can change between the screen and the request |
| Accept; triggers at the next observation | Simpler creation, but may notify immediately, which may surprise the user |
| Accept silently, never notify until the price drops *again* | Needs "crossing" semantics (state change), more complex |

*Lean:* reject, with an explicit error. It protects the user and keeps "target < price" a meaningful invariant. Is "at or below" vs "strictly below" the target also something you want defined?

**Decision (Accepted):**
- (a) When a current price is known and the target is already met by it, creation is rejected with an explicit error.
- (b) The threshold is inclusive: a price equal to the target reaches the target. As a consequence, a target equal to the current price is rejected.

### Q5 — What if the listing is unavailable or has no known price? (OQ-07)

*Lean:* allow creation (the user may want to wait for it to return). Whether the alert triggers when the product returns in stock *at a qualifying price* is an evaluation rule for a later feature. But then Q4 has no "current price" to compare against, so the rule must say what happens (skip the check).

**Decision (Accepted):** Creation is allowed when the Listing has no known price or is unavailable. The check in Q4 applies only when a current price is known.

### ● Q6 — How do currencies work? (OQ-06)

*Lean:* the target is expressed in the **listing's currency**; the user does not choose a currency; there is no conversion. The simulator uses EUR. Do you want any multi-currency behaviour in the MVP?

Related: prices tax-inclusive? Allowed decimals? Minimum/maximum target? (*Lean:* positive, at most the currency's minor-unit precision, no upper bound beyond sanity.)

**Decision (Accepted):**
- (a) The target is expressed in the Listing's currency, implicitly. There is no conversion.
- (b) The target must be greater than zero and have at most the precision of the currency (for example, two decimals for EUR). Otherwise it is rejected.
- (c) The domain does not distinguish prices with and without taxes. A price is the one shown by the Listing.

### ● Q7 — What makes an alert "active", and what lifecycle exists? (OQ-08, OQ-09, OQ-11)

*Lean:* feature 1 only *creates* alerts in an **active** state. Pause, edit, cancel and "after triggering" states are later features, but we should decide now whether an alert is **one-shot** (triggers once, then done) or **re-arming**, because that shapes the states. Which do you prefer? (*Lean:* one-shot for MVP.)

**Decision (Accepted):**
- (a) An alert is active as soon as it is created.
- (b) An alert is one-shot: once its target is reached and the user is notified, it ends. Triggering itself belongs to a later feature.
- (c) This feature only creates alerts. Cancel, pause and modify are separate, later features.

### ● Q8 — Authorisation (OQ-10)

*Lean:* only an authenticated user may create an alert, and only for themselves. Feature 1 receives the user's identity from outside; registration/login is a separate feature. Open items: must the user's email be verified first? Is there a maximum number of alerts per user? Who may later see/modify an alert (owner only)?

**Decision (Accepted):**
- (a) Only an authenticated user can create an alert, and always for themselves. The owner is the authenticated user, not a value supplied by the client.
- (b) A verified email is not required.
- (c) There is no limit on the number of alerts per user.
- Who may later see or modify an alert is not decided here, because those operations are outside this feature.

### Q9 — Notification channel (OQ-12)

*Lean:* the alert carries no channel choice; notifications go to the user's account email when that feature exists. Agreed?

**Decision (Accepted):** An alert does not store a notification channel. The channel is decided by the notifications feature.

### Q10 — Repeated submissions

If the user's request is sent twice (double click, retry), should the second be a harmless duplicate rather than an error? (Related to Q3: same answer may fall out of the duplicate rule.)

**Decision (Accepted):** If the same user repeats a creation request for the same Listing with the same target, the existing active alert is returned as a success and no new alert is created. If the target is different, the request is rejected as a duplicate (Q3).

### ● Q11 — Is a Watchlist a concept separate from a Price Alert? (OQ-04)

*Why it matters:* it can change the scope of this feature. If tracking a listing is a separate step from alerting on it, this feature may need that step as a precondition, or include it. It must therefore be resolved during Discovery.

| Option | Meaning | Effect on this feature |
|---|---|---|
| A. Separate concepts | A user first tracks a listing (watchlist), then sets alerts on tracked listings | Tracking becomes a precondition of creating an alert, and part of this feature or of an earlier one |
| B. Same concept | Creating an alert is what makes a listing "tracked"; there is no separate watchlist | Scope unchanged. A "watchlist" would at most be a view of the user's alerts |
| C. Separate but independent | A watchlist exists for tracking without alerts; alerts do not require it | Scope unchanged. The watchlist is a later feature |

No recommendation yet: the answer interacts with what an alert refers to (Q1) and how many alerts may exist (Q3).

**Decision (Accepted):** Watchlist and Price Alert are independent concepts. Creating an alert does not require a watchlist. Whether a watchlist exists is decided in another feature.

## 8. Resolution

All eleven questions are resolved (see the Decision lines in section 7). The decisions are summarised as business rules in Phase 1.

## 9. Out of this feature (recorded so they are not lost)

Alert evaluation · triggering and hysteresis/cooldown · notifications and delivery · pausing/editing/deleting alerts · listing price history · user registration · product-level alerts · multi-currency · watchlist · catalogue management · alert limits · email verification.

## 10. Exit criteria for Phase 0

- [x] Questions marked ● answered
- [x] Scope boundary (section 5) approved
- [x] User approves moving to Phase 1 (domain language and business rules)
