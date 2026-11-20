# ADR-0004: Users authenticate with server-side sessions, scrypt and a bearer token

- Document status: Approved
- Decision status: Accepted
- Date: 2026-11-19

## Context

Today a User is identified by a fixed demo token. The adapter that knows the tokens stands behind a port, `Authenticator`, which answers who a token belongs to, and the routes of Users and the Price History use it. The use cases never see a credential, only the identified User. The price providers have their own fixed credential, which is not interchangeable with the one of a User.

[ADR-0003](0003-persistence-deferred.md) decided that real authentication is built with its users in memory, that passwords are stored hashed with a vetted library and no cryptography written by the project, and that the mechanism is decided in its own ADR. The application is delivered with a test user, and a User needs to be able to register and sign in.

## Decision

| Aspect | Choice |
|---|---|
| After the login | A **server-side session** with an opaque token, random and unpredictable, made with the cryptographic random generator of the platform. A session expires, and signing out deletes it |
| What the server keeps of a session | A **hash of the token**, not the token. The client receives the token once, when the session is created |
| Passwords | **`scrypt`**, from the standard library of Node, with a random salt for each password. The stored text carries the version of the format and the parameters, so that they can change, or the algorithm be replaced, without breaking the accounts that exist |
| Where the token travels | The header `Authorization: Bearer <token>`, as today |
| Price providers | Not covered. Their credential stays fixed until a decision of its own |

The values that are not decided here are decided in the feature of accounts: the rules of registration, the policy of passwords, how the login is slowed against repeated attempts, the lifetime of a session and the parameters of `scrypt`.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| A signed token (JWT), with no state | The server would not have to look anything up, but signing out and invalidating a session become hard, a signing key must be managed, and the token needs an expiry and a way to renew it. None of that is needed to serve a few Users |
| `argon2` as a package | It is usually the first choice for storing passwords. But it brings a package with native code, which can fail to install where the application is deployed. `scrypt` is in the standard library, adds no dependency, and is an accepted algorithm |
| A cookie that scripts cannot read | It protects the token better from being stolen by a script of the page, but it needs a defence against forged requests and depends on how the interface is served. It is reconsidered in the decision on the interface |
| Deferred, with fixed tokens until the interface | Nothing could be said of real accounts, and the interface would be built on a login that is going to change |

## Consequences

- The port `Authenticator` does not change: it still answers who a token belongs to. Only its adapter does, and so does the adapter that tells the module of Price Observations whether a token is a User's. The routes and the use cases do not.
- No dependency is added.
- With the users and the sessions in memory, a restart loses them: every User signs in again, and an account that registered is gone. It is documented, and the test user is created at startup.
- A hash costs time and memory on purpose, so a login is slow. That is the defence of the password, and it is also a way to overload the server, which is why the feature has to limit the attempts.
- The session expires and can be ended, which a signed token would not allow without more mechanism.
- Only the hash of a token is kept, so a copy of the store gives no usable session.

## What changes with persistence

None of the three decisions changes when a database exists: only where things are kept.

| What | In memory | With a database |
|---|---|---|
| Users | Lost on restart | They stay. The test user is created only if it does not exist |
| Email of an account | Unique by the store | Unique by a constraint of the database. The port fails with a concrete error, as the other ports do |
| Two registrations at the same time | Atomic in memory | The constraint decides, as it does for the alerts and the Notifications |
| Sessions | Lost on restart | They stay. Those that expired have to be removed from time to time |
| The fixed tokens of the demo | In the code | They go: they become Users with a password |

Users and sessions are kept behind ports with contract tests, as the other stores are, so that a database adapter has to pass the same checks.

## Open

- How the interface is served, and whether the token then travels in a cookie: in the decision on the interface.
- The authentication of the price providers.
- Verifying an email, recovering a password and the roles of a User: not decided and not needed yet.
