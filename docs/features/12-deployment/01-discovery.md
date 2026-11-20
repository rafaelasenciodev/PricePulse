# 12 — Deployment: Discovery and Business Rules (Stage 1)

Status: Approved. A question is closed only when it has a **Decision** line with status Accepted. *Lean* lines record the proposal under discussion.

## 1. The business problem

The application runs only on the machine of its author. The server is a development server: it listens on `127.0.0.1`, it refuses to start when `NODE_ENV` is `production` because the demo passwords are public, and the cookie of the Session is not `secure`. Someone who wants to judge the project has to install Node and PostgreSQL, or trust the README.

This feature puts the application at a public address, so that a person can open it in a browser and try the whole round trip without installing anything.

## 2. Actors and goal

| Actor | Role |
|---|---|
| **Reviewer** | A supervisor or a recruiter who opens the address, signs in or registers, creates an alert and makes its price fall |
| **Author** | Deploys, operates and updates the application |
| System | Runs as a public demo, and says that it is one |

**Goal:** "Validate the project working, without installing anything."

## 3. Scope (proposed)

**Is:** a public deployment of the backend with the web interface, backed by PostgreSQL, as a demo with simulated data. In the code: a demo mode that lets the server run in production, the address and the `Secure` attribute of the cookie set from the environment, a notice in the interface, and a command that resets the demo data. In the documents: the choice of platform (an ADR) and the guide that takes a Reviewer through the round trip.

**Is not:** real retailer data, scheduled price checks, a price simulator in the interface, protection against abuse, an automatic reset, taking the passwords out of the code, a guide page in the interface, and a deployment hardened for real users. Each is another feature or a stated limitation.

## 4. What is already established

| Fact | Source |
|---|---|
| The server listens on `127.0.0.1` only, refuses `NODE_ENV=production`, and sets the cookie of the Session without `secure` because it speaks HTTP only | `main.ts`, `storage.ts` |
| With `DATABASE_URL` the data is kept in PostgreSQL and the demo data is created once. Without it the data is in memory | [ADR-0006](../../adr/0006-postgresql.md), feature 11 |
| The built interface is served by the backend, at the same origin as the API | [ADR-0005](../../adr/0005-web-interface.md) |
| Registration is open: `POST /accounts` is public, with an email and a password | `accounts/http/routes.ts`, feature 06 |
| The Provider token is fixed (`demo-provider-token`) and the demo passwords are public | `demo-data.ts` |
| Where the database runs, its backups, its connections, and whether the server may run in production are left to this feature | ADR-0006, section Open |
| The hosting platform is decided before the first deployment | Product scope |

## 5. Questions

Questions marked **●** must be resolved before this stage can close.

### ● Q1 — What is deployed?

| Option | Trade-off |
|---|---|
| A | A public demo with demo Accounts that are announced as demo. Anyone can try it |
| B | A deployment with no public Accounts. Nobody can try it without the Author |

**Decision (Accepted):** A. It is meant so that a Reviewer can validate the project without installing anything.

### ● Q2 — How does a Reviewer make a price fall?

| Option | Trade-off |
|---|---|
| A | In Swagger (`/docs`), with the public token of the Provider `simulator`. Nothing new is built |
| B | A button in the interface. It is a feature of its own, and it changes who can record a price |

**Decision (Accepted):** A. No button, so no new route and the rule that only a Provider records observations stays as it is. The consequence is that any visitor can change the prices of the demo, which is stated as a limitation of the demo.

### ● Q3 — May a Reviewer register their own Account?

Registration is open today. Two Reviewers who use `demo1@example.com` at the same time see and change each other's alerts.

| Option | Trade-off |
|---|---|
| A | Registration stays open. Each Reviewer can have their own Account and their own data. Anyone can also fill the database with Accounts |
| B | Registration is closed in the demo, and only the two demo Accounts exist. It needs a switch that does not exist, and Reviewers share their data |

*Lean:* **A**.

**Decision (Accepted):** A. Registration stays open, so that each Reviewer has their own Account. The risk that anyone fills the database with Accounts is accepted, and it is dealt with in Q4. Closing registration once the project has been validated is a possible later step. It is not part of this feature, and it would need the switch that does not exist.

### ● Q4 — What happens to the data that visitors change?

With open registration and a public Provider token, a visitor can create Accounts and leave absurd prices. Today the demo data is created once and nothing returns it to its first state.

| Option | Trade-off |
|---|---|
| A | Nothing: it is a stated limitation. A demo left in a bad state stays so for the next Reviewer |
| B | An automatic periodic reset. It needs a scheduler, and the job mechanism is not decided. A Reviewer in the middle of a try can lose their Account |
| C | A command that the Author runs to empty the data and create the demo data again. It depends on the Author, with little traffic expected |

*Lean:* **C**.

**Decision (Accepted):** C. A command run by the Author. An automatic reset can replace it later without changing the rest.

### ● Q5 — How may the server run in public with public passwords?

Today the server refuses `NODE_ENV=production` because the demo passwords are public. In this deployment they are public on purpose: the Reviewer needs the token of the Provider in Swagger, and the README lists a test Account.

| Option | Trade-off |
|---|---|
| A | An explicit demo mode, declared with a variable. Production is still refused unless the demo mode is on. A deployment that is not a demo keeps the protection |
| B | The refusal is removed. The protection against deploying the public passwords by mistake is lost |
| C | Run with `NODE_ENV=development`. Nothing to change, but the deployment says it is something it is not |

*Lean:* **A**.

**Decision (Accepted):** A. Taking the passwords out of the code, so that a deployment that is not a demo can use its own, is a separate capability and is not part of this feature. Improving the interface means deploying the same demo again, not a different deployment.

### ● Q6 — How are the address and the cookie set in the public server?

The server listens on `127.0.0.1` and sets the cookie without `Secure`, both written in the code. A change of data is refused with 403 unless its `Origin` is exactly `WEB_ORIGIN`.

| Option | Trade-off |
|---|---|
| A | A variable `HOST`, with `127.0.0.1` by default. The cookie is `Secure` when `WEB_ORIGIN` starts with `https`, so there is no second variable that can contradict it |
| B | Two variables, `HOST` and `COOKIE_SECURE`. They can be set in a way that contradicts the origin |
| C | `0.0.0.0` written in the code. The local server would also be open to the local network, with public passwords |

*Lean:* **A**.

**Decision (Accepted):** A. Without variables the local server is as it is today. `WEB_ORIGIN` must be the exact public address, or no change of data works. The prefix `__Host-` and the `Authorization` header of a proxy (finding 1 of feature 08) are left for the design.

### ● Q7 — What protection against abuse does the public demo have?

The only limit today is on sign-in: 5 failed attempts in a row for an email refuse it for 15 minutes (feature 06, BR-06). Registration and the recording of observations with the public token have no limit, and no library for limiting requests is installed.

| Option | Trade-off |
|---|---|
| A | Nothing new. It is a stated limitation of the demo |
| B | A general limit of requests by address. A new dependency, values to choose, and behind a proxy the address that the server sees may be the proxy's |
| C | Leave it to the hosting platform. It cannot be judged before the platform is chosen |

*Lean:* **A**.

**Decision (Accepted):** A. The demo is not protected against abuse beyond the limit on sign-in. The risk is low (fictitious data, few visitors) and the Author can reset the data (Q4). It is stated as a limitation of the demo.

### ● Q8 — What does the hosting cost, at most?

The deployment needs a Node process that keeps running, a PostgreSQL database that it can reach, and HTTPS. The platform is chosen in its own ADR. Here only the limit of cost is set.

| Option | Trade-off |
|---|---|
| A | Free. A free plan may limit, pause or expire the service or its database, so the first answer can be slow or the demo can disappear. The conditions of each candidate are checked in the ADR |
| B | A few euros a month. More stable, and a recurring cost |
| C | A server of the Author's own or a rented one. Full control, and HTTPS, updates and backups become the Author's work |

*Lean:* **B**, if the cost is acceptable.

**Decision (Accepted):** A. Free hosting. The candidates are judged in the ADR by their stated conditions, and what a free plan limits is written down as a limitation of the demo, with a warning in the README about a slow first answer. How long the demo must stay online was not stated.

### ● Q9 — How does a Reviewer know it is a demo?

The product vision asks that simulated data is labelled as such. A Reviewer lands on the interface before the README.

| Option | Trade-off |
|---|---|
| A | In the README and in the note of `/docs`, and the server says it when it starts. The interface does not change |
| B | Also a short visible notice in the interface: demo with simulated data |
| C | The notice, and a guide page in the interface with the steps of the round trip |

*Lean:* **B**.

**Decision (Accepted):** B. The guide page is left for when the interface is improved. How the interface learns that the server is a demo is a question of the design.

## 6. Business rules

| ID | Rule | From |
|---|---|---|
| BR-01 | The server refuses to run in production unless the demo mode is declared | Q5 |
| BR-02 | In demo mode the server says so when it starts and in the note of `/docs` | Q5, Q9 |
| BR-03 | The interface of the demo shows a visible notice that the data is simulated | Q9 |
| BR-04 | The server listens on `127.0.0.1` unless it is told another address | Q6 |
| BR-05 | The cookie of the Session is `Secure` when, and only when, `WEB_ORIGIN` is an `https` address | Q6 |
| BR-06 | Registration stays open in the demo, and nothing limits it | Q3, Q7 |
| BR-07 | A Reviewer makes a price fall by recording an observation as the Provider `simulator`, in `/docs` with its public token. No route lets a User record a price | Q2 |
| BR-08 | The Author can run a command that empties the data and creates the demo data again | Q4 |
| BR-09 | The demo is not protected against abuse beyond the limit on sign-in, and a free plan may make its first answer slow or stop it. Both are stated as limitations | Q7, Q8 |
| BR-10 | In production the server does not start without a database address: the demo would lose its Accounts and alerts without anyone noticing | Design, D4 |
| BR-11 | In production the server does not start without the origin of the application: without it every change of data would be refused as a forbidden origin | Design, D4 |

## 7. New terms for the glossary

| Term | Meaning |
|---|---|
| **Reviewer** | A person who opens the public demo to judge the project: a supervisor or a recruiter |
| **Demo mode** | The state of a server that declares that its data is simulated and that its passwords and Provider token are public |
| **Demo reset** | The command with which the Author returns the data of the demo to its first state |

## 8. Left for the next stages

The names of the variables, how the interface learns the demo mode, the shape of the reset command and whether it needs a guard, how the backend is built and started for production, the prefix `__Host-`, the `Authorization` header of a proxy (feature 08, finding 1), and the choice of platform and database host in an ADR.
