# 03 — Alert Evaluation: Business Rules (Phase 1)

Status: Approved

Business rules of the feature, expressed in the project's [Ubiquitous Language](../../domain/ubiquitous-language.md). Each rule traces to a decision in the [feature discovery](00-discovery.md). The terms **Notification** and **Evaluation** are new, and **Triggered** is refined. They are in the glossary.

## What is evaluated

| ID | Rule | Origin |
|---|---|---|
| BR-01 | The Evaluation of a Listing considers only its Active Price Alerts. A Triggered Price Alert is never evaluated again. | Q1, Q5 |
| BR-02 | An Active Price Alert whose Target Price is reached by the Current Price of its Listing is Triggered. The Current Price is the one at the moment of the Evaluation, and the comparison is the one of feature 01: Current Price less than or equal to Target Price. | Q4, glossary |
| BR-03 | If the Listing has no Current Price, no Price Alert is Triggered. The Evaluation keeps no memory of earlier prices: a Listing that has a Price again is evaluated against that Price. | Q5 |

## Outcome

| ID | Rule | Origin |
|---|---|---|
| BR-04 | When a Price Alert is Triggered, a Notification is produced for its owner. It states the Price Alert, the owner, the Listing, the Target Price, and the Current Price with its Observed At at the moment of the Evaluation. | Q1, Q4 |
| BR-05 | A Price Alert has at most one Notification. | Q3 |
| BR-06 | A Price Alert becomes Triggered together with its Notification: the Notification is produced first, and then the Price Alert becomes Triggered. If something fails in between, the next Evaluation makes the Price Alert Triggered without producing a second Notification, whatever the Current Price is at that moment. | Q3, R1 |
| BR-07 | Repeating an Evaluation when nothing has changed produces no Notification and changes no Price Alert. | Q2, Q3, Q5 |

## Boundaries

| ID | Rule | Origin |
|---|---|---|
| BR-08 | Producing a Notification does not deliver it, and a Notification has no channel. | Q1, feature 01 Q9 |
| BR-09 | The Evaluation changes only the state of the Price Alerts it Triggers and produces Notifications. It does not create, cancel, modify or delete Price Alerts, and it does not change Price Observations. | Section 6 of the discovery |
| BR-10 | The Evaluation of a Listing that does not exist has nothing to evaluate. It is not an error. | R2 |

## Questions of this phase

Two points were not settled by the discovery. Each shows its options, a *lean* (the proposal discussed) and the **Decision** taken.

### R1 — A Notification exists, the Price Alert is still Active, and the price has risen

This is the case that BR-06 leaves open. An Evaluation produced the Notification and failed before the Price Alert became Triggered. By the next Evaluation the Current Price no longer reaches the Target Price.

| Option | Outcome | Trade-off |
|---|---|---|
| A | The Price Alert becomes Triggered. The existing Notification decides, whatever the price is now | Alert and Notification never disagree. The User is told that the target was reached, and it was |
| B | The price is compared again. If it no longer reaches the Target Price, the Price Alert stays Active | The alert keeps waiting, but a Notification exists that says the target was reached, and a second one would be produced later (against BR-05) or none (a Triggered alert without a second Notification) |

*Lean:* **A**. B contradicts BR-05 or leaves a Notification that no Triggered alert explains.

**Decision (Accepted):** A. An existing Notification decides: the Price Alert becomes Triggered, whatever the Current Price is now. Recorded in BR-06.

### R2 — A Listing that does not exist

The Evaluation is started from outside, with a Listing identifier.

| Option | Outcome | Trade-off |
|---|---|---|
| A | There is nothing to evaluate and it is not an error | Simple. No Price Alert can exist for a Listing that does not exist (BR-02 of feature 01) |
| B | An explicit error, as in the other features | Consistent. But the one who starts the Evaluation is the system, and no one can act on the error |

*Lean:* **A**.

**Decision (Accepted):** A. Recorded as BR-10.

## Notes

- **Triggered is refined.** The glossary used to define it as reached and the User notified. With the decision of Q1, it means reached and a Notification produced. BR-11 of feature 01 says "the User is notified" and its document is not reopened: the glossary is where the meaning is kept, and "notified" is read as "a Notification was produced".
- **Terms added to the glossary:** Notification and Evaluation.
- When several Price Alerts of a Listing are reached by the same Evaluation, each one is Triggered and has its own Notification. What happens when one fails and the others do not is a design matter for the use case contract (Phase 4).
- How an Evaluation is started, where it lives and which ports it needs are not business rules. They are handled in Phases 3 and 4 (see section 9 of the discovery).
- Reading Notifications, delivering them, accounts, simulating prices and scheduling are outside this feature.
