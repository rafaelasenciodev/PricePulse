# 01 — Create Price Alert: Business Rules (Phase 1)

Status: Approved

Business rules of the feature, expressed in the project's [Ubiquitous Language](../../domain/ubiquitous-language.md). Each rule traces to a decision in the [feature discovery](00-discovery.md).

## Who and on what

| ID | Rule | Origin |
|---|---|---|
| BR-01 | Only a User who has signed in can create a Price Alert, and the Price Alert belongs to that User. | Q8a |
| BR-02 | A Price Alert can only be created for a Listing that exists. | Q1, Q2 |

## Validity of the Target Price

| ID | Rule | Origin |
|---|---|---|
| BR-03 | The Target Price must be greater than zero. | Q6b |
| BR-04 | The Target Price is expressed in the Listing's currency and cannot have more decimal places than that currency allows. The User does not choose the currency and there is no conversion. | Q6a, Q6b |
| BR-05 | If the Listing has a Current Price and the Target Price is reached by it (Current Price is less than or equal to the Target Price), creation is rejected. The comparison uses the Current Price at the moment the request is processed. | Q4a, Q4b |
| BR-06 | If the Listing has no Current Price (it is unavailable or its price is not known), creation is allowed and BR-05 does not apply. | Q5 |

## Duplicates

| ID | Rule | Origin |
|---|---|---|
| BR-07 | A User can have at most one Active Price Alert per Listing. | Q3 |
| BR-08 | If a User repeats a creation for the same Listing with the same Target Price, the existing Active Price Alert is returned and no new one is created. With a different Target Price, the request is rejected as a Duplicate. This rule takes precedence over BR-05: the existing Price Alert is returned even if the Current Price now reaches the Target Price. | Q10, Q3; precedence decided in Phase 2 |

## Outcome and limits

| ID | Rule | Origin |
|---|---|---|
| BR-09 | A newly created Price Alert is Active. | Q7a |
| BR-10 | Creating a Price Alert does not require a verified email, nor that the Listing is in a Watchlist. There is no limit on the number of Price Alerts per User. | Q8b, Q8c, Q11 |
| BR-11 | A Price Alert is one-shot: when its Target Price is reached and the User is notified, it stops being Active. This rule is applied by later features. It is stated here because it defines what Active means and lets BR-07 allow a new Price Alert afterwards. | Q7b |

## Notes

- When several rules are broken by the same request, the order in which they are reported is not a business rule. It is defined in the use case contract (Phase 4).
- Design consequences of the discovery decisions (for example, that a Price Alert stores no notification channel) are not business rules and are handled in domain modelling.
