# 13 — Interface Redesign: Design (Stage 3)

Status: Approved. The decisions of section 8 are Accepted.

It builds on the [discovery and rules](01-discovery.md), the [scenarios](02-scenarios.feature) and the designs of features [09](../09-web-interface/03-design.md) and [10](../10-my-alerts-and-notifications/03-design.md), whose layers and dependency rules stay as they are. The backend and the API do not change.

## 1. Where the change goes

| Folder | What changes |
|---|---|
| `src/api/` | One operation, `priceHistory`, and one type, `PriceObservation` |
| `src/texts/` | The texts of the chart, of the lowest and highest price and of the failure to read the history |
| `src/ui/` | Every component gets Tailwind classes in place of `styles.css`, which is removed. New: `PriceHistory` (reads and decides), `PriceChart` (draws) and `chartPoints.ts` (a pure function). `CatalogueScreen` and `ListingScreen` change their markup |
| `src/session/` | Nothing |
| `vite.config.ts`, `package.json` | The Tailwind plugin, and `recharts` |
| `tests/architecture.test.ts` | `recharts` is allowed in `ui` and nowhere else (decision D5) |
| Tests | The tests of this feature are in files that start with `redesign-`, so that the traceability test of the backend tells them from those of feature 09, whose scenarios are numbered apart. The client against the real application is in `backend/tests/interface-redesign/` |

## 2. The client

| Operation | Request | Gives |
|---|---|---|
| `priceHistory(listingId, { limit, offset })` | `GET /listings/{listingId}/price-observations?limit=&offset=` | `Page<PriceObservation>` |

`PriceObservation` is `{ observedAt, price: Money | null }`. The `provider` and the `listingId` that the API also sends are not copied, as the `owner` of a Notification is not. As the other operations it never throws, asks for the status that the API gives, and builds new objects. The test of the client against the real application runs it. The path starts with `/listings`, which the development server already forwards, so `vite.config.ts` needs no new path.

## 3. The Listing screen (BR-02, BR-06)

`ListingScreen` keeps its read of the Listing and creates the alert as before. Below the facts it renders `PriceHistory`, which has **its own** `useRequest` with `limit` 100 and `offset` 0 (BR-02 and Q5: the newest 100, one request). The two reads are independent, so a failure of the history shows its message and a retry in its own place and nothing else of the screen changes (SC-11, SC-12). The history is read again whenever the Listing is read again, which happens after an alert is created (BR-11 of feature 09): the screen shows the Listing as it was read, and the history is part of it. It is one more request and it changes nothing that the person sees.

`PriceHistory` turns the answer into points with `chartPoints` and chooses what to show:

| Points | Shows |
|---|---|
| Fewer than two | The note of BR-04, no chart (SC-07) |
| Two or more | The chart, the lowest and highest price, and the text alternative |

## 4. From observations to points

`chartPoints(observations)` is a pure function, in `ui/`, and the one that carries the rules of the chart:

1. It drops the observations with no price (BR-03, SC-06).
2. It orders the rest by `observedAt`, oldest first. The API gives them newest first.
3. For each one it gives `{ observedAt, amount (text), value (number) }`.
4. It also gives the lowest and the highest point, by `value`, with their text.

`value` exists **only to place the point on the axis.** Everything that is written about an observation, in the tooltip, in the lowest and highest price and in the text alternative, is the `amount` text with the currency, formatted by `formatPrice` (BR-05). The marks of the vertical axis are not observations: they are the scale that the chart computes, and they are written as it gives them. This keeps the rule of feature 09 that the interface does not turn money into numbers to show it. The currency is that of the Listing, because the API rejects an observation in another one (BR-05 of feature 02), so the points of a Listing share a currency.

## 5. The chart and its text alternative (BR-07)

`PriceChart` is the only component that imports `recharts`. It receives the points and draws a line chart with a tooltip. Next to it, `PriceHistory` renders a table with the moment and the price of each point, hidden from the eye (`sr-only`) and read by a screen reader, with the lowest and the highest price visible as text above the chart ("Mínimo del periodo mostrado", "Máximo del periodo mostrado").

The scenarios are checked on **that table and on `chartPoints`**, not on the SVG: the points of SC-05, SC-06 and SC-10 are the rows. One smoke test checks that the chart draws an `svg` when there are two points, which is as far as a simulated DOM can see.

## 6. The styling

- **Tailwind 4 with its Vite plugin.** `src/ui/styles.css` is replaced by `src/index.css`, which imports Tailwind and declares the tokens in `@theme`: one accent colour, the neutral greys, the radius and the system font. The dark mode follows the system, as it does today.
- **Small pieces only where a class string is repeated three times or more**: the button, the card and the field. No component library and no variants framework.
- **Layout.** A content width of about 64rem. The Catalogue is a grid of cards: one column on a phone, two on a tablet and three on a computer. The Listing is one column on a phone, and on a wide screen the price and the chart are on the left and the form of the alert is on the right.
- **The checks of `sources.test.ts`** read the `.css` files too, and the new one holds nothing that they forbid.
- **Replacement in steps.** The old file is deleted only when the last screen has stopped using it, so that every commit builds and passes.

## 7. Risks and how they are verified

| Risk | How it is dealt with |
|---|---|
| The server sends `default-src 'self'`, with no inline style. A chart that adds a `<style>` or sets a `style` attribute as text would be blocked **in a browser** and would work in the tests, which ignore it | Verified in stop 4 in a real browser against the built application, with the header, and the result recorded. If it is blocked, the decision is reopened: allow `style-src 'self' 'unsafe-inline'` as a decision of its own, or use another way to draw |
| Tailwind or Recharts do not work with the versions in use (Vite 8, React 19) | The metadata of both packages accepts them. It is confirmed when they are installed, and Recharts needs `react-is` as a peer. Their weight in the bundle is measured in stop 4 and written in the completion |
| `recharts` measures its container, and a simulated DOM has no layout | `tests/setup.ts` gives a stub of the browser's size observer, and the chart is checked as in section 5 |
| Scenarios SC-15 and SC-16 depend on layout and on the colour mode of the system, which a simulated DOM cannot evaluate | See decision D6 |

## 8. Decisions (Accepted)

| ID | Decision | Alternatives |
|---|---|---|
| D1 | A number is made from an amount **only to place a point**. Everything shown is the text of the API | Showing the number formatted by the browser: it would hide how the API wrote the amount and could differ from it |
| D2 | The history is a **separate read** with its own state, in its own component | One read in the screen for both: a failure of the history would hide the Listing and the form (it breaks BR-06) |
| D3 | The text alternative is a **table** that is also what the tests assert on | `aria-label` on the chart: it gives a summary, not the values; asserting on the SVG: brittle |
| D4 | Tailwind 4 with the Vite plugin and the tokens in `@theme` | A configuration file in JavaScript, which is the earlier way |
| D5 | `recharts` is allowed in `ui`, with a visible entry in `RULES` of the architecture test | Allowing any package in `ui`: it would stop the test from catching an unplanned dependency |
| D6 | **SC-15 and SC-16 are checked by hand** in a real browser at the width of a phone and of a computer and in both colour modes, at stop 5, and the result is written in the completion. No test asserts on classes | A test of the classes that Tailwind applies: it tests the implementation and not what is seen; a browser test: ADR-0005 leaves them for later |
| D7 | The chart shows the newest 100 observations, as Q5 says, and **says nothing** when there are more | A note saying that older ones exist: it needs `total`, which is read, but adds a rule that the scenarios do not have |

## 9. Build stops

Each is one commit or a few, reviewed before the next.

| Stop | What is built | Scenarios |
|---|---|---|
| 1 | `priceHistory`, `PriceObservation`, `chartPoints` and their tests. No visible change | SC-06, SC-07, SC-10 (rules) |
| 2 | Tailwind, the tokens, the `Layout`, sign in and register | SC-14, SC-15, SC-16 |
| 3 | The Catalogue as cards | SC-01, SC-02, SC-03 |
| 4 | The Listing, with `PriceHistory`, `PriceChart` and `recharts`. Verification under the CSP, and the weight | SC-04, SC-05, SC-08, SC-09, SC-11, SC-12, SC-13 |
| 5 | My alerts and my notifications, `styles.css` removed, the manual check of D6 and the review | SC-14, SC-15, SC-16 |

## 10. Where each scenario is handled

| Scenario | Handled in | Tested in |
|---|---|---|
| SC-01, SC-02, SC-03 | `CatalogueScreen` | `tests/ui/redesign-catalogue.test.tsx` |
| SC-04 | `ListingScreen`, `ListingFacts` | `tests/ui/redesign-listing.test.tsx` |
| SC-05, SC-09 | `PriceHistory`, the table of section 5 | `tests/ui/redesign-listing.test.tsx` |
| SC-06, SC-10 | `chartPoints` | `tests/ui/redesign-chartPoints.test.ts` |
| SC-07 | `PriceHistory` | `tests/ui/redesign-listing.test.tsx` |
| SC-08 | `chartPoints`, `PriceHistory` | `tests/ui/redesign-chartPoints.test.ts`, `redesign-listing.test.tsx` |
| SC-11, SC-12 | `PriceHistory`, its own `useRequest` | `tests/ui/redesign-listing.test.tsx` |
| SC-13 | `ListingScreen`, unchanged | `tests/ui/redesign-listing.test.tsx` |
| SC-14 | Every screen, whose behaviour is not touched | The existing tests, which must pass |
| SC-15, SC-16 | The classes of every component | By hand (D6) |
