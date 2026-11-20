# 10 — My Alerts and My Notifications: Completion (Stage 5)

Status: Approved

The close of the feature: what was built, the decisions and their status, how it was verified, what the review found, what it does not do and what comes next. It links to the documents of each stage and does not repeat them. It is the seventh feature developed with the [method of five stages](../README.md), and the second half of the interface that [ADR-0005](../../adr/0005-web-interface.md) decided and [feature 09](../09-web-interface/04-completion.md) began.

## 1. Summary

A person signed in to `/app/` has two new screens. **My alerts** lists their Price Alerts newest first, one page at a time and filtered by state, with the title and the Retailer of each Listing. An Active alert can have its Target Price changed, or be cancelled after a second step. **My notifications** lists the Notifications of the alerts that reached their price, and says that they are stored and not sent anywhere.

It is interface only. The backend has no change in its source and the API is the one of features 04 and 05. It runs end to end over HTTP with in-memory storage. It does not show the history of prices, and it has no way to pause an alert, to mark a Notification as read or to deliver one. Those are listed in the [discovery](01-discovery.md).

## 2. What was built

| Stage | Result | Where |
|---|---|---|
| 1 Understand | 8 questions decided, 11 rules (BR-01 to BR-11), no new term | [Discovery and rules](01-discovery.md) |
| 2 Scenarios | 26 Gherkin scenarios (SC-01 to SC-26) | [Scenarios](02-scenarios.feature) |
| 3 Design | The client, the titles, the messages, the two lists and the entry of an alert, 9 decisions | [Design](03-design.md) |
| 4a Client and messages | Four operations of the client, two types, the messages of changing and cancelling, and the test of the client against the real application | `frontend/src/api`, `frontend/src/texts`, `backend/tests/my-alerts/` |
| 4b Reading | The navigation, `Pager`, `useTitles`, and the two screens as readers: lists, filter, paging and titles | `frontend/src/ui` |
| 4c Changing and cancelling | `AmountForm`, and the modes of an entry: changing, and confirming a cancel, with the notices of the screen | `frontend/src/ui` |
| 4d Verification and review | The traceability of the feature, a check in a real browser, and a review | Sections 4 and 5 |

The feature changed 17 files of the source of the frontend (685 insertions, 98 deletions, 6 new) and 12 of its tests (961 insertions, 11 deletions, 6 new), and 4 files of tests of the backend (258 insertions, 34 deletions, 2 new). It changed **no file of the source of the backend** and added no dependency.

## 3. Decisions and their status

The status of every decision of the discovery and the design is recorded here, and only here. The design's decisions are numbered D1 to D9, as in its section 8.

| Decision | Status | Evidence |
|---|---|---|
| Q1 Alerts and Notifications, with no price history | Implemented | This document |
| Q2 Two screens, `/alerts` and `/notifications`, with no screen for one alert | Verified | SC-02, and the real browser |
| Q3 Every state, a filter by state and the page, both in the address | Verified | SC-06, SC-07 |
| Q4 The Target Price is changed in the entry, with the rules of creating an alert | Verified | SC-12 to SC-16, and the real browser |
| Q5 Cancelling asks first, in the entry and with no browser dialog | Verified | SC-17 to SC-20, and the real browser |
| Q6 The two lists are independent, and nothing is joined | Verified | SC-21, SC-22 |
| Q7 The screen says that Notifications are stored and not sent, with no count and no read state | Verified | SC-24 |
| Q8 When a title is not found, the identifier is shown | Verified | SC-09 |
| D1 Four operations in the client, with no new type of `PriceAlert` | Verified | `alerts-client.test.ts`, and 10 tests against the real application |
| D2 `useTitles`: the Catalogue once, then each Listing that is missing | Verified | SC-08, SC-09 |
| D3 The messages are chosen by the code of the answer | Verified | `alerts-messages.test.ts` |
| D4 The filter and the page are in the address, and the filter is four links | Verified | SC-06, SC-07 |
| D5 `Pager` is taken out of the Catalogue | Verified | The 17 tests of the Catalogue, unchanged apart from the names of the texts of paging in two of them |
| D6 `AmountForm` is taken out of `PriceAlertForm` | Verified | The tests of creating an alert, unchanged |
| D7 The modes of an entry are its own | Verified | SC-11 to SC-20 |
| D8 What a change tells is a notice of the screen, and the list is read again | Verified | SC-12, SC-15, SC-18, SC-19, and the real browser |
| D9 The navigation is in the `Layout`, with no counter | Verified | SC-02, SC-24 |

Decisions taken while building, which the design left open. Each one was shown to the author at its stop and approved with the stop.

| When | Decision | Status |
|---|---|---|
| 4a | The four new operations are wrapped by the session, so that a 401 in any of them ends it (BR-11). The design did not say it | Verified |
| 4a, 4d | The tests of this feature are in files of their own, and the traceability guard assigns the tests of the frontend by file name, because the scenarios of two features are numbered apart | Verified |
| 4b | A failure of the Catalogue alone does not hide a title: the lookups by identifier still run. The identifier is shown when those fail too | Verified |
| 4c | Each result starts a new generation of the entries, so that the form of the entry that was acted on is gone at once | Verified |
| 4d | A notice is cleared when the filter changes and not when the page does | Verified |

### Effect on the other features

- **Feature 09.** The Catalogue uses `Pager` and `PriceAlertForm` uses `AmountForm`. The texts of paging moved to a group of their own. Its tests pass as they were, and two of the Catalogue name the texts of paging in their new place.
- **The traceability guard.** It reads the tests of the frontend by file, and feature 10 is in it. The backend is not touched and the API does not change.

## 4. Verification

- **Tests:** the backend has 1,582 test cases in 77 files, and the frontend 384 in 16 files, all passing. Of the feature: 98 in the frontend (the client 20, the texts 10, the session 4, and the screens 64), 10 in the backend that run the client against the real application, and 7 of the traceability guard.
- **Scenarios:** the 26 have tests, read from their titles, with no exemption.
- **Coverage, as a diagnostic:** the frontend has 98.1 % of statements, 97.4 % of branches, 100 % of functions and 98.8 % of lines. The backend has 99.2 %, 97.3 %, 99.7 % and 99.3 %.
- **Deliberate errors,** two, where a mistake would be silent: a link of the page that drops the filter made SC-07 fail, and an answer `ALERT_CONFLICT` that does not read the list again made two tests fail. The code was restored each time.
- **In a real browser,** Chrome, driven with the extension of the browser, through the proxy of Vite, with the backend on another port:

| What | Result |
|---|---|
| My alerts | Title, Retailer, Target Price, state and creation moment, the filters and the actions |
| Changing a Target Price, which is the first `PATCH` of the interface | The application accepted it with the cookie and the `Origin` that came through the proxy. The list was read again and showed 85.00 EUR, and the notice said so |
| A Notification | A price reported by a provider reached the new target, and the Notification stated 85.00, so the change was stored |
| A Triggered alert | It says Triggered and offers nothing |
| Cancelling | The question, the confirmation, the notice, and the alert listed as Cancelled |
| The console | No errors |

- **Not done.** Only Chrome was used, over HTTP and on the local machine. The failures that are not an answer, and a Session that ended in another place, were not made to happen in the browser, and are covered only on a simulated page.

## 5. Architecture review

- **The folders and their imports** are as feature 09 left them, and the architecture test still holds. The client has no React, every request is made there, and no file names the storage of the browser or a header of credentials.
- **Failures** are values, as before. The new operations are covered by the test that runs every operation against a fetch that rejects or answers what is not the API.
- **The backend** is untouched, so its dependency direction and its domain have nothing new to review.

A review of the branch against `develop` found these points. Each was checked against the code before deciding.

| # | Finding | What was done |
|---|---|---|
| 1 | The tests of this feature, in the files of feature 09, would have been counted by the guard for that feature | Moved to files of their own, and the guard assigns by file (section 3) |
| 2 | The session did not wrap the new operations, so a 401 in them did not end it | Fixed, with a test |
| 3 | A fast answer did not unmount the list, so the form of the entry could stay open | Fixed with the generation of the entries |
| 4 | Cancelling the only alert of the last page led to the page before and cleared the notice, so nothing confirmed it | Fixed: the notice is cleared by the filter only. A test shows it |
| 5 | Every result drops the forms of the other entries, and a person who was typing in another one loses what was written | A limitation (section 7) |
| 6 | The titles are read again after each result and for each page | A limitation: at most one read of the Catalogue and one for each distinct Listing of the page, which is 21 requests |
| 7 | In development each read is made twice | Not a defect: `StrictMode` runs the effects twice, and it does not in the build |

## 6. What the process revealed

| When | What | Result |
|---|---|---|
| 4a | The recorder that the Composition Root returns records but does not evaluate, so a test cannot make a Notification with it | The test reports the price through the API, as a Provider does |
| 4b | The first tests of the client were in a file that the guard assigns to feature 09 | See finding 1 |
| 4d | The first price reported in the browser was a minute earlier than the price that the demo server seeds at its start, so it was not the Current Price and nothing was triggered | The current time. The price that is not the latest is stored and is not evaluated, as the rules say |
| 4d | A price with a moment in the future is refused with 422 | A moment of the past |
| 4d | The ports 3000 and 5173 were busy again, with processes that were not this session's | Ports 3011 and 5174, started and stopped here. `vite --port` replaces the port of its configuration |

## 7. Known limitations

- Storage is in memory ([ADR-0003](../../adr/0003-persistence-deferred.md)): a restart loses every Account, Session, alert and Notification.
- Notifications are a record. Nothing is delivered, nothing is read or unread, and the navigation has no counter.
- Cancelling cannot be undone: the person creates another alert.
- Each result drops the forms of the other entries, and what a person was typing in them.
- The titles cost up to 21 requests for a page, and are asked for again after each result.
- The list is read again from the server after each change, and a person who has two tabs open sees the state of the moment of the last read.
- The check in a real browser was one browser, over HTTP and on the local machine, and there is no audit of accessibility and no end-to-end suite.
- `main.ts` has no test, the tests have run on one version of Node, 25.9, no continuous integration runs them, and the repository has no licence.

## 8. Documentation volume

The documents of the first three stages have 574 lines (discovery and rules 163, scenarios 281, design 130). The previous feature had 742, so it is 23 % less.

## 9. Follow-up

**Next,** in the order agreed so far, the persistence and then the deployment, each with its ADR, and the final README, slides and video. Nothing of the interface changes with the persistence: it only talks to the API.

**Not started and not scheduled:** the history of prices on the screen of a Listing, pausing an alert, marking Notifications as read, and delivering them.

**For the deployment,** in addition to what [feature 09](../09-web-interface/04-completion.md#9-follow-up) lists: that a restart empties the alerts and the Notifications, and that the demo Accounts are public.

## 10. Completion checklist

- [x] Stages 1 to 4 completed
- [x] Documentation of stage 5 written (this document)
- [x] This document is approved by the author
- [x] The README and the documentation indexes describe this feature
- [ ] The feature is merged into `develop` with `--no-ff`, and `develop` into `main` and tagged (done by the developer, [ADR-0002](../../adr/0002-branching-model.md))
- [ ] A licence is chosen before the repository is published
