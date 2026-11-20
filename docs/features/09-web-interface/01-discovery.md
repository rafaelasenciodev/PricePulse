# 09 — Web Interface: Discovery and Business Rules (Stage 1)

Status: Approved. Every question below has a **Decision** line with status Accepted. *Lean* lines record the proposal that was discussed.

## 1. The business problem

The only ways to use PricePulse are `curl` and the interactive documentation of the API, which is a way to try the API and not the product. The project is delivered with a web interface to try the system, and [ADR-0005](../../adr/0005-web-interface.md) decided how it is built: a single-page application in TypeScript, served by the backend, that keeps the session in a cookie. It left to this feature what it does, in what order, in what language and how it looks.

The system needs to let a person do in a browser what they can do through the API: sign in, see what can be watched, choose a Listing and ask to be told when it reaches a price.

## 2. Actors and goal

| Actor | Role |
|---|---|
| **Person in a browser** | Registers, signs in, looks at the Catalogue, creates a Price Alert and signs out |
| System | Answers the requests of the interface as it answers any client, and serves the interface itself |
| Provider | Not an actor. It has no screen |

**Goal:** "Create my account, see what I can watch, choose a Listing and tell the system at what price I want to know."

## 3. Scope (proposed)

**Is:** the project of the interface (`frontend/`, its build, its development server and its tests), the serving of it by the backend, and the screens to register, sign in, sign out, read the Catalogue, read a Listing and create a Price Alert from it.

**Is not (in this feature):** reading, changing and cancelling one's Price Alerts and reading the Notifications, which are the next feature; the history of prices as a chart; changing a password or an email; delivering Notifications; updates in real time; a second language; and tests that drive a browser.

**Scope approved** for stage 1 (see section 9).

## 4. What is already established

| Fact | Source |
|---|---|
| The interface is a single-page application in TypeScript, in `frontend/` with its own `package.json`, that talks to the API only through HTTP. It is served by the backend under `/app/`, at the origin of the API, and `/` leads there. The session is the `HttpOnly` cookie. Vitest tests it with a simulated DOM, and there are no browser tests for now | [ADR-0005](../../adr/0005-web-interface.md) |
| The ADR leaves to the feature the screens, the language of the texts, the styling, whether the types of the API are written or generated, and the security headers | ADR-0005 |
| Signing in sets the cookie and still returns the token in the body. Registering does not sign in. A change that the cookie authenticates must carry an `Origin` equal to the application's. In development the interface is served by another server that forwards the API, and `WEB_ORIGIN` says its origin | Features 06 and 08 |
| The API answers errors as `{ code, message }`, with stable codes, and money as text, such as `"80.00"` with its currency. Instants are UTC text. Lists come in pages of 20, up to 100 | The README, features 04 to 07 |
| The Catalogue lists Listings with `id`, `title`, `retailer`, `currency` and `currentPrice`, which is `{ amount, currency, observedAt }` or `null`. A Price Alert and a Notification show only the `listingId` of their Listing, and no title | Features 05 and 07 |
| Nothing serves files today: `/` and `/app/` answer the 404 of an unknown route, and there is no package to serve static files | Measured against the application |
| The demo server starts with two Accounts and six Listings, and everything is in memory | `main.ts` |
| The development server of this repository has never been tried with a real browser: the cookie and its check of the origin were checked with `curl`, and the browser was not connected | Feature 08, section 4 |

## 5. Ambiguities and questions

Questions marked **●** must be resolved before this stage can close.

### ● Q1 — How big is this feature?

| Option | Includes | Trade-off |
|---|---|---|
| A | Every screen: sign in, Catalogue, creating an alert, one's alerts and Notifications | The most in one feature, and nothing to show until it ends |
| B | Two features. This one has the project, the serving, signing in and out, the Catalogue and creating an alert. The next has the alerts and the Notifications | A first interface that can be shown, with a document of each that fits the method |
| C | Three features, with the project and the sign-in alone in the first | The smallest steps, and a first one with nothing to look at |

*Lean:* **B**. The method says that a document of about 150 lines is what a feature can hold, and an interface with five screens and a new project does not fit. B also gives something to show after the first one.

**Decision (Accepted):** B. Two features. This one has the project, the serving, signing in and out, the Catalogue and creating an alert. The next has the alerts and the Notifications.

### ● Q2 — How does the interface show the title of a Listing in an alert or a Notification?

| Option | Effect  | Trade-off |
|---|---|---|
| A | It asks the Catalogue: one request for up to 100 Listings, and one by identifier for any that is not in it | No change of the backend, and a client that must join two answers |
| B | The backend adds the title and the Retailer to the alert and to the Notification | The client is simpler, but it changes the use cases of two modules, and the Price Alerts cannot import the Catalogue |
| C | It shows the identifier | Nothing to build, and `headphones-shop-a` is what a person would read |

*Lean:* **A**. It is a question of the next feature, which shows alerts, but it decides how the project is built now. If it turns out to be slow or awkward, B is a feature of backend of its own.

**Decision (Accepted):** A. The interface asks the Catalogue, in one request for up to 100 Listings and by identifier for any that is not in it. It is the next feature that shows alerts, and this one is built so that it can.

### ● Q3 — In what language are the texts?

| Option | Effect  | Trade-off |
|---|---|---|
| A | English, as the documentation and the code | One language, equal to the glossary |
| B | Spanish | What a supervisor and a video would use. The domain terms of the glossary would be translated |
| C | Both, with a switch | A second language to write and to test in every screen |

*Lean:* **B**, with every text in one file, so that a second language can be added without touching a screen.

**Decision (Accepted):** B. The texts are in Spanish, all in one file.

### ● Q4 — How is it styled?

| Option | Effect  | Trade-off |
|---|---|---|
| A | CSS written by hand, with a few variables for colour and size | No dependency, and the design is the author's work |
| B | A utility framework | Faster to write, and a dependency and a build step more |
| C | A library of components | The most finished look, and the most dependencies |

*Lean:* **A**. There are few screens, and the ADR asks for few dependencies.

**Decision (Accepted):** A. CSS written by hand, with a few variables.

### ● Q5 — Are the types of the API written or generated?

| Option | Effect  | Trade-off |
|---|---|---|
| A | Written by hand for the dozen of operations that the interface uses | No tool, and it can drift from the API |
| B | Generated from the OpenAPI document of the application | They cannot drift, and a tool and a step of the build more |

*Lean:* **A**, with a test of the client against the answers of the real application, which is what would show a drift.

**Decision (Accepted):** A. The types are written by hand, with a test of the client against the answers of the real application.

### ● Q6 — How does the backend serve the interface?

| Option | Effect  | Trade-off |
|---|---|---|
| A | A package to serve static files, an optional group of `buildApp` that serves `frontend/dist` under `/app/`, and `/` that leads there. An address under `/app/` that is not a file gets the page of the application | The assumption of the ADR, and one dependency in the backend |
| B | The same, written by hand with the file system | No dependency, and the handling of types, caching and paths by hand |

*Lean:* **A**. Serving files safely is what the package is for, and writing it by hand adds a place where a path can escape the folder.

**Decision (Accepted):** A. A package to serve static files, in an optional group of `buildApp`, under `/app/`, with `/` leading there.

### Q7 — What happens after registering?

*Lean:* the interface signs the person in with the same email and password, so that registering is one gesture. Registering does not sign in by itself on the API (feature 06, Q9), and the interface joins the two requests.

**Decision (Accepted):** as proposed.

### Q8 — What does the person see when the session ends?

*Lean:* any answer 401 takes them to the sign-in screen, with a message that the session ended. Nothing is retried, and nothing they typed is kept.

**Decision (Accepted):** as proposed.

### Q9 — When is the data read again?

*Lean:* when a screen is entered and after each action that changes something, always from the server and never by guessing the result. There is no polling.

**Decision (Accepted):** as proposed.

### Q10 — Does the sign-in screen show the demo Accounts?

*Lean:* no. They are in the README. Whether a screen of a deployed application shows them is a decision of the deployment.

**Decision (Accepted):** as proposed.

### Q11 — What is the baseline for accessibility?

*Lean:* semantic HTML, a label for every field, a visible focus and the whole interface usable with the keyboard. No more than that is promised.

**Decision (Accepted):** as proposed.

## 6. Business rules

| ID | Rule | Origin |
|---|---|---|
| BR-01 | The page never holds the token of the Session: it does not keep it in memory, in storage or in a URL, and every request relies on the cookie | ADR-0005 |
| BR-02 | A person who is not signed in sees only the screens to sign in and to register. Any other address shows the sign-in screen | Q1 |
| BR-03 | Signing in with a wrong password and with an email that has no Account show the same message. A locked email shows how many seconds to wait | Feature 06, Q5, Q6 |
| BR-04 | Registering shows what the API says is wrong with the email or the password, and that the email is registered. When it succeeds, the person is signed in | Q7 |
| BR-05 | Signing out ends the Session at the server. The person leaves the signed-in screens only when the server has answered | Q8 |
| BR-06 | An answer 401 to any request takes the person to the sign-in screen, with a message that the session ended | Q8 |
| BR-07 | The Catalogue shows each Listing with its title, its Retailer and its Current Price with the moment it was observed, or that it has none. It keeps the order that the API gives and reads one page at a time | Q1, feature 07 |
| BR-08 | A Listing has a screen with the same data and a form to create a Price Alert for it | Q1 |
| BR-09 | The amount that the person writes is sent as the text that they wrote, trimmed. The interface does not turn it into a number and does not decide whether it is valid | Feature 01 |
| BR-10 | Each answer of creating an alert has its own message: created, the same alert that already existed, another Active alert for the Listing, a target that the Current Price already reaches, and an amount that is not valid | Features 01 and 04 |
| BR-11 | While a request that changes something is in progress, its control cannot be used again. When it ends, what is shown is read again from the server | Q9 |
| BR-12 | A failure that is not an answer of the API, such as no connection or a 500, shows a message that says that something failed and nothing of the cause | Feature 01 |
| BR-13 | The backend serves the interface under `/app/`, and `/` leads there. An address under `/app/` that is not a file of the interface gets its page, and no address of the API is ever answered with it | ADR-0005, Q6 |
| BR-14 | A form with a field that must be filled and is empty is not sent, and says which field is missing. Whether what is written is valid is decided by the API | Found in stage 2 |

## 7. New terms for the glossary

None. The interface speaks of Listings, Price Alerts, Catalogue and Session as the glossary defines them, and it shows them in the language of Q3.

## 8. Carried to the design

- The libraries: the router, the way the interface keeps and shares what it read, and the testing library. Each one is a dependency, with its purpose and cost to explain.
- How the development server forwards the API, with which paths, and how it sets `WEB_ORIGIN`.
- How the build is made and where it goes, how `buildApp` serves it, and how a path that escapes the folder is refused.
- The shape of the client that makes the requests, how an answer becomes a message, and where the texts are.
- Whether the `Origin` that the browser sends on a change reaches the application as it is, which is the check that feature 08 could not make and this one must.

## 9. Exit criteria

- [x] Questions marked ● answered (Q1 to Q6)
- [x] Scope (section 3) approved
- [x] Rules (section 6) approved
- [x] The User approves moving to stage 2 (scenarios)
