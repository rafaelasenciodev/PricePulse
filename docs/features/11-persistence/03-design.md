# 11 — Persistence: Design (Stage 3)

Status: Approved. Every decision in section 9 has status Accepted, and the two dependencies of section 7 were approved at the versions given.

The design of the database adapters. It builds on the [discovery and rules](01-discovery.md), the [scenarios](02-scenarios.feature), the ports of features 01 to 07 and [ADR-0003](../../adr/0003-persistence-deferred.md). The choice of PostgreSQL (Q2) is written as [ADR-0006](../../adr/0006-postgresql.md). No use case, port or rule changes, and nothing in the domain or the application imports the driver.

## 1. Where the code goes

| Piece | Where | Imports |
|---|---|---|
| The adapters | `postgres.ts` in the `adapters/` folder of each module: `accounts`, `price-alerts`, `price-observations` | The application of their module, `pg` as a type and for queries |
| The connection and the migrations | `src/database/`: `connect.ts`, `migrate.ts` and `migrations/0001-initial.sql` | `pg`, `node:fs`, `node:path` |
| Choosing the storage | `src/storage.ts`, from the environment | `database`, the Composition Root |
| The demo data | `src/demo-data.ts`, taken out of `main.ts` | The Composition Root |
| The wiring | `composition-root.ts`: one `composeApp(stores, options)`, used by `composeInMemoryApp` and by a new `composePostgresApp(pool, options)` | The adapters |

## 2. The schema (`0001-initial.sql`)

Money is an integer of minor units and a currency, and an instant is an integer of milliseconds, as in the domain. A column that holds a comparison key or an identifier uses the collation `"C"`, which compares by the codes of the characters.

| Table | Columns | Guarantees and indexes |
|---|---|---|
| `accounts` | `id`, `email`, `password_hash` | Primary key `id`. `UNIQUE (email)`, the normal form of the email |
| `sessions` | `token_hash`, `user_id`, `created_at`, `expires_at` | Primary key `token_hash`. Index on `expires_at` |
| `login_attempts` | `email`, `count`, `locked_until` (may be empty), `written` | Primary key `email`. `written` comes from a sequence: it is the order in which they were written |
| `listings` | `id`, `title`, `title_key`, `retailer`, `currency` | Primary key `id`. `title_key` is the title in lower case as the domain makes it. Index `(title_key, id)` |
| `price_alerts` | `id`, `owner`, `listing_id`, `target_minor_units`, `currency`, `status`, `created_at` | `CHECK (target_minor_units > 0)` and `CHECK (status IN (...))`. **Unique partial index** `(owner, listing_id) WHERE status = 'active'`. Index `(owner, created_at DESC, id)` for the list, and `(listing_id) WHERE status = 'active'` for the Evaluation |
| `notifications` | `alert_id`, `owner`, `listing_id`, `currency`, `target_minor_units`, `current_minor_units`, `observed_at` | Primary key `alert_id`: one per alert. Index `(owner, observed_at DESC, alert_id)` |
| `price_observations` | `provider`, `listing_id`, `observed_at`, `price_minor_units` and `currency` (both empty when there is no price) | Primary key `(provider, listing_id, observed_at)`: the identity. `CHECK` that the two are both empty or both set. Index `(listing_id, observed_at DESC, provider)` |
| `schema_migrations` | `version`, `name`, `applied_at` | Primary key `version` |

There are **no foreign keys.** The modules refer to each other by identifier only, and the contracts of every port add rows without the ones they would refer to (an alert with an owner that is not an Account).

## 3. What each operation does

Every query uses parameters (`$1`), never text put together from values. A `bigint` comes from the driver as text and is converted by one helper that refuses what is not a safe integer.

| Port and operation | In the database |
|---|---|
| `AccountRepository.add` | `INSERT`. A violation of the email's unique key is `EmailAlreadyStored` |
| `find`, `findByEmail` | A `SELECT` by key |
| `SessionStore.add` | One statement that deletes the Sessions that expired at the creation moment of the new one (BR-13), then `INSERT` |
| `findByTokenHash`, `delete` | By key. Deleting what is not there is not an error |
| `LoginAttemptStore.update` | One transaction: `INSERT … ON CONFLICT DO NOTHING`, `SELECT … FOR UPDATE`, `change(current)`, then write the result, or delete the row when it says no attempts. The oldest rows beyond the capacity are deleted by `written`, as the in-memory adapter drops them. `change` may run again, which its contract allows |
| `PriceAlertRepository.add` | `INSERT`. A violation of the partial unique index is `ActiveAlertAlreadyExists` |
| `findActive`, `findActiveByListing`, `find` | `SELECT`, with the owner in `find`, so another owner's alert is not found |
| `findByOwner` | `ORDER BY created_at DESC, id`, with the state as a condition when asked, and `LIMIT`/`OFFSET` |
| `save(alert, expectedStatus)` | `UPDATE … WHERE id = $ AND status = $expected`. One row: done. None: it reads the alert. Not there: a defect. Already in the new state: nothing to do. Another state: `AlertStateChanged` |
| `NotificationRepository.add` | `INSERT`. A violation of the key is `NotificationAlreadyExists`. `findByAlert`, `findByOwner` by key and by `(owner, observed_at DESC, alert_id)` |
| `PriceObservationRepository.add` | `INSERT`. A violation of the key is `ObservationAlreadyExists`. `find` by key, `findLatest` by `(listing_id, observed_at DESC)` with `LIMIT 1` |
| `findByListing` | The range as a condition, `from` included and `to` excluded, `ORDER BY observed_at DESC, provider` |
| `ListingCatalogue.find`, `list` | By key, and `ORDER BY title_key, id` with the collation `"C"` |

**A page and its total are one statement,** so that they come from one snapshot: the count is a subquery joined to the page, and the total is there even when the page is empty. **Errors:** only the violations of the constraints named in section 2 are told apart, by the SQLSTATE `23505` and the name of the constraint. Any other error goes up as it is and ends as the 500 that reveals nothing.

## 4. Rebuilding what was stored (Q5)

`Notification`, `PriceObservation` and `Session` have private constructors and a factory for creation. Each gets a `restore` that takes stored values and checks what can be wrong in stored data: the Notification that its Current Price reaches its Target Price, and the observation that its price is not negative. `PriceAlert` and `Account` already have a public constructor that applies no rule of creation, and the adapters use it, with the checks that the value objects make (`Price`, `TargetPrice`, `Email`) and those of the database (`CHECK`). A stored value that fails a check is an error that is not hidden.

## 5. The migrations

`migrate(pool, directory)` reads the files `NNNN-name.sql` in the order of their number, refuses a gap or a repeated number, and for each one not in `schema_migrations` runs it and records it **in one transaction**. It takes an advisory lock first, so that two servers that start together do not both apply a step. A step that fails leaves nothing of itself and stops the start (SC-37). It runs when the server starts and with `npm run migrate`. A step that was applied and then edited is not detected: that would need a checksum, which is not built.

## 6. Choosing the storage and the demo data

`storage.ts` reads the environment. **Production** is refused as `main.ts` already does, because the demo passwords are public (SC-32): that stays until the deployment decides otherwise. With `DATABASE_URL` it connects, applies the migrations and logs `host:port/name` without the user and the password. If it cannot, it says that it could not connect and gives the error code, never the text of the error or the address, and the server does not start (SC-33). Without it, it uses memory and says that what it stores is lost when it stops (SC-31).

`demo-data.ts` registers the demo Accounts last, after the Listings and their first prices, and the demo Account `demo1` is the mark: if its registration says that the email exists, nothing else is created (SC-38, SC-39). A start that stops half way can leave the demo data without its alert, which is harmless.

## 7. Dependencies

| Dependency | Where | Purpose | Cost |
|---|---|---|---|
| `pg` 8.23.1 | `backend`, production | The driver and the pool of connections | 11 packages in all, one more optional. A client that returns every `bigint` as text, which the helper handles |
| `@types/pg` 8.23.1 | `backend`, dev | Its types, which `pg` does not bring | None at runtime |

Both are more than a month old (30 September and 4 October 2026). The `engines` of the 17 packages of the two, read from a scratch lockfile, accept Node 25.9, and the rule of feature 09 holds. The Docker image of PostgreSQL has its major version fixed in `compose.yaml`, chosen when it is built: the Docker daemon was not running when this was checked, so the tags were not.

## 8. Tests

- **Contracts:** the 10 functions of the contracts that exist, and an 11th, run against each adapter in `*.db.test.ts`, with `npm run test:db` and a configuration of their own (one worker, `*.db.test.ts` only). `npm test` leaves them out and stays in memory. The 11th is new: `add`, `findActive` and the uniqueness of the Active alert were tested only in the test of the in-memory adapter, and not as a contract that any adapter can run, so five tests are taken out into one. Two contracts are widened: the Catalogue's `add` may give a promise, and the Sessions' contract gets the check that adding removes the expired, which the in-memory adapter now does too.
- **The database of the tests** is `pricepulse_test` on the server of `compose.yaml`, created by the set-up if it is absent, and emptied before each test. If the server cannot be reached the set-up fails with a message, and no test runs or is skipped (SC-29).
- **At the level of the application:** `composePostgresApp` over the same database, twice for a restart (SC-01 to SC-05), simultaneous calls for the guarantees (SC-07 to SC-17), and the same journey in memory and in the database with the ids and moments replaced by names, to compare answers (SC-06).
- **The rest:** the migrations with folders of steps made for the test (SC-34 to SC-37), `storage.ts` and `demo-data.ts` with their cases (SC-30 to SC-33, SC-38, SC-39), the rows read directly for SC-26, and the architecture test, which gets the layer `database` and keeps the driver out of the domain and the application (SC-27).
- **By hand:** `npm run test:db` with Docker stopped, to see the failure of SC-29, and the server started twice on the same database.

## 9. Decisions

| ID | Decision | Status |
|---|---|---|
| 1 | One migration with the seven tables and the schema of section 2, with no foreign keys | Accepted |
| 2 | Money and instants are stored as integers (minor units, milliseconds), converted by a helper that refuses what is not a safe integer | Accepted |
| 3 | The Catalogue is ordered by a stored `title_key` and the collation `"C"` | Accepted |
| 4 | `restore` for the three entities with private constructors. `PriceAlert` and `Account` use their public one (refines Q5) | Accepted |
| 5 | Errors are told apart by SQLSTATE `23505` and the name of the constraint, and no other | Accepted |
| 6 | `save` is one conditional `UPDATE` and a read to tell an old save from a conflict | Accepted |
| 7 | The login attempts keep the capacity of the in-memory adapter, by the order of writing | Accepted |
| 8 | Adding a Session removes the expired ones, in both adapters, with a check in the contract | Accepted |
| 9 | A page and its total are one statement | Accepted |
| 10 | The migrations are numbered files, one transaction each, with a lock, applied at start and by a script | Accepted |
| 11 | One `composeApp` over a set of stores, with a version in memory and one for PostgreSQL | Accepted |
| 12 | `storage.ts` chooses the storage, and the refusal of production stays | Accepted |
| 13 | `demo-data.ts` creates the demo data once, marked by the Account `demo1` | Accepted |
| 14 | Database tests in `*.db.test.ts`, their own configuration and script, the test database created by the set-up, and a failure and no skip without a database | Accepted |
| 15 | `compose.yaml` has one service on the host port 5433, with a named volume | Accepted |
| 16 | `pg` and `@types/pg`, at the versions of section 7 | Accepted |

Alternatives that were weighed:

- **Decision 1:** foreign keys between the tables of one module and none across modules. The contracts of the Notification add one with no alert, so the key would reject them, and the modules are still not settled as separate contexts (XQ-02).
- **Decision 2:** `timestamptz` for the instants. It reads better in a query and has native functions. It converts at each side, has a smaller range than a safe integer, and would put a second representation of the same moment next to the domain's.
- **Decision 3:** `lower(title)` in the query. The database lowers by its own locale and rules, and not by those of the domain, so the order would depend on the machine, which BR-06 forbids. A known difference remains: a title with a character above U+FFFF and another from U+E000 to U+FFFF is ordered one way in memory (UTF-16) and the other in the database (code points). It is a limitation, with no contract check.
- **Decision 7:** to drop the capacity, which a table does not need to bound its size. Then trying many emails could grow it without limit, which is what the cap was written to prevent.

## 10. Where each scenario is handled

| Scenario | Handled by |
|---|---|
| SC-01 to SC-05 | The adapters and `composePostgresApp`, with a new composition over the same database |
| SC-06 | `composeApp`, and the comparison of the two compositions |
| SC-07 to SC-13 | The constraints of section 2 and the mapping of errors (decisions 1 and 5) |
| SC-14 to SC-16 | `save` (decision 6) |
| SC-17 | `LoginAttemptStore.update` (decision 7) |
| SC-18 to SC-23 | The orders and the pages (decisions 3 and 9) |
| SC-24 to SC-26 | Decision 2, and the rows as they are stored |
| SC-27 | The architecture test |
| SC-28, SC-29 | The contracts run against the database, and the set-up of the tests |
| SC-30 to SC-33 | `storage.ts` |
| SC-34 to SC-37 | `migrate` |
| SC-38, SC-39 | `demo-data.ts` |
| SC-40 | `SessionStore.add` (decision 8) |

## 11. Effects on the rest

- **`main.ts`** is shorter: it reads the environment, asks `storage.ts` for the storage, seeds the demo data and listens. Its choosing of the mode and its demo data are now tested.
- **Contracts:** the extraction and the two widenings of section 8. The in-memory adapter of the Sessions changes with its contract.
- **The Composition Root:** `composeInMemoryApp` keeps its signature and what it returns, so the tests that use it do not change.
- **Architecture test, `package.json`, `.gitignore`, README:** the layer `database`, the scripts `test:db` and `migrate`, and how to start the database and run the server, in stage 5.

## 12. The stops of the build

| Stop | What |
|---|---|
| 4a | `compose.yaml`, the connection, the migration runner and the schema, with the harness of the database tests. The dependencies, once approved |
| 4b | The two adapters of the simple stores: Accounts and Sessions, and the Catalogue, with the contracts |
| 4c | The adapters of Price Alerts, Notifications, Price Observations and login attempts, with the contracts |
| 4d | `composeApp`, `storage.ts`, `demo-data.ts`, `main.ts`, and the tests at the level of the application |
| 4e | Verification with a real server restarted, the deliberate errors and the review, and the traceability of the feature |
