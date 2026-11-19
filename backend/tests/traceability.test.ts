/**
 * Traceability of feature 01: business rule -> scenario -> test.
 *
 * The scenarios tag the rules they exercise (@BR-nn) and the tests cite the scenario
 * (SC-nn) in their title. This test keeps that chain from rotting: it fails when a rule
 * has no scenario, a tag points to a rule that does not exist, or a scenario has no test
 * and no justified exemption.
 *
 * Only test titles are read, not comments: a comment that says a scenario is not tested
 * must not count as a test.
 */

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const FEATURE_DIR = new URL("../../docs/features/01-create-price-alert/", import.meta.url);
const TESTS_DIR = new URL("./", import.meta.url);

/** Scenarios that have no test of their own, and why. An entry must stay justified. */
const EXEMPT_SCENARIOS: Readonly<Record<string, string>> = {
  "SC-05":
    "BR-10 states the absence of restrictions: the command carries no email or Watchlist data, so nothing can require them.",
};

const readFeatureFile = (name: string) => readFileSync(new URL(name, FEATURE_DIR), "utf8");

const pad = (id: string) => `${id.slice(0, id.indexOf("-") + 1)}${id.slice(id.indexOf("-") + 1).padStart(2, "0")}`;

/** scenario id -> the rule ids it is tagged with */
function scenarioTags(): Map<string, string[]> {
  const scenarios = new Map<string, string[]>();
  for (const line of readFeatureFile("02-scenarios.feature").split("\n")) {
    if (!/^\s*@SC-\d+/.test(line)) continue;
    const tags = line.trim().split(/\s+/);
    const scenario = tags.find((t) => t.startsWith("@SC-"));
    if (scenario) scenarios.set(pad(scenario.slice(1)), tags.filter((t) => t.startsWith("@BR-")).map((t) => pad(t.slice(1))));
  }
  return scenarios;
}

function businessRules(): string[] {
  return [...readFeatureFile("01-business-rules.md").matchAll(/^\| (BR-\d+) \|/gm)].map((m) => pad(m[1] as string));
}

function testFiles(dir: URL = TESTS_DIR): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = new URL(entry.name + (entry.isDirectory() ? "/" : ""), dir);
    // The tests of another feature cite their own SC-nn, which would be taken for these.
    if (entry.isDirectory()) return entry.name === "price-observations" ? [] : testFiles(path);
    const isTest = entry.name.endsWith(".test.ts") && entry.name !== "traceability.test.ts";
    return isTest ? [fileURLToPath(path)] : [];
  });
}

/** The titles of the tests: it("title", ...) and it.each(...)("title", ...) */
function testTitles(): string[] {
  const title = /(?:\bit|\))\(\s*(["`])((?:\\.|(?!\1).)*)\1\s*,\s*(?:async\s*)?\(/g;
  return testFiles().flatMap((file) =>
    [...readFileSync(file, "utf8").matchAll(title)].map((m) => m[2] as string),
  );
}

function scenariosCitedByTests(): Set<string> {
  return new Set(testTitles().flatMap((t) => [...t.matchAll(/SC-(\d+)/g)].map((m) => pad(`SC-${m[1]}`))));
}

describe("traceability of feature 01", () => {
  it("finds the scenarios, the rules and the tests it is meant to check", () => {
    expect(scenarioTags().size).toBe(18);
    expect(businessRules()).toHaveLength(11);
    expect(testTitles().length).toBeGreaterThan(50);
  });

  it("every tag in the scenarios refers to an existing business rule", () => {
    const rules = new Set(businessRules());
    const unknown = [...scenarioTags()].flatMap(([sc, brs]) => brs.filter((br) => !rules.has(br)).map((br) => `${sc} -> ${br}`));
    expect(unknown).toEqual([]);
  });

  it("every business rule is exercised by at least one scenario", () => {
    const exercised = new Set([...scenarioTags().values()].flat());
    expect(businessRules().filter((br) => !exercised.has(br))).toEqual([]);
  });

  it("every scenario is cited by a test, or is exempt with a reason", () => {
    const cited = scenariosCitedByTests();
    const untested = [...scenarioTags().keys()].filter((sc) => !cited.has(sc) && !(sc in EXEMPT_SCENARIOS));
    expect(untested).toEqual([]);
  });

  it("no exemption is stale: an exempt scenario really has no test", () => {
    const cited = scenariosCitedByTests();
    expect(Object.keys(EXEMPT_SCENARIOS).filter((sc) => cited.has(sc))).toEqual([]);
  });

  it("every exemption refers to a scenario that exists", () => {
    const scenarios = scenarioTags();
    expect(Object.keys(EXEMPT_SCENARIOS).filter((sc) => !scenarios.has(sc))).toEqual([]);
  });
});
