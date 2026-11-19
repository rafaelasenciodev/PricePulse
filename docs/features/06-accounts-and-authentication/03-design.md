# 06 — Accounts and Authentication: Design (Stage 3)

Status: Approved. Every decision in section 6 has status Accepted.

The design of the feature: the model, the use cases, the ports and the way in. It builds on the [discovery and rules](01-discovery.md), the [scenarios](02-scenarios.feature) and [ADR-0004](../../adr/0004-authentication.md). It does not describe persistence technology.

## 1. The model

A new module, `accounts`, with its own domain, application, adapters and HTTP layer. The identifier of an Account is the `UserId` that the Price Alerts already use, so `UserId` moves to the shared module, as `Price` and `ObservedAt` did.

| Element | What it is | Rule |
|---|---|---|
| `Email` (Value Object) | Text made lower case, without surrounding spaces. It has text before and after a single `@`, and at most 254 characters. Two that differ only in case or spaces are equal | BR-01 |
| `Password` (rule) | Text of 10 to 128 characters, counted as characters and not as bytes, and not equal to the email. It is checked when it is given and never kept | BR-03, BR-04 |
| `Account` (entity) | Identifier (`UserId`), `Email` and the hash of the password. It has no operation that changes it: there is nothing to change in this feature | BR-01, BR-04 |
| `Session` (entity) | The hash of its token, the Account, its creation and its expiry, 7 days after the creation. It is valid until the expiry, excluded | BR-07, BR-08 |
| `FailedAttempts` (Value Object) | How many failed sign-ins in a row an email has, and until when it is locked. Failing the fifth locks it for 15 minutes from that failure. A lock that has passed counts as no failures | BR-06 |

| Where each rule lives | |
|---|---|
| BR-01, BR-03 | Domain: `Email` and `Password` |
| BR-02 | Application and port: the port refuses an Account whose email is already stored |
| BR-04 | Domain and port: the Account holds a hash, and the hash is made by a port |
| BR-05 | Application: the same answer for an unknown email and a wrong password, and a hash is always checked |
| BR-06 | Domain (`FailedAttempts`) and application (it is looked at before the password) |
| BR-07, BR-08 | Domain (`Session` is valid or not at a moment) and application |
| BR-09, BR-10 | Application |
| BR-11 | The two credentials have their own hooks, and the token of a Session is not the credential of a Provider |
| BR-12 | The Composition Root and `main.ts`: they register the two Accounts with the use case, as anyone would |

## 2. Use cases

| UC | Input | Output | Flow |
|---|---|---|---|
| **UC-01 Register** | `email`, `password` (text) | The Account: `id`, `email` | 1. The email and the password are valid, or `InvalidRegistration`, which tells which. 2. No Account has that email, or `EmailAlreadyRegistered`. 3. The password is hashed and the Account is stored. If the store refuses it because another registration came first, it is `EmailAlreadyRegistered` too |
| **UC-02 Sign in** | `email`, `password` (text) | `token`, `expiresAt`, the Account | 1. If the email is locked: `TooManyAttempts`, with the time to wait, **without looking at the password**. 2. The Account is looked up and a hash is always checked, against a fixed one if there is no Account. 3. If it does not match: the failure is counted and the answer is `InvalidCredentials`. 4. If it matches: the count is cleared, a Session is created and its token is given |
| **UC-03 Sign out** | `token` | Nothing | The Session of the token is ended. A token that is not valid is `Unauthenticated` |
| **UC-04 Read my account** | `owner` | The Account: `id`, `email` | The Account of the owner |
| **UC-05 Authenticate** (used by the other modules) | `token` | The `UserId`, or nothing | The Session with the hash of the token, if it exists and is valid at this moment |

The email of a sign-in is read as text without being required to be valid: an email that cannot be one is an unknown email, with the same answer and the same counting (SC-09, SC-15). Failed attempts are counted by the email in its normal form, valid or not.

| Application error | Rules | When |
|---|---|---|
| `InvalidRegistration` | BR-01, BR-03 | The email is not valid, or the password is too short, too long or the email |
| `EmailAlreadyRegistered` | BR-02 | The email has an Account |
| `InvalidCredentials` | BR-05 | The email or the password is not valid, without saying which |
| `TooManyAttempts` | BR-06 | The email is locked, and it carries the seconds to wait |
| `Unauthenticated` | BR-08, BR-09 | The token is unknown, expired or of a Session that ended |

## 3. Ports

| Port | Operation | Contract |
|---|---|---|
| `AccountRepository` | `add`, `findByEmail`, `find` | `add` fails with `EmailAlreadyRegistered` if the email is stored. It is atomic, so two registrations at the same time leave one |
| `SessionStore` | `add`, `findByTokenHash`, `delete` | A Session is found only by the hash of its token |
| `LoginAttemptStore` | `get(email)`, `save(email, attempts)`, `clear(email)` | Capped in size, so that someone who tries many emails cannot grow it for ever. The oldest are dropped |
| `PasswordHasher` | `hash(password)`, `verify(password, hash)` | The hash carries its version and parameters. `verify` takes the same time whatever the hash is |
| `SessionTokens` | `create()`, `hash(token)` | A token is random and unpredictable. Only its hash is kept |
| `Clock` | `now()` | A port of this module, since the others cannot be imported |

## 4. Concurrency and transaction boundary

- Registering writes one Account, and its uniqueness is guaranteed by the store, as in the other modules. There is no Unit of Work.
- Two failed sign-ins at the same time can be counted as one if the count is read and written apart. The in-memory store does it in one step, and a database will have to increment atomically. It is noted for persistence.
- A Session is written once and deleted once. Signing out twice at the same time leaves it deleted.

## 5. The way in

| Request | Use case | Answers |
|---|---|---|
| `POST /accounts` with `{ "email", "password" }` | UC-01 | 201, 400, 409 `EMAIL_ALREADY_REGISTERED`, 422 `INVALID_REGISTRATION` |
| `POST /sessions` with `{ "email", "password" }` | UC-02 | 201, 400, 401 `INVALID_CREDENTIALS`, 429 `TOO_MANY_ATTEMPTS` with `Retry-After` |
| `DELETE /sessions/current` | UC-03 | 204, 401 |
| `GET /accounts/me` | UC-04 | 200, 401 |

The first two need no token, and the others carry it in `Authorization: Bearer`. A Session is a resource: signing in creates one and signing out deletes the current one. The routes of the other modules do not change: they still ask a port who the token belongs to, and the Composition Root now answers with UC-05.

## 6. Decisions

| ID | Decision | Status |
|---|---|---|
| 1 | The module `accounts`, with its four layers, and `UserId` in the shared module | Accepted |
| 2 | `Email`, `Password`, `Account`, `Session` and `FailedAttempts` are the model, and the policy of the attempts belongs to the domain | Accepted |
| 3 | Six ports: accounts, sessions, attempts, password hash, token and clock | Accepted |
| 4 | A hash is always checked when signing in, against a fixed one if the Account does not exist | Accepted |
| 5 | Routes: `POST /accounts`, `POST /sessions`, `DELETE /sessions/current`, `GET /accounts/me` | Accepted |
| 6 | The other modules keep their ports. The Composition Root adapts UC-05 to `Authenticator` and to `UserAuthenticator`, so no hook changes | Accepted |
| 7 | The reading of the `Bearer` token becomes one function of the shared module, used by every hook | Accepted |
| 8 | The adapters of `accounts` may use `node:crypto`, and the shared layer holds what is not domain too, such as that function | Accepted |
| 9 | The Composition Root takes the hasher as an option, and the tests give it a fast one | Accepted |

Alternatives that were weighed:

- **Decision 1:** an `AccountId` of its own in `accounts`, converted at the Composition Root. It would leave `UserId` where it is, but every adapter would convert, and an Account and a User would be two things that have the same identifier.
- **Decision 4:** answering at once when the email is unknown. It is faster, and it tells which emails have an Account by the time of the answer.
- **Decision 7:** a fourth copy. It is one line, but it is the third time that the discovery of a feature notes that the copies are a smell, and this feature touches every hook anyway when it changes who answers.
- **Decision 9:** the default hasher in every test. A hash costs time on purpose, and the tests would spend most of theirs on it.

## 7. Where each scenario is handled

| Scenario | Handled by |
|---|---|
| SC-01 to SC-06 | UC-01, `Email`, `Password` and the port that refuses a repeated email |
| SC-07, SC-08, SC-10 | UC-02: the email is read as in registering, and each sign-in creates a Session |
| SC-09, SC-15 | UC-02, step 2: the same answer, and the counting by email whether it exists or not |
| SC-11 to SC-14 | `FailedAttempts` and UC-02, step 1 |
| SC-16 to SC-18, SC-20 | UC-05 and `Session`, with the expiry excluded |
| SC-19 | UC-03: only the Session of the token is deleted |
| SC-21 | UC-04 |
| SC-22 | The hooks: the credential of a User and the one of a Provider are checked by different ports |
| SC-23 | UC-05 through the existing ports of the other modules |
| SC-24 | The Composition Root and `main.ts`, which register two Accounts with UC-01 |

## 8. Effects on the other features

- **All the modules.** `UserId` moves to `shared`: 17 source files and 34 test files change an import, and nothing else.
- **Alerts, observations.** Their ports and hooks do not change. The three copies of the `Bearer` regex become one function.
- **The tests.** 13 files build a fixed-token authenticator. They get their Users from a helper of the composition, with the fast hasher. The fixed-token adapter stays for the tests of the modules that build their own application.
- **`main.ts`.** The fixed tokens go. The two Accounts and the demo Price Alert are made with the use cases.
- **The API and the README.** Every example starts with a sign-in. The documentation has two tags, Accounts and Sessions.

## 9. Carried to the build

The parameters of `scrypt` and the format of the hash. The size of the cap of the attempts. The documented emails and passwords of the two demo Accounts. The contract tests of the three stores. The change of the architecture test. A test that the time of an unknown email is close to that of a wrong password.
