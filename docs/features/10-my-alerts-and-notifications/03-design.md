# 10 — My Alerts and My Notifications: Design (Stage 3)

Status: Approved. Every decision in section 8 has status Accepted.

The design of the second half of the interface. It builds on the [discovery and rules](01-discovery.md), the [scenarios](02-scenarios.feature) and the [design of feature 09](../09-web-interface/03-design.md), whose folders, hooks and dependency rules stay as they are. The backend and the API do not change, and no dependency is added.

## 1. Where the change goes

| Folder | What is added |
|---|---|
| `src/api/` | Four operations and two types: `alerts`, `changeTarget`, `cancelAlert`, `notifications`; `Money` and `Notification` |
| `src/texts/` | The texts of the two screens, the new actions of `messageFor`, and a `paging` group shared by the lists |
| `src/ui/` | `AlertsScreen`, `NotificationsScreen`, the entry of an alert, the hook that finds titles, a `Pager` shared with the Catalogue, an `AmountForm` shared with the creation of an alert, and the navigation in the `Layout` |
| `src/session/` | Nothing |

## 2. The client

| Operation | Request | Gives |
|---|---|---|
| `alerts({ status?, limit, offset })` | `GET /price-alerts?status=&limit=&offset=` | `Page<PriceAlert>` |
| `changeTarget(id, amount)` | `PATCH /price-alerts/{id}` with `{ targetAmount }` | The `PriceAlert` after the change |
| `cancelAlert(id)` | `PATCH /price-alerts/{id}` with `{ status: "cancelled" }` | The `PriceAlert` after the change |
| `notifications({ limit, offset })` | `GET /notifications?limit=&offset=` | `Page<Notification>` |

As the other operations, they never throw, send the amount as the text given (BR-05), ask for the status that the API gives, and build new objects with the fields they know. `Notification` is `{ alertId, listingId, targetPrice, currentPrice, observedAt }`, with `Money` as `{ amount, currency }`: the `owner` that the API also sends is not copied. Nothing is added to `PriceAlert`, which the creation already reads. The test of the client against the real application runs the four.

## 3. The titles

`useTitles(listingIds)` gives, for the Listings of a page of alerts or Notifications, the title and the Retailer of each that it finds (Q2 of feature 09, Q8 of this one).

1. When the page is ready, it reads the Catalogue once, with `limit` 100 and `offset` 0.
2. For each distinct identifier that the Catalogue did not give, it asks `listing(id)`: at most 20, one per entry of a page.
3. A failure of any of them, of the Catalogue or of a Listing, is not shown and not retried. That Listing has no title, and its entry shows the identifier (BR-03, SC-09).

The titles arrive after the entries. Until they do, an entry shows the identifier and then changes, so that the screen never waits for a title. It is a hook of `ui/` and it keeps nothing between screens.

## 4. The messages

`messageFor` gains four actions. The code of the answer chooses the message, as for the others.

| Action | Code | Message says |
|---|---|---|
| `changeTarget` | `INVALID_TARGET_PRICE` | The amount is not valid |
| | `TARGET_ALREADY_REACHED` | The Current Price already reaches that target |
| | `ALERT_NOT_ACTIVE` | The alert is no longer Active |
| | `ALERT_CONFLICT` | The alert changed meanwhile, look at it again |
| | `ALERT_NOT_FOUND` | The alert does not exist |
| `cancelAlert` | `ALERT_NOT_ACTIVE`, `ALERT_CONFLICT`, `ALERT_NOT_FOUND` | The same three messages |
| `readAlerts`, `readNotifications` | Any | "Something failed", with a way to try again |
| Any | Another answer, and a failure that is not an answer | "Something failed", and nothing of the cause (BR-11) |

A 401 is handled by the session before any message (BR-11).

## 5. The two lists

**`/alerts`** reads `alerts({ status, limit: 20, offset })` with `useRequest`, and the address has the filter and the page: `?status=active|triggered|cancelled` and `?page=`. A value of `status` that is none of these, and a page that is not a whole number from 1, are read as no filter and the first page, and a page past the end leads to the last one, as in the Catalogue. The filter is four links, "Todas" with no `status` and one for each state, with the current one marked and no page in their address, so choosing another filter starts at its first page. The titles come from `useTitles`. Each entry shows what BR-03 says, and an Active one has the two actions of section 6.

**`/notifications`** reads `notifications({ limit: 20, offset })` with `?page=`, and shows the entries of BR-09, the one line of BR-10 and no control. The empty state of each list is a message, and the one of alerts links to the Catalogue.

**The navigation** is a `nav` in the `Layout` with three links, the Catalogue, "Mis alertas" and "Mis notificaciones". The current one is marked, and the whole interface is reachable with the keyboard.

**`Pager`** is the part of the Catalogue that is also needed here: the page of `?page=`, the line "1 a 20 de 45", the two links and the redirection of a page past the end. The Catalogue uses it, and so do the two new lists, each saying how to build the address of a page.

## 6. Changing and cancelling

Each Active entry is in one of three modes, which only it knows: **seen**, **changing** and **confirming a cancel**.

- **Changing** shows an `AmountForm` that starts empty and sends the trimmed text (BR-05). Sending uses `useSubmit`, so a second click in the same instant sends nothing (BR-08). An answer that leaves the form useful, an invalid amount or a target already reached, shows its message in the form and keeps what was written. Giving up goes back to seen with no request.
- **Confirming a cancel** replaces the buttons with the question and two buttons, confirm and go back. Only confirming sends (BR-06), and it is also under `useSubmit`.
- **A change that was made,** or an answer that says that the alert is not what the person saw (not Active, changed meanwhile, does not exist), is told by a **notice of the screen**, and the list is read again (BR-08). The notice is in the screen and not in the entry because the read replaces the entries, as feature 09 did with the result of creating an alert.

`AmountForm` is the form of `PriceAlertForm` with what changes as props: the label, the texts of the button, the operation and the action of the messages. It is where BR-05 and the empty field live, so that the rule is written once. A field has an identifier of its own per entry, so that two forms never share a label.

## 7. Tests

- **Screens:** Vitest and Testing Library, with the fake client of feature 09, in `tests/ui/alerts.test.tsx`, `notifications.test.tsx` and `titles.test.tsx`. Each test names its scenarios.
- **Client:** the four operations in `tests/api/client.test.ts`, with the shapes that the API gives, and in the test of the backend suite that runs the client against the real application, which is what shows a drift. A PATCH is the first change of the interface that is not a POST.
- **Messages:** one test of the table of section 4.
- **Guards:** the architecture test and the test of the sources run over the new files with no change.
- **Not covered by tests:** that the `Origin` of a PATCH reaches the application through the development server. It is tried in a real browser, as feature 09 did for a POST.

## 8. Decisions

| ID | Decision | Status |
|---|---|---|
| 1 | Four operations in the client, with the shapes of section 2, and no new type of `PriceAlert` | Accepted |
| 2 | The titles are found by `useTitles`: the Catalogue once, then one request for each Listing that is missing, and a failure is shown as the identifier | Accepted |
| 3 | The messages are those of section 4, chosen by the code of the answer | Accepted |
| 4 | The filter and the page are in the address, and the filter is four links | Accepted |
| 5 | `Pager` is taken out of the Catalogue and used by the three lists | Accepted |
| 6 | `AmountForm` is taken out of `PriceAlertForm`, and used to create an alert and to change a Target Price | Accepted |
| 7 | Each Active entry has the modes seen, changing and confirming a cancel, kept in the entry | Accepted |
| 8 | What a change tells is a notice of the screen, and the list is read again | Accepted |
| 9 | The navigation is in the `Layout`, with no counter | Accepted |

Alternatives that were weighed:

- **Decisions 5 and 6:** to copy the paging of the Catalogue and the form of creating an alert into the new screens. It leaves the code of feature 09 as it is, and writes the rule of BR-05 and the paging in three places each, which is where they drift. The two changes are small, and the tests of feature 09 protect them.
- **Decision 2:** to ask for each title one by one, with no read of the Catalogue. At most 20 requests for each screen, against one in the usual case. The Catalogue first is what Q2 of feature 09 accepted.
- **Decision 4:** a `select` for the filter. It needs no links, and it is a form to read and to keep in the address. Links do it with what the Catalogue already does.
- **Decision 8:** to keep the old list on the screen while it is read again, with no flash. It needs a second kind of state in `useRequest`, which feature 09 chose not to have.

## 9. Where each scenario is handled

| Scenario | Handled by |
|---|---|
| SC-01, SC-02 | The wrapper of routes, the new routes and the navigation of the `Layout` |
| SC-03, SC-04, SC-05, SC-10 | `AlertsScreen`, the entry and the client |
| SC-06, SC-07 | `AlertsScreen` and `Pager`, with the address |
| SC-08, SC-09 | `useTitles` |
| SC-11 | The entry |
| SC-12 to SC-16 | The entry, `AmountForm`, `useSubmit` and the messages |
| SC-17 to SC-20 | The entry, `useSubmit` and the messages |
| SC-21 to SC-24 | `NotificationsScreen`, `Pager` and `useTitles` |
| SC-25, SC-26 | The session, `LoadFailed` and the messages |

## 10. Effects on the rest

- **The code of feature 09** changes in two places: the Catalogue uses `Pager`, and `PriceAlertForm` uses `AmountForm`. The texts of the paging move from the Catalogue to a group of their own.
- **The documentation:** the vocabulary of feature 09 is not edited. The new words, "notificación", "cancelar", "disparada" and "cancelada", are in the texts file.
- **The backend** is not touched, apart from the test that runs the client against it.

## 11. The stops of the build

| Stop | What |
|---|---|
| 4a | The client, its types, the messages and the texts, with their tests and the one against the real application. No screen |
| 4b | The navigation, `Pager` and `useTitles`, and the two screens as readers: the lists, the filter, the paging and the titles |
| 4c | `AmountForm`, and changing and cancelling in the entry, with the notices |
| 4d | Verification in a real browser, including a PATCH through the development server, and the review |
