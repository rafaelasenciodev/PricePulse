# 10 — My Alerts and My Notifications: Discovery and Business Rules (Stage 1)

Status: Approved. Every question below has a **Decision** line with status Accepted. *Lean* lines record the proposal that was discussed.

## 1. The business problem

[Feature 09](../09-web-interface/01-discovery.md) lets a person sign in, read the Catalogue and create a Price Alert, and then the interface stops: the alert is created and cannot be seen again. The API can already list the alerts of a User, change the Target Price of an Active one, cancel it and list the Notifications ([feature 04](../04-read-and-manage-alerts/01-discovery.md), [feature 05](../05-notifications-and-price-history/01-discovery.md)), but only through `curl`.

This feature is the second half of the interface, as decided in Q1 of feature 09: the person sees what they are watching, changes or stops it, and reads what the system has told them.

## 2. Actors and goal

| Actor | Role |
|---|---|
| **Person in a browser** | Reads their Price Alerts, changes the Target Price of an Active one, cancels it, and reads their Notifications |
| System | Answers as it answers any client. Nothing changes in the backend |

**Goal:** "See what I am watching and what has reached my price, and change my mind."

## 3. Scope (proposed)

**Is:** a screen with the Price Alerts of the person, with the title of each Listing, and the actions to change the Target Price of an Active alert and to cancel it; and a screen with their Notifications.

**Is not:** the history of prices as a chart or a table, pausing an alert, marking a Notification as read, delivering Notifications by any channel, a count of Notifications in the navigation, updates in real time, and tests that drive a browser. None of them exists in the API or was asked for.

**Scope approved** (see section 9).

## 4. What is already established

| Fact | Source |
|---|---|
| The API has `GET /price-alerts?status=&limit=&offset=`, `GET /price-alerts/{id}` and `PATCH /price-alerts/{id}` with exactly one of `{ targetAmount }` or `{ status: "cancelled" }`. A list is `{ items, total, limit, offset }`, newest first, 20 by default and 100 at most | Feature 04, design section 5 |
| A PATCH answers 404 for an alert that is not the person's or does not exist, 409 `ALERT_NOT_ACTIVE`, `ALERT_CONFLICT` or `TARGET_ALREADY_REACHED`, and 422 for an amount that is not valid | Feature 04, BR-01 to BR-08 |
| Cancelling a Cancelled alert succeeds and changes nothing. A Triggered alert cannot be cancelled. Only an Active alert can have its Target Price changed. Cancelled alerts stay in the list | Feature 04, BR-03 to BR-06 |
| A Price Alert has `id`, `listingId`, `targetAmount`, `currency`, `status` and `createdAt`. It has no title | `frontend/src/api/types.ts` |
| `GET /notifications?limit=&offset=` lists the Notifications of the person, newest first by the Observed At of the price that reached the target. Each states the alert, the Listing, the Target Price and the Current Price with its Observed At. It has no read state and it is not delivered | Feature 05, BR-01 to BR-03 |
| The interface shows the title of a Listing by asking the Catalogue: one request for up to 100 Listings, and one by identifier for any that is not in it | Feature 09, Q2 (Accepted) |
| The interface keeps nothing: it reads when a screen is entered and again after each change, a control cannot be used again while its request is in progress, and a 401 takes the person to signing in | Feature 09, Q8, Q9, BR-06, BR-11 |
| The client has no operation for any of this today. It has seven, and a test checks it against the real application | Feature 09, design section 2 |
| A change that the cookie authenticates carries the `Origin` of the application. Feature 09 checked it in a real browser for creating an alert | Features 08 and 09 |

## 5. Ambiguities and questions

Questions marked **●** must be resolved before this stage can close.

### ● Q1 — How far does this feature go?

| Option | Includes | Trade-off |
|---|---|---|
| A | The alerts (list, change, cancel) and the Notifications, as agreed in feature 09 | Closes the second half of the interface, and no backend change |
| B | A, plus the price history of a Listing on its screen | The backend can already answer it, but it needs a table or a chart, which is a screen of its own |

*Lean:* **A**. The history was left out of feature 09 on purpose and nobody has asked for it since. It can be a later feature.

**Decision (Accepted):** as proposed.

### ● Q2 — How are the screens organised?

| Option | Effect | Trade-off |
|---|---|---|
| A | Two screens, `/alerts` and `/notifications`, with a link to each in the navigation next to the Catalogue | Each screen does one thing, and each fits the router that exists |
| B | One screen with both lists | Everything at once, and two lists to page on one page |
| C | A, and a screen for one alert at `/alerts/:id` | The API has a read of one alert, but the list entry already has every field |

*Lean:* **A**. There is nothing in one alert that the list does not show.

**Decision (Accepted):** as proposed.

### ● Q3 — What does the list of alerts show, and can it be filtered?

| Option | Effect | Trade-off |
|---|---|---|
| A | Every state, with a filter by state kept in the address (`?status=`), and the page in the address as in the Catalogue | The person can find Active ones, and the address can be shared or reloaded. One control more |
| B | Every state in one list, with no filter | Simpler. A person with many Cancelled alerts must page through them |

Each entry shows the title and Retailer of its Listing (feature 09, Q2) with a link to it, the Target Price, the state, and the moment it was created.

*Lean:* **A**.

**Decision (Accepted):** as proposed.

### ● Q4 — Where is the Target Price changed?

| Option | Effect | Trade-off |
|---|---|---|
| A | In the entry: an Active alert has a button that turns its Target Price into a field with the same rules as the creation form (BR-09 and BR-14 of feature 09) | No new screen, and the form of creating an alert is reused |
| B | In the screen of one alert (Q2, option C) | Requires that screen |

*Lean:* **A**. Only an Active alert offers it. As in feature 09, the interface does not decide whether the amount is valid.

**Decision (Accepted):** as proposed.

### ● Q5 — Does cancelling ask for confirmation?

Cancelling cannot be undone: the alert stays as Cancelled, and the person must create another one.

| Option | Effect | Trade-off |
|---|---|---|
| A | A second step in the entry itself: "¿Cancelar esta alerta?" with a button to confirm and another to go back | One click more on something that cannot be undone. No browser dialog, which cannot be tested on a simulated page |
| B | It cancels at once | Faster, and an accidental click is final |

*Lean:* **A**.

**Decision (Accepted):** as proposed.

### ● Q6 — How are the Notifications related to the alerts?

| Option | Effect | Trade-off |
|---|---|---|
| A | The two lists are independent. A Notification shows the title of its Listing, the Target Price, the Current Price and when it was observed | Nothing is joined, and it is what the API gives |
| B | A Triggered alert also shows the price that triggered it, found by joining with its Notification by the identifier of the alert | A richer list, and a second read to join and to page |

*Lean:* **A**. The same title lookup serves both screens.

**Decision (Accepted):** as proposed.

### Q7 — What does a Notification say about delivery?

A Notification is stored and it is not delivered: no email, push or message is sent. The screen must not suggest that the person was told anywhere else.

*Lean:* the screen is called "Notificaciones", says in one line that they are the record of the alerts that reached their price and that nothing is sent anywhere, and has no count and no mark of read in the navigation, because there is no read state to count.

**Decision (Accepted):** as proposed.

### Q8 — What if a Listing of an alert cannot be found for its title?

*Lean:* the entry shows its `listingId` instead of the title, and the rest of the entry is complete. A failure to read the Catalogue is not a failure of the screen of alerts: it is shown as the identifier.

**Decision (Accepted):** as proposed.

## 6. Business rules (proposed)

| ID | Rule | Origin |
|---|---|---|
| BR-01 | The alerts and the Notifications are screens for a person who is signed in, and are protected as the Catalogue is | Feature 09, BR-02 |
| BR-02 | The list of alerts keeps the order of the API, newest first, reads one page at a time, and may be filtered by state. The filter and the page are in the address | Q3 |
| BR-03 | Each alert shows the title and Retailer of its Listing, with a link to it, its Target Price with its currency, its state and its creation moment. When the title cannot be found, it shows the identifier | Q3, Q8 |
| BR-04 | Only an Active alert offers to change its Target Price or to cancel it | Feature 04, BR-04, BR-05 |
| BR-05 | The amount that the person writes is sent as the text that they wrote, trimmed. A field that is empty is not sent. Whether it is valid is decided by the API | Feature 09, BR-09, BR-14 |
| BR-06 | Cancelling asks for a second step before it is sent | Q5 |
| BR-07 | Each answer of changing or cancelling has its own message: done, the alert is no longer Active, the alert changed meanwhile, a target that the Current Price already reaches, an amount that is not valid, and an alert that does not exist | Feature 04 |
| BR-08 | While a change is in progress its control cannot be used again, and when it ends the list is read again from the server | Feature 09, BR-11 |
| BR-09 | The Notifications are read newest first, one page at a time. Each shows the title and Retailer of its Listing, the Target Price, the Current Price and when it was observed | Feature 05, BR-02, BR-03 |
| BR-10 | The screen of Notifications says that they are stored and not sent anywhere. It has no read state and no counter | Q7 |
| BR-11 | A 401 and a failure that is not an answer of the API are handled as in feature 09 (BR-06, BR-12) | Feature 09 |

## 7. New terms for the glossary

None. The interface speaks of Price Alerts and Notifications as the glossary defines them. "Alerta de precio" is already in the vocabulary of feature 09, and this feature adds "notificación" (Notification) and "cancelar" (cancel).

## 8. Carried to the design

- How the titles are found for a page of alerts or Notifications, once, for both screens, with the rule of feature 09 Q2.
- The operations that the client needs (list alerts, change a Target Price, cancel, list Notifications) and the messages of each answer.
- Whether the form that changes a Target Price reuses the form that creates an alert.
- The navigation, and the address `?status=` and `?page=` of the list.

## 9. Exit criteria

- [x] Questions marked ● answered (Q1 to Q6)
- [x] Scope (section 3) approved
- [x] Rules (section 6) approved
- [x] The User approves moving to stage 2 (scenarios)
