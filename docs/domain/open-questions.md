# Open domain questions

Status: Draft (living document). A question is closed only after an explicit decision, which is recorded in the feature's discovery document. The feature 01 questions below are resolved; the cross-cutting questions remain open.

| ID | Question | Status | Resolved in |
|---|---|---|---|
| OQ-01 | What is a Product, and is it distinct from a Listing? | Accepted | [Feature 01 discovery](../features/01-create-price-alert/00-discovery.md), Q1 |
| OQ-02 | Does an alert target a Listing, a Product, or either? | Accepted | Q1 |
| OQ-03 | May several alerts exist for the same user and listing? | Accepted | Q3, refined by Q10 |
| OQ-04 | Is there a Watchlist separate from alerts? | Accepted | Q11 |
| OQ-05 | May the target price be at or above the current price? | Accepted | Q4 |
| OQ-06 | How do currencies work? | Accepted | Q6 |
| OQ-07 | What happens when a listing is unavailable or has no price? | Accepted | Q5 |
| OQ-08 | What makes an alert "active"; what lifecycle states exist? | Accepted | Q7 |
| OQ-09 | Can users pause, modify or delete alerts, and in which feature? | Accepted | Q7 |
| OQ-10 | What authorisation rules apply (ownership, verified email, limits)? | Accepted | Q8 |
| OQ-11 | Is an alert one-shot or re-arming after it triggers? | Accepted | Q7 |
| OQ-12 | Which notification channel(s) does an alert imply? | Accepted | Q9 |

## Cross-cutting questions (not specific to one feature)

| ID | Question | Status |
|---|---|---|
| XQ-01 | Will a real data provider ever be added, and which? | Deferred until a candidate provider's terms of use, cost and price-storage rules are evaluated |
| XQ-02 | Where do bounded-context boundaries fall (catalogue, pricing, alerting, identity, notifications)? | Open |
| XQ-03 | Is the user account a context of its own, or an external concept for now? | Open |
