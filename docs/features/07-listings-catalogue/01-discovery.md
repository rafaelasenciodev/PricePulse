# 07 — Listings Catalogue: Discovery and Business Rules (Stage 1)

Status: Approved. Every question below has a **Decision** line with status Accepted. *Lean* lines record the proposal that was discussed.

## 1. The business problem

A User can create a Price Alert only for a Listing whose identifier they already know. The API does not list the Listings that exist, and it does not show what each one offers or its Current Price. Nobody can choose what to watch, and a web interface ([ADR-0005](../../adr/0005-web-interface.md)) would have nothing to show on its first screen.

The system needs to let a User see which Listings exist, what each one is, and at what price, so that they can choose one.

## 2. Actors and goal

| Actor | Role |
|---|---|
| **User** | Reads the catalogue, and then creates an alert for a Listing they chose |
| System | Holds the Listings and answers with their Current Price |
| Provider | Not an actor. It reports prices, and does not read or change the catalogue |

**Goal:** "See which Listings exist and at what price, so that I can choose one to watch."

## 3. Scope (proposed)

**Is:** reading the Listings of the catalogue in pages, with the Current Price of each, and reading one Listing. A Listing gains a title and the name of its Retailer, so that a person can tell them apart. The development server starts with a larger fictitious catalogue.

**Is not:** adding, changing or removing Listings, Products as entities of their own, searching or filtering, categories, images or links to a retailer, and the Price History, which exists. Each is a separate feature or decision.

**Scope approved** for stage 1 (see section 9).

## 4. What is already established

| Fact | Source |
|---|---|
| A Listing is a Retailer's offer of a Product. A Product is context for the person and nothing an alert points at. Managing the catalogue was left out | Feature 01, Q1; glossary |
| A Listing in the catalogue holds only its identifier and its currency. It is held in memory and filled by `main.ts` and by the tests. No route reads it and no use case adds one | `ListingCatalogue`, `InMemoryListingCatalogue`, `main.ts` |
| The catalogue is a port of the module of Price Observations, used to record a price and to read the history. Price Alerts have their own reader of Listings, fed by the Composition Root with the currency and the Current Price | `composition-root.ts` |
| The Current Price is the price of the latest Price Observation of the Listing. A Listing whose latest observation has no Price, or that has none, has no Current Price | Glossary, BR-07 of feature 02 |
| Lists are read in pages: `limit` (20 by default, 100 at most), `offset` and the `total` | Features 04 and 05 |
| What a signed-in User reads needs the token of a User, and the token of a Provider is not valid | Feature 05, Q4; feature 06 |
| Storage is in memory | [ADR-0003](../../adr/0003-persistence-deferred.md) |

## 5. Ambiguities and questions

Questions marked **●** must be resolved before this stage can close.

### ● Q1 — How far does this feature go?

| Option | Includes | Trade-off |
|---|---|---|
| A | Read the Listings with their Current Price, and read one | What the interface needs, and nothing that changes data |
| B | A, plus adding and changing Listings over HTTP | It needs to say who may do it, and there are no roles |
| C | A, plus searching and filtering | Useful with a large catalogue, which this one is not |

*Lean:* **A**.

**Decision (Accepted):** A. Read the Listings with their Current Price, and read one. Nothing that changes data, and no searching or filtering.

### ● Q2 — What does a Listing show?

| Option | Shows | Trade-off |
|---|---|---|
| A | Its identifier and its currency, which is what exists | No new data, but an identifier such as `headphones-shop-a` is not what a person chooses by |
| B | A, plus a **title** and the **name of its Retailer**, as text | A person can tell the Listings apart. Product and Retailer stay context, as feature 01 decided |
| C | B, with Product and Retailer as entities of their own and a Listing pointing at them | Closer to the model, but it adds two entities and their relations for no rule that needs them now |

*Lean:* **B**. The title and the name take part in no other rule: alerts and observations still use the identifier and the currency.

**Decision (Accepted):** B. A Listing has a title and the name of its Retailer, as text. Product and Retailer are not entities.

### ● Q3 — Who can read the catalogue?

| Option | Effect |
|---|---|
| A | Any signed-in User. A token of a Provider is not valid, as for the Price History |
| B | Anyone, with no token |
| C | Users and Providers |

*Lean:* **A**. Nothing in the catalogue is secret, but a request with no token is refused everywhere else, and the interface asks for a sign-in first.

**Decision (Accepted):** A. Any signed-in User reads it, and the token of a Provider is not valid.

### ● Q4 — Does a Listing show its Current Price?

| Option | Effect |
|---|---|
| A | Yes: the price and the Observed At of the observation that gave it. A Listing with none shows none |
| B | No: only the Listing. The interface would read the history of each one to find its price |

*Lean:* **A**. A person chooses by price, and B turns a list into one request for each Listing. A Listing that was never observed and one that is unavailable now both show none, as the glossary defines them.

**Decision (Accepted):** A. A Listing shows its Current Price and the Observed At that gave it, or none. A Listing never observed and one that is unavailable now both show none.

### ● Q5 — In what order, and how many at a time?

| Option | Effect |
|---|---|
| A | By title, then by identifier, in pages with `limit` and `offset` as the other lists |
| B | By identifier |
| C | Those observed most recently first |

*Lean:* **A**. The order is stable and one a person can read. Which way capitals are ordered is settled in the design.

**Decision (Accepted):** A. By title and then by identifier, in pages as the other lists.

### ● Q6 — Can the list be searched or filtered?

*Lean:* **no**, not in this feature. The catalogue is small and fictitious. A text search is added when there is a catalogue that needs it.

**Decision (Accepted):** no searching or filtering in this feature.

### Q7 — Can one Listing be read on its own?

*Lean:* **yes**, with the same view as the list, and one that is not in the catalogue is not found. A screen of one Listing needs it.

**Decision (Accepted):** as proposed.

### Q8 — What does the demo catalogue hold?

*Lean:* about six Listings with fictitious titles and Retailers, in different currencies, and one with no Current Price. It is data of `main.ts`, as the three Listings of today are.

**Decision (Accepted):** as proposed.

## 6. Business rules

| ID | Rule | Origin |
|---|---|---|
| BR-01 | A signed-in User reads the Listings of the catalogue in pages, ordered by title and then by identifier. The answer says how many there are in all | Q1, Q5 |
| BR-02 | A Listing shows its identifier, its title, the name of its Retailer, its currency and its Current Price. The title and the name are text for people and take part in no other rule | Q2, Q4 |
| BR-03 | The Current Price of a Listing is the one that BR-07 of feature 02 defines, shown with the Observed At of the observation that gave it. A Listing with none shows none | Q4 |
| BR-04 | A signed-in User reads one Listing by its identifier. One that is not in the catalogue is not found | Q7 |
| BR-05 | Reading the catalogue changes nothing | Q1 |
| BR-06 | A request without a valid token of a User is not authenticated, and the token of a Provider is not valid. Authentication comes before anything else of the request | Q3 |
| BR-07 | A page holds `limit` Listings, 20 when it is not said and 100 at most, after skipping `offset` | Q5 |
| BR-08 | No request adds, changes or removes a Listing: the catalogue is filled by the system | Q1 |

## 7. New terms for the glossary

**Catalogue:** the set of Listings that the system knows. Only a Listing in it can be observed, watched or read. The definition of **Listing** gains its **title** and the name of its **Retailer**: text for a person to read, which take part in no rule. Both are in the glossary.

## 8. Carried to the design

- Which module reads the catalogue. The list needs the catalogue and the latest observation of each Listing, and both are in the module of Price Observations.
- What the port of the catalogue gains: the title and the name, and a read of one page of Listings in a defined order, so that a database can answer it.
- How capitals are ordered in the title, and what the page and the total mean when the catalogue changes between two requests.
- The route and the hook of Users, the documentation tag, and the data of the demo catalogue.

## 9. Exit criteria

- [x] Questions marked ● answered (Q1 to Q6)
- [x] Scope (section 3) approved
- [x] Rules (section 6) approved
- [x] The User approves moving to stage 2 (scenarios)
