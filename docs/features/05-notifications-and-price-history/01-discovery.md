# 05 — Notifications and Price History: Discovery and Business Rules (Stage 1)

Status: Approved. Every question below has a **Decision** line with status Accepted. *Lean* lines record the proposal that was discussed.

## 1. The business problem

The system produces two things that nobody can see. When a Price Alert is reached, a Notification is stored ([feature 03](../03-alert-evaluation/00-discovery.md)), and every price that a Provider reports is stored as a Price Observation ([feature 02](../02-price-observation/00-discovery.md)). Both were left unread on purpose: the first because delivery is another feature, the second because "observations are stored so that history can be built later" (feature 02, Q12).

A User cannot see which of their alerts were reached, and nobody can see how the price of a Listing has behaved. The [product vision](../../product/product-vision.md) names both needs: to understand how prices have behaved, and to be told when one reaches the price.

## 2. Actors and goal

| Actor | Role |
|---|---|
| **User** | Reads their own Notifications, and the price history of any Listing |
| System | Checks who is asking, and answers from what is stored |
| Provider | Not an actor. Its token is not valid for reading |

**Goal:** "See which of my alerts have been reached, and how the price of a Listing has moved."

## 3. Scope (proposed)

**Is:** listing the Notifications of the User, and reading the price history of a Listing, both as pages and as read-only requests.

**Is not:** delivering Notifications through a channel, marking them as read, preferences, statistics or charts (the history gives the data, not its summary), reading Listings and their details, real authentication, persistence and the interface. Each is a separate feature or decision.

**Scope approved** for stage 1 (see section 8).

## 4. What is already established

| Fact | Source |
|---|---|
| A Notification states the Price Alert, its owner, the Listing, the Target Price, and the Current Price with its Observed At. It has no identifier of its own, and there is at most one per Price Alert. It has no channel and no read state | Feature 03, BR-04, BR-05 and BR-08 |
| Notifications can only be found by Price Alert today | `NotificationRepository` |
| A Price Observation holds its Provider, Listing, Observed At and a Price that may be absent, meaning the Listing was unavailable. Every valid one is stored, an older one too, and the Provider is part of what identifies it | Feature 02, BR-03, BR-06, BR-08, BR-09 |
| Observations can only be found by their identity, or the latest one of a Listing | `PriceObservationRepository` |
| A Notification can stay stored for a Price Alert that was cancelled | Feature 04, Q6 |
| The identity of a User comes from the authentication of the request. The credentials of Users and of Providers are not interchangeable | Features 01 and 02 |
| Ports that a database can implement: queries by owner and by Listing, and pagination, with limit and offset | [ADR-0003](../../adr/0003-persistence-deferred.md) |
| The catalogue only knows the currency of a Listing | `ListingCatalogue` |
| The simulated data is labelled as such, which the Provider of an observation allows | Product vision |

## 5. Ambiguities and questions

Questions marked **●** must be resolved before this stage can close.

### ● Q1 — How far does this feature go?

| Option | Includes | Trade-off |
|---|---|---|
| A | The list of the User's Notifications, and the price history of a Listing | Both are small reads and give the interface what it needs. They touch two modules |
| B | Only the Notifications | Smaller. The interface would still have no history |
| C | A, plus marking Notifications as read | Needs a state in the Notification, and a rule for who changes it. It belongs with delivery |

*Lean:* **A**.

**Decision (Accepted):** A. The feature lists the Notifications of the User and reads the price history of a Listing. Delivery, marking as read and statistics are out.

### ● Q2 — Which Notifications does a User read, and in what order?

| Option | Order of the list |
|---|---|
| A | By the Observed At of the price that reached the target, newest first, and by alert identifier when two share it |
| B | By the moment the Notification was produced, which is not stored today and would need a clock |

*Lean:* **A**: the Notification has no moment of its own, and the Observed At says when the target was reached. Only the owner's Notifications are listed, and the list is paginated as the list of alerts is.

**Decision (Accepted):** A. The Notification does not get a moment of its own.

### ● Q3 — How does a User read one Notification?

| Option | Effect |
|---|---|
| A | Only the list. Each entry carries the identifier of its Price Alert, so the User can tell which one it is |
| B | The list, plus a read of the Notification of a Price Alert, answered as not found when it has none or is another User's |

*Lean:* **A**. A list is enough for a screen, and B can be added when something needs it.

**Decision (Accepted):** A. Only the list, and each entry carries the identifier of its Price Alert.

### ● Q4 — Who can read the price history?

| Option | Effect | Trade-off |
|---|---|---|
| A | Any signed-in User. The token of a Provider is not valid | Consistent with the other routes |
| B | Anyone, with no token | The data is not private, but it breaks the rule that every route is authenticated |
| C | Users and Providers | A Provider has no need to read, and it would mix the two credentials |

*Lean:* **A**. The history is not owned by anyone, so any User reads any Listing.

**Decision (Accepted):** A. Any signed-in User. The token of a Provider is not valid.

### ● Q5 — What does the history contain, and how can it be limited?

| Option | Effect | Trade-off |
|---|---|---|
| A | Every Price Observation of the Listing, newest Observed At first, paginated | Simple. A User who wants a period must page to it |
| B | A, and a range of Observed At (`from`, `to`) | A period can be asked for, which a chart needs. It adds the validation of two instants |

Each entry shows the Provider, the Observed At and the Price, or that the Listing was unavailable. Unavailable moments stay in the history: they are observations too.

*Lean:* **B**, because a history without a period is hard to use. The range is by Observed At, from inclusive and to exclusive, and `from` must be before `to`.

**Decision (Accepted):** B, as proposed.

### ● Q6 — What if the Listing does not exist?

| Option | Effect |
|---|---|
| A | It is answered as not found, as recording an observation does (feature 02, BR-02) |
| B | An empty history |

*Lean:* **A**: an empty history of a Listing that exists means something else.

**Decision (Accepted):** A. A Listing that does not exist is answered as not found.

### Q7 — How is a page asked for?

*Lean:* the same as the list of Price Alerts: `limit` and `offset`, 20 by default and 100 at most, and the answer carries the total. A request that is not valid is rejected.

**Decision (Accepted):** as proposed.

## 6. Business rules

| ID | Rule | Origin |
|---|---|---|
| BR-01 | A User reads only their own Notifications. Those of another User are never listed | Q2 |
| BR-02 | The Notifications of a User are listed newest first by the Observed At of the price that reached the target, and by alert identifier when two share it, in pages | Q2, Q7 |
| BR-03 | A Notification in the list shows what it states, including the identifier of its Price Alert. Reading it changes nothing, and it has no read state | Q1, Q3 |
| BR-04 | A signed-in User reads the price history of any Listing. The credential of a Provider is not valid for it | Q4 |
| BR-05 | The history of a Listing is its Price Observations, newest Observed At first, in pages. Every stored observation is in it, an older one and an unavailable one too, each with its Provider, Observed At and Price or absence | Q5, feature 02 BR-06 |
| BR-06 | The history can be limited to a range of Observed At: `from` inclusive and `to` exclusive. A value that is not an instant, or a `from` that is not before `to`, is rejected | Q5 |
| BR-07 | The history of a Listing that does not exist is answered as not found | Q6 |
| BR-08 | A page is asked for with `limit` and `offset`, 20 and 100 at most. The answer has the total of what matches. A limit or an offset out of range is rejected | Q7 |
| BR-09 | Reading changes nothing: it produces no Notification, starts no Evaluation and changes no alert or observation | Q1 |

## 7. New terms for the glossary

**Price History:** the Price Observations of a Listing, in the order of their Observed At. It is in the glossary.

## 8. Exit criteria

- [x] Questions marked ● answered (Q1 to Q6)
- [x] Scope (section 3) approved
- [x] Rules (section 6) approved
- [x] The User approves moving to stage 2 (scenarios)
