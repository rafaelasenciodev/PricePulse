# 04 — Read and Manage Price Alerts: Design (Stage 3)

Status: Approved. Every decision in section 6 has status Accepted.

The design of the feature: the model, the use cases, the ports and the way in. It builds on the [discovery and rules](01-discovery.md) and the [scenarios](02-scenarios.feature). It does not describe persistence technology.

## 1. The model

No new aggregate: Cancelled is one more state of `PriceAlert`, and the alert keeps being the only thing that changes.

| Element | Change | Rule |
|---|---|---|
| `AlertStatus` | Gains `Cancelled` | BR-03 |
| `CreatedAt` (new Value Object) | An instant, such as `ObservedAt`. It holds epoch milliseconds, prints as ISO 8601 in UTC and compares by instant | BR-09 |
| `PriceAlert` | Gains `createdAt`, set when it is created and never changed | BR-09 |
| `PriceAlert.cancel()` | Returns the alert as Cancelled. Only from Active, like `trigger()` | BR-03 |
| `PriceAlert.changeTargetPrice(target, currentPrice)` | Returns the alert with another Target Price, and the same identifier, owner, Listing and creation moment. Only from Active. It rejects a Target Price that the Current Price already reaches, as creation does | BR-05, BR-06 |

`isReachedBy` is already false for an alert that is not Active, so a Cancelled alert is never reached (BR-03). The domain errors are the existing ones: `AlertNotActive` and `TargetAlreadyReached`.

| Where each rule lives | |
|---|---|
| BR-01, BR-02 | Application and port: the queries are by owner, so an alert of another User is never returned |
| BR-03 | Domain (`cancel`, not reached) and port (the Active queries leave Cancelled out) |
| BR-04, BR-06 | Application: it decides the outcome from the state it finds |
| BR-05 | Domain (`changeTargetPrice`) and application (the Target Price is built with the rules of creation) |
| BR-07 | Nothing to model: the use cases have no port to evaluate or to notify |
| BR-08 | Port (conditional save) and application |
| BR-09 | Domain |

## 2. Use cases

The owner always comes from the authentication, never from the request. Views show the alert as text, as in feature 01, and gain `createdAt` in UTC.

| UC | Input | Output | Flow |
|---|---|---|---|
| **UC-01 List my Price Alerts** | `owner`, `status` (optional), `limit`, `offset` | `items` (views), `total`, `limit`, `offset` | One query by owner, filtered by state and ordered newest first, then by identifier. No application errors |
| **UC-02 Read a Price Alert** | `owner`, `alertId` | The view | Find the alert of that owner. If there is none: `AlertNotFound` (BR-01) |
| **UC-03 Modify the Target Price** | `owner`, `alertId`, `targetAmount` (text) | The view and `changed` | 1. As UC-02. 2. If the alert is not Active: `AlertNotActive`. 3. Read the Listing (currency and Current Price). 4. Build the Target Price in that currency: `InvalidTargetPrice`. 5. If it equals the current one: return it with `changed` false (BR-06). 6. `changeTargetPrice`: `TargetAlreadyReached`. 7. Save, conditional on Active: `AlertConflict` if it changed meanwhile |
| **UC-04 Cancel a Price Alert** | `owner`, `alertId` | The view and `changed` | 1. As UC-02. 2. Cancelled: return it with `changed` false. 3. Triggered: `AlertNotActive`. 4. `cancel`, and save conditional on Active: `AlertConflict` if it changed meanwhile |

Step 5 of UC-03 comes before step 6, so the same Target Price succeeds even when the Current Price now reaches it, as the repeated creation of feature 01 does.

**Creation changes.** `CreatePriceAlert` takes a `Clock` and gives the alert its creation moment (SC-22). Nothing else in it changes.

| Application error | Rules | When |
|---|---|---|
| `AlertNotFound` (new) | BR-01 | The alert does not exist or is another User's |
| `AlertNotActive` (new) | BR-04, BR-05 | The alert has ended or was stopped, and the request needs it Active |
| `AlertConflict` (new) | BR-08 | The alert changed state between being read and being saved |
| `InvalidTargetPrice`, `TargetAlreadyReached` | BR-05 | Existing, as in creation |

A missing Listing for an alert that exists is inconsistent data: it is an internal error, not `ListingNotFound`.

## 3. Ports

| Port | Operation | Contract |
|---|---|---|
| `PriceAlertRepository` | `find(owner, alertId)` | New. The alert if it exists and belongs to the owner, and nothing otherwise |
| `PriceAlertRepository` | `findByOwner(owner, { status?, limit, offset })` | New. The page and the `total` of the owner's alerts that match, newest first, then by identifier |
| `PriceAlertRepository` | `save(alert, expectedStatus)` | **Changed.** Replaces the stored alert only if its state is the expected one. Otherwise it fails with `AlertStateChanged`, a failure of the port that the use cases handle. It still fails if none is stored |
| `Clock` | `now()` | New port of this module. The one of feature 02 cannot be imported, so the Composition Root gives both the same clock |
| `ListingReader` | `get(listingId)` | Existing. UC-03 reads the currency and the Current Price with it |

## 4. Concurrency and transaction boundary

- Each change writes one alert with a conditional save. It is atomic, and there is no Unit of Work.
- If an Evaluation and a User act on the same alert, the first to save wins. The other finds a different state: UC-03 and UC-04 answer `AlertConflict` (SC-20), and the Evaluation lists the alert as `failed`, leaving its Notification stored (SC-21, as decided in Q6).
- UC-03 reads the Current Price and then saves, and the price can move in between. It is the same gap as creation has, and it is accepted.
- The race between creating an alert and recording a price, found in feature 03, is not changed by this feature.

## 5. The way in

Authentication is done by the existing hook of the module, before the body is read. The shape that is proposed:

| Request | Use case | Answers |
|---|---|---|
| `GET /price-alerts?status=&limit=&offset=` | UC-01 | 200 |
| `GET /price-alerts/{alertId}` | UC-02 | 200, 404 |
| `PATCH /price-alerts/{alertId}` with `{ "targetAmount": "70.00" }` or `{ "status": "cancelled" }` | UC-03 or UC-04 | 200, 404, 409 (`ALERT_NOT_ACTIVE`, `ALERT_CONFLICT`, `TARGET_ALREADY_REACHED`), 422 |

The body of a PATCH carries exactly one of the two fields, and the schema rejects anything else. Schemas, error codes and the API documentation are built in stage 4.

## 6. Decisions

| ID | Decision | Status |
|---|---|---|
| 1 | `CreatedAt` is a Value Object in the module of Price Alerts | Accepted |
| 2 | `cancel` and `changeTargetPrice` are behaviours of `PriceAlert`, which stays immutable and returns a new alert | Accepted |
| 3 | `Clock` is a port of this module, and the Composition Root gives it the same clock as feature 02 | Accepted |
| 4 | Saving is conditional on the state that was read, as decided in Q6. The expected state is a parameter | Accepted |
| 5 | The list is paginated with `limit` and `offset`, and answers with the `total` | Accepted |
| 6 | Three new application errors: `AlertNotFound`, `AlertNotActive` and `AlertConflict` | Accepted |
| 7 | One resource, `/price-alerts/{alertId}`, with PATCH for both changes. Cancelling is a change of state | Accepted |
| 8 | The queries are by owner, so authorisation is part of the question and not a check afterwards | Accepted |

Alternatives that were weighed:

- **Decision 1:** `ObservedAt` has another meaning, and a plain `Date` is mutable. A small Value Object keeps equality by instant and no mutable object in the model.
- **Decision 5:** pagination by cursor is more robust when data changes while it is read, but a page selector is easier with `limit` and `offset`, and any adapter can offer either. It can change without touching the use cases.
- **Decision 7:** `PATCH` for the Target Price and `DELETE` for cancelling would use another verb, but the alert stays after being cancelled, and DELETE says it is removed. A separate action such as `POST .../cancel` was also considered and is not needed.
- **Decision 8:** finding by identifier and comparing the owner afterwards makes the port simpler, but the port would hand over alerts of other Users, and a database would read them.

## 7. Where each scenario is handled

| Scenario | Handled by |
|---|---|
| SC-01 to SC-04 | UC-01, with the order, the filter and the owner in the query |
| SC-05 | UC-02 |
| SC-06 | UC-02, UC-03 and UC-04 give `AlertNotFound` through `find(owner, alertId)` |
| SC-07 | Authentication at the way in, before the use case |
| SC-08, SC-11, SC-12 | UC-04 |
| SC-09 | `isReachedBy` is false for Cancelled, and `findActiveByListing` leaves it out |
| SC-10 | `findActive` ignores Cancelled, so creation is allowed |
| SC-13 | The use cases have no port to evaluate or to notify |
| SC-14, SC-18, SC-19 | UC-03 |
| SC-15, SC-16 | UC-03, steps 4 and 6 |
| SC-17 | UC-03, step 2 |
| SC-20, SC-21 | Conditional save (decision 4) in UC-03, UC-04 and the Evaluation |
| SC-22 | `CreatePriceAlert` with the `Clock` |

## 8. Effects on the other features

- **Feature 01.** `CreatePriceAlert` gains a `Clock`, and the constructor and `create` of `PriceAlert` gain `createdAt`. Its documents are not reopened: the change is recorded here.
- **Feature 03.** The Evaluation saves with the expected state Active, and an `AlertStateChanged` ends in its `failed` list. Its rules do not change.
- **Feature 02.** No change.

## 9. Carried to the build

The contract tests of the repository for the new operations, including the page, the order and the conditional save. The schemas, the codes of the errors (`ALERT_NOT_FOUND`, `ALERT_NOT_ACTIVE`, `ALERT_CONFLICT`), the default and the maximum of `limit`, the API documentation, the demo data and the README.
