# 11 — Persistence: Discovery and Business Rules (Stage 1)

Status: Approved. Every question below has a **Decision** line with status Accepted. *Lean* lines record the proposal that was discussed.

## 1. The business problem

Everything the system stores is held in memory. A restart loses every Account, Session, Price Alert, Notification, Price Observation and Listing, and the demo server creates a few of them again at each start. [ADR-0003](../../adr/0003-persistence-deferred.md) deferred persistence on four conditions, and said that it must be decided and built before the application is published for general use. The conditions were kept: the ports express what a database answers, every port has contract tests that any adapter can run, and users live behind ports.

This feature gives each of those ports an adapter over a database, so that data lasts. It is a feature of the backend. No answer of the API and no rule of any earlier feature should change.

## 2. Actors and goal

| Actor | Role |
|---|---|
| **Person using the application** | Their Account, Session, alerts and Notifications stay when the server restarts. Nothing else changes for them |
| **Developer** | Starts the application and its tests against a real database, and changes the schema in steps that can be repeated |
| Provider | Not an actor. Its recorded prices stay, as everything else does |

**Goal:** "Restart the server and find everything where it was."

## 3. Scope (proposed)

**Is:** the database and its schema; one adapter for each of the seven stores (Accounts, Sessions, login attempts, Price Alerts, Notifications, Price Observations, the Catalogue); the way the schema changes; the contract tests run against those adapters; the wiring in the Composition Root and `main.ts`; the demo data in a database; and how a developer starts a database.

**Is not:** where the database runs when the application is deployed, backups and its operation, which belong to the deployment; pooling or tuning for scale beyond the indexes that earlier features named; authentication of price providers, whose tokens stay in the code ([ADR-0004](../../adr/0004-authentication.md)); a scheduled evaluation or any background job; and any change of the API, the interface or the rules.

**Scope approved** (see section 9).

## 4. What is already established

| Fact | Source |
|---|---|
| Seven ports hold state: `AccountRepository`, `SessionStore`, `LoginAttemptStore`, `PriceAlertRepository`, `NotificationRepository`, `PriceObservationRepository` and `ListingCatalogue`. The in-memory adapters have 392 lines in all | `backend/src/*/application/ports.ts` |
| Each port has contract tests written as a function that takes a way to create the adapter, so that "a database adapter runs exactly the same checks". They are 14 files | `backend/tests/**/*-contract.ts` |
| The ports fail with concrete errors that the use cases handle: `ActiveAlertAlreadyExists`, `NotificationAlreadyExists`, `ObservationAlreadyExists`, `EmailAlreadyStored`, `AlertStateChanged` | Ports |
| `save` of an alert is conditional on the state that was read, `LoginAttemptStore.update` is atomic and takes a pure function, and the writes of an Evaluation are ordered (Notification, then the alert) with no Unit of Work | Features 03, 04 and 06 |
| The completions of features 01 to 07 list what persistence must settle: a partial unique index for the Active alert of an owner and Listing, a unique constraint for the Notification of an alert and for an observation by Provider, Listing and Observed At, and an index of observations by Listing and Observed At. They also ask for indexes by owner for the lists, a conditional `UPDATE`, the removal of expired Sessions, and a way to rebuild a stored alert | Completions of features 01 to 07 |
| `PriceAlert` and `Account` have public constructors, and `Notification`, `PriceObservation` and `Session` have private ones with a factory that applies the rules of creation | `backend/src/*/domain/` |
| The Catalogue port has `find` and `list`, and no way to add a Listing: `addListing` is an operation of the in-memory adapter that `main.ts` uses | `ListingCatalogue`, `main.ts` |
| Money is an integer of minor units and a currency, an amount travels as text, and an instant is UTC with milliseconds | [ADR-0001](../../adr/0001-typescript-backend.md), the domain |
| The backend has four dependencies for production, and the minimum Node is 22. A rule of feature 09: no dependency whose `engines` excludes the Node of the repository, 25.9 | `package.json`, feature 09 design |
| `npm test` runs 1,582 tests in about two seconds, all in memory | Measured |
| On this machine Docker 29.6.1 is installed and there is no local PostgreSQL. Node 25.9 includes a `node:sqlite` module | Measured |

## 5. Ambiguities and questions

Questions marked **●** must be resolved before this stage can close.

### ● Q1 — Which stores move to the database?

| Option | Includes | Trade-off |
|---|---|---|
| A | All seven | One feature that leaves nothing in memory, and a larger change that touches every repository at once, as ADR-0003 foresaw |
| B | The four of the domain (alerts, Notifications, observations, Catalogue). Accounts and Sessions stay in memory | Smaller, but every restart still empties the Accounts, so the application is not usable after one |
| C | Alerts and Notifications only | The smallest. The Catalogue and the prices would be lost, and so the alerts would point to nothing |

*Lean:* **A**. ADR-0004 already says that Users and Sessions stay behind ports with contracts, so that a database adapter has to pass them.

**Decision (Accepted):** as proposed.

### ● Q2 — Which database? (an ADR, because it is a decision of the whole project)

| Option | Effect | Trade-off |
|---|---|---|
| A | PostgreSQL, run as a server | Concurrent transactions, constraints and partial indexes, as the ports assume, and a database that a deployment can offer. Needs a server in development, which Docker gives here, and one more dependency (a driver) |
| B | SQLite, in a file, through `node:sqlite` or a driver | No server, and the file travels with the project. One writer at a time, so the "two requests at once" cases are tested in a gentler setting. `node:sqlite` would have to be checked against the minimum Node of the repository (22) |
| C | Another kind of database | The ports and the queries are relational: ordering, pages by offset, uniqueness and a conditional update |

*Lean:* **A**. It is the one that exercises the guarantees that the ports were written for, and it is the usual choice for the kind of application that this project is. That the guarantees hold (a partial unique index, an `UPDATE … WHERE`) is checked by a test, not assumed.

**Decision (Accepted):** as proposed.

### ● Q3 — How does the code talk to it?

| Option | Effect | Trade-off |
|---|---|---|
| A | The driver and SQL written by hand in each adapter | One dependency. The mapping of rows to objects is written seven times, and a query is checked only by running it |
| B | A query builder | Queries checked by the types. A dependency and a vocabulary more |
| C | An ORM | The most done for you, and a second model of the data next to the domain, which the project avoided |

*Lean:* **A**. The adapters are small and sit behind ports, and the contract tests are what checks a query.

**Decision (Accepted):** as proposed.

### ● Q4 — How does the schema change?

| Option | Effect | Trade-off |
|---|---|---|
| A | Numbered SQL files and a small runner that applies each once and records it | No dependency, and the history of the schema is in the repository. The runner is a small piece of code to test |
| B | A migration tool | Less to write. A dependency and its way of working |
| C | The tables are created at startup when absent | The least. There is no history, and a change of a table is not a step |

*Lean:* **A**.

**Decision (Accepted):** as proposed.

### ● Q5 — How is a stored object rebuilt?

The earlier completions left it open, because the factories of `Notification`, `PriceObservation` and `Session` apply the rules of creation, and a stored one is not a creation.

| Option | Effect | Trade-off |
|---|---|---|
| A | A named operation in each entity that builds it from stored values and checks its invariants | The domain says how a stored object comes back, and knows nothing of the database. A new operation for each entity |
| B | Public constructors, used by the adapters | Nothing to add. Any code could build an object that skipped the rules |
| C | The adapters rebuild through the factories | The rules of creation would run on every read, and some create new values, such as an identifier |

*Lean:* **A**.

**Decision (Accepted):** as proposed.

### ● Q6 — How are the contract tests run against the database?

| Option | Effect | Trade-off |
|---|---|---|
| A | Against a real PostgreSQL started with Docker, in a separate script. `npm test` stays in memory. If the script is run without a database it fails, and does not skip | The tests that matter run against the real thing. It needs Docker |
| B | A database in the process of the test, with a package | No Docker. A dependency, and a database that is not the real one |
| C | The same, started by the tests with a container library | Nothing to start by hand. A dependency, and Docker anyway |

*Lean:* **A**. The contract is written as a function of "how to create the adapter", which today is synchronous. The design settles how the database is prepared and emptied between tests.

**Decision (Accepted):** as proposed.

### Q7 — How does a developer start a database?

*Lean:* a `compose.yaml` at the root with one service, for development and for the tests. Its purpose is that the same database is one command away, and its cost is one more file and the need for Docker. Credentials are those of a local, empty database and are not secrets.

**Decision (Accepted):** as proposed.

### ● Q8 — Does the server still run without a database?

| Option | Effect | Trade-off |
|---|---|---|
| A | A database is required | One way to run it. `npm run dev` needs the database before anyone sees anything |
| B | With `DATABASE_URL` it uses the database. Without it, it runs in memory and says so when it starts | The quick start of the README keeps working. Two modes to keep, and a risk of running in memory without noticing, which the message and the refusal of production (below) reduce |

*Lean:* **B**. `main.ts` already refuses `NODE_ENV=production` because of the public demo passwords. Whether a deployment may run without a database is a question of the deployment.

**Decision (Accepted):** as proposed.

### Q9 — Where does the demo data come from?

| Option | Effect |
|---|---|
| A | `main.ts` creates it at start only if it is absent: the two Accounts, the six Listings with a first price, and the demo alert |
| B | A separate command, run once |

*Lean:* **A**, as ADR-0004 says ("created only if it does not exist"), so that a restart does not repeat it. The Catalogue has no port to add a Listing, so the seed writes through the adapter, as it does today.

**Decision (Accepted):** as proposed.

### Q10 — Is there a transaction around an Evaluation?

*Lean:* no. Each operation of a port is one statement, uniqueness is decided by constraints, `save` is a conditional `UPDATE`, and the order of writes of feature 03 stays. A crash between the Notification and the alert is finished by the next Evaluation, as that feature's completion accepted. A Unit of Work is a decision for when something needs it.

**Decision (Accepted):** as proposed.

### Q11 — When are expired Sessions removed?

*Lean:* when a Session is added at sign-in, in one statement that deletes the expired ones. It needs no timer and no background job, which are not decided.

**Decision (Accepted):** as proposed.

## 6. Business rules (proposed)

| ID | Rule | Origin |
|---|---|---|
| BR-01 | Nothing observable changes: every answer of the API, and every rule of features 01 to 10, are as they were. The existing tests and contracts are the check | Q1 |
| BR-02 | What is stored survives a restart of the server: Accounts, Sessions, login attempts, Price Alerts, Notifications, Price Observations and the Catalogue | Q1 |
| BR-03 | The database enforces uniqueness: one Account per email, one Active alert per owner and Listing, one Notification per alert, and one observation per Provider, Listing and Observed At. Two requests at the same time leave one | ADR-0003, features 01 to 03 |
| BR-04 | Saving an alert checks the state that was read, in the same statement that writes it. If another change came first, it fails as it does today | Feature 04, BR-08 |
| BR-05 | The attempts of an email are updated atomically: those that arrive together do not lose a count | Feature 06 |
| BR-06 | Lists have the order, the tie-breakers and the total that their contracts say, and the Catalogue keeps its order by lower-cased title and then identifier, by the codes of the characters | Features 04, 05, 07 |
| BR-07 | Every port has its contract run against its database adapter, with the same checks as the in-memory one | ADR-0003 |
| BR-08 | Money and instants are stored exactly, with no floating point and with the milliseconds of an instant. Passwords and tokens are stored as they are today: a hash, never in clear | ADR-0001, ADR-0004 |
| BR-09 | The domain and the application know nothing of the database. Only the adapters and the Composition Root import its driver, and a test checks it | ADR-0001 |
| BR-10 | The connection comes from the environment and never from the repository. Without a connection the server runs in memory and says so, and production does not start in that mode | Q8 |
| BR-11 | A change of the schema is a numbered step, applied once, and recorded | Q4 |
| BR-12 | The demo data is created only if it is absent, so a restart does not repeat it | Q9 |
| BR-13 | Expired Sessions are removed | Q11 |

## 7. New terms for the glossary

None. A Notification, a Price Alert or a Session are the same things as before: this feature only changes where they are kept.

## 8. Carried to the design

- The schema: tables, types for money and instants, the constraints and the indexes that the completions asked for.
- The driver, its exact version, its `engines` against Node, and its purpose and cost, for approval before it is installed.
- The operation that rebuilds each entity, and how the errors of the database become the errors of the ports.
- How the contract tests get an adapter that needs to be prepared and emptied, and how the connection is closed.
- How the Composition Root chooses the adapters, without a second copy of its wiring.
- The runner of the migrations, `compose.yaml`, and the scripts of `package.json`.
- The architecture test that keeps the driver out of the domain and the application.

## 9. Exit criteria

- [x] Questions marked ● answered (Q1 to Q6 and Q8)
- [x] Scope (section 3) approved
- [x] Rules (section 6) approved
- [x] The User approves moving to stage 2 (scenarios)
