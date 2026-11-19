/**
 * Architecture rules, checked on the imports of the source code.
 *
 * The design says dependencies point inward: the domain knows nothing of the rest, the
 * application knows only the domain, and the adapters and the HTTP layer know the
 * application. Two more rules keep the features apart: `shared` holds only what several
 * features need and imports nothing, and a feature never imports another feature. This test
 * fails when a change breaks any of that, so the review of Phase 9 does not have to be
 * repeated by hand.
 */

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

type Layer = "shared" | "domain" | "application" | "http" | "adapters" | "app" | "evaluation-trigger" | "composition-root" | "main";

/** For each layer: the internal layers it may import, and the packages it may use. */
const RULES: Readonly<Record<Layer, { imports: readonly Layer[]; packages: readonly string[] }>> = {
  shared: { imports: [], packages: [] },
  domain: { imports: ["shared"], packages: [] },
  application: { imports: ["domain", "shared"], packages: [] },
  // node:crypto: the hash of the passwords and the random tokens of the Accounts (ADR-0004), which add no dependency.
  adapters: { imports: ["application", "domain", "shared"], packages: ["node:crypto"] },
  http: { imports: ["application", "domain", "shared"], packages: ["fastify"] },
  // `shared`: the error of a refused origin and the check of the origin of the settings (feature 08).
  app: { imports: ["application", "http", "shared"], packages: ["fastify", "@fastify/swagger", "@fastify/swagger-ui"] },
  // The policy that joins two features: it knows both through their applications and nothing else.
  "evaluation-trigger": { imports: ["application"], packages: ["fastify"] },
  "composition-root": { imports: ["adapters", "application", "http", "app", "evaluation-trigger"], packages: ["fastify"] },
  main: { imports: ["domain", "shared", "composition-root"], packages: [] },
};

const SRC = new URL("../src/", import.meta.url);

interface Source {
  readonly path: string; // relative to src/, for messages
  readonly layer: Layer | null; // null: not in any known layer
  readonly imports: readonly string[]; // as written
}

/** The feature a file belongs to (the folder under src/ that holds the layers), or null. */
function featureOf(path: string): string | null {
  const feature = /^([a-z-]+)\/(?:domain|application|http|adapters)\//.exec(path)?.[1];
  return feature && feature !== "shared" ? feature : null;
}

function layerOf(path: string): Layer | null {
  if (path.startsWith("shared/")) return "shared";
  const folder = /^[a-z-]+\/(domain|application|http|adapters)\//.exec(path)?.[1];
  if (folder && featureOf(path)) return folder as Layer;
  if (path === "app.ts") return "app";
  if (path === "evaluation-trigger.ts") return "evaluation-trigger";
  if (path === "composition-root.ts") return "composition-root";
  if (path === "main.ts") return "main";
  return null;
}

function walk(dir: URL, prefix = ""): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walk(new URL(`${entry.name}/`, dir), `${prefix}${entry.name}/`)
      : entry.name.endsWith(".ts")
        ? [`${prefix}${entry.name}`]
        : [],
  );
}

/** Every module specifier written in an import or an export of a file. */
function importsOf(code: string): string[] {
  const specifier = /\b(?:import|export)\s+(?:type\s+)?(?:[^"';]*?\s+from\s+)?["']([^"']+)["']/g;
  return [...code.matchAll(specifier)].map((m) => m[1] as string);
}

function sources(): Source[] {
  return walk(SRC).map((path) => ({
    path,
    layer: layerOf(path),
    imports: importsOf(readFileSync(new URL(path, SRC), "utf8")),
  }));
}

/** The source file a relative import points to, or null if it points elsewhere. */
function resolve(from: string, specifier: string, all: readonly Source[]): string | null {
  const base = new URL(specifier, new URL(from, "file:///src/")).pathname.replace(/^\/src\//, "");
  return [`${base}.ts`, `${base}/index.ts`].find((p) => all.some((s) => s.path === p)) ?? null;
}

describe("architecture of the backend", () => {
  const all = sources();

  it("finds the source files of every layer", () => {
    const found = new Set(all.map((s) => s.layer));
    expect([...Object.keys(RULES)].filter((l) => !found.has(l as Layer))).toEqual([]);
    expect(all.length).toBeGreaterThan(15);
  });

  it("every source file belongs to a known layer", () => {
    expect(all.filter((s) => s.layer === null).map((s) => s.path)).toEqual([]);
  });

  it.each(Object.keys(RULES) as Layer[])(
    "%s depends only on the layers and packages it is allowed to",
    (layer) => {
      const { imports: allowedLayers, packages: allowedPackages } = RULES[layer];
      const violations: string[] = [];

      for (const file of all.filter((s) => s.layer === layer)) {
        for (const specifier of file.imports) {
          if (specifier.startsWith(".")) {
            const target = resolve(file.path, specifier, all);
            const targetLayer = target ? layerOf(target) : null;
            if (targetLayer !== layer && !(targetLayer && allowedLayers.includes(targetLayer))) {
              violations.push(`${file.path} imports ${specifier} (${targetLayer ?? "outside src"})`);
            }
          } else if (!allowedPackages.includes(specifier)) {
            violations.push(`${file.path} imports the package ${specifier}`);
          }
        }
      }
      expect(violations).toEqual([]);
    },
  );

  it("a feature does not import another feature", () => {
    const violations: string[] = [];
    for (const file of all) {
      const feature = featureOf(file.path);
      if (feature === null) continue;
      for (const specifier of file.imports.filter((i) => i.startsWith("."))) {
        const target = resolve(file.path, specifier, all);
        const targetFeature = target ? featureOf(target) : null;
        if (targetFeature !== null && targetFeature !== feature) {
          violations.push(`${file.path} (${feature}) imports ${specifier} (${targetFeature})`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("no source file imports from the tests", () => {
    expect(all.filter((s) => s.imports.some((i) => i.includes("tests"))).map((s) => s.path)).toEqual([]);
  });

  it("there are no cycles between files", () => {
    const graph = new Map(
      all.map((s) => [
        s.path,
        s.imports.filter((i) => i.startsWith(".")).flatMap((i) => resolve(s.path, i, all) ?? []),
      ]),
    );
    const cycles: string[][] = [];
    const state = new Map<string, "visiting" | "done">();

    const visit = (file: string, path: string[]): void => {
      state.set(file, "visiting");
      for (const next of graph.get(file) ?? []) {
        if (state.get(next) === "visiting") cycles.push([...path.slice(path.indexOf(next)), next]);
        else if (!state.has(next)) visit(next, [...path, next]);
      }
      state.set(file, "done");
    };
    for (const file of graph.keys()) if (!state.has(file)) visit(file, [file]);

    expect(cycles.map((c) => c.join(" -> "))).toEqual([]);
  });
});
