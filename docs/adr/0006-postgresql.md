# ADR-0006: Data is kept in PostgreSQL, through its driver and SQL written by hand

- Document status: In Review
- Decision status: Accepted
- Date: 2026-11-20

## Context

[ADR-0003](0003-persistence-deferred.md) deferred persistence on four conditions, among them that the database is decided in its own ADR and built before the application is published for general use. The conditions were kept: the seven ports that hold state express what a database answers, they have contract tests that any adapter can run, and users live behind ports ([ADR-0004](0004-authentication.md)). Everything the system stores is still in memory, and a restart loses all of it.

The ports ask for guarantees that a database has to give: uniqueness decided by a constraint, a partial unique index for the Active alert of an owner and Listing, a save that is conditional on the state that was read, an update of the login attempts that does not lose a count when several arrive together, and lists with a fixed order and a total. The author works alone and wants few dependencies and no second model of the data next to the domain.

## Decision

| Aspect | Choice |
|---|---|
| Database | **PostgreSQL**, run as a server |
| Access from the code | The driver **`pg`** and SQL written by hand in the adapters, which sit behind the ports. No query builder and no ORM |
| Schema changes | Numbered SQL files, applied once each by a small runner of the project, and recorded in a table |
| In development and in tests | One service in a `compose.yaml`, started with Docker. `npm test` stays in memory, and the contracts run against the database with `npm run test:db` |
| Configuration | `DATABASE_URL`, from the environment. Without it the server runs in memory and says so |

The schema, what each operation does, the migrations and the tests are in the [design of feature 11](../features/11-persistence/03-design.md).

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| SQLite, in a file | No server to run, and it needs no Docker. It has one writer at a time, so the cases of two requests at once would be tested in a gentler setting than the ports were written for, and the module of Node that serves it would have to be checked against the minimum Node of the repository, 22 |
| A query builder | Its types check a query. It is a dependency and a vocabulary more, for seven small adapters whose queries the contracts already check |
| An ORM | The most done for the author, and a second model of the data next to the domain, which the project avoided |
| A migration tool | Less to write, and a dependency and its way of working. The runner is small and its cases are scenarios of the feature |
| Another kind of database | The ports are relational: ordering, pages by offset, uniqueness and a conditional update |

## Consequences

- The backend gains two dependencies, `pg` for production and its types for development, and with the driver a dozen packages. Starting the database needs Docker, and the tests of the database need it running.
- The adapters are SQL written by hand: the mapping of rows to objects is written once for each store, and a query is checked only by running it, which the contracts do.
- `bigint` columns come from the driver as text, so the adapters convert them with one helper that refuses what is not a safe integer.
- Two guarantees stop being verified only in memory: uniqueness and the conditional save. The concurrency of two requests at once is tested against a real database.
- The domain and the application still know nothing of the database, and a test checks that they do not import the driver.
- The server has two modes, with a database and in memory, and says which one it runs in.

## Open

- Where the database runs when the application is deployed, how it is backed up, and how many connections it needs: in the deployment decision.
- The version of PostgreSQL in `compose.yaml`: chosen when it is built, after checking that its image exists.
- Whether the server may run in production, which it does not do today because of the public demo passwords: in the deployment decision.
