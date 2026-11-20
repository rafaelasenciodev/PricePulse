# ADR-0007: The public demo runs on Render, with its database in Neon

- Document status: Approved
- Decision status: Accepted
- Date: 2026-11-20

## Context

[Feature 12](../features/12-deployment/01-discovery.md) puts the application at a public address as a demo with simulated data, so that a Reviewer can try it without installing anything. Its discovery fixes what the platform must do: keep a Node process running that serves the API and the web interface, give it a PostgreSQL database, serve it over HTTPS (the cookie of the Session is `Secure` for an `https` origin, BR-05), and cost nothing (Q8). [ADR-0006](0006-postgresql.md) left open where the database runs, how it is backed up and how many connections it needs. The demo may wait one or two months before someone opens it.

The conditions below are what the official pages of each provider said when they were read on 2026-11-20. They are the providers' statements, not facts of the project, and they change. They are read again before the project is delivered.

## Decision

| Aspect | Choice |
|---|---|
| Application | A **Render** free web service, started with `npm start` (feature 12, design). `HOST=0.0.0.0` and `PORT` are set from its environment |
| Database | A **Neon** free project, PostgreSQL |
| Connection | The **direct** connection string of Neon, not the pooled one. The migrations take a session advisory lock (`pg_advisory_lock`), which the pooled connection does not support |
| Encrypted connection | `sslmode=require` in `DATABASE_URL`. That the driver `pg` honours it is checked when it is built |
| Backups | None scheduled. The restore window of Neon is the only safety net, and the demo can be rebuilt with its reset command |
| Keeping it awake | Nothing. No service sends requests to avoid the sleep of the platform |

### Conditions read

| Provider | What its page says | Page |
|---|---|---|
| Render, web service | 750 free instance hours a month for a workspace. It spins down after 15 minutes without traffic, and waking it takes about one minute. It may be restarted at any time. Custom domains and managed TLS are supported. The page says free instances are for testing and hobby use | render.com/docs/free |
| Render, web service | The free instance has 0.1 CPU and 512 MB of memory | render.com/docs/compute-plans |
| Render, web service | A Node service (not Docker) takes a Build Command and a Start Command set by the user, and environment variables and secrets. The free page lists no restriction on them | render.com/docs/web-services, render.com/docs/free |
| Render, web service | The service must bind to host `0.0.0.0`, on the port of the `PORT` variable (10000 by default) | render.com/docs/web-services |
| Render, web service | The Node version is chosen by `NODE_VERSION`, then `.node-version`, then `.nvmrc`, then `engines` of `package.json`. The default is 24.22.1 for services created on or after 2026-10-21 | render.com/docs/node-version |
| Render, web service | A root directory can be set. "Files outside your service's root directory are not available to the service at build time or at runtime" | render.com/docs/monorepo-support |
| Render, web service | Not stated: whether inactive free services are deleted. Only the free PostgreSQL is stated to be deleted | render.com/docs/free |
| Render, PostgreSQL | Expires 30 days after creation, deleted after a 14-day grace period, 1 GB, no backups | render.com/docs/free |
| Neon | 1 GB of storage and 100 CU-hours a month per project, no credit card. When the hours are used up the compute is suspended until the next month, and no data is deleted | neon.com/pricing, neon.com/docs/introduction/plans |
| Neon | The compute suspends after 5 minutes without use, and it resumes in "a few hundred milliseconds". Free projects are not paused for inactivity | neon.com/pricing |
| Neon | Restore up to 6 hours back. No scheduled backups on the free plan | neon.com/docs/introduction/plans |
| Neon | 112 direct connections at the smallest compute. The pooled connection runs in transaction mode and does not support session advisory locks | neon.com/docs/connect/connection-pooling |

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| The free PostgreSQL of Render | It expires after 30 days, and the demo has to last months |
| Koyeb, application and database | Secondary sources disagree on whether it sleeps and whether it asks for a card, and its official pages were not read |
| Fly.io | Secondary sources say it has no free plan for new accounts. Its official pages were not read |
| A server of the Author's own or rented | It costs money, which Q8 ruled out, and HTTPS, updates and backups would be work of the Author |
| The pooled connection of Neon | The advisory lock of the migrations is not supported through it |

## Consequences

- The first answer after a period without visits takes about a minute while Render wakes the service, and the database wakes in less than a second. The README says so, and the demo is described as a limitation, not as a defect.
- A keep-alive service would be counter-productive: a compute of 0.25 CU awake for a whole month is about 186 CU-hours, more than the 100 of the plan, so Neon would suspend the database before the month ended.
- Nothing in the code changes because of Neon. The pool of 10 connections fits in the direct limit.
- The demo depends on two providers and on their free plans staying as they are. If they change, the project can run locally with `docker compose`, and the video is the record of it working.
- Before the delivery, and before the review window, the Author reads the conditions again, opens the address, runs the reset command and goes through the round trip once.

## Open

- Whether Render deletes free services that stay inactive for long. Its pages do not say. It is read again before the delivery.
- Whether 0.1 CPU and 512 MB are enough for `tsx` to start in an acceptable time. It is measured when the service is created, and this ADR changes if it is not.
- The root directory of the service has to be the root of the repository, because the server serves `frontend/dist` from outside `backend/`. The build and start commands are fixed in the design of feature 12.
