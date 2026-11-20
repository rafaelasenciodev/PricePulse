# 13 — Interface Redesign: Completion (Stage 5)

Status: Approved

The close of the feature: what was built, the decisions and their status, how it was verified, what the review found, what it does not do and what comes next. It links to the documents of each stage and does not repeat them.

## 1. Summary

The interface has a new look and shows the Price History. Every screen is styled with Tailwind CSS in place of the single hand-written file, the Catalogue is a grid of cards with the Current Price, and a Listing makes its price prominent and draws its history as a chart, with the lowest and highest price of the period shown and the same content as text. A selector of the appearance (system, light or dark) is in the header and in the access screens. The behaviour of the rest of the screens is the one of features 09 and 10, and their tests pass: only the fixtures that build a client were given the new operation. The backend and the API do not change: the only new request is the Price History, which already existed.

## 2. What was built

| Stage | Result | Where |
|---|---|---|
| 1 Understand | 8 questions decided, 10 rules (BR-01 to BR-10) | [Discovery and rules](01-discovery.md) |
| 2 Scenarios | 21 Gherkin scenarios (SC-01 to SC-21) | [Scenarios](02-scenarios.feature) |
| 3 Design | The client, the chart and its text, the styling, the appearance, 8 decisions, 6 build stops | [Design](03-design.md) |
| 4.1 Client and points | `priceHistory`, `PriceObservation` and `chartPoints` | `frontend/src/api/`, `frontend/src/ui/chartPoints.ts` |
| 4.2 Styling and access | Tailwind, the tokens, `Layout`, sign in and register, `Button` and `Field` | `frontend/src/index.css`, `frontend/src/ui/` |
| 4.3 Catalogue | `Card`, `ListingCard`, the grid, the pager | `frontend/src/ui/` |
| 4.4 Listing | `PriceHistory`, `PriceChart`, the Listing in two columns | `frontend/src/ui/` |
| 4.5 Alerts, Notifications and close | The two screens, the reset, `styles.css` removed, the traceability | `frontend/src/ui/`, `backend/tests/traceability.test.ts` |
| 4.6 Appearance | `ThemeProvider`, `ThemeSelector` and the tokens under the attribute `data-theme` | `frontend/src/ui/theme.tsx`, `ThemeSelector.tsx`, `frontend/src/index.css` |

Two dependencies were added, with their cost: `tailwindcss` and `@tailwindcss/vite` (build tools, 4.3.5) and `recharts` (3.11.0, in the bundle). The JavaScript of the page went from 290 kB to 706 kB (91 to 209 kB compressed), and the style sheet from 2 kB to 16 kB (0.8 to 4.0 kB compressed).

## 3. Decisions and their status

The status of every decision is recorded here, and only here. Q1 to Q8 are those of the discovery and D1 to D8 those of the design, in its section 8.

| Decision | Status | Evidence |
|---|---|---|
| Q1 A new look and the history chart, with no change in the backend | Verified | SC-01 to SC-13, and a real browser |
| Q2 A chart library: Recharts | Verified | SC-05, and the chart in a real browser under the policy of the server (section 4) |
| Q3 Tailwind CSS | Verified | The build with the version of Vite in use, and every screen |
| Q4 The Catalogue as cards | Verified | SC-01 to SC-03, and a real browser |
| Q5 The newest 100 observations, with no selector | Verified | SC-10, and the contract test against the application |
| Q6 The lowest and highest price of the period shown | Verified | SC-08 |
| Q7 The system font and one accent colour | Implemented | Seen in a real browser; it is a visual choice with no test |
| Q8 A selector of the appearance that is not kept | Verified | SC-17 to SC-21, and a real browser |
| D1 A number only to place a point, and the text of the API for what is written | Verified | The tests of `chartPoints`, and SC-05, SC-08, SC-09 |
| D2 The history is a separate read | Verified | SC-11, SC-12 |
| D3 The text alternative is a table, and the tests assert on it | Verified | SC-05, SC-09 |
| D4 Tailwind 4 with the Vite plugin and the tokens in `@theme` | Verified | The build |
| D5 `recharts` is allowed in `ui` in the architecture test | Verified | `tests/architecture.test.ts` |
| D6 SC-15 and SC-16 are checked by hand | Verified | Section 4 |
| D7 The chart says nothing when there are more than 100 observations | Implemented | No test: SC-10 checks the request, not the case |
| D8 The appearance is a `select` whose state is in memory and shows as an attribute of `<html>` | Verified | SC-17 to SC-21, and `sources.test.ts`, which forbids the storage |

Decisions taken while building that the design left open or settled differently:

| When | Decision | Status |
|---|---|---|
| 4.2 | Tailwind was added without its reset, and the old file stayed in a lower layer until the last screen moved, so that every commit built and the other screens did not change. The reset came with the removal of the old file | Verified |
| 4.3 | The Catalogue has its own `ListingCard`, and `ListingFacts` stayed for the Listing, where the price is made prominent | Verified |
| 4.4 | The history shows its loading as plain text and not as a `status`, so that it does not clash with the notice of the screen | Verified |
| 4.5 | The tests of this feature are in files that start with `redesign-`, and the traceability test has the feature | Verified |
| 4.6 | `ThemeProvider` is inside `App`, so a test of any screen has it and the tests of the other screens needed no change | Verified |
| 4.6 | The dark tokens are written twice in `index.css`: for the system when nothing is chosen, and for the choice of dark | Verified |
| 3 and 4.4 | Two sentences of the design were corrected: the history is read again when the Listing is, and the marks of the vertical axis are the scale of the chart | Verified |

### Effect on the other features

- **The client of the interface** has thirteen operations, and the provider of the Session watches `priceHistory`, so an ended Session is handled as for the others.
- **`AmountForm` and `LoadFailed`** are shared by features 09 and 10 and were restyled with it. Their tests pass, and none was edited.
- **The traceability guard** has the feature. The tests of feature 13 in the interface are told apart from those of feature 09 by a file name that starts with `redesign`.

## 4. Verification

- **Tests:** the backend has 1,676 test cases in 87 files, 11 more than before. The frontend has 440 in 23 files, 44 more. All pass, and `tsc` is clean in both.
- **Scenarios:** 18 of the 21 have tests, read from their titles. SC-14, SC-15 and SC-16 are exempt, with their reason. SC-17 to SC-21 are checked on the attribute `data-theme` of the page, because a simulated page does not evaluate the media query of the system.
- **Against the application:** a contract test runs `priceHistory` against the real server: the order, an observation with no price, an empty history, a Listing that does not exist and a person who is not signed in.
- **A deliberate error,** where a mistake would not be seen: the key of the rows of the table was the moment alone. A test with two observations of the same moment fails without the fix and passes with it.
- **By hand, in Chrome, on the local machine, with the built interface and the demo mode:**

| What | Result |
|---|---|
| The chart and its tooltip under `default-src 'self'`, the policy that the server sends | They work, and the console has no violation. This was the main risk of the design |
| Sign in, Catalogue, Listing, my alerts, my notifications, and creating, and asking to cancel, an alert | As designed, in the dark mode |
| SC-15, a narrow screen: a window of about 514 pixels | The navigation goes to a second row, and the price, the chart and the form are readable without scrolling sideways |
| SC-15, a wide screen: 1280 pixels | The Catalogue has three columns, and the Listing has the chart on the left and the form on the right |
| SC-16, the dark mode | The system was in it |
| SC-16, the light mode | With the selector, which sets the attribute, while the system was in the dark mode: sign in, Catalogue and Listing with the chart were readable, and choosing "Sistema" went back to the dark one. The light mode of the system itself was not switched on: it uses the default tokens, which are the light ones |
| SC-20, SC-21 | The choice made on the sign-in screen stayed after signing in. A page that is loaded again follows the system, as BR-10 says |
| SC-16, contrast | Calculated for eight pairs of colours in each mode. The lowest is 5.47 to 1, for the muted text on the page in the light mode, and the minimum asked is 4.5 to 1 |

- **Not done.** It was not tried on a real phone, nor with the system itself in the light mode, and it was not tried on the demo that is deployed.

## 5. Architecture review

- **Dependencies:** `recharts` is imported only by `PriceChart`, and the architecture test names it as allowed in `ui`. The Tailwind classes are in the components and the tokens in one file. No layer below `ui` changed except the client of the API, which has one operation more.
- **No use case, port or rule of the system changed,** and the backend has only one test file more.
- **Failures:** a failure of the history is a message of its own, with nothing of the cause, and it does not hide the Listing.

This review was made by the author of the code on the whole branch, and `/code-review` was not run.

| # | Finding | What was done |
|---|---|---|
| 1 | The rows of the text alternative were keyed by the moment, which two Providers may share | Fixed, with a test |
| 2 | Removing the old file would have left three things that it did: the colour of links, the column of the forms and `color-scheme` | Moved to the new file before it was removed |
| 3 | The history is read again whenever the Listing is read again, for example after creating an alert | Left, and written in the design: it is one request and nothing changes that the person sees |
| 4 | The bundle grew by 118 kB compressed because of the chart | A limitation (section 7) |

## 6. What the process revealed

| When | What | Result |
|---|---|---|
| 4.1 | The traceability test gives each test to a feature by folder or by the start of its file name | The tests of the feature start with `redesign`, and the test has the feature |
| 4.2 | Without the reset of Tailwind, a paragraph and a heading keep their default margins | Explicit margins until the reset came |
| 4.4 | A simulated page has no layout, so the chart measures its container as zero and draws nothing | The test that looks at the chart gives it a size, and the others look at the table |
| 4.6 | Under the version of Node in use, `localStorage` of the simulated page has no `length`, so a test cannot look at the storage | That nothing is stored is left to `sources.test.ts`, which reads the sources |
| 4.4 | The policy of the server has no inline style, and a chart is the kind of thing that could break it, in a browser and not in a test | It was tried in a real browser |

## 7. Known limitations

- **The weight.** The chart library is in the first bundle. Loading the chart only when a Listing is opened is possible and was not done.
- **The marks of the vertical axis** are numbers that the chart computes, and not the text of the API. The values that are written about an observation are the text.
- **Repeated labels:** when all the points are within a minute, the horizontal axis repeats the same time.
- **The choice of the appearance is not kept:** a page that is loaded again follows the system. Keeping it needs the storage of the browser, which BR-01 of feature 09 forbids, so it is a decision on security of its own.
- **Crowded labels:** with a dense history, two labels of the horizontal axis can be close to each other.
- **More than 100 observations:** only the newest are drawn, and the screen does not say so (D7).
- **The classes are not tested:** that a layout adapts, or that a colour is readable, is checked by hand, as the design says.
- **No search or filters** in the Catalogue: they need a feature of the backend.

## 8. Documentation volume

The documents of the first three stages have 471 lines (discovery and rules 157, scenarios 199, design 115). The previous feature had 469, so it is about the same.

## 9. Follow-up

**Next,** if the author wants it: put the new interface in the demo that is deployed, and try it on a phone and with the system in the light mode.

**A possible step:** keeping the choice of the appearance, with an exception in BR-01 of feature 09 that is decided on its own.

**Not started and not scheduled:** loading the chart on demand, search and filters in the Catalogue, a selector of the period of the history, and browser tests.

## 10. Completion checklist

- [x] Stages 1 to 4 completed
- [x] Documentation of stage 5 written (this document)
- [x] This document is approved by the author
- [x] The README and the documentation indexes describe this feature
- [ ] The feature is merged into `develop` with `--no-ff`, and `develop` into `main` and tagged (done by the developer, [ADR-0002](../../adr/0002-branching-model.md))
