# 03 — Alert Evaluation: Application Use Case Contract (Phase 4)

Status: Approved

The contract of the use case that realises this feature. It builds on the [business rules](01-business-rules.md), the [scenarios](02-scenarios.feature) and the [domain model](03-domain-model.md). It describes what the use case asks for, what it returns and what it needs from the outside. It does not describe HTTP, persistence technology or how the use case is started.

Identifiers such as UC-01 are numbered within each feature, like BR and SC. This UC-01 is not the one of the other features.

## UC-01 — Evaluate the Price Alerts of a Listing

The system compares the Current Price of a Listing with the Target Price of each of its Active Price Alerts. Each alert that is reached gets a Notification and becomes Triggered. An alert that a failure left half done is completed.

**Precondition.** None about identity: the System starts it, and no User or Provider requests it (discovery, Q2). What starts it is outside this contract.

### Input

| Data | Origin | Notes |
|---|---|---|
| `listingId` | The caller | The Listing to evaluate. It may not exist (BR-10) |

### Output

| Data | Notes |
|---|---|
| `triggered` | The Price Alerts that became Triggered in this run. Each entry has the `notification` (alert, owner, Listing, Target Price, Current Price and its Observed At as text) and `produced`: `true` if the Notification was produced in this run, `false` if it already existed (BR-06, SC-15, SC-16) |
| `failed` | The Price Alerts that could not be processed, each with its alert identifier and the error. It is empty when everything went well (decision 5) |

Both can be empty: a Listing with no Active alerts, or none reached (SC-03, SC-05, SC-06, SC-19).

### Expected application errors

**None.** Everything that can happen with a Listing and its alerts is a normal outcome and is returned: an unknown Listing is an Evaluation with nothing to do (BR-10), a price that does not reach the target is an alert that stays Active, and an alert that fails is listed in `failed`. Technical failures and inconsistent data are internal errors and are outside this contract.

## Flow and order of checks

1. Find the Active Price Alerts of the Listing. If there are none, return empty (BR-01, BR-10).
2. Read the Current Price of the Listing with its Observed At, **once**. All the alerts of this run are compared with the same price (decision 3).
3. For each alert, on its own (decision 5):
   1. Look for the Notification of the alert.
      - **Found:** make the alert Triggered and store it, whatever the Current Price is (BR-06, SC-15, SC-16). `produced` is `false`.
   2. Not found: if the alert is not reached by the Current Price, leave it Active (BR-02, BR-03).
   3. Reached: produce the Notification and add it. If adding fails because another Evaluation added it first, take the stored one and continue as in 3.1 with `produced` `false`.
   4. Make the alert Triggered and store it. `produced` is `true` if this run added the Notification.

The Notification is stored before the alert is changed (BR-06). If the run stops between the two, the next run finds the Notification in 3.1 and completes the alert.

## Ports

The use case depends on three ports, defined by the application. It does not know what lies behind them. All their operations are asynchronous (see [ADR-0001](../../adr/0001-typescript-backend.md)).

| Port | Operation | Contract |
|---|---|---|
| `PriceAlertRepository` | Find the Active alerts of a Listing | **New operation** of the existing port. Returns every Price Alert of that Listing that is Active. A Triggered one is never returned (BR-01) |
| `PriceAlertRepository` | Save an alert | **New operation.** Replaces the stored alert that has the same identifier. The only change it is used for is Active to Triggered |
| `NotificationRepository` | Find the Notification of an alert | **New port.** Returns it, or nothing |
| `NotificationRepository` | Add a Notification | Fails with `NotificationAlreadyExists` if one for that Price Alert is stored. The failure is handled inside the use case and is not exposed to the caller |
| `CurrentPriceSource` | The Current Price of a Listing | **New port.** Returns the Price and its Observed At, or nothing if the Listing has no Current Price (BR-03). A Listing that does not exist has none |

There is no `Clock`: a Notification does not record when it was produced. There is no port to deliver (BR-08), and the `ListingReader` of feature 01 is not used.

### Dependencies of the use case

The domain model (`PriceAlert`, `Notification`, `Price`, `ObservedAt` and the identifiers) and the three ports. Nothing else: no HTTP, no persistence technology, no external provider, and nothing from the module of Price Observations.

## Concurrency and transaction boundary

Two Evaluations of the same Listing can run at the same time and both find an alert Active, with no Notification.

- Persistence must guarantee at most one Notification per Price Alert (BR-05). When adding violates it, the repository fails with `NotificationAlreadyExists`.
- The use case then takes the stored Notification and goes on to make the alert Triggered. Both Evaluations store the alert as Triggered, which is the same state, so the second does no harm (SC-13).
- The use case writes two things per alert, a Notification and the state of the alert. They are not one transaction: each write is atomic by itself, and the order of the flow makes a stop between them safe to repeat (discovery, Q3). It needs no Unit of Work.
- Saving the alert replaces it. That is safe while Active to Triggered is the only change of state. When alerts can be cancelled or modified, the save will have to be conditional on the state that was read. This is recorded as a limitation.
- A failure of one alert does not stop the others (decision 5).

## Effect on the other features

- **Feature 01.** The use case `CreatePriceAlert` and its contract do not change. Only its repository port gains two operations, and the in-memory adapter gains them. The documents of feature 01 are not reopened.
- **Feature 02.** Its use case and contract do not change. `ObservedAt` moves to the shared module (decision C of the domain model), so its imports change. The Current Price with its Observed At comes from the latest Price Observation of the Listing, through the Composition Root, in the same way as the Current Price reaches feature 01 today (Phase 7).

## Decisions

| ID | Decision | Status |
|---|---|---|
| 1 | One use case, `EvaluatePriceAlerts`, with a Listing as its only input. It does not know what starts it | Verified |
| 2 | The use case has no application errors. An unknown Listing, a price that does not reach the target and an absent Current Price are results | Verified |
| 3 | The Current Price is read once per run, before the alerts are looked at | Verified |
| 4 | For each alert the Notification is looked for first, and only then is the price compared (BR-06) | Verified |
| 5 | An alert that fails does not stop the others. The run returns the failures in `failed` and does not raise them | Verified |
| 6 | The output lists the alerts made Triggered, with their Notification and whether it was produced in this run, and the failures | Verified |
| 7 | Three ports: two new operations on `PriceAlertRepository`, a new `NotificationRepository` and a new `CurrentPriceSource`. No `Clock` | Implemented |
| 8 | Concurrency is solved with a uniqueness guarantee on the Notification per alert and a repeatable order of writes, without a Unit of Work | Verified |

Statuses after the implementation. **Verified** means that tests confirm the decision; **Implemented** means that it is realised in code and no test pins it down.

- **1**: the use case is tested with only a Listing as input, and the wiring tests start it from outside, through the recording of a price.
- **2**: an unknown Listing, a price that does not reach the target and an absent Current Price are tested as results, not as errors (SC-03, SC-05, SC-06, SC-19).
- **3**: a test checks that the Current Price is read once for several alerts.
- **4**: SC-15 and SC-16 test that an existing Notification decides, even if the price has risen or is absent.
- **5**: tests check that an alert that fails, with a store error, a currency inconsistency or something that is not an `Error`, does not stop the others and is returned in `failed`.
- **6**: the output is tested as a whole in SC-01, with the Notification, the `produced` flag and `failed`.
- **7**: the three ports are realised, but the number of them is a structural choice that no test pins down. Each port has contract tests of its own.
- **8**: tested with two Evaluations at the same time, with a stale read, and with a failure between the two writes. It has been verified only in memory. Against a database it still has to be verified.

Alternatives considered:

- **Decision 2:** a `ListingNotFound` error for an unknown Listing, as the other features raise. R2 of Phase 1 decided that it is not an error, because the one that starts the Evaluation is the System and no one can act on the error.
- **Decision 3:** reading the price for each alert. It costs more reads and two alerts of the same run could be compared with different prices if an observation arrived in between.
- **Decision 4:** comparing the price first, as the natural reading of the rules. It would leave an alert Active when a Notification exists and the price has risen, against R1.
- **Decision 5:** stopping at the first failure and raising it. A single alert with inconsistent data would block the alerts after it in every run. Raising an error at the end, after processing all, was also considered: the result is clearer for the caller and avoids losing what was done, and the caller can still choose to raise.
- **Decision 7:** a new `AlertEvaluation` module with its own port to the alerts. Rejected in the domain model (decision A).
- **Decision 8:** a Unit of Work for the two writes, or a stored "outbox". Both are heavier, and the order of the writes already makes a repeat safe.

## Traceability to the scenarios

| Scenario | Outcome in the use case |
|---|---|
| SC-01, SC-02, SC-04 | Reached (step 3.3): Notification produced and alert Triggered, `produced` `true` |
| SC-03 | Not reached (step 3.2): the alert stays Active and is not in `triggered` |
| SC-05, SC-06 | No Current Price (step 2): no alert is reached |
| SC-07 | The price is read as it is now, with no memory (step 2) |
| SC-08, SC-09 | Step 3 for each alert, on its own |
| SC-10 | Step 1 finds only the alerts of the Listing |
| SC-11, SC-12 | Step 1 returns only Active alerts |
| SC-13 | `NotificationAlreadyExists` handled in step 3.3 |
| SC-14 | The Notification cannot be added: the alert stays Active and appears in `failed`. A later run finds no Notification and does it again |
| SC-15, SC-16 | Step 3.1: the Notification exists, the alert is made Triggered whatever the price, `produced` `false` |
| SC-17 | The use case has no port to deliver |
| SC-18 | The use case has no operation other than adding a Notification and saving the alert as Triggered |
| SC-19 | Step 1 returns nothing (BR-10) |

## Out of this contract

How the Evaluation is started, and what happens to the response of the recording of an observation if the Evaluation fails (Phase 7). The line of the development log (Q6, Phase 7). The persistence schema and the uniqueness mechanism (infrastructure), and the in-memory adapters (Phase 6).
