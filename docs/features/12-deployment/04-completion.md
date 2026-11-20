# 12 — Deployment: Completion (Stage 5)

Status: Approved

The close of the feature: what was built, the decisions and their status, how it was verified, what the review found, what it does not do and what comes next. It links to the documents of each stage and does not repeat them. It is the ninth feature developed with the [method of five stages](../README.md), and the one that [ADR-0006](../../adr/0006-postgresql.md) left open and [ADR-0007](../../adr/0007-deployment-platform.md) decided.

## 1. Summary

The server can now run as a **public demo**. Declared with `DEMO_MODE=true`, it may run in production if it also has a database and the exact address of the application. It listens on the address it is told, sets the `Secure` cookie for an `https` address, says that it is a demo in its start, in `/docs` and in a notice on every screen of the interface, and a command returns its data to the first state. Without any variable the server is the development server that it always was.

**Nothing is deployed yet.** The feature prepares the code and decides the platform, Render for the application and Neon for the database ([ADR-0007](../../adr/0007-deployment-platform.md)). Creating the two services and writing the public address in the README remain to be done, and are listed in section 9.

## 2. What was built

| Stage | Result | Where |
|---|---|---|
| 1 Understand | 9 questions decided, 11 rules (BR-01 to BR-11) | [Discovery and rules](01-discovery.md) |
| 2 Scenarios | 20 Gherkin scenarios (SC-01 to SC-20) | [Scenarios](02-scenarios.feature) |
| 3 Design | The settings, the route, the reset, the interface, the build, 5 decisions | [Design](03-design.md), [ADR-0007](../../adr/0007-deployment-platform.md) |
| 4a Settings | `readSettings`, and the refusals of production | `backend/src/settings.ts`, `main.ts`, `storage.ts` |
| 4b Reset | `truncateData`, `resetDemo` and `npm run reset-demo` | `backend/src/database/truncate.ts`, `reset-demo.ts`, `run-reset-demo.ts` |
| 4c Route and interface | `GET /demo`, the note of `/docs`, the client, `DemoNotice`, and `npm start` | `app.ts`, `main.ts`, `frontend/src/` |
| 4d Verification | The traceability of the feature, the demo in process, a real browser, deliberate errors | Sections 4 and 5 |

The feature changed 8 files of the source of the backend (225 insertions, 30 deletions, 4 new) and 8 of its tests (530 insertions, 14 deletions, 5 new), and 14 of the frontend (140 insertions, 3 deletions, 3 new), besides `package.json` and its lock. It moved `tsx` from development to production dependencies, and added no new package.

## 3. Decisions and their status

The status of every decision is recorded here, and only here. Q1 to Q9 are those of the discovery and D1 to D5 those of the design, in its section 8.

| Decision | Status | Evidence |
|---|---|---|
| Q1 A public demo with demo Accounts that are announced | Verified | The whole round trip, SC-11 to SC-14 and a real browser |
| Q2 A Reviewer makes a price fall in `/docs` with the token of the Provider, and there is no button | Verified | SC-13, SC-14. The same request that `/docs` sends was made with `curl`; the **Authorize** screen was not driven |
| Q3 Registration stays open | Verified | SC-11, SC-12 |
| Q4 A command resets the data | Verified | SC-15 to SC-17 and one deliberate error |
| Q5 An explicit demo mode, and production is refused without it | Verified | SC-01 to SC-03, SC-19, SC-20 and one deliberate error |
| Q6 `HOST`, and `Secure` when the origin is `https` | Implemented | SC-07 to SC-10. `Secure` was checked in the header, not over real HTTPS |
| Q7 No protection against abuse beyond the limit on sign-in | Accepted | A stated limitation. SC-18 checks the limit on sign-in |
| Q8 Free hosting | Accepted | [ADR-0007](../../adr/0007-deployment-platform.md). Not realised: no service exists |
| Q9 A visible notice in the interface | Verified | SC-06, and a real browser (Chrome, over HTTP on the local machine) |
| D1 `tsx` runs the server in production | Verified | `npm start`, and 280 MB of memory measured on the local machine |
| D2 The interface asks the server whether it is a demo | Verified | SC-06, the tests of the route, the client and the notice |
| D3 A reset that refuses without the demo mode | Verified | SC-15 to SC-17, one deliberate error |
| D4 The variables, and the refusals of BR-10 and BR-11 | Verified | SC-19, SC-20, and the real server |
| D5 Render and Neon, with the direct connection string | Accepted | [ADR-0007](../../adr/0007-deployment-platform.md). Not realised |

Decisions taken while building that the design left open or settled differently. Each one was shown to the author at its stop and approved with it.

| When | Decision | Status |
|---|---|---|
| 4a | The two tests of production of [feature 11](../11-persistence/02-scenarios.feature) (SC-32) now exercise `readSettings`, because `storage.ts` no longer decides about production | Verified |
| 4b | `npm run reset-demo` has an entry file of its own, `run-reset-demo.ts`, which the design did not list | Verified |
| 4b | The rule "only `true` declares the demo mode" is one function, `declaresDemo`, which the settings and the reset share | Verified |
| 4c | **The route `GET /demo` is hidden from `/docs`**, and the design said that it was documented. It is for the interface, and listing it broke four tests of other features that compare the exact paths. The design was corrected | Verified |
| 4c | In demo mode the note of `/docs` does not name the host of the database, as the development note did: the page is public | Verified |
| 4d | SC-09 to SC-14 and SC-18, which the design said were only verified, have a test that runs a demo in process | Verified |

### Effect on the other features

- **The settings** are a new layer of the architecture test, and `reset-demo` another.
- **The client of the interface** has twelve operations, and the provider of the Session forwards `demo` without watching it, because it needs no Session.
- **The traceability guard** has the feature. The tests of the interface of feature 12 are told apart from those of feature 09 by a file name that starts with `demo`.

## 4. Verification

- **Tests:** the backend has 1,665 test cases in 86 files that run in memory, 41 more than before, and **236 in 13 files that run against the database**, 7 more. The frontend has 394, 10 more. All pass, and `tsc` is clean in both.
- **Scenarios:** 18 of the 20 have tests, read from their titles. SC-04 and SC-05 are exempt, with their reason: what the server says is made in `main.ts`, which no test of the project runs, and they were checked by hand.
- **Deliberate errors,** two, where a mistake is costly. A reset without the guard of the demo mode made 2 tests fail, one of them the one that checks that nothing is changed. Production accepted without the demo mode made 3 fail. The code was restored each time.
- **By hand:**

| What | Result |
|---|---|
| The real server in production without the demo mode, without a database, and without the origin | Each refused with its own message, exit code 1 |
| The real server in demo mode, and in development | `/demo` answers `true` and `false`; the start says so only in demo mode; `/docs` has the paragraph of the demo and no host of a database |
| A real browser (Chrome, local, over HTTP): the notice on the sign-in screen, the Catalogue and the Notifications; sign in with a demo Account; its alert Active; a price of 79.00 recorded as `simulator` | The alert became Triggered, and the Notification showed 79.00 against 80.00 |
| The address: without `HOST`, then `HOST=0.0.0.0`, reached from the network address of the machine | The first did not answer there and the second did |
| `npm run reset-demo` against the test database: without the demo mode, without an address, with an address that cannot be reached, and correct | The three refusals said why and ended in 1, and the last one created the demo data. The unreachable one said only `ECONNREFUSED` |
| `sslmode=require` in the connection string, read by the driver | It turns the encryption on. Without the parameter it does not |
| The memory of the server with `tsx` | About 280 MB in all, `npm` included, for the 512 MB of the free instance ([ADR-0007](../../adr/0007-deployment-platform.md)) |

- **Not done.** No service was created in Render or Neon, so the real address, the start command in the platform, the time that a free instance takes to start with a tenth of a CPU, the connection through the TLS of Neon, and the reset against that database were not tried. Neither was a real `https` origin. The server of the browser test kept its data in memory.

## 5. Architecture review

- **Dependencies:** the settings import only `shared`, and the reset names no driver, because it asks `database` for the pool. The architecture test enforces both.
- **No use case, port or rule of the domain changed.** The route of the demo is in the application layer of the server and holds no secret.
- **Failures:** a refusal of the settings or of the reset is an error with a message that is safe to show, and what is not a refusal is shown only as its code. The reset empties in one transaction.

This review was made by the author of the code on the whole branch, and `/code-review` was not run.

| # | Finding | What was done |
|---|---|---|
| 1 | In production, without `HOST` the server listens on `127.0.0.1`, and a platform would not reach it | Not changed: it is the decision of Q6. The README lists it as a step of the deployment |
| 2 | The README said that the server refuses production and listens only on the local machine | Updated in this close |
| 3 | The development note of `/docs` named the host and the database | Fixed for demo mode (section 3) |
| 4 | `chooseStorage` and `readSettings` both read `DATABASE_URL` | A limitation: they would have to share it, which means changing the tests of the database |
| 5 | The reset is not one transaction: it empties, and then it creates the data with the use cases | A limitation. If it fails in between, running it again repairs it |

## 6. What the process revealed

| When | What | Result |
|---|---|---|
| 3 | The migrations take a session advisory lock, which the pooled connection of the database does not support | The decision of ADR-0007 is the direct connection string |
| 4c | A route that is added to the application directly is not seen by the documentation, which is a plugin loaded later | The route is registered where the others are, and then hidden |
| 4c | Four tests of other features compare the exact list of paths of the documentation | The route was hidden instead of editing them |
| 4d | The guard reads the titles of `it`, and not those of `describe`, as in feature 11 | The identifier is in the title of the tests |
| 4d | `timeout` does not exist in the shell of macOS | The servers were started in the background and stopped by hand, and none was left running |

## 7. Known limitations

- **The demo is public on purpose.** Its passwords and the token of the Provider are known, anyone can change the prices of everyone, and anyone can fill the database with Accounts. It is protected only by the limit on sign-in and by the reset that the Author runs.
- **Free plans.** The first answer after a while without visits is slow, and the conditions that the [ADR](../../adr/0007-deployment-platform.md) cites were read on 2026-11-20 and change. There are no scheduled backups.
- A deployment that is not a demo cannot use its own passwords, because they are in the code. The demo mode is the only way to run in production today.
- If the question of the interface fails, the notice is not shown, and the person is not told.
- A server in production needs `HOST`, `WEB_ORIGIN`, `DATABASE_URL` and `DEMO_MODE` set, and the origin has to be the exact public address.
- `main.ts` still has no test, and no continuous integration runs the tests.

## 8. Documentation volume

The documents of the first three stages have 469 lines (discovery and rules 184, scenarios 187, design 98). The previous feature had 713, so it is 34 % less. This one touches the start of the server and little else.

## 9. Follow-up

**Next,** in the order agreed: create the services in Render and Neon as the [ADR](../../adr/0007-deployment-platform.md) says, write the public address in the README, run the steps of the Author before the delivery, and then the final README, slides and video.

**Not started and not scheduled:** closing the registration once the project has been validated, taking the passwords out of the code, an automatic reset, a guide page in the interface, and a limit of requests.

## 10. Completion checklist

- [x] Stages 1 to 4 completed
- [x] Documentation of stage 5 written (this document)
- [x] This document is approved by the author
- [x] The README, the glossary and the documentation indexes describe this feature
- [x] [ADR-0007](../../adr/0007-deployment-platform.md) has its status decided: Approved, Accepted
- [ ] The services are created, and the address of the demo is in the README
- [ ] The feature is merged into `develop` with `--no-ff`, and `develop` into `main` and tagged (done by the developer, [ADR-0002](../../adr/0002-branching-model.md))
- [ ] A licence is chosen before the repository is published
