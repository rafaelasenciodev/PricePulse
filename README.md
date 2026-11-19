# PricePulse

A price-tracking platform: monitor product prices, consult price history, and get alerted when a product reaches a target price.

> **Status: in development.** One feature is implemented, **Create Price Alert**, running on in-memory adapters. The rest of the platform is planned and not started. See [What works today](#what-works-today).

PricePulse is a Master's Final Project (TFM), a professional portfolio project, and a vehicle for a repeatable, design-first engineering methodology (see [`docs/features/README.md`](docs/features/README.md)).

## What works today

| Capability | State |
|---|---|
| Create Price Alert | Implemented, with in-memory storage |
| Price observations and price history | Not started |
| Alert evaluation and notifications | Not started |
| User accounts and login | Not started (a development stand-in with fixed tokens is used) |
| Database persistence | Not started |
| Frontend | Not started |

The planned scope is in [`docs/product/product-scope.md`](docs/product/product-scope.md).

## Quick start

Requires Node 22 or later.

```bash
cd backend
npm ci          # install the dependencies
npm test        # run the tests
npm run dev     # start the server on http://127.0.0.1:3000
```

Create a Price Alert for a demo Listing, from another terminal:

```bash
curl -i -X POST http://127.0.0.1:3000/listings/headphones-shop-a/price-alerts \
  -H "Authorization: Bearer demo-token-1" \
  -H "Content-Type: application/json" \
  -d '{"targetAmount":"80.00"}'
```

The server starts with demo data, defined in [`backend/src/main.ts`](backend/src/main.ts):

| Demo data | Values |
|---|---|
| Tokens | `demo-token-1` and `demo-token-2` (two different Users) |
| `headphones-shop-a` | Current Price 100.00 EUR |
| `keyboard-shop-b` | Current Price 50.00 USD |
| `monitor-shop-a` | No Current Price (unavailable) |

The retailers are fictitious. Everything is held in memory and is lost when the server stops. The server listens on `127.0.0.1` only, and it refuses to start when `NODE_ENV` is `production`. Use `PORT=3001 npm run dev` to change the port.

## The API

`POST /listings/{listingId}/price-alerts` with the body `{ "targetAmount": "80.00" }`. The User is identified by the `Authorization: Bearer <token>` header, never by the body. The amount is text, and its currency is the one of the Listing.

| Status | Code | Meaning |
|---|---|---|
| 201 | | The Price Alert was created |
| 200 | | The same request was repeated: the existing Price Alert is returned |
| 400 | `BAD_REQUEST` | Malformed body, a missing or unknown field, or an amount that is not text |
| 401 | `UNAUTHENTICATED` | No valid token |
| 404 | `LISTING_NOT_FOUND` | The Listing does not exist |
| 409 | `DUPLICATE_ALERT` | The User already has an Active Price Alert for the Listing with another target |
| 409 | `TARGET_ALREADY_REACHED` | The Current Price already reaches the target |
| 422 | `INVALID_TARGET_PRICE` | The amount is not a number, is not greater than zero, or has too many decimals |
| 500 | `INTERNAL_ERROR` | An unexpected failure. The response reveals no detail |

Errors have the form `{ "code": "...", "message": "..." }`. The rules behind them are in [`01-business-rules.md`](docs/features/01-create-price-alert/01-business-rules.md) and the full contract in [`04-use-case-contract.md`](docs/features/01-create-price-alert/04-use-case-contract.md).

## Architecture

Ports and adapters. Dependencies point inward, and a test fails if a change breaks that.

```
        http ───────▶ application ───────▶ domain
                          ▲
      adapters ───────────┘                (the Composition Root connects them)
```

| Layer | Responsibility | Location |
|---|---|---|
| `domain` | Business rules and invariants. It imports nothing | `backend/src/price-alerts/domain/` |
| `application` | The use case and the ports it needs | `backend/src/price-alerts/application/` |
| `adapters` | In-memory implementations of the ports | `backend/src/price-alerts/adapters/` |
| `http` | The HTTP interface, authentication and error mapping | `backend/src/price-alerts/http/` |
| Composition Root | The only place that chooses and connects the parts | `backend/src/composition-root.ts` |

The design decisions are recorded in [`docs/adr/`](docs/adr/).

## Technology

TypeScript in strict mode on Node, Fastify for HTTP, Vitest for tests. [ADR-0001](docs/adr/0001-typescript-backend.md) explains the choice.

Not decided yet: the database, background jobs, the frontend, how the application is built for production, and where it is deployed.

## Testing

```bash
cd backend
npm test                 # all the tests
npm run typecheck        # type checking
npm run coverage         # tests with a coverage report, used as a diagnostic
```

The tests cover the domain, the use case, the adapters, the HTTP interface and the wiring. Two further tests guard the project itself: one keeps the chain business rule → scenario → test from breaking, and one enforces the dependency rules. See [`08-test-plan.md`](docs/features/01-create-price-alert/08-test-plan.md).

## How the project is built

Each feature goes through eleven phases, from discovery to documentation, and each phase ends with an approval. The behaviour is described first as business rules and Gherkin scenarios, then modelled, then implemented, and the tests trace back to the scenarios. [`docs/features/README.md`](docs/features/README.md) describes the method.

A simplified Git Flow organises the branches, with one `feature/NN-name` branch per feature ([ADR-0002](docs/adr/0002-branching-model.md)).

| To read | Where |
|---|---|
| Documentation index | [`docs/README.md`](docs/README.md) |
| Product vision and scope | [`docs/product/`](docs/product/) |
| Vocabulary of the domain | [`docs/domain/ubiquitous-language.md`](docs/domain/ubiquitous-language.md) |
| Feature 01, phase by phase | [`docs/features/01-create-price-alert/`](docs/features/01-create-price-alert/) |

## Data

The project runs on simulated data. No real retailer data is used, and no retailer is scraped. Real price providers could be added later behind an adapter, subject to their terms of use.
