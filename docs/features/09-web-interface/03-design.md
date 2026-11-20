# 09 — Web Interface: Design (Stage 3)

Status: Approved. Every decision in section 7 has status Accepted.

The design of the feature: the project, its pieces, the libraries, the way the backend serves it, the way it is developed and tested, and the stops of the build. It builds on the [discovery and rules](01-discovery.md), the [scenarios](02-scenarios.feature) and [ADR-0005](../../adr/0005-web-interface.md). It has no use case, port or adapter: its layers are different from those of the backend.

## 1. The project

`frontend/` has its own `package.json`, no workspace, and is installed with `npm ci` in its own folder. Its source is in four folders, and a test keeps their dependencies pointing one way.

| Folder | What it holds | May import |
|---|---|---|
| `src/api/` | The client of the API and the types of its answers. **No React.** The only place that calls `fetch` | Nothing of the rest |
| `src/texts/` | Every text, in Spanish, and the choice of the message for an answer | `api/` (its types) |
| `src/session/` | Who is signed in: the state, and registering, signing in and out | `api/`, `texts/` |
| `src/ui/` | The router, the screens and their components, and the stylesheet | All of the above |

| Where each rule lives | |
|---|---|
| BR-01 | `api/` drops the token, and a test refuses any source file that names storage, `document.cookie` or `Authorization` |
| BR-02, BR-06 | `session/`: the state, and the wrapper of routes that need a person signed in |
| BR-03, BR-04, BR-05 | `session/` and the two screens of access |
| BR-07, BR-08 | The screens of the Catalogue and of a Listing, and the hook that reads |
| BR-09, BR-10 | `api/` sends the text as written, and `texts/` chooses the message of each answer |
| BR-11 | The hook that sends |
| BR-12 | `api/` turns every failure into a value, and `texts/` has one message for it |
| BR-13 | The backend: its group `webInterface` |
| BR-14 | The screens, before they call the client |

## 2. The pieces

| Piece | What it does |
|---|---|
| **Client** | `createApiClient({ fetch })` gives one function for each of the seven operations: sign in, register, sign out, one's Account, the Catalogue, a Listing and creating a Price Alert. Each gives a value, `{ ok: true, data }` or `{ ok: false, failure }`, and **never throws**. A failure is an answer of the API (status, code, message, seconds to wait) or a failure that is not an answer (no connection, an unexpected body). The sign-in keeps the Account and drops the token. It sends no `Authorization` header, writes relative addresses and relies on the cookie |
| **Session** | `checking`, `signedOut` or `signedIn`. At the start it asks for the Account: an answer is signed in, a 401 is signed out. Any 401 later makes it signed out with the reason "ended" (BR-06). Registering is a registration followed by a sign-in (BR-04) |
| **Reading** | One hook, `useRequest(load)`, with `loading`, `ready` and `failed`, and a way to try again. It reads again every time a screen is entered and keeps nothing |
| **Sending** | One hook, `useSubmit(action)`. It refuses a second call while the first is in progress with a mark that is set at once, so two clicks in the same instant send one request, and it gives the state to disable the button (BR-11) |
| **Router** | `/` leads to the Catalogue or to signing in, `/sign-in`, `/register`, `/catalogue` with `?page=`, `/listings/:id`, and an address that is none of them leads to the same place as `/`. All under the base `/app/` |
| **Texts** | One file with every text and a function that gives the message for a failure of each action |

**The vocabulary of the screens.** The glossary stays in English.

| In the glossary | On the screen |
|---|---|
| Account, Session | cuenta, sesión |
| Sign in, Register, Sign out | Entrar, Crear cuenta, Salir |
| Catalogue | catálogo |
| Listing | producto, with the name of its tienda |
| Retailer | tienda |
| Price Alert | alerta de precio |
| Target Price, Current Price | precio objetivo, precio actual |
| Observed At | observado el |

"Listing" is not "oferta", which in Spanish suggests a discount. Amounts are shown as the API gives them with their currency, and instants with the format of the browser, in tests in UTC.

## 3. The libraries

| Dependency | Where | Purpose | Cost |
|---|---|---|---|
| `react`, `react-dom` | `frontend` | The framework of ADR-0005 | The weight of the framework in the page |
| `react-router-dom` | `frontend` | The router with a base path, parameters, redirects and the back button, which a hand-made one would have to get right | One more API to know |
| `vite`, `@vitejs/plugin-react` | `frontend`, dev | The build and the development server | A build step |
| `typescript`, `@types/react`, `@types/react-dom` | `frontend`, dev | The same language and strictness as the backend | None |
| `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event` | `frontend`, dev | The tests of screens in a simulated page, written as a person uses it | Four dev packages |
| `@fastify/static` | `backend` | Serving the built files safely, which includes refusing a path that leaves the folder | The one new package of production in the backend |

**A rule for every dependency of this feature:** its `engines` must include the version of Node that the repository runs on, 25.9. It was checked against the registry: Vitest 5 and jsdom 30 or later do not declare it, and so the lines that do are chosen: Vitest 4, as in the backend, and jsdom up to 29. The versions are fixed when they are installed.

## 4. Serving the interface

| Piece | How |
|---|---|
| The group | `buildApp` takes `webInterface?: { root }`, the folder of the build. Without it nothing is served and `/app/` is an unknown route (SC-35) |
| The files | `@fastify/static` under `/app/`. `index.html` is sent with `Cache-Control: no-cache` and what is under `assets/`, whose names carry a hash, with a long life |
| `/` | A temporary redirect to `/app/` (SC-31). It is not permanent, because a browser would keep it for ever |
| The pages of the interface | The handler of unknown routes sends `index.html` for a GET or a HEAD under `/app/` whose last segment has no dot. An address with a dot, such as a script that does not exist, is a 404, and an address outside `/app/` is never answered with the page (SC-32, SC-33) |
| Headers of `/app/` | `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin` and `Content-Security-Policy: default-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`. The documentation page does not get them. For that policy the interface has no inline script and no `style` attribute |
| `main.ts` | Looks for `frontend/dist/index.html` next to the backend. If it is there, the group is on, and if not, it says to build the interface and goes on without it |

The architecture test lets `app` use `@fastify/static` and `main` use `node:fs`, which is the one place that looks at the machine.

## 5. Development

`npm run dev` in `frontend/` starts Vite at `http://localhost:5173/app/`, with `strictPort`, and forwards the paths of the API (`/accounts`, `/sessions`, `/listings`, `/price-alerts`, `/notifications`) to `API_URL`, by default `http://127.0.0.1:3000`. The backend is started with `WEB_ORIGIN=http://localhost:5173`, because the browser sees the origin of Vite. Whether the proxy hands the `Origin` on as it comes is not assumed: it is checked in a browser. `npm run build` is the type check and `vite build`, and it writes `frontend/dist`, which the repository already ignores.

## 6. Tests

- **Screens and pieces:** Vitest with a simulated page and Testing Library, with a `fetch` of the test that is given to the client. Each test names the scenario or the rule.
- **The client against the application:** a test of the backend suite starts the real application on a free port and runs the client against it, so that a difference between what the client expects and what the API answers breaks it (Q5 of the discovery).
- **Guards of the frontend:** an architecture test of the folders of section 1, and one that refuses any source file that names `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie` or `Authorization`.
- **Traceability:** the guard of the project reads the tests of the frontend too, for this feature, and SC-36 is an exemption with its reason: it needs a real browser.
- **A real browser,** by hand or with the extension of the browser: that a change made by the interface carries an `Origin` that the application accepts, which is SC-36, and what feature 08 could not try.

## 7. Decisions

| ID | Decision | Status |
|---|---|---|
| 1 | `frontend/` has four folders, `api`, `texts`, `session` and `ui`, with the dependencies of section 1, kept by a test | Accepted |
| 2 | The client is a module with no React that never throws, never exposes the token and never sends `Authorization` | Accepted |
| 3 | The session is `checking`, `signedOut` or `signedIn`, found out with the Account, and any 401 makes it signed out | Accepted |
| 4 | The libraries are those of section 3, and none whose `engines` leaves out the Node of the repository | Accepted |
| 5 | The router is `react-router-dom`, with the base `/app/`, and the page of the Catalogue is `?page=` | Accepted |
| 6 | One hook reads and one hook sends, with no library of data. The second marks a call in progress at once | Accepted |
| 7 | Every text is in one file in Spanish, with the vocabulary of section 2 | Accepted |
| 8 | One stylesheet with variables, semantic HTML, no inline style | Accepted |
| 9 | The backend serves the interface with `@fastify/static` in an optional group, with the page of the interface as the answer to its unknown addresses | Accepted |
| 10 | `/` redirects to `/app/` with a temporary redirect | Accepted |
| 11 | `/app/` gets `nosniff`, a policy of referrers and a content security policy, and the documentation page does not | Accepted |
| 12 | Vite proxies the API in development, and the backend is told its origin with `WEB_ORIGIN` | Accepted |
| 13 | The client is tested against the real application from the backend suite, and the screens with a `fetch` of the test | Accepted |
| 14 | The traceability guard reads the tests of the frontend for this feature, and SC-36 is an exemption | Accepted |

Alternatives that were weighed:

- **Decision 5:** a router written by hand. About sixty lines for four addresses, and the base path, the back button and the redirects to get right and to test.
- **Decision 6:** a library of data, with a cache and retries. It is what a larger interface needs. With three reads and no cache wanted (Q9), it is more than the problem.
- **Decision 9:** a hash in the address (`/app/#/catalogue`), which needs no fallback. It changes the addresses of the scenarios, and a hash is not sent to the server.
- **Decision 11:** no policy at all, as the documentation page has none. It costs one header, and the interface has no reason to be framed or to load anything from outside.
- **Decision 13:** a server of fake answers in the tests of screens. It is one more tool and it drifts, which is what the test against the real application is for.

## 8. Where each scenario is handled

| Scenario | Handled by |
|---|---|
| SC-01, SC-02, SC-14 | The session and the wrapper of routes |
| SC-03 to SC-06, SC-10, SC-11 | The screens of access, the session and the two hooks |
| SC-07 | The client, the guard of the sources and a test of the screens |
| SC-08, SC-09 | The registration screen and the session |
| SC-12, SC-13 | The session and the layout with its button to sign out |
| SC-15 to SC-20 | The screen of the Catalogue and the hook that reads |
| SC-21 to SC-30 | The screen of a Listing, the client and the texts |
| SC-31 to SC-35 | The group `webInterface` of the backend |
| SC-36 | A real browser, by hand |

## 9. Effects on the rest

- **The backend.** A dependency, a group in `buildApp`, a handler of unknown routes that learns about the page, an option of the Composition Root, `main.ts`, and two lines of the architecture test. The API does not change.
- **The guard of traceability.** It can read a second folder of tests, and one scenario can be exempt for needing a browser.
- **The repository.** A folder `frontend/`, and the README gains how to build and run it.

## 10. The stops of the build

The stops are not those of the backend, which has a domain and ports.

| Stop | What | 
|---|---|
| 4a | The project, the client, the texts and the guards, with no screen |
| 4b | The screens of access: signing in, registering and signing out, and the session |
| 4c | The Catalogue, a Listing and creating a Price Alert |
| 4d | The backend serves the interface, with its headers, and the development server |
| 4e | Verification, with a real browser, and the review |
