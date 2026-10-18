// Shared, dependency-free detector behind every wative-core pre-write hook adapter.
// It reuses the SAME banned set as `.wative/eslint-no-reinvent.mjs` — the one source
// shared with the ESLint gate — so the hook and the lint rule can never drift
// apart, and the remediation text is the ESLint rule's own message.
//
// Agent-agnostic: an adapter reads its agent's stdin shape, pulls out the text about
// to be written, calls scanText(), and blocks in its agent's way. This file holds the
// banned-set loading + the detection only. Node built-ins only — it runs on EVERY
// write in the consumer's environment, so it must be fast and carry no dependencies.

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

export const ALLOW_TOKEN = "wative-allow";

// Walk up from `startDir` to the first ancestor holding `.wative/eslint-no-reinvent.mjs`.
export function findBannedConfig(startDir) {
  let dir = startDir;
  for (;;) {
    const candidate = join(dir, ".wative", "eslint-no-reinvent.mjs");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

// Flatten the ESLint flat-config fragment into a plain banned set — the same shape
// the ESLint rule declares, so the hook and the lint rule stay in agreement.
export async function loadBannedSet(configPath) {
  const mod = await import(pathToFileURL(configPath).href);
  const rule = mod.default[0].rules["no-restricted-imports"][1];
  const pathBans = new Map();
  for (const p of rule.paths ?? []) {
    pathBans.set(p.name, { names: new Set(p.importNames ?? []), message: p.message ?? `Do not import ${p.name}.` });
  }
  const patternBans = (rule.patterns ?? []).map((p) => ({ group: p.group ?? [], message: p.message ?? "Banned module." }));
  return { pathBans, patternBans };
}

// --- import extraction (dependency-free; a speed-bump scan, not a full parser) ---

const RE_FROM = /(?:import|export)\b([\s\S]*?)\bfrom\s*["']([^"']+)["']/g;
const RE_SIDE_EFFECT = /\bimport\s*["']([^"']+)["']/g;
const RE_CALL = /\b(?:require|import)\s*\(\s*["']([^"']+)["']\s*\)/g;

function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text[i] === "\n") line++;
  return line;
}

function parseClause(clause) {
  const names = [];
  const named = clause.match(/\{([\s\S]*?)\}/);
  if (named) {
    for (const raw of named[1].split(",")) {
      const t = raw.trim().replace(/^type\s+/, "");
      if (t) names.push(t.split(/\s+as\s+/)[0].trim());
    }
  }
  const namespace = /\*\s+as\s+/.test(clause);
  return { names, namespace };
}

export function extractImports(text) {
  const out = [];
  let m;
  RE_FROM.lastIndex = 0;
  while ((m = RE_FROM.exec(text))) {
    const { names, namespace } = parseClause(m[1] || "");
    out.push({ module: m[2], names, namespace, dynamic: false, index: m.index });
  }
  RE_SIDE_EFFECT.lastIndex = 0;
  while ((m = RE_SIDE_EFFECT.exec(text))) out.push({ module: m[1], names: [], namespace: false, sideEffect: true, index: m.index });
  RE_CALL.lastIndex = 0;
  while ((m = RE_CALL.exec(text))) out.push({ module: m[1], names: [], namespace: false, dynamic: true, index: m.index });
  return out;
}

function matchBan(imp, { pathBans, patternBans }) {
  for (const pat of patternBans) {
    if (pat.group.some((g) => imp.module === g || imp.module.startsWith(g + "/"))) {
      return { name: imp.names[0] ?? "*", message: pat.message };
    }
  }
  const pb = pathBans.get(imp.module);
  if (pb) {
    // paths+importNames is a NAMED ban (matches ESLint): a named or namespace import can
    // reach a banned name; a bare side-effect / dynamic / require can't be scoped, so leave
    // those to the exact ESLint + CI gate rather than over-block here.
    if (imp.namespace) return { name: "*", message: pb.message };
    for (const n of imp.names) if (pb.names.has(n)) return { name: n, message: pb.message };
  }
  return null;
}

// Scan `text` for the first banned import. Returns { module, name, message, line } or null.
// Honors the `// wative-allow` escape on, or on the line above, the offending import.
export function scanText(text, bannedSet, opts = {}) {
  const allowToken = opts.allowToken ?? ALLOW_TOKEN;
  const lines = String(text).split("\n");
  for (const imp of extractImports(String(text))) {
    const hit = matchBan(imp, bannedSet);
    if (!hit) continue;
    const ln = lineOf(text, imp.index);
    if ((lines[ln - 1] ?? "").includes(allowToken) || (lines[ln - 2] ?? "").includes(allowToken)) continue;
    return { module: imp.module, name: hit.name, message: hit.message, line: ln };
  }
  return null;
}

// Build the one-line stderr message an adapter writes before it blocks.
export function remediation(hit) {
  const where = hit.name && hit.name !== "*" ? `${hit.module} { ${hit.name} }` : hit.module;
  return `${hit.message}  [${where}, line ${hit.line}]  For genuine interop, add "// ${ALLOW_TOKEN}: <reason>" on the import line.`;
}
