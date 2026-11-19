# 04 — Read and Manage Price Alerts: Discovery and Business Rules (Stage 1)

Status: Approved. Every question below has a **Decision** line with status Accepted. *Lean* lines record the proposal that was discussed.

## 1. The business problem

A User can create a Price Alert, but cannot see it again, change its Target Price or stop it. Once created, an alert is out of the User's hands until it is Triggered. [Feature 01](../01-create-price-alert/00-discovery.md) left this out on purpose (its Q7c): cancelling and modifying were "separate, later features".

The system needs to let a User see their Price Alerts and keep them under control.

## 2. Actors and goal

| Actor | Role |
|---|---|
| **User** | Owns the Price Alerts. Reads them, changes the Target Price of an Active one, or cancels it |
| System | Checks that the alert belongs to the User, and applies the rules |

**Goal:** "See my Price Alerts, correct the Target Price of one that is still waiting, or stop one I no longer want."

## 3. Scope (proposed)

**Is:** listing the Price Alerts of the User, reading one, modifying the Target Price of an Active one, and cancelling an Active one. Cancelled becomes a new state of a Price Alert.

**Is not:** pausing and resuming, reading Notifications, the price history of a Listing, real authentication, persistence and the web interface. Each is a separate feature or decision. Reading Notifications and the price history are the next feature to be discussed.

**Scope approved** for stage 1 (see section 8).

## 4. What is already established

| Fact | Source |
|---|---|
| A Price Alert is Active until its Target Price is reached, and then Triggered. It is one-shot | Feature 01 BR-11, feature 03 |
| A User has at most one Active Price Alert per Listing | Feature 01 BR-07 |
| A Target Price is greater than zero, in the currency of the Listing, with the decimals of the currency, and is never already reached by the Current Price | Feature 01 BR-03, BR-04, BR-05 |
| The identity of the User comes from the authentication of the request, never from its body | Feature 01 BR-01 |
| Saving an alert replaces it without a condition. It must become conditional when alerts can be cancelled or modified | Completions of features 01 and 03 |
| Ports that a database can implement: queries by owner and by Listing, and pagination | [ADR-0003](../../adr/0003-persistence-deferred.md) |
| A Price Alert has no creation moment today: it holds its identifier, owner, Listing, Target Price and state | `PriceAlert` |

## 5. Ambiguities and questions

Questions marked **●** must be resolved before this stage can close.

### ● Q1 — How far does this feature go?

| Option | Includes | Trade-off |
|---|---|---|
| A | List, read one, modify the Target Price, cancel | A coherent unit about "my alerts". Adds one state and two changes to an alert |
| B | A, plus pause and resume | One more state and its transitions. Nothing needs it yet |
| C | A, plus reading Notifications and the price history | Many reads of different things. It grows past the size of one feature |

*Lean:* **A**.

**Decision (Accepted):** A. The feature lists the Price Alerts of the User, reads one, modifies the Target Price of an Active one and cancels an Active one. Pausing, Notifications and the price history are out.

### ● Q2 — What does a User see of another User's alert?

| Option | Answer to a request about an alert that is not theirs |
|---|---|
| A | The same as for one that does not exist (404) |
| B | A different answer (403) |

*Lean:* **A**: the existence of other Users' alerts is not revealed.

**Decision (Accepted):** A. An alert of another User is answered as one that does not exist.

### ● Q3 — What is cancelling?

| Option | Effect | Trade-off |
|---|---|---|
| A | The alert becomes Cancelled and is kept | The User can create a new Active alert for the Listing. It is not evaluated again. It stays in the list |
| B | The alert is deleted | Simpler, but nothing remains of it |

Two cases around it: cancelling an alert that is already Cancelled, and one that is already Triggered.

*Lean:* **A**. Cancelling a Cancelled alert is a success that changes nothing (a repeated request is harmless, as in features 01 and 02). A Triggered alert cannot be cancelled, because it has already ended.

**Decision (Accepted):** A, with both cases as proposed.

### ● Q4 — What can be modified?

| Option | Effect |
|---|---|
| A | Only the Target Price, of an Active alert, with the rules of creation |
| B | Also the Listing |
| C | Any field of an alert in any state |

*Lean:* **A**. Changing the Listing is another alert, and changing a Triggered or Cancelled one would reopen what has ended. Modifying to the same Target Price is a success that changes nothing.

**Decision (Accepted):** A.

### ● Q5 — How is the list ordered, and does the alert need a creation moment?

A list that is paginated needs a stable order, and "newest first" is what a User expects.

| Option | Effect | Trade-off |
|---|---|---|
| A | No new field. The order is by identifier, which is arbitrary | Nothing changes in the alert, but the order means nothing to the User |
| B | The alert gains a creation moment, set when it is created | Newest first. It changes the creation of feature 01, which needs a clock (as in feature 02), and the model of the alert |

*Lean:* **B**, because a list in an arbitrary order is a poor result for the User.

**Decision (Accepted):** B. The Price Alert gains a creation moment, and creating an alert takes it from a clock. This changes the use case of feature 01, which is not reopened as a document: the change is recorded in the design of this feature.

### ● Q6 — What if the alert changes while the User acts on it?

An Evaluation can make an alert Triggered at the same moment as the User cancels or modifies it. Today saving replaces the alert, so one of the two changes would be lost without notice.

| Option | Effect | Trade-off |
|---|---|---|
| A | Saving is conditional on the state that was read. If the alert is no longer in it, the request is rejected as a Conflict and nothing is lost | Needs a change in the port. A request can fail and have to be repeated |
| B | A version number in the alert | More general, and more than is needed while there are three states |
| C | Accept the race | Simple. A cancelled alert could be Triggered, or a modification could be lost |

*Lean:* **A**. One consequence is accepted: if the Evaluation produced its Notification just before the User cancelled, the Notification stays stored, because it records that the target was reached at that moment, and the Evaluation reports that it could not finish the alert.

**Decision (Accepted):** A, with that consequence.

### Q7 — What does the list show, and how can it be filtered?

*Lean:* each alert shows its identifier, Listing, Target Price with its currency, state and creation moment. The User can filter by state. It does not show the Notification of a Triggered alert, because reading Notifications is another feature. How pagination works is a design matter (stage 3).

**Decision (Accepted):** as proposed.

## 6. Business rules

| ID | Rule | Origin |
|---|---|---|
| BR-01 | A User reads, modifies and cancels only their own Price Alerts. One of another User is answered as one that does not exist | Q2 |
| BR-02 | A User reads the list of their Price Alerts, newest first, optionally filtered by state, and reads any one of them | Q5, Q7 |
| BR-03 | Cancelling an Active Price Alert makes it Cancelled. A Cancelled alert is not evaluated again, and it no longer counts as Active for the rule of one Active alert per Listing | Q3, feature 01 BR-07 |
| BR-04 | Cancelling a Cancelled alert succeeds and changes nothing. A Triggered alert cannot be cancelled | Q3 |
| BR-05 | Only the Target Price of an Active alert can be modified. The new Target Price follows the rules of creation (feature 01, BR-03, BR-04 and BR-05) | Q4 |
| BR-06 | Modifying the Target Price to the one it already has succeeds and changes nothing. The owner and the Listing never change | Q4 |
| BR-07 | Cancelling or modifying does not produce Notifications and does not trigger an Evaluation | Q1 |
| BR-08 | If the alert is no longer in the state that the request read when it is saved, the request is rejected as a Conflict and the stored alert is not changed | Q6 |
| BR-09 | A Price Alert has a creation moment, which never changes | Q5 |

## 7. New terms for the glossary

**Cancelled:** the state of a Price Alert that its owner stopped before it was Triggered. A Cancelled Price Alert is no longer Active. **Active** is refined: it is the state of a Price Alert that has not been Triggered or Cancelled. **Creation moment:** when a Price Alert was created. They are in the glossary.

## 8. Exit criteria

- [x] Questions marked ● answered (Q1 to Q6)
- [x] Scope (section 3) approved
- [x] Rules (section 6) approved
- [x] The User approves moving to stage 2 (scenarios)
