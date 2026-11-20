# 08 — Session Cookie: Discovery and Business Rules (Stage 1)

Status: Approved. Every question below has a **Decision** line with status Accepted. *Lean* lines record the proposal that was discussed.

## 1. The business problem

The only way to be recognised today is to send the token of a Session in `Authorization: Bearer`. A web interface would have to keep that token in the page, where any script that runs there can read it, and it lasts 7 days. [ADR-0005](../../adr/0005-web-interface.md) decided that the browser keeps the session in an `HttpOnly` cookie instead. That decision says what the cookie is, and leaves its behaviour to this feature.

The system needs to let a person sign in once in a browser and be recognised by every later request, with no script holding the token, and sign out to end it.

## 2. Actors and goal

| Actor | Role |
|---|---|
| **Person in a browser** | Signs in, uses the application and signs out. Their browser sends the cookie by itself |
| **Client of the API** | `curl`, the interactive documentation or any program. It keeps sending the token in the header |
| System | Sets and clears the cookie, and refuses a request that is not known to come from its own pages |
| Provider | Not an actor. Its credential does not change |

**Goal:** "Sign in once in the browser, be recognised by every later request without any script holding my token, and end it when I sign out."

## 3. Scope (proposed)

**Is:** setting a cookie when a User signs in and clearing it when they sign out, reading it on the routes of Users, a defence against requests forged from another site, and the setting that tells the application its own origin and whether it is served over HTTPS.

**Is not:** the web interface, a token against forged requests, CORS, security headers such as a content security policy, the `__Host-` prefix and HTTPS themselves, renewing a Session or remembering a sign-in, and any change to Providers or to the Session. Each is a separate feature or decision.

**Scope approved** for stage 1 (see section 9).

## 4. What is already established

| Fact | Source |
|---|---|
| The session is an `HttpOnly` cookie with `SameSite=Strict`, set when a User signs in and removed when they sign out, with the life of the Session. The token is still returned in the body and accepted in the header. A Provider never uses a cookie. CORS is not enabled. The exact attributes, the check of the origin and the behaviour on `http://127.0.0.1` are the job of this feature | [ADR-0005](../../adr/0005-web-interface.md) |
| The token is read in five hooks, one for each of the routes of Accounts, Price Alerts, the Catalogue, the Price History and, for Providers, the recording of prices. All use `bearerTokenOf` on the header `Authorization` | `shared/http`, the `http` layers |
| `POST /sessions` returns the token in the body, with `Cache-Control: no-store`. A Session lasts 7 days and is not renewed. Only the hash of the token is stored | [ADR-0004](../../adr/0004-authentication.md), feature 06 |
| Nothing reads or writes a cookie, there is no CORS, and no package for cookies is installed | `package.json`, the code |
| A body must be `application/json`. `text/plain` gets 400, and a form (`urlencoded` or `multipart`) gets 415. So a plain form of another site cannot sign in or register | Measured against the application |
| The `Origin` of a request is not looked at: a sign-in that carries `Origin: http://evil.example` is accepted | Measured against the application |
| The interactive documentation is served by the same application, at the same origin as the API | `app.ts` |
| The development server listens on `127.0.0.1` over HTTP only | `main.ts` |
| By the standard of cookies, a cookie is not kept apart by port, and `SameSite` compares sites and not origins. Another page on another port of the same host is the same site | RFC 6265 |

## 5. Ambiguities and questions

Questions marked **●** must be resolved before this stage can close.

### ● Q1 — What does signing in do about the cookie?

| Option | Effect |
|---|---|
| A | It always sets the cookie, and still returns the token in the body |
| B | It sets the cookie only if the client asks for it in the request |
| C | A second route signs in for browsers, and the first one does not set it |

*Lean:* **A**. It is one request and one behaviour. A client that does not keep cookies, such as `curl` and the documentation page, ignores the header and uses the body as before.

**Decision (Accepted):** A. Signing in always sets the cookie, and the token is still in the body.

### ● Q2 — What are the name and the attributes of the cookie?

*Lean:* the name `pricepulse_session`, `HttpOnly`, `SameSite=Strict`, `Path=/` because the API is at the root, and a `Max-Age` of the seconds that the Session has left. The value is the token, as the header carries it. The prefix `__Host-` needs HTTPS, so it is left to the deployment.

**Decision (Accepted):** as proposed: the name `pricepulse_session`, `HttpOnly`, `SameSite=Strict`, `Path=/` and a `Max-Age` of the seconds that the Session has left. The prefix `__Host-` is left to the deployment.

### ● Q3 — How is `Secure` decided?

| Option | Effect  | Trade-off |
|---|---|---|
| A | Never | It works on `http://127.0.0.1`, and it is unsafe once the application is served over HTTPS |
| B | Always | Right for production, and the development server could not keep the cookie |
| C | A setting of the Composition Root, off by default, that the deployment turns on | |

*Lean:* **C**. What a browser does with a `Secure` cookie on `http://127.0.0.1` is not assumed: it is tried in the feature.

**Decision (Accepted):** C. A setting of the Composition Root, off by default. What a browser does with a `Secure` cookie on `http://127.0.0.1` is tried in the feature.

### ● Q4 — What defends against a request forged from another site?

| Option | Effect  | Trade-off |
|---|---|---|
| A | Nothing besides `SameSite=Strict` | It leans on the browser alone, and a page on another port of the same host is the same site |
| B | A request that the cookie authenticates and that is not a read must carry an `Origin` equal to the one of the application. A request authenticated by the header is not subject to it. Signing in and registering are refused if they carry another `Origin` | It needs no change of the clients, and a header cannot be set by another site |
| C | B, and a token against forged requests in every request that changes something | The most defence, and a convention that every client must follow |

*Lean:* **B**. A request with no `Origin` that the cookie authenticates and that changes something is refused too, since it is what a program that holds a cookie but is not a page would send.

**Decision (Accepted):** B. A request that the cookie authenticates and that is not a read must carry an `Origin` equal to the one of the application, and one with no `Origin` is refused. Signing in and registering are refused if they carry another `Origin`. The header is not subject to it.

### ● Q5 — How does the application know its own origin?

| Option | Effect  | Trade-off |
|---|---|---|
| A | A setting of the Composition Root, with the scheme, the host and the port. `main.ts` builds it from where it listens | |
| B | The `Host` header of each request | No setting, and it depends on a proxy that passes the header as it came |
| C | A list of allowed origins | More than a single page needs |

*Lean:* **A**, with one origin. The deployment gives its own.

**Decision (Accepted):** A. A setting of the Composition Root with one origin, which `main.ts` builds from where it listens.

### ● Q6 — Is the cookie always on?

| Option | Effect  | Trade-off |
|---|---|---|
| A | Always | Every application and every test changes at once |
| B | Only when the origin is given to the Composition Root. Without it nothing is set and nothing is read | |

*Lean:* **B**. Nothing that exists changes, and `main.ts` turns it on.

**Decision (Accepted):** B. The cookie is on only when the origin is given. Without it nothing is set and nothing is read.

### ● Q7 — Which wins if a request has the header and the cookie?

| Option | Effect |
|---|---|
| A | The header, and a header that is not valid is not replaced by the cookie |
| B | The cookie |
| C | Whichever is valid |

*Lean:* **A**. A client that sends the header says who it is, and the cookie is only what the browser adds.

**Decision (Accepted):** A. The header wins, and a header that is not valid is not replaced by the cookie.

### ● Q8 — Which routes read the cookie?

*Lean:* the routes of Users: one's own Account, signing out, the Price Alerts, the Notifications, the Price History and the Catalogue. **Never** the route that records a price, which a Provider uses, so a cookie cannot make anyone a Provider.

**Decision (Accepted):** as proposed. The routes of Users read the cookie, and the route that records a price never does.

### Q9 — What happens to the cookie when it is no good, and when a User signs out?

*Lean:* signing out clears the cookie. A sign-out whose cookie is not valid, because the Session ended or expired, answers 401 as now and clears the cookie too, so the browser stops sending it. The other routes answer 401 and leave the cookie as it is.

**Decision (Accepted):** as proposed.

### Q10 — Does a failed sign-in set a cookie?

*Lean:* no. Neither a wrong password, nor a locked email, nor a malformed request.

**Decision (Accepted):** as proposed.

## 6. Business rules

| ID | Rule | Origin |
|---|---|---|
| BR-01 | When the cookie is on, a successful sign-in sets a cookie with the token of the new Session, and the body still carries it | Q1, Q6 |
| BR-02 | The cookie is `HttpOnly`, `SameSite=Strict` and `Path=/`, lasts as long as the Session has left, and is `Secure` when the application is set to be served over HTTPS | Q2, Q3 |
| BR-03 | A sign-in that fails sets no cookie | Q10 |
| BR-04 | A request to a route of Users that has no `Authorization` header and has the cookie is made by the User of that Session, as if the token had come in the header | Q8 |
| BR-05 | When a request has both, only the header is read. A header that is not valid is not replaced by the cookie | Q7 |
| BR-06 | The cookie never identifies a Provider: the route that records a price reads only the header | Q8 |
| BR-07 | A request that the cookie authenticates and that is not a read is refused unless it carries an `Origin` equal to the origin of the application. A request authenticated by the header is not subject to this | Q4, Q5 |
| BR-08 | Signing in and registering are refused if they carry an `Origin` that is not the one of the application. With no `Origin` they are accepted | Q4 |
| BR-09 | Signing out clears the cookie. A sign-out whose cookie is not valid answers 401 and clears it too | Q9 |
| BR-10 | Without the origin given to the Composition Root, the application sets no cookie and reads none, and behaves as before | Q6 |
| BR-11 | A request that carries the token in the header is answered as it was before this feature | Q1, Q7 |

## 7. New terms for the glossary

**Session cookie:** the cookie that carries the token of a Session, which the browser sends by itself. It is not a second kind of Session: it holds the same token as the header does. It is in the glossary.

## 8. Carried to the design

- How the cookie is read and written, by hand or with a package, and what that adds.
- One function, in the shared module, that gives the token of a request and where it came from, used by the four hooks of Users and not by the one of Providers.
- Where the check of the origin lives, and what a refused request answers: its status and its code.
- How the application is given its origin and the setting for HTTPS, and how `main.ts` builds them.
- How signing out and the failed sign-out reach the cookie, and how the documentation page behaves once a cookie is set.

## 9. Exit criteria

- [x] Questions marked ● answered (Q1 to Q8)
- [x] Scope (section 3) approved
- [x] Rules (section 6) approved
- [x] The User approves moving to stage 2 (scenarios)
