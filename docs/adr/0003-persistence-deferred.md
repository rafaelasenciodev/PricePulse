# ADR-0003: Persistence is deferred and the in-memory adapters stay

- Document status: In Review
- Decision status: Accepted
- Date: 2026-11-19

## Context

The application is built on ports and adapters. Each feature defines the ports it needs, and the adapters that implement them are in memory: the stores of Price Alerts, Price Observations and Notifications, and the catalogue of Listings. Every port has contract tests that any adapter must pass, so that a database adapter can be held to the same expectations later.

The next features are reading and managing alerts, real authentication and a web interface. A database is not needed to build them, and choosing one now would mean doing it before the queries that the reads need are known.

A goal of the project is to show persistence, and the application is meant to be delivered working, ideally deployed. A deployed application with in-memory storage keeps no data across restarts, so persistence has to come before the application is published for general use.

## Decision

Persistence is deferred. The in-memory adapters are the only adapters until a feature of persistence replaces them.

It is deferred under four conditions:

1. **Ports that a database can implement.** New ports, in particular those of the reads, express what a database would answer: queries by owner and by Listing, and pagination. No port has an operation that only makes sense in memory.
2. **Contract tests for every port,** as today, so that any adapter can run them.
3. **Authentication with in-memory users.** Real authentication is built with its users in memory. Passwords are stored hashed, with a vetted library and no cryptography written by the project, and a test user is created at startup. Registered users are lost when the server restarts. The mechanism (sessions or tokens) is decided in its own ADR.
4. **The database is decided and built before the application is published for general use,** or earlier if a feature needs data that lasts. Its choice is a separate ADR.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| Persistence now, before the reads and the authentication | Every later feature would rest on real storage, and the guarantees would be verified sooner. But it needs a database, migrations and configuration before there is anything visible to show, and the choice would be made without knowing what the reads ask of it |
| No persistence at all | The simplest. But the application would keep nothing across restarts, and it would not show persistence |
| An intermediate adapter over files | It would be written only to be replaced, and it would verify none of the guarantees that a database has to give |
| Deferred, with conditions (chosen) | The ports and the contract tests keep the later change mechanical, and the project keeps moving while the queries become known |

## Consequences

- The next features are built without infrastructure, and the database is chosen with the real queries in front.
- Several guarantees stay verified only in memory until persistence arrives: the uniqueness of the Active Price Alert per owner and Listing, of a Price Observation by its identity and of a Notification per alert, the concurrency of two requests at the same time, and the save of an alert that must become conditional. The follow-up sections of the completions of [feature 01](../features/01-create-price-alert/10-completion.md), [feature 02](../features/02-price-observation/10-completion.md) and [feature 03](../features/03-alert-evaluation/10-completion.md) list what the feature of persistence must settle, among them how a stored Price Alert is rebuilt.
- Data is lost when the server restarts, including the users that register. It is documented, and the test user is recreated at startup.
- The feature of persistence will touch every repository at once. The contract tests are what keeps that change safe.
- A deployment before persistence is only a demonstration. It must say so.

## Open

- Which database, how it is run and how its schema changes are decided: in a separate ADR.
- The mechanism of authentication: in a separate ADR.
- Where the application is deployed: in a separate ADR.
- When the persistence feature takes place: after the web interface and before the public deployment, as planned today. It moves earlier if a feature needs durable data.
