// 15 — Package resolution. Every other example imports `../dist/index.cjs`
// directly, which bypasses the `exports` map in package.json entirely. This
// file is the only one that resolves the package the way a real consumer does:
// by its bare name. It therefore covers the export conditions (`import` vs
// `require`), the declared subpaths, and the parity between the two builds.
//
// It works without installing anything because Node resolves a package's own
// name from inside that package ("self-reference"), which requires `name` and
// `exports` to be present — so a broken exports map fails this file outright.

const test = require("node:test");
const assert = require("node:assert");

// "wative-core/node" is where HybridProviderV3 lives after the breaking
// refactor that folded NodeHybridProvider into it. It was missing here, so the
// subpath carrying the release's headline feature was the one subpath nothing
// resolved.
const SUBPATHS = [
  "wative-core",
  "wative-core/node",
  "wative-core/artifacts/evm",
  "wative-core/artifacts/svm",
];

test("every declared subpath resolves by bare name under require(), to the CJS build", () => {
  for (const specifier of SUBPATHS) {
    const resolved = require.resolve(specifier);
    assert.ok(
      resolved.endsWith(".cjs"),
      `${specifier} should resolve to the CJS build via the "require" condition, got ${resolved}`,
    );
    const mod = require(specifier);
    assert.ok(mod && typeof mod === "object", `${specifier} exported nothing`);
  }
});

// A type used in a public signature but not exported is invisible to a
// TypeScript consumer, who then cannot name what the method returns. That is not
// visible from JavaScript, so it is asserted against the emitted declarations.
//
// Two things this used to get wrong, both of which let a real regression ship:
//
//   1. It opened ONLY `dist/index.node.d.cts` — the node+require artifact. The
//      root subpath emits THREE declaration files (browser/default, node+import,
//      node+require), and `ContainerState` is the return type of the universal
//      `Provider.inspectContainer()`. Deleting its export from the browser
//      artifact alone left this green while every bundler consumer got TS2305.
//      The artifact list is now derived from the `exports` map itself, so a new
//      subpath or condition is covered the day it is added rather than the day
//      someone remembers.
//
//   2. It asserted `\bName\b` — bare presence anywhere in the file. A name also
//      appears in an import specifier, in another type's signature, or in a
//      comment, so the assertion held whether or not the name was EXPORTED. It
//      now parses the export clauses and checks membership in the exported set.
// Keyed by ARTIFACT, not by subpath: the browser and node root builds export
// legitimately different sets (the node one adds the filesystem provider), so a
// per-subpath map cannot express "required here, absent there" and would either
// under-check the node build or falsely fail the browser one.
//
// ⚠️ This list is HAND-MAINTAINED, and that is the remaining weakness. The
// checks below make the ORACLE strong — every declared artifact, and exported
// rather than merely mentioned — but the INPUT is still a list someone has to
// remember to extend. `OpenOptions` and `PasswordCheckContext` were both TS2305
// in a shipped release precisely because nothing derived this list from the
// public signatures. Deriving it (a referenced-but-not-exported set difference
// over the emitted declarations) is the real fix and is not done here.
const EXPECTED_EXPORTS = {
  "./dist/index.d.ts": ["ContainerState", "Argon2BackendInfo", "OpenOptions", "PasswordCheckContext"],
  "./dist/index.node.d.ts": [
    "ContainerState",
    "Argon2BackendInfo",
    "OpenOptions",
    "PasswordCheckContext",
    // The node root re-exports the filesystem provider surface. `exports.test.ts`
    // pins this as a deliberate contract, and `18-envelope-v3.test.cjs` reaches
    // `HybridProviderV3` through the ROOT specifier, not the ./node subpath.
    "HybridProviderV3",
    "HybridProvider",
    "FileSink",
    "FileSinkOptions",
  ],
  "./dist/index.node.d.cts": [
    "ContainerState",
    "Argon2BackendInfo",
    "OpenOptions",
    "PasswordCheckContext",
    "HybridProviderV3",
    "HybridProvider",
    "FileSink",
    "FileSinkOptions",
  ],
  "./dist/node/index.d.ts": ["HybridProviderV3", "HybridProvider", "FileSink", "FileSinkOptions"],
  "./dist/node/index.d.cts": ["HybridProviderV3", "HybridProvider", "FileSink", "FileSinkOptions"],
};

// The `exports` map declares 10 `types` entries across 9 distinct files
// (`./dist/index.d.ts` is reached by both the `browser` and `default`
// conditions). Both totals are asserted EXACTLY rather than as floors: a floor
// tolerates a gap, so deleting `exports["./node"].require.types` would drop the
// CJS declarations for the subpath carrying the headline feature and still pass.
// 32 = 4 (index.d.ts, counted twice — browser and default both resolve to it)
//    + 8 + 8 (the two node root artifacts) + 4 + 4 (the ./node subpath pair).
// The artifacts/{evm,svm} pairs contribute none; they are checked for existence
// and non-emptiness only.
const EXPECTED_ARTIFACTS = 10;
const EXPECTED_ASSERTIONS = 32;

// tsup re-exports rather than re-declares: `export { k as ContainerState } from
// './chunk.cjs'`. The public name is what follows `as`, or the whole entry when
// there is no alias. Direct `export declare class X` forms are collected too.
//
// Two shapes the two builds do NOT agree on, both of which must be handled or
// the check reports a false regression: the browser artifact writes inline type
// modifiers (`type Argon2BackendInfo`) where the node artifact writes the bare
// name, and a name colliding with a lib type is emitted aliased (`Record$1 as
// Record`). Strip the modifier first, then resolve the alias.
function exportedNames(dts) {
  const names = new Set();
  for (const m of dts.matchAll(/export\s*(?:type\s*)?\{([^}]*)\}/g)) {
    for (const entry of m[1].split(",")) {
      const trimmed = entry.trim().replace(/^type\s+/, "");
      if (!trimmed) continue;
      const parts = trimmed.split(/\s+as\s+/);
      names.add(parts[parts.length - 1].trim());
    }
  }
  for (const m of dts.matchAll(
    /export\s+(?:declare\s+)?(?:abstract\s+)?(?:class|interface|type|const|function|enum)\s+([A-Za-z_$][\w$]*)/g,
  )) {
    names.add(m[1]);
  }
  return names;
}

// Every `types` file the exports map can resolve, as [subpath, condition, file].
function declaredTypeArtifacts(exportsMap) {
  const out = [];
  const walk = (subpath, node, condition) => {
    if (typeof node === "string") return;
    for (const [key, value] of Object.entries(node)) {
      if (key === "types" && typeof value === "string") {
        out.push({ subpath, condition: condition || "default", file: value });
      } else if (value && typeof value === "object") {
        walk(subpath, value, condition ? `${condition}.${key}` : key);
      }
    }
  };
  for (const [subpath, node] of Object.entries(exportsMap)) walk(subpath, node, "");
  return out;
}

test("every type named by a public signature is exported from every artifact that declares it", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  // Resolve the package under test by NAME, not by `__dirname/..`. This file
  // runs in two layouts: in the release checkout (examples/ beside dist/, where
  // `..` is the package root) and copied FLAT into a scratch consumer dir that
  // installed the tarball (where `..` is the scratch dir's parent and holds no
  // package.json at all). The second layout is what CI's "published" job uses,
  // and `__dirname/..` made this test throw ENOENT there — so that job has
  // never been able to pass. The exports map declares "./package.json", so this
  // resolves in both.
  const root = path.dirname(require.resolve("wative-core/package.json"));
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const artifacts = declaredTypeArtifacts(pkg.exports);

  // If the exports map stops declaring types, this test would otherwise pass by
  // checking nothing at all — the same vacuity it exists to prevent.
  assert.strictEqual(
    artifacts.length,
    EXPECTED_ARTIFACTS,
    `the exports map declares ${artifacts.length} types entries, expected exactly ${EXPECTED_ARTIFACTS}. ` +
      `A condition lost its "types" (consumers fall back to "could not find a declaration file"), ` +
      `or a subpath was added and needs an entry in EXPECTED_EXPORTS.`,
  );

  // Counting `types` entries alone cannot see a subpath that declares NONE: the
  // total is unchanged, so the exact-count assertion above passes while the new
  // subpath ships with no declarations at all and its consumers get "could not
  // find a declaration file". Every subpath with conditions must produce at
  // least one.
  for (const [subpath, node] of Object.entries(pkg.exports)) {
    if (typeof node === "string") continue; // "./package.json" — a file, not a type surface
    assert.ok(
      artifacts.some((a) => a.subpath === subpath),
      `subpath "${subpath}" declares no "types" under any condition — TypeScript consumers get no declarations for it`,
    );
  }

  let checked = 0;
  for (const { subpath, condition, file } of artifacts) {
    const abs = path.join(root, file);
    assert.ok(fs.existsSync(abs), `${subpath} (${condition}) declares types "${file}", which does not exist`);
    const names = exportedNames(fs.readFileSync(abs, "utf8"));
    assert.ok(names.size > 0, `${file} exports nothing — the declaration emit is empty or malformed`);
    for (const name of EXPECTED_EXPORTS[file] || []) {
      assert.ok(
        names.has(name),
        `${name} appears in a public signature of "${subpath}" but is not exported from ${file}`,
      );
      checked++;
    }
  }
  // Exact, for the same reason as the artifact count: a floor here would let a
  // whole artifact's expectations be deleted without the suite noticing.
  assert.strictEqual(
    checked,
    EXPECTED_ASSERTIONS,
    `made ${checked} name/artifact assertions, expected exactly ${EXPECTED_ASSERTIONS}`,
  );
});

test("bare-name require() exposes the documented entry points", () => {
  const core = require("wative-core");
  for (const name of ["Workspace", "Network", "Asset", "Provider", "WativeError"]) {
    assert.ok(core[name], `wative-core should export ${name}`);
  }
  const evm = require("wative-core/artifacts/evm");
  assert.strictEqual(typeof evm.ERC20.encode, "function");
  const svm = require("wative-core/artifacts/svm");
  assert.strictEqual(typeof svm.TokenProgram.encodeInstruction, "function");
});

test("every declared subpath resolves by bare name under import(), to the ESM build", async () => {
  for (const specifier of SUBPATHS) {
    const mod = await import(specifier);
    assert.ok(mod && typeof mod === "object", `${specifier} exported nothing via import()`);
  }
});

test("the CJS and ESM builds expose an identical export surface", async () => {
  const cjs = require("wative-core");
  const esm = await import("wative-core");

  const cjsKeys = Object.keys(cjs).sort();
  // The ESM namespace carries a `default` interop key that the CJS object does not.
  const esmKeys = Object.keys(esm).filter((k) => k !== "default").sort();

  assert.deepStrictEqual(
    esmKeys,
    cjsKeys,
    "the two builds must expose the same named exports, or consumers get different APIs depending on how they import",
  );
  assert.ok(cjsKeys.length > 0, "expected a non-empty export surface");
});

test("the package advertises a Node version that the current runtime satisfies", () => {
  const { engines } = require("wative-core/package.json");
  assert.ok(engines && engines.node, "package.json should declare engines.node");

  const required = engines.node.replace(/^[^\d]*/, "").split(".").map(Number);
  const actual = process.versions.node.split(".").map(Number);
  const satisfies =
    actual[0] > required[0] ||
    (actual[0] === required[0] && (actual[1] ?? 0) >= (required[1] ?? 0));

  assert.ok(
    satisfies,
    `these examples are running on Node ${process.versions.node} but the package requires ${engines.node}`,
  );
});
