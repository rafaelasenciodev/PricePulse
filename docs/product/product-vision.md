# Product Vision

Status: Draft

## Vision

PricePulse lets people watch the prices of products sold by retailers, understand how those prices have behaved over time, and be told when a product reaches a price they consider worth paying.

## The problem

Prices change often and without notice. Checking manually is tedious, and a single current price says nothing about whether it is actually a good one. People need *history* (is this cheap?) and *timely notification* (it is cheap now).

## Who it is for

- **Shopper (primary actor):** a registered user who wants to track products and be alerted at a target price.
- **Operator/administrator (secondary):** whoever runs the system and needs to see that price checks and notifications work. Needs are not yet defined.

## What makes this project distinctive

PricePulse is an engineering project, not a business proposal. It makes no claim about market opportunity and is not positioned against existing price-tracking services. Its value lies in how it is designed and built. Its design objectives are:

- **Provider-agnostic design:** the business rules should not depend on any specific retailer or data vendor.
- **Reliable alerting:** notifications should not be lost or duplicated because of technical failures or retries. What counts as a notifiable event is set by business rules that are still open.
- **Honest data provenance:** simulated data should be labelled as such, and data-licence constraints should be treated as a design input.

## Guiding principles

1. **Domain first.** Understand and name the problem before designing a solution.
2. **Independence from providers.** The product should work without Amazon, Keepa, OpenAI or n8n.
3. **Deterministic business rules.** Rules are code and tests, never LLM output.
4. **Simplicity.** No abstraction without a concrete justification.
5. **Defensibility.** Every significant decision is explainable and recorded.

## Success criteria (as a project)

- A complete, working price-alert round trip on simulated data: create alert → price changes → alert evaluated → notification produced.
- Every feature documented to the standard in [features/README.md](../features/README.md).
- Decisions traceable through ADRs; tests that verify business behaviour.
