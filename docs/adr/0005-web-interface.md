# ADR-0005: The web interface is a single-page application served by the backend, with the session in a cookie

- Document status: Approved
- Decision status: Accepted
- Date: 2026-11-19

## Context

The project is delivered with a web interface to try the system: register, sign in, create and manage Price Alerts, and read Notifications and the Price History. Today the only interface is the interactive documentation of the API, which is a way to try the API and not the product.

[ADR-0004](0004-authentication.md) left two points open for this decision: how the interface is served, and whether the token travels in a cookie. [ADR-0001](0001-typescript-backend.md) does not decide the language of a frontend. The backend is one Fastify application that serves the API at the root of its address (`/accounts`, `/sessions`, `/price-alerts`, ...) and reads the session token only from `Authorization: Bearer`. It has no CORS configuration and serves no files.

The author works alone, is learning backend development, and wants a normal and simple solution: the interface should show the backend working, not become a second project.

## Decision

| Aspect | Choice |
|---|---|
| What it is | A **single-page application in TypeScript**, in a `frontend/` folder with its own `package.json`. It talks to the backend only through its HTTP API, as any other client would |
| Framework | **React, built with Vite.** It is the part of this decision that matters least: the rest does not depend on it, and any equivalent framework the author knows better can replace it |
| How it is served | The backend serves the built files under **`/app/`**, from the same origin as the API, and `/` redirects there. The routes of the interface live under `/app/`, so they never clash with the paths of the API. In development, Vite serves the interface and forwards the API paths to the backend, so the browser still sees one origin |
| The session | An **`HttpOnly` cookie with `SameSite=Strict`**, set when a User signs in and removed when they sign out, with the same lifetime as the Session. The token is still returned in the body and accepted in `Authorization: Bearer`, for the documentation page, `curl` and any other client. Price providers keep using the header only: a cookie never authenticates a Provider |
| CORS | Not enabled. The interface and the API share an origin, so nothing cross-origin is allowed in |
| Tests | Vitest, as in the backend, with a testing library for components on a simulated DOM. No browser end-to-end tests for now |

The behaviour of the cookie (the exact attributes, the check of the `Origin` of requests that change something, and how it behaves on `http://127.0.0.1` during development) is specified and tested in the feature, not assumed here.

Not decided here, and left to the feature of the interface: the screens and their order, the language of the texts, the styling, whether the types of the API are written by hand or generated from its OpenAPI document, and security headers such as a content security policy.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| Pages made by the backend (templates and forms, with a little script) | One process and no build step, and cookies are natural. But the backend would produce HTML, mixing presentation into the HTTP layer, and the interface would not use the API of the project, which would then have no client. The API is what the project wants to show |
| A single-page application hosted apart from the API | The two can be built and published separately. But it needs CORS, and a cookie across two sites brings both a weaker `SameSite` setting and a defence against forged requests, and two things to deploy and to keep in step. It is reconsidered if the deployment decision puts them on different addresses, and the cookie with it |
| A full-stack framework with its own server | It would add a second server runtime with its own routing, and the pull to move logic into it, so the backend of ADR-0001 would end up behind another backend |
| A single-page application with no framework | No dependency apart from the build tool. But the state and the rendering would be written by hand, and they grow quickly even for a handful of screens, and are harder to test |
| Another framework (Vue, Svelte, ...) | Equivalent at this size. The choice is about what the author knows, and it is left open on purpose |
| The token in the memory of the page | Scripts of the page could read it, but it does not outlive a reload, so the User would sign in again every time |
| The token in `localStorage` | It survives a reload, but any script that runs in the page can read a token that lasts 7 days. With the cookie it cannot |
| All the API under a `/api` prefix, and the interface at `/` | The cleanest address plan, but it changes every route, the documentation, the tests and the README. A base path for the interface avoids that for now, and the prefix can come later |

## Consequences

- **Dependencies, with their purpose and cost.** The interface brings a build tool, a framework and a testing library, all in `frontend/`. The backend gains one dependency to serve static files and, if no manual parsing is written, one to read cookies. Each is one more package to keep up to date, and the application now has a build step before it can be served.
- **One change in the backend, in one place.** The reading of the token is already one function shared by every hook ([feature 06](../features/06-accounts-and-authentication/04-completion.md)). It must also read the cookie, for the routes of Users and not for those of Providers. Serving the files is an optional group of `buildApp`, like the others, so the core does not depend on the interface.
- **A cookie needs a defence the header did not.** A request that carries a cookie can be forged from another site, so `SameSite=Strict`, the absence of CORS and a check of `Origin` are required, and tested. The cookie keeps scripts from reading the token, but it does not stop a script that runs in the page from making requests as the User.
- **The API has no way to discover Listings.** It does not list them or show their Current Price: a User can only create an alert for a Listing whose identifier they already know. The first feature of the interface will need a read of the catalogue, which is a backend feature with its own five stages, and it is decided there.
- **Interface features follow the same method.** Scenarios describe what a screen does, and the tests trace back to them.
- **Two processes in development.** The backend and Vite run side by side. The interactive documentation stays as the way to try the API.
- **Deployment gets a constraint.** Building and serving both together is the case that is assumed. Separate addresses are a later decision that reopens the cookie.

## Open

- The screens, their order and the language of the texts: in the first feature of the interface.
- The read of the catalogue that the interface needs: in that feature.
- How the application is built, run and published, and whether the interface and the API stay on one address: in the deployment decision.
- Browser end-to-end tests: when the application is deployed and there is something stable to run them against.
