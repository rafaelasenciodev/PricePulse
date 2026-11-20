# 03 — Alert Evaluation: Feature Discovery (Phase 0)

Status: Approved. Every question below has a **Decision** line with status Accepted. *Lean* lines record the proposal that was discussed.

## 1. The business problem

A User creates a Price Alert ([feature 01](../01-create-price-alert/00-discovery.md)) and a Provider reports prices ([feature 02](../02-price-observation/00-discovery.md)), but nothing connects the two. A Price Alert stays Active forever, even when the Current Price of its Listing reaches its Target Price.

The system needs to notice that a Target Price has been reached and to record that the User must be told.

## 2. Initial premise (hypothesis)

> When the Current Price of a Listing reaches the Target Price of an Active Price Alert, the system ends the alert (it becomes Triggered) and produces a notification for its User, once and only once, even if the evaluation is repeated or runs twice at the same time.

This is the step that completes the round trip that the [product vision](../../product/product-vision.md) names as the success criterion: create an alert, the price changes, the alert is evaluated, a notification is produced.

## 3. What is already established

These come from approved documents. This feature builds on them and does not reopen them.

| Fact | Source |
|---|---|
| "Target reached" means Current Price less than or equal to the Target Price. A price equal to the target reaches it | Glossary, feature 01 Q4 |
| A Price Alert is one-shot: when its target is reached and the User is notified, it stops being Active. Triggering itself belongs to a later feature | Feature 01, BR-11 and Q7 |
| The state Triggered exists in the code, but nothing produces it yet | Glossary, `PriceAlert` |
| A Listing with no Current Price is not compared against anything | Feature 01, BR-06 and Q5 |
| An alert is never created already reached, but the Current Price can reach it later | Feature 01, BR-05 |
| An alert stores no notification channel. The channel is decided by the notifications feature | Feature 01, Q9 |
| Recording a Price Observation does not evaluate alerts and emits no event. Whether an event is needed is decided in the evaluation feature | Feature 02, BR-11 and Q9 |
| The Current Price is derived from the observation with the greatest Observed At. An older observation is stored and does not change it | Feature 02, BR-07 and BR-08 |
| Notifications should not be lost or duplicated because of failures or retries | Product vision, design objectives |

## 4. Actors

| Actor | Role in this feature |
|---|---|
| **System** | Evaluates alerts and produces notifications. Primary actor: there is no human action that evaluates |
| **User** | Owner of the alert. Receives the outcome, never starts it |
| Provider | Indirect. Its observations change the Current Price, but it does not evaluate anything |

## 5. Goal

"When the Current Price of a Listing reaches the Target Price of an Active Price Alert, end that alert and record, once, that its User must be notified."

## 6. Scope of this feature (proposed)

**Is:** deciding, for the Active Price Alerts of a Listing, which ones have their Target Price reached by the Current Price; making those Triggered; producing one notification record for each, without duplicates; being safe to repeat.

**Is not:** delivering notifications through any channel (email, push, other), user accounts and emails, listing or reading alerts and notifications, cancelling, pausing or modifying alerts, simulating prices, scheduling price checks, price history, currency conversion. Each is a separate feature or decision.

**Scope approved** for Phase 0 (see section 11).

## 7. Domain concepts involved

Price Alert, Target Price, Current Price, Listing, Triggered (all in the glossary), and **Notification**, which is new. Phase 1 is where Notification becomes language, if Q1 keeps it in scope. See [candidate concepts](../../domain/candidate-concepts.md).

## 8. Ambiguities and questions

Questions marked **●** must be resolved before Phase 0 can close.

### ● Q1 — How far does this feature go?

| Option | Includes | Trade-off |
|---|---|---|
| A | Make the alert Triggered, and nothing else | Smallest. But "Triggered" is defined as reached **and** the User notified, so the state would be set with nothing recorded about the notification |
| B | A, plus a notification record for the User, stored and not delivered | Closes the round trip of the vision with a record that can be inspected. Delivery stays separate |
| C | B, plus delivery through a channel | Needs a channel, which needs the account and email of the User, and these are separate features |

*Lean:* **B**. A notification is "produced" and stored; delivering it is the notifications feature.

**Decision (Accepted):** B. The feature makes the alert Triggered and produces a notification record for its User. The notification is stored and not delivered: channels and delivery belong to the notifications feature.

### ● Q2 — What starts an evaluation?

The unit of work is the same in every option: evaluate the Active alerts of **one Listing** against its Current Price. The question is what starts it.

| Option | Trigger | Trade-off |
|---|---|---|
| A | The use case that records an observation calls it | Simple and immediate. It reverses BR-11 of feature 02 and couples the two features |
| B | Recording emits an event, and the evaluation consumes it in the same process | Decoupled. It needs an event mechanism, and a decision on what happens if the consumer fails |
| C | A periodic sweep over all Active alerts | Works whatever the source of the prices. Evaluation is late by up to one period, and the scheduling mechanism is not decided |
| D | Something outside both features starts it after a new observation is recorded, such as the Composition Root | Both features stay unaware of each other. The wiring must live somewhere and be tested |

*Lean:* the unit of work as a use case that takes a Listing and is **idempotent**, so that how it is started can change without changing it. For the trigger, **D** for this feature. It needs no new infrastructure, and B or C can replace it later. A is the one that reopens an approved rule.

**Decision (Accepted):** the unit of work is a use case that evaluates the Active alerts of one Listing and is idempotent. It is started from outside both features (D), without changing BR-11 of feature 02. The trigger can be replaced later by an event or a periodic sweep without changing the use case.

### ● Q3 — What does Triggered mean, and what is done in what order?

Two changes must happen for one alert: the notification is produced, and the alert becomes Triggered. A failure between them is the case the vision asks to be safe.

| Option | Behaviour | Trade-off |
|---|---|---|
| A | Both in one atomic step | No in-between state. It needs a unit of work, which the project has avoided so far |
| B | First the notification, unique per alert, then Triggered. Repeating the evaluation finishes what was left half done | No loss and no duplicate, with a uniqueness guarantee only. A crash in between leaves a notification of an alert that is still Active, until the next evaluation |
| C | First Triggered, then the notification | A crash in between loses the notification and nothing repeats it |

*Lean:* **B**. It uses the same technique as features 01 and 02 (a uniqueness guarantee and a repeatable step) and needs no unit of work. C is rejected because it loses notifications.

**Decision (Accepted):** B. For each alert, the notification is produced first, and it is unique per alert; then the alert becomes Triggered. Repeating the evaluation finishes what a failure left half done. There is no unit of work. Option C is rejected because it can lose a notification.

Consequence to settle in Phase 1: the glossary defines Triggered as reached **and notified**. With Q1 = B, "notified" would mean that a notification was produced. The definition would be refined.

### ● Q4 — Which price counts, and what does the notification say?

| Option | Meaning |
|---|---|
| A | The Current Price at the moment of evaluation |
| B | The price of the observation that started the evaluation |

*Lean:* **A**, because the Current Price is the one defined by the rules (BR-07 of feature 02), and B does not exist when the trigger is not an observation (Q2 option C).

**Decision (Accepted):** A. The price that counts is the Current Price at the moment of evaluation. The notification states the alert, its owner, the Listing, the Target Price and the Current Price with its Observed At.

### Q5 — Cases around the Current Price

| Case | Outcome |
|---|---|
| The Listing has no Current Price (unavailable, or no observations) | Nothing to compare: no alert is triggered |
| The Listing becomes available again at a price that reaches the target | The alert is triggered, as feature 01 Q5 anticipated |
| An older observation is recorded after a later one | The Current Price does not change, so the outcome does not change |
| The same observation is sent again | Repeating the evaluation changes nothing, because of the idempotence of Q2 and Q3 |
| An alert already Triggered | It is skipped |

**Decision (Accepted):** these outcomes follow from earlier decisions. They are listed so that they become scenarios in Phase 2.

### ● Q6 — How is the result seen?

Alerts and notifications cannot be read yet, and there is no read feature in the scope.

| Option | Effect | Trade-off |
|---|---|---|
| A | Only through tests | Nothing to show when running the server |
| B | A minimal endpoint where a User reads their notifications | Shows the round trip. It adds a use case, a read port and authorisation of reads |
| C | A line in the log of the development server | Visible and cheap. It is not a feature, only a demonstration aid |

*Lean:* **A and C**: verified by tests, and visible in the development server. Reading notifications is a feature of its own.

**Decision (Accepted):** A and C. The result is verified by tests and shown as a line in the log of the development server. The feature adds no endpoint to read notifications.

## 9. Carried to later phases

These are design questions, not business ones, so they are not resolved here.

- **Where the evaluation lives.** A feature never imports another, and the evaluation needs Active alerts and their state (feature 01), the Current Price (feature 02) and the notification. A module of its own with its own ports, connected in the Composition Root, is a candidate. It touches the open question XQ-02 about boundaries (Phase 3 and 4).
- **A new query on the alerts.** Today the repository finds an Active alert by owner and Listing. Evaluating needs the Active alerts of a Listing, and the state change must be stored (Phase 4).
- **Behaviour of the alert.** Whether making an alert Triggered is a behaviour of `PriceAlert` (Phase 3).
- **Several alerts and failures.** What happens if one alert fails and others succeed, and what happens with two evaluations at the same time (Phase 4).
- **Whether `main.ts` needs demo alerts** to show the round trip (Phase 7).

## 10. Out of this feature (recorded so they are not lost)

Delivery of notifications and channels · user accounts and emails · reading alerts and notifications · cancelling, pausing and modifying alerts · price simulator · scheduling · price history · persistence · real provider authentication.

## 11. Exit criteria for Phase 0

- [x] Questions marked ● answered (Q1, Q2, Q3, Q4, Q6)
- [x] Scope boundary (section 6) approved
- [x] User approves moving to Phase 1 (domain language and business rules)
