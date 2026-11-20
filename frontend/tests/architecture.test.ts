// @vitest-environment node
/**
 * The architecture of the interface, checked on the imports of the source (decision 1 of the design of feature 09):
 * `api` knows nothing of the rest and not of React, `texts` knows `api`, `session` knows both, and `ui` knows all.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

type Layer = "api" | "texts" | "session" | "ui" | "entry";

const RULES: Readonly<Record<Layer, { imports: readonly Layer[]; packages: readonly string[] }>> = {
  api: { imports: [], packages: [] },
  texts: { imports: ["api"], packages: [] },
  session: { imports: ["api", "texts"], packages: ["react"] },
  ui: { imports: ["api", "texts", "session"], packages: ["react", "react-dom", "react-router-dom", "recharts"] },
  // The file that starts the page puts the pieces together, as the Composition Root of the backend does.
  entry: { imports: ["api", "texts", "session", "ui"], packages: ["react", "react-dom", "react-dom/client", "react-router-dom"] },
};

const SRC = new URL("../src/", import.meta.url);

interface Source {
  readonly path: string;
  readonly layer: Layer | null;
  readonly imports: readonly string[];
}

function layerOf(path: string): Layer | null {
  const folder = path.split("/")[0];
  if (path.includes("/") && folder && folder in RULES && folder !== "entry") return folder as Layer;
  return path.includes("/") ? null : "entry";
}

function walk(dir: URL, prefix = ""): string[] {
  return readdirSync(dir).flatMap((name) => {
    const child = new URL(statSync(new URL(name, dir)).isDirectory() ? `${name}/` : name, dir);
    return statSync(child).isDirectory() ? walk(child, `${prefix}${name}/`) : /\.(ts|tsx)$/.test(name) ? [`${prefix}${name}`] : [];
  });
}

function importsOf(code: string): string[] {
  const specifier = /\b(?:import|export)\s+(?:type\s+)?(?:[^"';]*?\s+from\s+)?["']([^"']+)["']/g;
  return [...code.matchAll(specifier)].map((m) => m[1] as string);
}

const sources = (): Source[] =>
  walk(SRC).map((path) => ({ path, layer: layerOf(path), imports: importsOf(readFileSync(new URL(path, SRC), "utf8")) }));

/** The layer that a relative import points to. */
function target(from: string, specifier: string): Layer | null {
  const base = new URL(specifier, new URL(from, "file:///src/")).pathname.replace(/^\/src\//, "");
  // An import of a folder, such as `../texts`, points to the layer of that folder.
  const first = base.split("/")[0] ?? "";
  if (first in RULES && first !== "entry") return first as Layer;
  return base.includes("/") ? null : "entry";
}

describe("architecture of the frontend", () => {
  const all = sources();

  it("finds the source files, and every one belongs to a known layer", () => {
    expect(all.length).toBeGreaterThan(5);
    expect(all.filter((s) => s.layer === null).map((s) => s.path)).toEqual([]);
  });

  it("the folders are the ones of the design", () => {
    const folders = readdirSync(fileURLToPath(SRC)).filter((name) => statSync(new URL(name, SRC)).isDirectory());
    expect(folders.filter((f) => !(f in RULES) || f === "entry")).toEqual([]);
  });

  it.each(Object.keys(RULES) as Layer[])("%s depends only on the layers and packages it is allowed to", (layer) => {
    const { imports: allowedLayers, packages: allowedPackages } = RULES[layer];
    const violations: string[] = [];
    for (const file of all.filter((s) => s.layer === layer)) {
      for (const specifier of file.imports) {
        if (specifier.startsWith(".")) {
          if (/\.(css|svg|png)$/.test(specifier)) continue;
          const targetLayer = target(file.path, specifier);
          if (targetLayer !== layer && !(targetLayer && allowedLayers.includes(targetLayer))) {
            violations.push(`${file.path} imports ${specifier} (${targetLayer ?? "outside src"})`);
          }
        } else if (!allowedPackages.includes(specifier)) {
          violations.push(`${file.path} imports the package ${specifier}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("the client of the API has no React in it", () => {
    for (const file of all.filter((s) => s.layer === "api")) {
      expect(file.imports.filter((i) => i.startsWith("react"))).toEqual([]);
    }
  });

  it("no source file imports from the tests", () => {
    expect(all.filter((s) => s.imports.some((i) => i.includes("tests"))).map((s) => s.path)).toEqual([]);
  });

  it("is able to see a violation: a file of `api` that imports `texts` would be one", () => {
    const fake = { path: "api/x.ts", layer: "api" as Layer, imports: ["../texts"] };
    expect(target(fake.path, fake.imports[0] as string)).toBe("texts");
    expect(RULES.api.imports.includes("texts")).toBe(false);
  });

  it("the folder of the source exists", () => {
    expect(existsSync(SRC)).toBe(true);
  });
});
