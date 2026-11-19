# 05 — Notifications and Price History: Design (Stage 3)

Status: Approved. Every decision in section 6 has status Accepted.

The design of the feature: the model, the use cases, the ports and the way in. It builds on the [discovery and rules](01-discovery.md) and the [scenarios](02-scenarios.feature). It does not describe persistence technology.

## 1. The model

Two reads over what is already stored. The only new concept is the range of the history.

| Element | Change | Rule |
|---|---|---|
| `Notification`, `PriceObservation` | None. They are read as they are | BR-03, BR-05 |
| `ObservedAtRange` (new Value Object, module of Price Observations) | A start and an end, either of which may be absent. `includes(observedAt)` is true from the start, included, until the end, excluded. It cannot be made with a start that is not before its end | BR-06 |

The inclusive start and the exclusive end are a business rule, so they live in the model and not in each adapter: an adapter only has to answer the question the range asks.

| Where each rule lives | |
|---|---|
| BR-01, BR-02 | Application and port: the query is by owner, and the order is part of the port |
| BR-03 | The view, which shows what the Notification states, and has no read state |
| BR-04 | The way in: the authentication of Users, and not of Providers |
| BR-05 | Port: every stored observation, ordered by Observed At |
| BR-06 | Domain (`ObservedAtRange`) and application (the text is read as instants) |
| BR-07 | Application: the Listing is looked up |
| BR-08 | The way in (the bounds), and the port (the page and the total) |
| BR-09 | Nothing to model: the use cases have no port that writes |

## 2. Use cases

| UC | Input | Output | Flow |
|---|---|---|---|
| **UC-01 List my Notifications** (module of Price Alerts) | `owner`, `limit`, `offset` | `items` (views), `total`, `limit`, `offset` | One query by owner, ordered by the Observed At of the price that reached the target, newest first, and by alert identifier on a tie. No application errors |
| **UC-02 Read the Price History** (module of Price Observations) | `listingId`, `from` and `to` (optional text), `limit`, `offset` | `items` (views), `total`, `limit`, `offset` | 1. The Listing exists, or `ListingNotFound`. 2. `from` and `to` are read as instants and made a range, or `InvalidRange`. 3. One query by Listing and range, newest Observed At first |

The views are the ones that already exist: `NotificationView` (it moves from the evaluation to its own file, as the alert view did) and `PriceObservationView`. Step 1 of UC-02 comes before step 2, as the existence of the Listing comes first when a price is recorded.

| Application error | Rules | When |
|---|---|---|
| `ListingNotFound` (existing, Price Observations) | BR-07 | The Listing does not exist |
| `InvalidRange` (new, Price Observations) | BR-06 | `from` or `to` is not an instant, or `from` is not before `to`. The message tells which |

## 3. Ports

| Port | Operation | Contract |
|---|---|---|
| `NotificationRepository` | `findByOwner(owner, { limit, offset })` | New. The page and the `total` of the owner's Notifications, newest Observed At first, then by alert identifier. The limit and the offset are valid: the caller checks them |
| `PriceObservationRepository` | `findByListing(listingId, { range, limit, offset })` | New. The page and the `total` of the observations of the Listing that the range includes, newest Observed At first, then by Provider so that two at the same moment keep an order. `range` may be unbounded |
| `ListingCatalogue` | `find(listingId)` | Existing. UC-02 uses it to know that the Listing exists |
| `UserAuthenticator` (HTTP layer of Price Observations) | `isUser(token)` | New. Whether the token belongs to a signed-in User. It does not say which one: the history belongs to nobody |

## 4. Concurrency and transaction boundary

Both are reads. They write nothing and need no transaction. A page and its total are two answers of the same query: a recording that happens between them can make the total differ by one from what a later page shows, and it is accepted.

## 5. The way in

| Request | Use case | Answers |
|---|---|---|
| `GET /notifications?limit=&offset=` | UC-01 | 200, 400, 401 |
| `GET /listings/{listingId}/price-observations?from=&to=&limit=&offset=` | UC-02 | 200, 400, 401, 404, 422 |

- **Pages:** `limit` 20 by default and 100 at most, `offset` from 0, as in the list of alerts. An unknown parameter is rejected. The numbers of the URL are read as numbers by a hook of the route, as there.
- **Authentication:** the list of Notifications is in the module of Price Alerts and uses its hook. The history is in its own plugin of the module of Price Observations, with its own hook, because the hook of the routes of Providers would ask for a Provider. The two plugins share a path with different methods, and the hooks do not mix.
- **Answers:** `{ items, total, limit, offset }` in both. A range that is not valid answers 422 `INVALID_RANGE`, and a Listing that does not exist 404 `LISTING_NOT_FOUND`, as when a price is recorded.

## 6. Decisions

| ID | Decision | Status |
|---|---|---|
| 1 | `NotificationRepository` and `PriceObservationRepository` each gain one operation to read a page, with its total | Accepted |
| 2 | `ListNotifications` lives in the module of Price Alerts, and `ReadPriceHistory` in the module of Price Observations | Accepted |
| 3 | `ObservedAtRange` is a Value Object of the module of Price Observations | Accepted |
| 4 | The history has its own plugin, with its own hook and a port `UserAuthenticator`. The Composition Root gives it the authentication of Users | Accepted |
| 5 | The list of Notifications joins the existing group `priceAlertManagement`, and the history is a new optional group of `buildApp` | Accepted |
| 6 | An invalid range is an application error, `InvalidRange`, and answers 422 | Accepted |
| 7 | The helper that reads the numbers of a URL, and the bounds of the pages, are written once in each module. There is no shared HTTP layer | Accepted |

Alternatives that were weighed:

- **Decision 3:** two checks inside the use case would do. But whether the start is included and the end excluded is the rule the scenarios describe, and a database adapter must give the same answer, so it is written once and tested without any adapter.
- **Decision 4:** the module of Price Observations cannot import the `Authenticator` of Price Alerts, and moving it to `shared` would break that module's rule of holding only domain. A port of its own, as small as what it needs, keeps the features apart, and the Composition Root adapts one to the other. Putting the history in the module of Price Alerts was rejected: it is data of the observations.
- **Decision 7:** a shared HTTP layer would need a new rule of the architecture. With two modules the duplication is small. It is reviewed with a third.

## 7. Where each scenario is handled

| Scenario | Handled by |
|---|---|
| SC-01 to SC-04 | UC-01, with the order, the owner in the query and the empty page |
| SC-05 | UC-01: the Notification is listed whatever the state of its alert |
| SC-06, SC-19 | The page and the total of the ports |
| SC-07, SC-08 | The hooks of each plugin: a User is required, and a Provider is not one |
| SC-09 | The use cases have no port that writes |
| SC-10, SC-12, SC-13 | UC-02, step 3: by Listing, ordered by Observed At and not by arrival |
| SC-11, SC-14 | UC-02: an absent Price is shown, and a Listing without observations has an empty page |
| SC-15 | UC-02, step 1 |
| SC-16 to SC-18 | UC-02, step 2, and `ObservedAtRange` |
| SC-20 | The schemas of the way in |

## 8. Effects on the other features

- **Feature 03.** `NotificationRepository` gains an operation, and so does its in-memory adapter. The Evaluation does not change, and `NotificationView` moves to its own file.
- **Feature 02.** `PriceObservationRepository` gains an operation, and the module gains a plugin and a port. Recording a price does not change.
- **Feature 04.** `priceAlertManagement` gains `listNotifications`, which changes the tests that build it.

## 9. Carried to the build

The contract tests of the two new ports, including the order, the total and the range. The schemas, the codes of the errors (`INVALID_RANGE`), the documentation of the two routes with their tags, the demo data (a Notification to see) and the README.
