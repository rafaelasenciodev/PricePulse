# 12 — Deployment: Design (Stage 3)

Status: Approved. The decisions of section 8 are Accepted when this design is approved.

The design of what the server and the interface need to run as a public demo. It builds on the [discovery and rules](01-discovery.md), the [scenarios](02-scenarios.feature) and [ADR-0007](../../adr/0007-deployment-platform.md), which chooses Render and Neon. No use case, port or rule of the domain changes. Most scenarios (SC-11 to SC-14 and SC-18) say that something that already holds still holds in the demo, and the build checks them without writing code for them.

## 1. Where the code goes

| Piece | Where | Knows |
|---|---|---|
| The settings of the server | `backend/src/settings.ts`, new | Only the environment, as a pure function |
| The reset | `backend/src/reset-demo.ts`, new, and `truncateData` in `src/database/` | `database`, the Composition Root, the demo data |
| The route that says whether it is a demo | `GET /demo`, registered in `app.ts` | Nothing of the domain |
| The start of the server | `main.ts`: reads the settings first, and uses them | Settings, storage |
| The notice and its question | `frontend/src`: `demo()` in the client, a `DemoNotice` component and its texts | The client |

## 2. The settings (`settings.ts`)

`readSettings(environment)` gives an object or refuses with a `SettingsRefused` whose message is safe to show. It runs before anything is connected, and `storage.ts` stops deciding about production.

| Setting | Source | Rule |
|---|---|---|
| `demo` | `DEMO_MODE`, true only for the text `true` | |
| `host` | `HOST`, `127.0.0.1` by default | BR-04 |
| `port` | `PORT`, 3000 by default | As today |
| `origin` | `WEB_ORIGIN`, `http://127.0.0.1:<port>` by default | As today |
| `secureCookie` | `origin` starts with `https:` | BR-05 |
| `databaseUrl` | `DATABASE_URL`, may be absent | As today |

Refusals, in this order, each with its own message: production without `demo` (BR-01); in production, no `databaseUrl` (BR-10); in production, no `WEB_ORIGIN` (BR-11). Outside production nothing is refused, so SC-03 holds and the local server is as it was.

## 3. The route `GET /demo`

Public, with no token. It always answers 200 with `{ "demo": <true or false> }`, and it is registered always, so that a development server answers `false`. It is for the interface and not for whoever reads the API, so it is hidden from `/docs`, as the redirections are. It carries no secret: it says what the server declares about itself.

## 4. What the server says (BR-02)

In demo mode the start of the server writes that it is a demo with simulated data, and the note of `/docs` begins with a paragraph that says so and that the passwords and the token of the Provider are public. The note already lists them. Outside demo mode both texts are what they are today.

## 5. The reset (`npm run reset-demo`)

1. It reads the settings and refuses unless `demo` is true and `databaseUrl` is present (D3), with a message for each.
2. It connects, and applies the pending migrations as `npm run migrate` does.
3. `truncateData` empties, in one transaction, every table of the `public` schema except `schema_migrations`, restarting the sequences. The list of tables is read from the catalogue of the database, so a table of a later migration is also emptied.
4. It composes the application over the pool and runs `seedDemoData`, which creates the Accounts, Listings, first prices and the demo alert, as at the first start.
5. It closes the pool. A failure to connect ends it with the code of the failure and nothing is changed (SC-17). If the seed fails after the truncate the database is left empty, and running the command again repairs it.

## 6. The interface

- `ApiClient` gains `demo(): Promise<Result<{ demo: boolean }>>`, and the proxy of Vite forwards `/demo` in development.
- `DemoNotice`, in `App` above the routes, asks once when the page loads. If the answer is `true` it shows one visible line, so it appears on the sign-in screen, the Catalogue and the alerts alike (SC-06). If the request fails, or the answer is `false`, it shows nothing.
- The text is in Spanish, in the file of texts, as the rest.

## 7. Build and start

| Step | Decision |
|---|---|
| Start | A script `start` in `backend/package.json`: `tsx src/main.ts`. `tsx` moves to `dependencies` |
| Render, root directory | The root of the repository, because the server serves `frontend/dist` from outside `backend/` |
| Render, build command | `npm ci --prefix backend && npm ci --include=dev --prefix frontend && npm run build --prefix frontend`. `--include=dev` is there because with `NODE_ENV=production` the build tools would not be installed |
| Render, start command | `npm start --prefix backend` |
| Render, environment | `NODE_ENV=production`, `DEMO_MODE=true`, `HOST=0.0.0.0`, `WEB_ORIGIN` (the exact address of the service), `DATABASE_URL` (the direct string of Neon, with `sslmode=require`). `PORT` is given by Render |

The commands and `sslmode` are written from the documentation and checked when the service is created, which is not part of this build.

## 8. Decisions

| # | Decision | Alternatives that were discussed | Status |
|---|---|---|---|
| D1 | `tsx` runs the server in production | Bundling it into one file, and a container image: more work or more to keep, with no change for a Reviewer | Accepted |
| D2 | The interface asks the server whether it is a demo | A build variable in the interface, which can contradict the server; the server writing it into the HTML | Accepted |
| D3 | A command that resets the data, and that refuses without the demo mode | The same without the guard, which could empty a database that is not a demo; an HTTP route, which would need roles that do not exist | Accepted |
| D4 | The variables of section 2, with two refusals more in production | Only the table; only the database check | Accepted |
| D5 | Render and Neon, with the direct string | [ADR-0007](../../adr/0007-deployment-platform.md) | Accepted |

## 9. Where each scenario is handled

| Scenario | Handled by |
|---|---|
| SC-01, SC-02, SC-03, SC-19, SC-20 | `readSettings` (section 2), and `main.ts` for the seed |
| SC-04, SC-05 | Section 4 |
| SC-06 | Sections 3 and 6 |
| SC-07, SC-08 | `host` of the settings, used by `listen` in `main.ts` |
| SC-09 | `secureCookie` of the settings, given to the cookie of feature 08 |
| SC-10 | The check of the origin of feature 08, with the origin of the settings |
| SC-11, SC-12 | Registration of feature 06. Verified in a real browser, nothing built |
| SC-13, SC-14 | Features 02, 03 and 05, and the demo token. Verified, nothing built |
| SC-15, SC-16, SC-17 | The reset (section 5) |
| SC-18 | Sign-in limit of feature 06. Verified |

## 10. The stops of the build

| Stop | What is built |
|---|---|
| a | `settings.ts` with its tests, and the change of `main.ts` and `storage.ts` that uses it |
| b | `truncateData` and `reset-demo`, with tests against the database (`npm run test:db`) |
| c | `GET /demo`, the paragraph of the note, and the interface (client, `DemoNotice`, texts, proxy) with their tests, and the scripts of `package.json` |
| d | The round trip tried in a real browser against a server in demo mode, with the checks of the scenarios that are only verified, and a review |
