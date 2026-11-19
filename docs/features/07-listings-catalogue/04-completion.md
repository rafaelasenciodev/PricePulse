# 07 — Listings Catalogue: Completion (Stage 5)

Status: Approved

The close of the feature: what was built, the decisions and their status, how it was verified, what the review found, what it does not do and what comes next. It links to the documents of each stage and does not repeat them. It is the fourth feature developed with the [method of five stages](../README.md), and the one that gives the web interface of [ADR-0005](../../adr/0005-web-interface.md) something to show on its first screen.

## 1. Summary

A signed-in User reads the Listings that the system knows, in pages ordered by title and then by identifier. Each shows its identifier, its title, the name of its Retailer, its currency and its Current Price with the moment it was observed, or none. A User can also read one Listing. Reading changes nothing, and no request adds, changes or removes a Listing.

It runs end to end over HTTP with in-memory storage. It does not manage the Catalogue, search or filter it, or model Products and Retailers as entities. Those are listed in the [discovery](01-discovery.md).

## 2. What was built

| Stage | Result | Where |
|---|---|---|
| 1 Understand | 8 questions decided, 8 rules, one new term (Catalogue) and an extended one (Listing) | [Discovery and rules](01-discovery.md), [glossary](../../domain/ubiquitous-language.md) |
| 2 Scenarios | 21 Gherkin scenarios, 3 of them with several examples | [Scenarios](02-scenarios.feature) |
| 3 Design | No new rule of the domain, 2 use cases, one port that grows, 2 routes, 10 decisions | [Design](03-design.md) |
| 4a Use cases | `ListListings`, `ReadListing`, the view and the one function that makes the Current Price; the port gains `list`. The in-memory adapter had to follow so that the project still compiled | `backend/src/price-observations/application/` |
| 4b Port and adapter | The contract of `ListingCatalogue`: order, ties, pages and total, run against the in-memory adapter | `backend/tests/price-observations/catalogue/` |
| 4c Way in | `GET /listings`, `GET /listings/{listingId}`, a plugin with its own hook of Users, the optional group `catalogue`, the wiring and the demo Catalogue | `backend/src/price-observations/http/`, `backend/src/composition-root.ts`, `backend/src/main.ts` |
| 4d Verification and review | Traceability of the seventh feature, 9 findings | Sections 4 and 5 |

The feature changed 14 source files (394 insertions, 42 deletions; 5 new) and 12 test files (1,115 insertions, 19 deletions; 5 new). No dependency was added.

## 3. Decisions and their status

The status of every decision of the discovery and the design is recorded here, and only here.

| Decision | Status | Evidence |
|---|---|---|
| Q1 Scope: read the Listings with their Current Price, and one | Verified | The 21 scenarios |
| Q2 A Listing has a title and the name of its Retailer, as text | Verified | SC-01, and the contract of the port |
| Q3 Any signed-in User reads it, and a Provider's token is not valid | Verified | SC-18, SC-19, and the wiring with real Sessions |
| Q4 A Listing shows its Current Price and its Observed At, or none | Verified | SC-04 to SC-09, and the tests that make the alerts agree |
| Q5 By title and then by identifier, in pages | Verified | SC-02, SC-10 to SC-13, and the contract of the port |
| Q6 No searching or filtering | Verified | SC-14: a `search` parameter is rejected |
| Q7 One Listing can be read | Verified | SC-15 to SC-17 |
| Q8 The demo Catalogue has six Listings | Implemented | `main.ts` has no test: checked by hand |
| D1 The reading is in the module of Price Observations | Verified | The architecture test keeps the layers. No test pins down the module |
| D2 `CatalogueListing` gains its text and the port gains `list` | Verified | The contract of the port |
| D3 The order is the lower-cased title and then the identifier, by code | Verified | The contract, with an accent after `z` as an example |
| D4 The Current Price of each Listing is read with `findLatest` | Verified | The use case reads the Listings of the page and no others |
| D5 Two routes, a plugin of their own and an optional group | Verified | The API and documentation tests, with and without the group |
| D6 Nothing writes to the Catalogue: no route exists | Verified | SC-21, over the API and at the Composition Root |
| D7 `addListing` takes the text as an optional argument and refuses an empty one | Verified | The tests of the adapter |
| D8 The reading of the numbers of a page is written once for the module | Verified | The history and the Catalogue use it, and the tests of both pass |
| D9 The Current Price is made by one function of the application layer | Verified | Tests that make the Catalogue and the alerts agree. The rule is still written twice: see finding 1 |
| D10 The demo Catalogue has six Listings and keeps the three identifiers | Implemented | By hand, as Q8 |

### Effect on the other features

- **Price Observations.** `CatalogueListing` changed shape. Recording a price and reading the history use only its currency and did not change. Three test doubles of the port, in three test files, had to follow it.
- **The History.** Its route uses the shared reader of page numbers, and it lost its private copy.
- **The guard of traceability.** The tests of the Catalogue were counted as feature 02's, because it owned all of the folder but one. It now leaves this folder out.
- **Accounts and Price Alerts.** Nothing changed.

## 4. Verification

- **Tests:** 1,281 test cases in 70 files, all passing, of which 122 are of this feature: the use cases 26, the contract and the adapter 24, the API 47, the wiring 18, and 7 of the traceability guard.
- **Scenarios:** all 21 have tests, read from the titles, with no exemption.
- **Coverage, as a diagnostic:** 99.6 % of statements, 97.6 % of branches, 99.8 % of functions and 99.7 % of lines. What is not covered is the tie-break between two identifiers or two Providers that are equal, which cannot exist.
- **Deliberate errors:** 74 changes were made by hand, one at a time, and the tests were run after each. **66 were detected,** 3 survived at first and were closed with the contract, and 5 change nothing a caller can see. The contract alone, run against its adapter, detected all 11 that were tried on `list` and `find`. Four holes of my own tests were closed on the way: the empty-text refusal and the capital in the title, an empty `offset`, and the documented codes.
- **By hand:** the development server was started with the real hash. The six Listings came in the right order with their prices, a page of two with an offset gave the right two and the total, a Listing that does not exist gave 404, and the token of a Provider, a fixed token and no token gave 401. A POST to `/listings` found no route. A Listing chosen in the Catalogue got an alert, a price recorded by the Provider reached it, the Catalogue showed the new price and a Notification appeared. The documentation listed the new tag and routes, and the log held no secret.

## 5. Architecture review

Dependencies point inward and the architecture test passes. The feature adds no rule of the domain and no dependency, and its group follows the pattern of the others.

| # | Finding | Outcome |
|---|---|---|
| 1 | The rule of the Current Price is written twice, in the Composition Root and in the use cases of the Catalogue | **Accepted** (decision D9). Tests make the two agree, and a change to either one makes one of them fail |
| 2 | `findLatest` scans every observation, and a page reads it for each Listing. Measured for a page of 100 Listings: 0.8 ms with 1,000 observations, 2.7 ms with 10,000 and 26.5 ms with 100,000. A million would take about 0.26 s, extrapolated and not measured | **Noted.** Irrelevant with the demo data. A database needs an index by Listing and Observed At, and one query for the page |
| 3 | Paging by `offset` can skip or repeat a Listing if the Catalogue changes between two pages, and a page and its total are two answers of one read | **Noted** for persistence. The Catalogue does not change while the system runs |
| 4 | The order uses `toLowerCase()` and the codes of the characters, and a database may lower some characters differently. A letter with an accent comes after `z` | **Accepted** (decision D3). A database adapter must use a binary collation, and the contract is what holds it to it |
| 5 | The title and the Retailer are free text with no limit of length or characters | **Noted.** The interface must escape them, and a database needs a limit |
| 6 | The view does not check that the currency of the price is the one of the Listing. Only the recording does | **Noted.** The Catalogue does not change while the system runs |
| 7 | HEAD is served on both routes, because Fastify adds it for every GET. It asks for a User, only reads, and is not documented | **Accepted** |
| 8 | The module of Price Observations now holds the Catalogue | **Accepted** (decision D1). It is reconsidered if the Catalogue gets rules of its own |
| 9 | The demo Catalogue has no test | **Noted.** Checked by hand |

## 6. What the process revealed

| When | What | Result |
|---|---|---|
| 4a | Three test doubles of other features implemented `ListingCatalogue` and broke when the port grew | Anticipated in the design. They fail if the use case that does not need `list` ever calls it |
| 4a | The in-memory adapter had to change before its stage, so that the project compiled | Said at the time. Its contract came in 4b, which closed the 3 survivors of 4a |
| 4c | An empty `offset` would have been read as 0, and nobody checked that the documented codes are the answered ones | Two tests of my own were added |
| 4c | The guard of traceability counted the tests of the Catalogue as feature 02's, as it had counted those of Accounts as feature 01's | An exclusion in each owner. The same defect has now appeared twice |
| 4d | The cost of reading the Current Price was only suspected | **Measured before it was written down** |
| 4d | I announced a hole in the tests of feature 03 and it did not exist: the alert tolerates a Price that is null | Retracted at once, with the test I had added for it |
| 4d | I announced 22 tests for one file and they were 15, as 7 belong to the guard | Corrected |

## 7. Known limitations

- Storage is in memory ([ADR-0003](../../adr/0003-persistence-deferred.md)), so the contract of the order and the pages has been tested only there.
- The Catalogue cannot be changed over HTTP, cannot be searched or filtered, and its Listings have no images, categories or links.
- A Listing never observed and one that is unavailable now look the same.
- A page costs a read for each Listing of it, and the cost of that read grows with the number of observations.
- The title and the Retailer are not validated beyond being non-empty in the in-memory adapter.
- `main.ts` has no test. The tests have run on one version of Node, 25.9, no continuous integration runs them, and the repository has no licence.

## 8. Documentation volume

The documents of the first three stages have 468 lines (discovery and rules 151, scenarios 212, design 105). The previous feature had 581 and the one before 470, so it is 19 % fewer than the last one. The discovery and the scenarios still go over the 150 lines that the method suggests, by one line and by sixty-two.

## 9. Follow-up

**Next features,** in the order agreed so far: a small feature of backend that moves the session to a cookie, as [ADR-0005](../../adr/0005-web-interface.md) decides; then the web interface, with its first screens on this Catalogue; then persistence and the deployment, each with its ADR, and the final README, slides and video.

**For the persistence feature.** `ListingCatalogue.list` is one query ordered by lower-cased title and then identifier, with a binary collation, and its contract is the check. The latest observation of a page is one query. The index of observations by Listing and Observed At serves both this and the Current Price of the alerts. Run the contract against the database adapter.

## 10. Completion checklist

- [x] Stages 1 to 4 completed
- [x] Documentation of stage 5 written (this document)
- [x] This document is approved by the author
- [x] The README and the documentation indexes describe this feature
- [ ] The feature is merged into `develop` with `--no-ff`, and `develop` into `main` and tagged (done by the developer, [ADR-0002](../../adr/0002-branching-model.md))
- [ ] A licence is chosen before the repository is published
