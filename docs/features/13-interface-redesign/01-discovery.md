# 13 — Interface Redesign: Discovery and Business Rules (Stage 1)

Status: Approved. Q8 and BR-10, the choice of the appearance, were added in a reopened review. A question is closed only when it has a **Decision** line with status Accepted. *Lean* lines record the proposal under discussion.

## 1. The business problem

The interface of [feature 09](../09-web-interface/01-discovery.md) and [feature 10](../10-my-alerts-and-notifications/01-discovery.md) does what it has to, but it looks like a list of links in a narrow column, with little hierarchy. A person who opens the demo cannot tell at a glance what a Listing costs now, or whether that price is good. The API already has the Price History of a Listing, and the interface does not show it: the history as a chart was left out of feature 09 on purpose.

This feature changes how the interface looks and how a Listing is presented, so that it is intuitive, minimal and simple to use, in the manner of price-tracking sites such as camelcamelcamel or idealo. It does not change what the system can do.

## 2. Actors and goal

| Actor | Role |
|---|---|
| **Person in a browser** | Looks at the Catalogue, opens a Listing, reads its price and its history, and creates a Price Alert |
| **Reviewer** | A supervisor or a recruiter who opens the demo and judges the project in a few minutes |
| System | Answers the same requests as before |

**Goal:** "See at a glance what something costs and how its price has moved, and ask to be told when it falls."

## 3. Scope (proposed)

**Is:** a new look for every screen (sign in, register, Catalogue, Listing, alerts, notifications), the Catalogue as cards with the Current Price, and, in the Listing, the Current Price made prominent and a chart of its Price History. A selector of the appearance (system, light or dark) is added to the header and to the access screens.

**Is not:** search or filters in the Catalogue (they need a backend feature), new endpoints or any change in the backend, a second language, updates in real time, browser end-to-end tests, a guide page, and any new rule of the system.

## 4. What is already established

| Fact | Source |
|---|---|
| The interface is React with Vite, written in TypeScript, with its own `package.json`, served by the backend under `/app/` | [ADR-0005](../../adr/0005-web-interface.md) |
| ADR-0005 leaves the styling to the features of the interface | ADR-0005, section Decision |
| The styling today is one file of about 175 lines (`styles.css`), with colours as variables and a dark mode that follows the system | `frontend/src/ui/styles.css` |
| The texts are in Spanish, in one place (`texts/`) | Feature 09 |
| The Catalogue already gives each Listing `title`, `retailer`, `currency` and `currentPrice` (`{ amount, currency, observedAt }` or `null`) | Feature 07 |
| `GET /listings/{listingId}/price-observations` gives the Price History, newest first, in pages of 20 and up to 100, each observation with its Observed At and its price, or no price when the Listing was unavailable. A User's token or cookie is needed | Feature 05, README |
| The interface has no call to the Price History: the client of the API (`frontend/src/api/`) must learn it | `frontend/src/api/` |
| A rule of the architecture test allows in `ui` only `react`, `react-dom` and `react-router-dom` | `frontend/tests/architecture.test.ts` |
| The interface tests look for text and roles on a simulated DOM, not for styles or classes | `frontend/tests/ui/` |
| The colours are tokens with a light set and a dark set, and the system chooses between them | `frontend/src/index.css` |
| No source file of the interface may use `localStorage`, `sessionStorage`, `indexedDB` or `document.cookie`, so that a token never ends in them. A test reads the sources, comments too | BR-01 of [feature 09](../09-web-interface/01-discovery.md), `frontend/tests/sources.test.ts` |

## 5. Questions

Questions marked **●** must be resolved before this stage can close.

### ● Q1 — How far does the redesign go?

| Option | Trade-off |
|---|---|
| A | A new look and the Price History chart in the Listing. No backend change |
| B | Only a new look. Nothing new to read, but it resembles price trackers less |
| C | A and search or filters. It needs a backend feature first |

**Decision (Accepted):** A.

### ● Q2 — How is the chart drawn?

| Option | Trade-off |
|---|---|
| A | Hand-made SVG. No dependency, but axes, tooltips and resizing are written by us |
| B | **A chart library.** More features for less code, at the cost of a dependency and of weight in a bundle of 90 kB gzip |
| C | No chart: a table |

**Decision (Accepted):** B, with **Recharts**. The two candidates differ in a way that matters for the tests:

| | uPlot | Recharts |
|---|---|---|
| Size | Very small | Several times larger |
| Draws with | Canvas | SVG |
| In the tests (simulated DOM) | The canvas is not available, so the chart must be replaced by a double in tests | Draws SVG that can be asserted on, although it needs the browser's size observer to be simulated |
| Fit with React | A wrapper to write | Made for React |

These are the properties as known, and the design measures them before building. Recharts is chosen because the project tests behaviour with Vitest and a simulated DOM, and a chart that cannot be rendered there would be left without tests. If the measurement shows a problem, the question returns to this stage.

### ● Q3 — How are the styles written?

| Option | Trade-off |
|---|---|
| A | Own CSS with variables, as now. No new tool |
| B | **Tailwind CSS.** A build plugin, and utility classes in the components in place of `styles.css` |
| C | A component library. It imposes its own look |

**Decision (Accepted):** B. Cost: one build tool, and the classes in 17 components. Its compatibility with the version of Vite in use is to be checked in the design, not assumed.

### ● Q4 — What is the first screen, and how does the Catalogue look?

| Option | Trade-off |
|---|---|
| A | Catalogue as cards in a grid: title, retailer and Current Price |
| B | Catalogue as a compact list |
| C | "My alerts" first |

**Decision (Accepted):** A. The first screen after signing in stays the Catalogue.

### ● Q5 — Which part of the history does the chart show?

The API gives 100 observations at most per request.

| Option | Trade-off |
|---|---|
| A | The newest 100, in one request, with no range selector |
| B | A selector of periods (30 days, 90 days, all). More to build, and more requests |

**Decision (Accepted):** A. With simulated data a Listing has few observations, and a selector is added if it is needed.

### Q6 — Does the Listing show the lowest and highest price?

Price trackers show them. They would be computed from the points that the chart shows, and said to be so ("in the period shown"), because the system has no such rule.

**Decision (Accepted):** yes, in that way. It is the cheapest way to say whether the price is good.

### Q7 — Which visual identity?

There is no brand. **Decision (Accepted):** the system font, one accent colour, and the light and dark modes that exist, with no font to download.

### Q8 — How does the person choose the appearance?

The light and the dark mode exist, and the system of the person chooses between them. The Author asks to choose it in the interface.

| Option | Trade-off |
|---|---|
| A | A selector with three choices, system, light and dark, that applies at once and is **not kept**: a reload goes back to the system. It touches no rule of security and is the smallest |
| B | The same selector, kept in `localStorage`. It is what a person expects, and it needs an exception in BR-01 of feature 09 and in its test, for a preference that is not sensitive. A decision on security of its own |
| C | Light by default and no selector. The dark mode would follow the system or disappear |

**Decision (Accepted):** A. The selector is in the header and also on the sign-in and register screens, so that it can be used before signing in. Keeping the choice is left as a possible later step (B).

## 6. Business rules (proposed)

| ID | Rule |
|---|---|
| BR-01 | The Catalogue shows each Listing as a card with its title, its Retailer and its Current Price, or a note that it has none. The card leads to the Listing |
| BR-02 | The Listing shows its Current Price prominently, its Price History as a chart, and the form to create a Price Alert |
| BR-03 | The chart draws one point for each observation that has a price. An observation with no price is not drawn as zero |
| BR-04 | With fewer than two points the chart is not drawn, and a note says that there is not enough history |
| BR-05 | Prices and instants are written with the format that exists, in the currency of the Listing |
| BR-06 | A failure to read the history does not hide the rest of the Listing: the form still works, and the history can be retried |
| BR-07 | When it has points, the chart is accompanied by the lowest and the highest price of the points shown, said to be of that period, and has a text alternative, so that its content is not available only to those who see it |
| BR-08 | The screens that already exist keep their behaviour. Only their look changes. Their tests stay as they are, except where the text of a control changes |
| BR-09 | The interface works on a narrow screen (a phone) and on a wide one, in the light and the dark mode |
| BR-10 | The person can choose the appearance: the one of the system, which is the first, light or dark. The choice applies at once to every screen, also those of access, and it is not kept: a page that is loaded again follows the system |

## 7. New terms for the glossary

None. The Price History and the Current Price already exist.

## 8. Open points for the design (stage 3)

- Which chart library, with its measured weight and how it behaves in the tests (Q2).
- Whether Tailwind works with the version of Vite in use, and how `styles.css` is replaced screen by screen in small commits.
- The new allowed packages in the architecture test, as an explicit decision.
- The call to the Price History in the client of the API, and its failure messages.

## 9. Approval

Approved. Every question has a decision with status Accepted.
