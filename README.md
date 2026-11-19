# PricePulse

A price-tracking platform: monitor product prices, consult price history, and get alerted when a product reaches a target price.

> **Status: in development.** Five features are implemented, **Create Price Alert**, **Record Price Observation**, **Alert Evaluation**, **Read and Manage Price Alerts** and **Notifications and Price History**, running on in-memory adapters. The rest of the platform is planned and not started. See [What works today](#what-works-today).

PricePulse is a Master's Final Project (TFM), a professional portfolio project, and a vehicle for a repeatable, design-first engineering methodology (see [`docs/features/README.md`](docs/features/README.md)).

## What works today

| Capability | State |
|---|---|
| Create Price Alert | Implemented, with in-memory storage |
| Record Price Observation (a price provider reports the price of a Listing) | Implemented, with in-memory storage |
| Interactive API documentation | Implemented, in the development server only |
| Simulating prices on a schedule | Not started |
| Alert evaluation: recording a price evaluates the Price Alerts of its Listing, and those it reaches become Triggered with a stored Notification | Implemented, with in-memory storage |
| Read and manage Price Alerts: list them, read one, change its Target Price, cancel it | Implemented, with in-memory storage |
| Read the Notifications of a User, and the Price History of a Listing | Implemented, with in-memory storage |
| Delivery of Notifications, marking them as read, pausing alerts, and evaluating on a schedule | Not started |
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

The server starts with a demo Price Alert of `demo-user-1` for `headphones-shop-a`, with a Target Price of 80.00 EUR, while the Current Price of that Listing is 100.00 EUR. Create another one as the second demo User, from another terminal. The answer has the `id` of the new Price Alert:

```bash
curl -i -X POST http://127.0.0.1:3000/listings/headphones-shop-a/price-alerts \
  -H "Authorization: Bearer demo-token-2" \
  -H "Content-Type: application/json" \
  -d '{"targetAmount":"90.00"}'
```

With `demo-token-1` and `80.00` the answer would be 200 and the demo alert, because repeating a creation returns the existing one.

Read your Price Alerts, and change the Target Price of the new one, using its `id` in place of `{alertId}`:

```bash
curl -s http://127.0.0.1:3000/price-alerts \
  -H "Authorization: Bearer demo-token-2"

curl -s -X PATCH http://127.0.0.1:3000/price-alerts/{alertId} \
  -H "Authorization: Bearer demo-token-2" \
  -H "Content-Type: application/json" \
  -d '{"targetAmount":"85.00"}'
```

To stop it instead of changing it, send `{"status":"cancelled"}`. A Cancelled Price Alert is not evaluated, so below only the demo alert would be triggered.

Then report a new price for that Listing as the price provider. The Current Price of a Listing is the price of its latest observation, and recording one evaluates the Price Alerts of that Listing:

```bash
curl -i -X POST http://127.0.0.1:3000/listings/headphones-shop-a/price-observations \
  -H "Authorization: Bearer demo-provider-token" \
  -H "Content-Type: application/json" \
  -d "{\"observedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"price\":{\"amount\":\"79.90\",\"currency\":\"EUR\"}}"
```

If you did not cancel it, both alerts are reached by 79.90, so both become Triggered, and the terminal where the server runs shows one line for each (abbreviated here):

```
{"level":30,...,"owner":"demo-user-1","targetPrice":{"amount":"80.00",...},"currentPrice":{"amount":"79.90",...},...,"produced":true,"msg":"Price Alert triggered: a Notification was produced"}
```

The Notifications are stored in memory and are not delivered. Their owner reads them, and anyone with a User's token reads the Price History of the Listing:

```bash
curl -s http://127.0.0.1:3000/notifications \
  -H "Authorization: Bearer demo-token-2"

curl -s "http://127.0.0.1:3000/listings/headphones-shop-a/price-observations?limit=5" \
  -H "Authorization: Bearer demo-token-1"
```

The first answers with the Notification of that User only, and the second with the observations of the Listing, newest first. The token of the price provider is not valid for either. A Triggered Price Alert has ended: trying to cancel it answers 409.

Or try it in the browser: open **<http://127.0.0.1:3000/docs>** and press **Authorize**. There are two padlocks, because there are two credentials that are not interchangeable: `bearerAuth` takes the token of a User (`demo-token-1` or `demo-token-2`), and `providerAuth` takes the one of the price provider (`demo-provider-token`). Then open an endpoint and press **Try it out**.

The server starts with demo data, defined in [`backend/src/main.ts`](backend/src/main.ts):

| Demo data | Values |
|---|---|
| Tokens of Users, for the price alerts | `demo-token-1` and `demo-token-2` (two different Users) |
| Token of the price provider, for the price observations | `demo-provider-token` (the provider `simulator`). It is not valid for the price alerts, and the tokens of Users are not valid for the price observations |
| `headphones-shop-a` | Current Price 100.00 EUR |
| `keyboard-shop-b` | Current Price 50.00 USD |
| `monitor-shop-a` | No Current Price (unavailable) |
| Demo Price Alert | `demo-user-1`, for `headphones-shop-a`, with a Target Price of 80.00 EUR |

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

### Read and manage Price Alerts

| Request | What it does |
|---|---|
| `GET /price-alerts?status=&limit=&offset=` | The Price Alerts of the User, newest first. `status` is `active`, `triggered` or `cancelled`. A page holds `limit` alerts (20 by default, 100 at most) after skipping `offset`, and `total` says how many match |
| `GET /price-alerts/{alertId}` | One of them |
| `PATCH /price-alerts/{alertId}` with `{ "targetAmount": "70.00" }` or `{ "status": "cancelled" }` | Changes the Target Price of an Active Price Alert, or cancels it. The body carries exactly one of the two |

The User is identified by the `Authorization: Bearer <token>` header, as when creating. An alert of another User is answered as one that does not exist. Each Price Alert shows its `id`, `listingId`, `targetAmount`, `currency`, `status` and `createdAt`, also in the answer to creating one.

| Status | Code | Meaning |
|---|---|---|
| 200 | | The list, the Price Alert, or the Price Alert after the change. A change that was already made also answers 200 |
| 400 | `BAD_REQUEST` | A query parameter or the body is not valid: an unknown one, both changes at once, a state other than `cancelled` |
| 401 | `UNAUTHENTICATED` | No valid token |
| 404 | `ALERT_NOT_FOUND` | The Price Alert does not exist, or it belongs to another User |
| 409 | `ALERT_NOT_ACTIVE` | The Price Alert has ended (Triggered) or was Cancelled, and the change needs it Active. Cancelling one that is already Cancelled is not an error |
| 409 | `ALERT_CONFLICT` | It changed state while the request was applied, for example because it was Triggered. Nothing was changed |
| 409 | `TARGET_ALREADY_REACHED` | The Current Price already reaches the new Target Price |
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

### Read the Notifications and the Price History

| Request | What it does |
|---|---|
| `GET /notifications?limit=&offset=` | The Notifications of the User, one for each of their Price Alerts that was reached, newest first by the moment its price was observed. Each shows the Price Alert, the Listing, the Target Price, and the Current Price with its Observed At |
| `GET /listings/{listingId}/price-observations?from=&to=&limit=&offset=` | The Price History of a Listing: its Price Observations, newest first, each with its Provider, Observed At and Price, or no price when the Listing was unavailable. `from` is included and `to` is excluded, both ISO 8601 with a time zone |

Both need the token of a **User**, and the token of the price provider is not valid for them. A page holds `limit` items (20 by default, 100 at most) after skipping `offset`, and the answer has the `total`, as the list of Price Alerts. The history path is the same as the one that records a price, with another method and another credential.

| Status | Code | Meaning |
|---|---|---|
| 200 | | The page, also when it is empty |
| 400 | `BAD_REQUEST` | A query parameter is not valid: an unknown one, or a limit or an offset out of range |
| 401 | `UNAUTHENTICATED` | No valid token of a User |
| 404 | `LISTING_NOT_FOUND` | The Listing of the history does not exist |
| 422 | `INVALID_RANGE` | `from` or `to` is not an instant, or `from` is not before `to` |
| 500 | `INTERNAL_ERROR` | An unexpected failure. The response reveals no detail |

### Alert evaluation

It has no endpoint. When a Price Observation is stored, new or repeated, the Price Alerts of its Listing are evaluated. Each one that the Current Price reaches becomes Triggered and gets one Notification, once, even if the evaluation is repeated or runs twice at the same time. The response of the recording is the same whatever happens to the evaluation, and a failure of it goes to the log. A Cancelled Price Alert is not evaluated. A Notification is a stored record: it is not delivered, and it has no read state.

### Documentation of the API

The same description is available as an OpenAPI document at `/docs/json` and as an interactive page at `/docs`. Both are generated from the schemas that validate the request, and a test checks that they do not drift from what the API answers. They are served only by the development server.

Errors have the form `{ "code": "...", "message": "..." }`. The rules behind them are in the business rules of each feature, [Create Price Alert](docs/features/01-create-price-alert/01-business-rules.md), [Price Observation](docs/features/02-price-observation/01-business-rules.md) and [Read and Manage Price Alerts](docs/features/04-read-and-manage-alerts/01-discovery.md) and [Notifications and Price History](docs/features/05-notifications-and-price-history/01-discovery.md), and the full contracts in their use case contracts, [feature 01](docs/features/01-create-price-alert/04-use-case-contract.md), [feature 02](docs/features/02-price-observation/04-use-case-contract.md) and the designs of [feature 04](docs/features/04-read-and-manage-alerts/03-design.md) and [feature 05](docs/features/05-notifications-and-price-history/03-design.md).

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
| Composition Root | The only place that chooses and connects the parts. It is also where the features meet: the Current Price that Price Alerts read comes from the Price Observations | `backend/src/composition-root.ts` |
| Evaluation trigger | The policy that evaluates the Price Alerts of a Listing after a price is recorded, so that neither feature knows the other | `backend/src/evaluation-trigger.ts` |

The features are `price-alerts`, which creates, evaluates, reads and manages alerts and reads their Notifications, and `price-observations`, which records prices and reads the Price History.

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

The tests cover the domain, the use case, the adapters, the HTTP interface and the wiring. Two further tests guard the project itself: one keeps the chain business rule → scenario → test from breaking, and one enforces the dependency rules. See [`08-test-plan.md`](docs/features/01-create-price-alert/08-test-plan.md) for feature 01, and section 4 of the completion of [feature 02](docs/features/02-price-observation/10-completion.md), [feature 03](docs/features/03-alert-evaluation/10-completion.md) [feature 04](docs/features/04-read-and-manage-alerts/04-completion.md) and [feature 05](docs/features/05-notifications-and-price-history/04-completion.md).

## How the project is built

Each feature goes through five stages: understand, scenarios, design, build and close. Each stage ends with an approval, and the build has a stop for each layer. The behaviour is described first as business rules and Gherkin scenarios, then designed, then built, and the tests trace back to the scenarios. [`docs/features/README.md`](docs/features/README.md) describes the method. The first three features followed an earlier method of eleven phases, and their documents are kept as they were.

A simplified Git Flow organises the branches, with one `feature/NN-name` branch per feature ([ADR-0002](docs/adr/0002-branching-model.md)).

| To read | Where |
|---|---|
| Documentation index | [`docs/README.md`](docs/README.md) |
| Product vision and scope | [`docs/product/`](docs/product/) |
| Vocabulary of the domain | [`docs/domain/ubiquitous-language.md`](docs/domain/ubiquitous-language.md) |
| Feature 01, phase by phase | [`docs/features/01-create-price-alert/`](docs/features/01-create-price-alert/) |
| Feature 02, phase by phase | [`docs/features/02-price-observation/`](docs/features/02-price-observation/) |
| Feature 03, phase by phase | [`docs/features/03-alert-evaluation/`](docs/features/03-alert-evaluation/) |
| Feature 04, stage by stage | [`docs/features/04-read-and-manage-alerts/`](docs/features/04-read-and-manage-alerts/) |
| Feature 05, stage by stage | [`docs/features/05-notifications-and-price-history/`](docs/features/05-notifications-and-price-history/) |

## Data

The project runs on simulated data. No real retailer data is used, and no retailer is scraped. Real price providers could be added later behind an adapter, subject to their terms of use.
