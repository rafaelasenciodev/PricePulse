# PricePulse

A price-tracking platform: monitor product prices, consult price history, and get alerted when a product reaches a target price.

> **Status: in development.** Two features are implemented, **Create Price Alert** and **Record Price Observation**, running on in-memory adapters. The rest of the platform is planned and not started. See [What works today](#what-works-today).

PricePulse is a Master's Final Project (TFM), a professional portfolio project, and a vehicle for a repeatable, design-first engineering methodology (see [`docs/features/README.md`](docs/features/README.md)).

## What works today

| Capability | State |
|---|---|
| Create Price Alert | Implemented, with in-memory storage |
| Record Price Observation (a price provider reports the price of a Listing) | Implemented, with in-memory storage |
| Interactive API documentation | Implemented, in the development server only |
| Price history, and simulating prices on a schedule | Not started |
| Alert evaluation and notifications | Not started |
| User accounts and login, and authentication of price providers | Not started (a development stand-in with fixed tokens is used for both) |
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

Then report a new price for that Listing as the price provider. The Current Price of a Listing is the price of its latest observation, so a Price Alert created afterwards sees it:

```bash
curl -i -X POST http://127.0.0.1:3000/listings/headphones-shop-a/price-observations \
  -H "Authorization: Bearer demo-provider-token" \
  -H "Content-Type: application/json" \
  -d "{\"observedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"price\":{\"amount\":\"79.90\",\"currency\":\"EUR\"}}"
```

Or try it in the browser: open **<http://127.0.0.1:3000/docs>**, press **Authorize**, paste `demo-token-1`, then open the endpoint and press **Try it out**. The price observations use another token, `demo-provider-token`.

The server starts with demo data, defined in [`backend/src/main.ts`](backend/src/main.ts):

| Demo data | Values |
|---|---|
| Tokens of Users, for the price alerts | `demo-token-1` and `demo-token-2` (two different Users) |
| Token of the price provider, for the price observations | `demo-provider-token` (the provider `simulator`). It is not valid for the price alerts, and the tokens of Users are not valid for the price observations |
| `headphones-shop-a` | Current Price 100.00 EUR |
| `keyboard-shop-b` | Current Price 50.00 USD |
| `monitor-shop-a` | No Current Price (unavailable) |

The Current Price of each Listing is not stored. The server records one observation per Listing when it starts, as the provider would, and the Current Price is the price of the latest observation.

The retailers are fictitious. Everything is held in memory and is lost when the server stops. The server listens on `127.0.0.1` only, and it refuses to start when `NODE_ENV` is `production`. Use `PORT=3001 npm run dev` to change the port.

## The API

### Create a Price Alert

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

### Record a Price Observation

`POST /listings/{listingId}/price-observations` with the body `{ "observedAt": "2026-11-19T10:00:00Z", "price": { "amount": "79.90", "currency": "EUR" } }`. The price provider is identified by the `Authorization: Bearer <token>` header, never by the body. `price` is required: send `null` when the Listing was unavailable. `observedAt` is ISO 8601 with a time zone, and it may be later than the moment of recording by 5 minutes at most.

| Status | Code | Meaning |
|---|---|---|
| 201 | | The Price Observation was recorded |
| 200 | | The same observation was repeated: the stored one is returned |
| 400 | `BAD_REQUEST` | Malformed body, a missing or unknown field, or an amount that is not text |
| 401 | `UNAUTHENTICATED` | No valid token of a price provider |
| 404 | `LISTING_NOT_FOUND` | The Listing does not exist |
| 409 | `OBSERVATION_CONFLICT` | An observation of the same provider, Listing and `observedAt` is stored with another content |
| 422 | `INVALID_OBSERVATION` | `observedAt` is not valid or is too far in the future, the amount is not a number, is negative or has too many decimals, or the currency is not the one of the Listing |
| 500 | `INTERNAL_ERROR` | An unexpected failure. The response reveals no detail |

### Documentation of the API

The same description is available as an OpenAPI document at `/docs/json` and as an interactive page at `/docs`. Both are generated from the schemas that validate the request, and a test checks that they do not drift from what the API answers. They are served only by the development server.

Errors have the form `{ "code": "...", "message": "..." }`. The rules behind them are in the business rules of each feature, [Create Price Alert](docs/features/01-create-price-alert/01-business-rules.md) and [Price Observation](docs/features/02-price-observation/01-business-rules.md), and the full contracts in their use case contracts, [feature 01](docs/features/01-create-price-alert/04-use-case-contract.md) and [feature 02](docs/features/02-price-observation/04-use-case-contract.md).

## Architecture

Ports and adapters, with one folder per feature. Dependencies point inward, a feature never imports another, and a test fails if a change breaks that.

```
        http ───────▶ application ───────▶ domain
                          ▲
      adapters ───────────┘                (the Composition Root connects them)
```

| Layer | Responsibility | Location |
|---|---|---|
| `domain` | Business rules and invariants. It imports nothing but `shared` | `backend/src/<feature>/domain/` |
| `application` | The use case and the ports it needs | `backend/src/<feature>/application/` |
| `adapters` | In-memory implementations of the ports | `backend/src/<feature>/adapters/` |
| `http` | The HTTP interface, authentication and error mapping | `backend/src/<feature>/http/` |
| `shared` | What several features need, such as `Price` | `backend/src/shared/domain/` |
| Composition Root | The only place that chooses and connects the parts. It is also where the two features meet: the Current Price that Price Alerts read comes from the Price Observations | `backend/src/composition-root.ts` |

The features are `price-alerts` and `price-observations`.

The design decisions are recorded in [`docs/adr/`](docs/adr/).

## Technology

TypeScript in strict mode on Node, Fastify for HTTP (with two plugins that generate and serve the OpenAPI documentation), Vitest for tests. [ADR-0001](docs/adr/0001-typescript-backend.md) explains the choice.

Not decided yet: the database, background jobs, the frontend, how the application is built for production, and where it is deployed.

## Testing

```bash
cd backend
npm test                 # all the tests
npm run typecheck        # type checking
npm run coverage         # tests with a coverage report, used as a diagnostic
```

The tests cover the domain, the use case, the adapters, the HTTP interface and the wiring. Two further tests guard the project itself: one keeps the chain business rule → scenario → test from breaking, and one enforces the dependency rules. See [`08-test-plan.md`](docs/features/01-create-price-alert/08-test-plan.md) for feature 01 and section 4 of [the completion of feature 02](docs/features/02-price-observation/10-completion.md).

## How the project is built

Each feature goes through eleven phases, from discovery to documentation, and each phase ends with an approval. The behaviour is described first as business rules and Gherkin scenarios, then modelled, then implemented, and the tests trace back to the scenarios. [`docs/features/README.md`](docs/features/README.md) describes the method.

A simplified Git Flow organises the branches, with one `feature/NN-name` branch per feature ([ADR-0002](docs/adr/0002-branching-model.md)).

| To read | Where |
|---|---|
| Documentation index | [`docs/README.md`](docs/README.md) |
| Product vision and scope | [`docs/product/`](docs/product/) |
| Vocabulary of the domain | [`docs/domain/ubiquitous-language.md`](docs/domain/ubiquitous-language.md) |
| Feature 01, phase by phase | [`docs/features/01-create-price-alert/`](docs/features/01-create-price-alert/) |
| Feature 02, phase by phase | [`docs/features/02-price-observation/`](docs/features/02-price-observation/) |

## Data

The project runs on simulated data. No real retailer data is used, and no retailer is scraped. Real price providers could be added later behind an adapter, subject to their terms of use.
