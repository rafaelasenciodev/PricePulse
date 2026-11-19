# Candidate domain concepts

Status: Draft. **These are candidate terms only.** They are not entities, Value Objects or aggregates. Nothing here is modelled yet (that is Phase 3). Working definitions are hypotheses to be confirmed or rejected in Phase 1, when they move into the Ubiquitous Language.

| Candidate | Working definition (hypothesis) | Main ambiguity |
|---|---|---|
| **User** | A registered person who owns alerts | Is the account in this bounded context or only an identity reference? |
| **Product** | A thing a shopper wants, independent of who sells it | Identity: by EAN? by title? by internal catalogue entry? |
| **Retailer** | A seller of products | Simulated only for now. Fictitious names? |
| **Product Listing** | A specific product offered by a specific retailer, with a price | Is it a sub-part of Product, or independent? Who owns its lifecycle? |
| **Price** | An amount of money in a currency | Currency, precision, tax-inclusive or not |
| **Availability** | Whether a listing can currently be bought | Does an unavailable listing have a price? |
| **Price Observation** | A recorded price (and availability) of a listing at a point in time | Recorded by whom? One per check, or only on change? |
| **Price Provider** | A source that supplies observations (simulator now, real adapters later) | Boundary: does the domain even know it exists? |
| **Price History** | The sequence of observations for a listing | Derived view or stored concept? |
| **Price Alert** | A user's standing request to be notified when a listing reaches a target price | Alert on a listing or a product? Lifecycle? One-shot or recurring? |
| **Target Price** | The price at which the user wants to be notified | Whether the threshold is inclusive or exclusive; relation to current price |
| **Watchlist** | A user's collection of tracked listings | Separate from alerts? Needed in feature 1? |
| **Alert Evaluation** | Deciding whether a new observation satisfies an alert | Not in feature 1; recorded to avoid blocking design |
| **Triggered Alert** | An alert whose condition has been met | Not in feature 1 |
| **Notification** | A message informing a user that an alert condition was met | Channel(s); delivery state |
| **Price Check** | A scheduled act of asking a provider for the current price | Not in feature 1 |

## Relationships (hypotheses, not decisions; see OQ-01, OQ-02 and OQ-03)

```
Retailer 1 ── * Product Listing * ── 1 Product
Product Listing 1 ── * Price Observation
User 1 ── * Price Alert * ── 1 Product Listing
```
