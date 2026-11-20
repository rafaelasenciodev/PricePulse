# 11 — Persistence: Completion (Stage 5)

Status: Approved

The close of the feature: what was built, the decisions and their status, how it was verified, what the review found, what it does not do and what comes next. It links to the documents of each stage and does not repeat them. It is the eighth feature developed with the [method of five stages](../README.md), and the one that [ADR-0003](../../adr/0003-persistence-deferred.md) deferred and [ADR-0006](../../adr/0006-postgresql.md) decided.

## 1. Summary

What the system stores now lasts. With `DATABASE_URL` the server keeps its Accounts, Sessions, sign-in attempts, Price Alerts, Notifications, Price Observations and the Catalogue in PostgreSQL, applies the schema by itself when it starts, and finds its data again after a restart. Without it, it runs in memory as it always did and says that what it stores is lost when it stops.

Nothing observable changes: no use case, port, rule or route was touched, and the same contracts that the in-memory adapters pass are passed by the database ones. The guarantees that were verified only in memory, uniqueness, the conditional save and two requests at the same time, are now verified against a real database. It does not deploy anything, and the server still refuses `NODE_ENV=production`.

## 2. What was built

| Stage | Result | Where |
|---|---|---|
| 1 Understand | 11 questions decided, 13 rules (BR-01 to BR-13) | [Discovery and rules](01-discovery.md) |
| 2 Scenarios | 40 Gherkin scenarios (SC-01 to SC-40) | [Scenarios](02-scenarios.feature) |
| 3 Design | The schema, the operations, the migrations, the storage, 16 decisions | [Design](03-design.md), [ADR-0006](../../adr/0006-postgresql.md) |
| 4a Database and harness | `compose.yaml`, the pool, the migration runner, `0001-initial.sql`, and `npm run test:db` | `compose.yaml`, `backend/src/database/`, `backend/vitest.db.config.ts` |
| 4b Simple stores | Accounts, Sessions and the Catalogue, with their contracts and the check of BR-13 | `postgres.ts` of `accounts` and `price-observations` |
| 4c The rest of the stores | Price Alerts, Notifications, Price Observations and login attempts, the eleventh contract, `restore` | `postgres.ts` of `price-alerts`, and the two others |
| 4d Wiring | `composeApp` and `composePostgresApp`, `storage.ts`, `demo-data.ts`, `main.ts`, and the tests of the application over the database | `backend/src/`, `backend/tests/persistence/` |
| 4e Verification | The traceability of the feature, the scenarios of order and exactness, a real server restarted, deliberate errors | Sections 4 and 5 |

The feature changed 19 files of the source of the backend (1,060 insertions, 78 deletions, 10 new) and 34 of its tests (1,665 insertions, 130 deletions, 21 new), and added `compose.yaml`. The **frontend has no change.** It added two dependencies, `pg` and `@types/pg`, with 13 packages in all.

## 3. Decisions and their status

The status of every decision is recorded here, and only here. Q1 to Q11 are those of the discovery and D1 to D16 are those of the design, in its section 9.

| Decision | Status | Evidence |
|---|---|---|
| Q1 Every store with state moves, and the Catalogue too | Verified | SC-01 to SC-05 |
| Q2 PostgreSQL, run with Docker | Verified | [ADR-0006](../../adr/0006-postgresql.md), SC-28 |
| Q3 The driver `pg` and SQL by hand, no ORM | Verified | SC-27, SC-28 |
| Q4 Migrations as numbered SQL files, applied once | Verified | SC-34 to SC-37 |
| Q5 `restore` for the entities that have a private constructor | Verified | `restore.test.ts` of the three, and the contracts |
| Q6 The contracts run against a real database, apart from `npm test` | Verified | SC-28, SC-29 |
| Q7 `compose.yaml` with one service | Verified | The real server and the tests |
| Q8 With `DATABASE_URL` the database, without it memory, and it says so | Verified | SC-30 to SC-33 |
| Q9 The demo data is created once | Verified | SC-38, SC-39 |
| Q10 No transaction around an Evaluation | Verified | SC-11, SC-14 |
| Q11 Expired Sessions are removed when one is added | Verified | SC-40 |
| D1 One migration, seven tables, no foreign keys | Verified | `migrate.db.test.ts`: the schema has no foreign key |
| D2 Integers for money and instants | Verified, refined | SC-24, SC-25. See below |
| D3 `title_key` and the collation `"C"` | Verified | SC-21 to SC-23, and the contract of the Catalogue |
| D4 `restore` | Verified | SC-26, the contracts |
| D5 Errors told apart by SQLSTATE and constraint name | Verified | SC-07 to SC-13 |
| D6 `save` as a conditional `UPDATE` and a read | Verified | SC-14 to SC-16, and one deliberate error |
| D7 The capacity of the login attempts | Verified, refined | SC-17. See below |
| D8 Adding a Session removes the expired | Verified | SC-40, and one deliberate error |
| D9 A page and its total in one statement | Verified | SC-18 to SC-23 |
| D10 The migrations: files, a transaction each, a lock | Verified | SC-34 to SC-37 |
| D11 `composeApp` over a set of stores | Verified | SC-06, SC-01 to SC-05 |
| D12 `storage.ts`, and production stays refused | Verified, refined | SC-31 to SC-33. See below |
| D13 `demo-data.ts`, marked by `demo1` | Verified, refined | SC-38, SC-39. See below |
| D14 `*.db.test.ts`, their own script and set-up | Verified | SC-29, by hand |
| D15 One service on the port 5433 with a named volume | Verified | The real server |
| D16 `pg` and `@types/pg` | Verified | 13 packages added, `npm audit` reports none |

Decisions taken while building that the design left open or settled differently. Each one was shown to the author at its stop and approved with it.

| When | Decision | Status |
|---|---|---|
| 4a | PostgreSQL 17 (`postgres:17-alpine`), because its image exists and it was already on the machine | Verified |
| 4a | `npm run migrate` has an entry file of its own, `run-migrations.ts`, which the design did not list | Verified |
| 4a | The dependencies are `^8.23.1`, as every other dependency of the project, and not pinned | Verified |
| 4b | **D2 refined:** the conversion of a `bigint` is made once, by the type parser of the pool, and not by a helper that every adapter calls. A pool that is not made by `createPool` would not convert | Verified |
| 4b | The check of a violation of a unique key is in `shared/database-errors.ts`, which names no driver, so the three modules use one | Verified |
| 4b | The `create` of every contract may give a promise, and the one of a database adapter empties the tables | Verified |
| 4c | **D7 refined:** the removal of the oldest login attempts takes a lock of the transaction. Without it, writes at the same time left 21 rows with a capacity of 20, because each transaction trimmed without seeing the rows the others had not committed. It serialises that step | Verified |
| 4d | **D12 refined:** a message of the storage never has the address, the user or the password, only a code. The design allowed `host:port/name` in the failure, and it is now only in the success | Verified |
| 4d | **D13 refined:** `demo1` is registered **first** and not last, because its registration is also the check that the data exists. The design said last. See the limitations | Verified |
| 4e | The scenario SC-29 is exempt from the guard, with its reason, and is checked by hand | Verified |

### Effect on the other features

- **The Composition Root** has `composeApp`, and `composeInMemoryApp` keeps its signature and its result, so no test that uses it changed.
- **The contracts** changed in two ways: the base operations of `PriceAlertRepository` are an eleventh contract, taken out of the test of the in-memory adapter, and the Sessions' contract has the check of BR-13, which the in-memory store now meets.
- **The traceability guard** has the feature, and feature 01 leaves out the folders of this one, because it owns every file that no other feature claims.
- **`main.ts`** is 73 lines shorter, and what it chose is now in `storage.ts` and `demo-data.ts`, which have tests.

## 4. Verification

- **Tests:** the backend has 1,624 test cases in 82 files that run in memory, 42 more than before, and **229 in 12 files that run against the database**, all passing. The frontend has 384, unchanged. Of the feature: 7 of the guard, 3 files of `restore`, and the folders `persistence/` and `database/`.
- **Scenarios:** 39 of the 40 have tests, read from their titles. SC-29 is exempt, with its reason.
- **Contracts:** the 11 contracts of the stores run against both adapters, and a test checks it.
- **Coverage** is not reported: `npm run coverage` runs the tests in memory, and the adapters of the database are exercised by the other script.
- **Deliberate errors,** three, where a mistake would be silent: a Session store that does not remove the expired made 3 tests fail, a `save` that ignores the state that was read made 4 fail, and a history that includes the end of its range made 4 fail. The code was restored each time. The race of the login attempts was found by a test and not planted.
- **By hand,** with the database in Docker:

| What | Result |
|---|---|
| `npm run test:db` with the database stopped (SC-29) | It fails and says it could not reach PostgreSQL. No test is reported as passed or skipped |
| The real server, on a new database, started three times | It applied the migration and created the demo data the first time, and said it was already there the other two |
| What a restart kept | The token of a Session still worked, the alert that was cancelled was still cancelled, and the observation that was recorded was stored: 2 Accounts, 6 Listings, 7 observations and 1 alert, with nothing repeated |
| A database that cannot be reached, a wrong password, a database that does not exist | Each stopped with `Could not connect`, and the code `ECONNREFUSED`, `28P01` or `3D000`. The exit code was 1 |
| Production, with and without a database, and an address that is not PostgreSQL's | Refused, with the reason |
| The secrets | The three addresses were run again with a marked password and user, and none of them appeared in the output |

- **Not done.** Only PostgreSQL 17, on the local machine, over TCP without encryption, and one version of Node, 25.9. No load, no second server on the same database, and no failure of the database while the server runs, were tried.

## 5. Architecture review

- **The driver** is named only in the adapters and in `database/`, which is a layer of its own in the architecture test. The domain and the application do not import it, and the Composition Root takes the type of the pool from `database` and not from the driver.
- **No port, use case or rule changed.** The only changes of the domain are three operations that rebuild what was stored.
- **Failures:** a violation of a constraint that the adapter expects becomes the error of the port, and any other failure goes up as it is and ends as the 500 that reveals nothing.

This review was made by the author of the code on the whole branch, and `/code-review` was not run. These are the points, each checked against the code.

| # | Finding | What was done |
|---|---|---|
| 1 | The capacity of the login attempts was exceeded under writes at the same time | Fixed with a lock of the transaction (section 3), with a test that does the 200 writes |
| 2 | In the journey of SC-06 two alerts of the same moment were ordered by a random identifier, so the two storages gave different lists | Not a defect: the order is the contract's. The journey uses a clock that moves |
| 3 | An `add` without its `await`, in the contract of the Catalogue, made the first tests against the database fail | Fixed in the contract |
| 4 | The pool ignores the errors of idle connections, so that one the server drops does not end the process, and says nothing | A limitation |
| 5 | A Session whose hash is already stored fails with the error of the database, which the port does not define | A limitation: the tokens are 256 random bits |

## 6. What the process revealed

| When | What | Result |
|---|---|---|
| 3 | The Docker daemon was not running when the design was written, so the tags of the image were not checked | The version was chosen at 4a, once it ran |
| 4b | The contract of the Catalogue creates two catalogues in one test, which a shared database does not allow | `create` is asynchronous and empties the tables, and the test reads each one before the next is made |
| 4c | The 10 contracts that existed did not include the base operations of the alerts | An eleventh was taken out of the test of the in-memory adapter |
| 4d | The guard reads the titles of `it`, and not those of `describe` | The identifiers are in the titles of the tests |
| 4e | `timeout` does not exist in the shell of macOS, and a `ps` of the processes matched its own shell | The runs were made without it, and no server of this session was left |

## 7. Known limitations

- A start that is cut half way, after `demo1` is registered, leaves the demo data incomplete, and the next start finds the mark and creates nothing. The design had said the opposite, and the cost was shown at 4d.
- A step of the migrations that was applied and then edited is not detected: there is no checksum.
- The order of the Catalogue differs between the storages for a title with a character above U+FFFF next to one from U+E000 to U+FFFF.
- The writes of the login attempts are serialised in one step. The traffic of a sign-in is low, and a cost that is not measured.
- The production server is not offered: it refuses `NODE_ENV=production` because the demo passwords are public. How the database is run, saved and sized when deployed is not decided ([ADR-0006](../../adr/0006-postgresql.md), Open).
- There is no pool configuration (its size, its timeouts), no encryption of the connection and no reconnection test.
- `main.ts` still has no test, and no continuous integration runs the tests, and the repository has no licence.

## 8. Documentation volume

The documents of the first three stages have 713 lines (discovery and rules 200, scenarios 365, design 148). The previous feature had 574, so it is 24 % more, for a feature that touches every store of the backend.

## 9. Follow-up

**Next,** in the order agreed, the deployment with its ADR, and then the final README, slides and video.

**For the deployment:** where the database runs and how it is saved, whether the server may run in production and with what accounts, the number of connections, and the encryption of the connection.

**Not started and not scheduled:** a checksum of the migrations, a way to add Listings other than the demo data, and removing old Sessions by time and not only when one is added.

## 10. Completion checklist

- [x] Stages 1 to 4 completed
- [x] Documentation of stage 5 written (this document)
- [x] This document is approved by the author
- [x] The README and the documentation indexes describe this feature
- [x] [ADR-0006](../../adr/0006-postgresql.md) has its document status decided: Approved
- [ ] The feature is merged into `develop` with `--no-ff`, and `develop` into `main` and tagged (done by the developer, [ADR-0002](../../adr/0002-branching-model.md))
- [ ] A licence is chosen before the repository is published
