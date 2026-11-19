/**
 * Traceability of each feature: business rule -> scenario -> test.
 *
 * The scenarios tag the rules they exercise (@BR-nn) and the tests cite the scenario
 * (SC-nn) in their title. This test keeps that chain from rotting: it fails when a rule
 * has no scenario, a tag points to a rule that does not exist, or a scenario has no test
 * and no justified exemption.
 *
 * Identifiers are numbered within each feature, so the same SC-nn exists in both. Each
 * feature therefore declares which test files are its own: a title is never counted for
 * the other feature.
 *
 * Only test titles are read, not comments: a comment that says a scenario is not tested
 * must not count as a test.
 */

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const DOCS_DIR = new URL("../../docs/features/", import.meta.url);
const TESTS_DIR = new URL("./", import.meta.url);

interface Feature {
  readonly name: string;
  /** Folder of the feature under docs/features/ */
  readonly docs: string;
  /** The test files that belong to the feature: paths relative to tests/ */
  readonly owns: (path: string) => boolean;
  readonly scenarios: number;
  readonly rules: number;
  /** Rules that have no scenario, and why. An entry must stay justified. */
  readonly exemptRules: Readonly<Record<string, string>>;
  /** Scenarios that have no test of their own, and why. An entry must stay justified. */
  readonly exemptScenarios: Readonly<Record<string, string>>;
}

// The tests of the Composition Root exercise how the two features meet. Their titles cite
// the scenarios of feature 02, which is what makes the Current Price derive from the
// observations (BR-07), so they belong to that feature.
const FEATURES: readonly Feature[] = [
  {
    name: "feature 01",
    docs: "01-create-price-alert/",
    // The evaluation of feature 03 lives in the same module, so its tests are told apart by folder.
    owns: (path) =>
      !path.startsWith("price-observations/") && !path.startsWith("price-alerts/evaluation/") && path !== "composition-root.test.ts",
    scenarios: 18,
    rules: 11,
    exemptRules: {},
    exemptScenarios: {
      "SC-05":
        "BR-10 states the absence of restrictions: the command carries no email or Watchlist data, so nothing can require them.",
    },
  },
  {
    name: "feature 02",
    docs: "02-price-observation/",
    owns: (path) => path.startsWith("price-observations/") || path === "composition-root.test.ts",
    scenarios: 21,
    rules: 13,
    exemptRules: {
      "BR-13":
        "While the set of Providers is closed and has one member, the case it describes cannot happen (see the scenarios file).",
    },
    exemptScenarios: {},
  },
];

const pad = (id: string) => `${id.slice(0, id.indexOf("-") + 1)}${id.slice(id.indexOf("-") + 1).padStart(2, "0")}`;

/** scenario id -> the rule ids it is tagged with */
function scenarioTags(feature: Feature): Map<string, string[]> {
  const scenarios = new Map<string, string[]>();
  const file = readFileSync(new URL(`${feature.docs}02-scenarios.feature`, DOCS_DIR), "utf8");
  for (const line of file.split("\n")) {
    if (!/^\s*@SC-\d+/.test(line)) continue;
    const tags = line.trim().split(/\s+/);
    const scenario = tags.find((t) => t.startsWith("@SC-"));
    if (scenario) scenarios.set(pad(scenario.slice(1)), tags.filter((t) => t.startsWith("@BR-")).map((t) => pad(t.slice(1))));
  }
  return scenarios;
}

function businessRules(feature: Feature): string[] {
  const file = readFileSync(new URL(`${feature.docs}01-business-rules.md`, DOCS_DIR), "utf8");
  return [...file.matchAll(/^\| (BR-\d+) \|/gm)].map((m) => pad(m[1] as string));
}

/** The test files of the feature, relative to tests/ */
function testFiles(feature: Feature, dir: URL = TESTS_DIR, prefix = ""): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return testFiles(feature, new URL(`${entry.name}/`, dir), `${prefix}${entry.name}/`);
    const path = `${prefix}${entry.name}`;
    const isTest = entry.name.endsWith(".test.ts") && entry.name !== "traceability.test.ts";
    return isTest && feature.owns(path) ? [path] : [];
  });
}

/** The titles of the tests: it("title", ...) and it.each(...)("title", ...) */
function testTitles(feature: Feature): string[] {
  const title = /(?:\bit|\))\(\s*(["`])((?:\\.|(?!\1).)*)\1\s*,\s*(?:async\s*)?\(/g;
  return testFiles(feature).flatMap((file) =>
    [...readFileSync(fileURLToPath(new URL(file, TESTS_DIR)), "utf8").matchAll(title)].map((m) => m[2] as string),
  );
}

function scenariosCitedByTests(feature: Feature): Set<string> {
  return new Set(testTitles(feature).flatMap((t) => [...t.matchAll(/SC-(\d+)/g)].map((m) => pad(`SC-${m[1]}`))));
}

describe.each(FEATURES)("traceability of $name", (feature) => {
  it("finds the scenarios, the rules and the tests it is meant to check", () => {
    expect(scenarioTags(feature).size).toBe(feature.scenarios);
    expect(businessRules(feature)).toHaveLength(feature.rules);
    expect(testTitles(feature).length).toBeGreaterThan(30);
  });

  it("every tag in the scenarios refers to an existing business rule", () => {
    const rules = new Set(businessRules(feature));
    const unknown = [...scenarioTags(feature)].flatMap(([sc, brs]) => brs.filter((br) => !rules.has(br)).map((br) => `${sc} -> ${br}`));
    expect(unknown).toEqual([]);
  });

  it("every business rule is exercised by at least one scenario, or is exempt with a reason", () => {
    const exercised = new Set([...scenarioTags(feature).values()].flat());
    expect(businessRules(feature).filter((br) => !exercised.has(br) && !(br in feature.exemptRules))).toEqual([]);
  });

  it("no rule exemption is stale: an exempt rule really has no scenario", () => {
    const exercised = new Set([...scenarioTags(feature).values()].flat());
    expect(Object.keys(feature.exemptRules).filter((br) => exercised.has(br) || !businessRules(feature).includes(br))).toEqual([]);
  });

  it("every scenario is cited by a test, or is exempt with a reason", () => {
    const cited = scenariosCitedByTests(feature);
    const untested = [...scenarioTags(feature).keys()].filter((sc) => !cited.has(sc) && !(sc in feature.exemptScenarios));
    expect(untested).toEqual([]);
  });

  it("no scenario exemption is stale: an exempt scenario really has no test", () => {
    const cited = scenariosCitedByTests(feature);
    expect(Object.keys(feature.exemptScenarios).filter((sc) => cited.has(sc))).toEqual([]);
  });

  it("every scenario exemption refers to a scenario that exists", () => {
    const scenarios = scenarioTags(feature);
    expect(Object.keys(feature.exemptScenarios).filter((sc) => !scenarios.has(sc))).toEqual([]);
  });
});
