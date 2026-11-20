# 07 — Listings Catalogue: Design (Stage 3)

Status: Approved. Every decision in section 5 has status Accepted.

The design of the feature: the model, the use cases, the ports and the way in. It builds on the [discovery and rules](01-discovery.md) and the [scenarios](02-scenarios.feature). It describes no persistence technology.

## 1. The model

There is no new rule of the domain, so no new Value Object or entity. A Listing in the Catalogue gains two texts, and what is new is how it is read.

| Element | What it is | Rule |
|---|---|---|
| `CatalogueListing` | The Listing as the Catalogue holds it: identifier, title, name of the Retailer and currency. The title and the name are text for people, and nothing else uses them | BR-02, BR-08 |
| `ListingView` | The Listing as a caller sees it: those four, and `currentPrice`, which is `{ amount, currency, observedAt }` or `null` | BR-02, BR-03 |
| The order | Titles compared in lower case, letter by letter in the order of their codes, and then identifiers in the order of their codes. Accents and capitals are not given a local order, since it would depend on the machine and a database would not match it | BR-01 |
| The Current Price | The one that BR-07 of feature 02 defines: the price of the observation with the greatest Observed At, or none when that observation has no Price or there is none | BR-03 |

| Where each rule lives | |
|---|---|
| BR-01, BR-07 | The port `list` answers a page in the order of BR-01, and the use case passes `limit` and `offset` |
| BR-02, BR-03 | The use cases: they join the Listing and its latest observation into the view |
| BR-04 | `ReadListing`, with the `ListingNotFound` that the module already has |
| BR-05 | Nothing in the two use cases writes |
| BR-06 | The hook of the plugin, which reads the token and asks `UserAuthenticator`, as the Price History does |
| BR-08 | The absence of any route or use case that writes to the Catalogue |

## 2. Use cases

Both are in the module of Price Observations, which holds the Catalogue and the latest observation of each Listing.

| UC | Input | Output | Flow |
|---|---|---|---|
| **UC-01 List Listings** | `limit`, `offset` | `items` (`ListingView`), `total`, `limit`, `offset` | 1. The Catalogue gives the page in the order of BR-01 and the total. 2. For each Listing, its latest observation is read and its Current Price is made. 3. The view of each is returned |
| **UC-02 Read a Listing** | `listingId` | `ListingView` | 1. The Listing is in the Catalogue, or `ListingNotFound`. 2. Its Current Price is made as in UC-01 |

No application error is new. The way in checks `limit` and `offset`, as the other lists do, so an invalid one never reaches a use case.

## 3. Ports

| Port | Operation | Contract |
|---|---|---|
| `ListingCatalogue` | `find(listingId)`, as today, and now **`list({ limit, offset })`** | `find` gives the `CatalogueListing`, or null. `list` gives `{ items, total }`: a page in the order of BR-01, `total` counting every Listing. Two Listings never come in an order that depends on how they were stored |
| `PriceObservationRepository` | `findLatest(listingId)`, as today | Unchanged. One call for each Listing of the page, so up to 100 |

The in-memory `addListing` takes the title and the name as an optional third argument. Without it the title is the identifier and the name is "Unknown retailer", so the tests of the other features, which only need a currency, do not change. With it, an empty text is refused: the Catalogue is filled by the system, and a Listing without a title would be a mistake of whoever fills it.

## 4. Concurrency and transaction boundary

- Both use cases only read, so there is no transaction and nothing to repeat. Reading twice gives the same answer unless a price was recorded in between (SC-09).
- A page and its total are two answers of the same query. In memory they cannot differ. A database must answer both in one read, or accept that they can.
- Offset paging can skip or repeat a Listing if the Catalogue changes between two pages. The Catalogue does not change while the system runs, so it is noted and not solved.
- The Current Price of a Listing is read after the page. A price recorded in between can make the answer one observation newer than the page. It is harmless, and it is noted.

## 5. The way in and decisions

| Request | Use case | Answers |
|---|---|---|
| `GET /listings?limit=&offset=` | UC-01 | 200, 400, 401 |
| `GET /listings/{listingId}` | UC-02 | 200, 401, 404 `LISTING_NOT_FOUND` |

A new plugin of the module has its own hook, which asks for a User, and a new optional group of `buildApp`, `catalogue`, like the other groups. Without the group the routes are not served or documented. They have the tag `Listings`. No other method is registered on these paths, so a POST, PUT, PATCH or DELETE has no route and the answer is the 404 of every unknown route (SC-21).

| ID | Decision | Status |
|---|---|---|
| 1 | The reading is in the module of Price Observations, in two use cases, and no new module is made | Accepted |
| 2 | `CatalogueListing` gains its identifier, title and Retailer name, and `ListingCatalogue` gains `list`, in a defined order | Accepted |
| 3 | The order is the lower-cased title and then the identifier, both by code, with no local order | Accepted |
| 4 | The Current Price of each Listing is read with the `findLatest` that exists, and `currentPrice` is `null` when there is none | Accepted |
| 5 | The routes `GET /listings` and `GET /listings/{listingId}`, in a plugin of their own and an optional group `catalogue` | Accepted |
| 6 | Nothing writes to the Catalogue over HTTP: no route is registered, and the answer is the 404 of an unknown route | Accepted |
| 7 | The in-memory `addListing` takes the title and the name as an optional argument, and refuses an empty one | Accepted |
| 8 | The helper that reads the numbers of a page moves to one file of the HTTP layer of the module, and the history and the Catalogue use it | Accepted |
| 9 | The reading of the Current Price from the latest observation is one function of the application layer, used by both use cases. The one of the Composition Root is not touched | Accepted |
| 10 | The demo Catalogue has six Listings: the three that exist keep their identifiers, and three more are added, in `EUR` and `USD` | Accepted |

Alternatives that were weighed:

- **Decision 1:** a module `catalogue`. It would hold the port that today is in Price Observations, but it moves code that works, and the new module would still need the latest observation of the other. It is reconsidered if the Catalogue grows rules of its own.
- **Decision 3:** the order of the machine (`localeCompare`). It reads better for accents, but it changes with the machine and a database collation would not match it.
- **Decision 4:** one read of the latest observation of every Listing of the page. It is one query in a database, and it is a new operation of a port that does not need it in memory. It is noted for persistence.
- **Decision 7:** a title required in every `addListing`, which touches 47 calls in 22 files for text that those tests do not use.
- **Decision 9:** the function of the Composition Root used by both, which would couple this module to the Composition Root and touch feature 03.

## 6. Where each scenario is handled

| Scenario | Handled by |
|---|---|
| SC-01 to SC-03 | UC-01 and the order of `list` |
| SC-04 to SC-09 | The Current Price of the view, and the latest observation of the port |
| SC-10 to SC-14 | UC-01 with the page, and the schema of the route for the bounds and the unknown parameter |
| SC-15 to SC-17 | UC-02 and the `ListingNotFound` of the module |
| SC-18, SC-19 | The hook of the plugin, which runs before the schema |
| SC-20 | The two use cases have no write |
| SC-21 | The absence of other routes |

## 7. Effects on the other features

- **Price Observations.** `CatalogueListing` changes shape, but recording a price and reading the history use only its currency. The documentation tests that list the paths gain two.
- **Price Alerts and Accounts.** Nothing changes.
- **`main.ts`.** The Catalogue is filled with titles and Retailers, and with three more Listings and their first prices.
- **The README.** Two routes, the demo Catalogue and the interface section.

## 8. Carried to the build

The schema of `currentPrice` as a value that may be null, and its documentation. A contract test of `ListingCatalogue.list`: the order, the ties, the pages and the total. The names and prices of the demo Listings. A traceability entry for the seventh feature.
