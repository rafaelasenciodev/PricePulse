/** The core knows nothing of the database, and the contracts are run against it (feature 11, SC-27 and SC-28). */

import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SRC = new URL("../../src/", import.meta.url);
const TESTS = new URL("../", import.meta.url);

function walk(dir: URL, prefix = ""): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(new URL(`${entry.name}/`, dir), `${prefix}${entry.name}/`) : [`${prefix}${entry.name}`],
  );
}

describe("SC-27 / BR-09: the domain and the application do not import the driver of the database", () => {
  it("SC-27 / BR-09: no file of the domain or of the application of any module names the driver, and only the adapters and the database layer do", () => {
    const naming = walk(SRC)
      .filter((path) => path.endsWith(".ts"))
      .filter((path) => /(^|\s)(import|export)\b[^;]*["']pg["']/m.test(readFileSync(new URL(path, SRC), "utf8")));
    expect(naming.length).toBeGreaterThan(0);
    expect(naming.filter((path) => !/(\/adapters\/|^database\/)/.test(path))).toEqual([]);
    expect(naming.filter((path) => /\/(domain|application)\//.test(path))).toEqual([]);
  });
});

describe("SC-28 / BR-07: every port passes its contract with the database adapter", () => {
  const files = walk(TESTS).filter((path) => path.endsWith(".ts"));
  const contracts = files
    .filter((path) => /contract\.ts$/.test(path))
    .flatMap((path) => [...readFileSync(new URL(path, TESTS), "utf8").matchAll(/export function (describe\w+Contract)\(/g)].map((m) => m[1] as string))
    // The hasher and the token generator keep nothing: they have no adapter for a database.
    .filter((name) => !/PasswordHasher|SessionTokens/.test(name));
  const databaseTests = files.filter((path) => path.endsWith(".db.test.ts")).map((path) => readFileSync(new URL(path, TESTS), "utf8")).join("\n");
  const memoryTests = files.filter((path) => /in-memory\.test\.ts$/.test(path)).map((path) => readFileSync(new URL(path, TESTS), "utf8")).join("\n");

  it("SC-28 / BR-07: there are eleven contracts of stores", () => {
    expect([...new Set(contracts)]).toHaveLength(11);
  });

  it.each([...new Set(contracts)])("SC-28 / BR-07: %s runs against the database adapter and against the in-memory one", (name) => {
    expect(databaseTests).toContain(`${name}(`);
    expect(memoryTests).toContain(`${name}(`);
  });
});
