# 06 — Accounts and Authentication: Discovery and Business Rules (Stage 1)

Status: Approved. Every question below has a **Decision** line with status Accepted. *Lean* lines record the proposal that was discussed.

## 1. The business problem

A User is identified today by a fixed demo token that lives in the code. Nobody can register, sign in or sign out, and anyone who reads the repository knows every token. The application cannot be delivered like that: it needs real accounts, and a test user for whoever reviews it.

The system needs to let a person register, sign in to get a way of being recognised, and sign out.

## 2. Actors and goal

| Actor | Role |
|---|---|
| **Person** | Registers, signs in and signs out. After signing in, they are a User |
| **User** | Reads their own account, and does everything the other features already allow |
| System | Checks the password, keeps the sessions and limits repeated attempts |
| Provider | Not an actor. Its credential is separate and does not change |

**Goal:** "Create my account, sign in with it and be recognised in my requests, and sign out when I am done."

## 3. Scope (proposed)

**Is:** registering with an email and a password, signing in, signing out, and reading one's own account. The development server starts with two accounts that can be signed in to, and the fixed demo tokens go.

**Is not:** verifying an email, recovering or changing a password, roles, deleting an account, signing out of every session at once, the authentication of price providers, persistence and the interface. Each is a separate feature or decision.

**Scope approved** for stage 1 (see section 9).

## 4. What is already established

| Fact | Source |
|---|---|
| A User is a registered person who has signed in. The use cases never see a credential: they receive the identified User | Glossary, feature 01 decision 1 |
| The identity reaches the routes through a port, `Authenticator`, that says who a token belongs to. Its adapter holds fixed tokens. The Price History uses the same one through a small adapter of the Composition Root | `Authenticator`, `composition-root.ts` |
| The identifier of a User, `UserId`, is defined inside the module of Price Alerts. A module cannot import another | `price-alerts/domain/identifiers.ts` |
| Two fixed tokens, `demo-token-1` and `demo-token-2`, stand for two Users. The demo Price Alert belongs to the first | `main.ts` |
| The credential of a price provider is separate from the ones of Users, and it does not change here | Feature 02 |
| Users and sessions are kept in memory. A restart loses them | [ADR-0003](../../adr/0003-persistence-deferred.md) |
| Sessions are server-side, with an opaque token of which only the hash is kept. Passwords are hashed with `scrypt`. The token travels in `Authorization: Bearer` | [ADR-0004](../../adr/0004-authentication.md) |
| The application is delivered with a test user and its password, and the development server refuses to start in production | Delivery of the project, `main.ts` |

## 5. Ambiguities and questions

Questions marked **●** must be resolved before this stage can close.

### ● Q1 — How far does this feature go?

| Option | Includes | Trade-off |
|---|---|---|
| A | Register, sign in, sign out, and read one's own account | The minimum for real accounts |
| B | A, plus changing the password | A common need, and one more rule, the old password |
| C | A, plus verifying the email and recovering a password | They need to send email, which does not exist |

*Lean:* **A**.

**Decision (Accepted):** A. Register, sign in, sign out, and read one's own account. Changing a password, verifying an email and recovering a password are out.

### ● Q2 — What identifies an account?

| Option | Effect  | Trade-off |
|---|---|---|
| A | The email, with no other name. Two emails that differ only in case or in surrounding spaces are the same | |
| B | A username that the person chooses | |
| C | Both | More to ask and to keep unique |

*Lean:* **A**. The email is the name to sign in with. It is not verified: nothing is sent to it.

**Decision (Accepted):** A. The email identifies the account, and it is not verified.

### ● Q3 — What is a valid password?

| Option | Rule |
|---|---|
| A | At least 8 characters |
| B | From 10 to 128 characters, and not the email |
| C | At least 12 characters |

There are no rules of composition (a capital, a digit): they make passwords harder to remember and not much harder to guess. The upper bound keeps the cost of hashing bounded.

*Lean:* **B**.

**Decision (Accepted):** B. From 10 to 128 characters, not the email, and no other rule of composition.

### ● Q4 — What if the email is already registered?

| Option | Effect  | Trade-off |
|---|---|---|
| A | It is rejected as a Conflict | The person knows what happened. It tells anyone that the email has an account |
| B | The same answer as a success | It does not tell, but without email it leaves the person not knowing |

*Lean:* **A**: B only makes sense when a message can be sent to the email. The cost is accepted and limited by Q6.

**Decision (Accepted):** A. It is rejected as a Conflict. The cost, that anyone can find out whether an email has an account, is accepted and limited by Q6.

### ● Q5 — How is a failed sign-in answered?

| Option | Effect  | Trade-off |
|---|---|---|
| A | One answer for an unknown email and for a wrong password | It does not tell which emails have an account |
| B | Two answers | Clearer for the person, and it tells |

*Lean:* **A**, and the time taken must not tell the two cases apart either.

**Decision (Accepted):** A. One answer for an unknown email and for a wrong password, and the time taken does not tell them apart.

### ● Q6 — How are repeated attempts slowed?

| Option | Effect  | Trade-off |
|---|---|---|
| A | After 5 failed sign-ins in a row for an email, attempts are refused for 15 minutes. A success resets the count | Simple. Anyone who knows an email can keep it locked out |
| B | A, and also by the address of the client | Harder to abuse, and it needs the address, which depends on how the server is reached |
| C | No limit | The hash costs time and memory, so repeated attempts are also a way to overload the server |

*Lean:* **A**, with the numbers above.

**Decision (Accepted):** A. After 5 failed sign-ins in a row for an email, attempts are refused for 15 minutes, and a success resets the count. The cost, that someone who knows an email can keep it locked out for that time, is accepted.

### ● Q7 — How long does a session last?

| Option | Effect  | Trade-off |
|---|---|---|
| A | 7 days from the sign-in, and it does not renew | Simple and predictable |
| B | It renews with use | A person who keeps using it is never asked again, which also keeps a stolen token alive |
| C | 24 hours | Safer, and the demonstration is asked to sign in again often |

*Lean:* **A**. A person can have several sessions at once, one per place they signed in.

**Decision (Accepted):** A. 7 days from the sign-in, with no renewal, and several Sessions at once.

### ● Q8 — What happens to the demo tokens?

| Option | Effect  | Trade-off |
|---|---|---|
| A | They go. The development server creates two accounts with documented emails and passwords, and a token is obtained by signing in | One way to be a User, and the test user that the delivery asks for |
| B | They stay as a second way | Two ways, one of them fixed in the code |

*Lean:* **A**. The demo Price Alert belongs to the first account.

**Decision (Accepted):** A. The fixed demo tokens go. The development server creates two accounts with documented emails and passwords, and the first owns the demo Price Alert.

### Q9 — Does registering sign the person in?

*Lean:* no. It answers with the account, and signing in is another request. The two concerns stay apart.

**Decision (Accepted):** as proposed.

### Q10 — What identifies an account in the rest of the system?

*Lean:* the same `UserId` that the Price Alerts already use, generated when the account is created, so that nothing else changes.

**Decision (Accepted):** as proposed.

### Q11 — What does reading the account show?

*Lean:* its identifier and its email. Never the password or its hash.

**Decision (Accepted):** as proposed.

## 6. Business rules

| ID | Rule | Origin |
|---|---|---|
| BR-01 | A person registers with an email and a password. The email identifies the account: two that differ only in case or surrounding spaces are the same. An email is valid if it has text before and after a single `@` and at most 254 characters. Its existence is not checked | Q2, found in stage 2 |
| BR-02 | Registering with an email that is already registered is rejected as a Conflict, and nothing changes | Q4 |
| BR-03 | A password has from 10 to 128 characters and is not the email. There are no other rules of composition | Q3 |
| BR-04 | A password is never stored or shown: only its hash | ADR-0004 |
| BR-05 | Signing in with the email and the password of an account creates a Session for it and gives its token once. An unknown email and a wrong password get the same answer | Q5 |
| BR-06 | After 5 failed sign-ins in a row for an email, further attempts for it are refused for 15 minutes, whatever the password. A successful sign-in resets the count | Q6 |
| BR-07 | A Session lasts 7 days from its creation. An account can have several Sessions | Q7 |
| BR-08 | A request that carries the token of a Session is made by the User of its account. A token that is unknown, expired or of a Session that ended is not valid | Q7, ADR-0004 |
| BR-09 | Signing out ends the Session of the token that was used. The other Sessions of the account stay | Q1 |
| BR-10 | A User reads their own account: its identifier and its email | Q11 |
| BR-11 | The token of a User is not valid where the credential of a Provider is asked for, and the other way round | Feature 02 |
| BR-12 | The development server starts with two accounts whose emails and passwords are documented, and without the fixed tokens | Q8 |

## 7. New terms for the glossary

**Account:** the registration of a User: an email that identifies it and a password. **Session:** the period during which a token identifies an Account. It starts when the person signs in, and ends when it expires or when they sign out. They are in the glossary.

## 8. Carried to the design

- **Where `UserId` lives.** The module of accounts needs it and cannot import the module of Price Alerts.
- Where accounts and sessions are kept, the port of the hash of a password, the random token and the clock, and how a failed attempt is counted.
- How the module of Price Alerts learns who a token belongs to once there are sessions, without importing the module of accounts.

## 9. Exit criteria

- [x] Questions marked ● answered (Q1 to Q8)
- [x] Scope (section 3) approved
- [x] Rules (section 6) approved
- [x] The User approves moving to stage 2 (scenarios)
