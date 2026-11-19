# Ubiquitous Language

Status: Approved

The agreed vocabulary of the project. Each term has one meaning, used in documentation, code and conversation. Terms enter this glossary during Phase 1 of the feature that needs them. Terms that belong to features not yet discussed are not listed.

| Term | Definition | Introduced in |
|---|---|---|
| **User** | A registered person who has signed in. A User creates and owns Price Alerts. | [Feature 01](../features/01-create-price-alert/00-discovery.md) |
| **Product** | An article, independent of who sells it. | Feature 01 |
| **Retailer** | A seller that offers Products. | Feature 01 |
| **Listing** | A Retailer's offer of a Product. A Price Alert watches a Listing. | Feature 01 |
| **Price** | An amount of money in a currency. | Feature 01 |
| **Current Price** | The Price of the Price Observation of a Listing with the greatest Observed At. A Listing may have none: a Listing whose latest Price Observation is unavailable has no Current Price, and neither does a Listing with no Price Observation. | Feature 01, refined in [Feature 02](../features/02-price-observation/00-discovery.md) |
| **Target Price** | The Price at which a User wants to be notified. It is expressed in the Listing's currency. | Feature 01 |
| **Price Alert** | A User's request to be notified when the Current Price of a Listing reaches a Target Price. | Feature 01 |
| **Target reached** | The condition that a Current Price is less than or equal to a Target Price. A Price equal to the Target Price reaches it. | Feature 01 |
| **Active** | The state of a Price Alert that has been created and has not ended. It is the only state that Feature 01 produces. | Feature 01 |
| **Triggered** | The state of a Price Alert whose Target Price was reached and whose User was notified. A Triggered Price Alert is no longer Active. Only a later feature makes a Price Alert Triggered; Feature 01 needs the state to tell such alerts apart from Active ones. | Feature 01 |
| **Duplicate** | An attempt to create a Price Alert when the User already has an Active one for the same Listing. | Feature 01 |
| **Price Observation** | A record of whether a Listing was available at a point in time and, if it was, its Price. | Feature 02 |
| **Observed At** | The moment at which a Provider saw the state of a Listing. It is the time that orders Price Observations, not the moment they are received. | Feature 02 |
| **Provider** | A source that supplies Price Observations, identified by an identifier. Today it is the simulator. A Provider is not a User, and it is not a Retailer. | Feature 02 |
| **Conflict** | An attempt to record a Price Observation with the same Provider, Listing and Observed At as a stored one, but with different content. | Feature 02 |

## Vocabulary decisions

- **User** is the term for the person who owns an alert. "Shopper" is an informal description in the product vision, not a domain term.
- **Listing** is used instead of "Product Listing".
