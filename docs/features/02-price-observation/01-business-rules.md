# 02 — Price Observation: Business Rules (Phase 1)

Status: Approved

Business rules of the feature, expressed in the project's [Ubiquitous Language](../../domain/ubiquitous-language.md). Each rule traces to a decision in the [feature discovery](00-discovery.md).

## Who and on what

| ID | Rule | Origin |
|---|---|---|
| BR-01 | Only an authenticated Provider can record a Price Observation. The Price Observation carries the identifier of that Provider, taken from its identity and never from the content of the request. | Q10a, Q11a, Q11b |
| BR-02 | A Price Observation can only be recorded for a Listing that exists. | Q7 |

## Content of a Price Observation

| ID | Rule | Origin |
|---|---|---|
| BR-03 | A Price Observation states whether the Listing is available at its Observed At. An available Listing has a Price; an unavailable one has none. A Price that is not known is expressed as unavailable, never as zero. | Q1 |
| BR-04 | The Price of a Price Observation is greater than or equal to zero. A negative Price is rejected. A Price of zero is valid and means free. | Q6a |
| BR-05 | The Price is expressed in the Listing's currency and cannot have more decimal places than that currency allows. A different currency is rejected, and there is no conversion. | Q6b, Q6c |

## Storage and the Current Price

| ID | Rule | Origin |
|---|---|---|
| BR-06 | Every valid Price Observation is stored, including one whose Price and availability equal those of the previous one. | Q4 |
| BR-07 | The Current Price of a Listing is the Price of the Price Observation with the greatest Observed At. If that Price Observation is unavailable, the Listing has no Current Price. A Listing with no Price Observation has no Current Price either. | Q3a, Q1, Q8 |
| BR-08 | A Price Observation whose Observed At is earlier than that of the latest one is accepted and stored. It does not change the Current Price. | Q3b |

## Resends

| ID | Rule | Origin |
|---|---|---|
| BR-09 | A Price Observation is identified by its Provider, its Listing and its Observed At. If the same Provider records again a Price Observation with that identity and the same content (the same availability and, when available, the same Price), the existing one is returned and nothing is duplicated. | Q5 |
| BR-10 | If the identity is the same but the content differs, the request is rejected as a Conflict and the stored Price Observation is not changed. | Q5 |

## Boundaries

| ID | Rule | Origin |
|---|---|---|
| BR-11 | Recording a Price Observation does not evaluate Price Alerts and emits no event. | Q9 |

## Time and Providers

| ID | Rule | Origin |
|---|---|---|
| BR-12 | A Price Observation whose Observed At is later than the moment it is recorded is rejected, because it would become the Current Price and stay so. A small tolerance for differences between clocks is allowed. The value of the tolerance is a design detail, set in the use case contract (Phase 4), not a business rule. | Q14 |
| BR-13 | The set of Providers is closed and today contains a single one, the simulator. BR-07 does not say which Price Observation defines the Current Price when two Providers record the same Listing with the same Observed At and different content. A second Provider is therefore not admitted until a rule decides it. | Q13, Q11d |

## Notes

- When several rules are broken by the same request, the order in which they are reported is not a business rule. It is defined in the use case contract (Phase 4).
- BR-07 changes where feature 01 obtains the Current Price, not the rules of feature 01 (Q8). The Current Price used by BR-05 and BR-06 of feature 01 is the one defined here.
- Design consequences of the discovery decisions (for example, that the Provider is an identifier and not an entity, Q11d) are not business rules and are handled in domain modelling.
- Simulating prices, scheduling, price history and the shape of the HTTP endpoint are outside this feature or decided in later phases (Q2, Q10d, Q12).
