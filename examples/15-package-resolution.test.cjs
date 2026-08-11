// 15 — The exports map itself: every subpath, both conditions, and build parity.

const test = require("node:test");
const assert = require("node:assert");

// "wative-core/node" carries HybridProviderV3 and was once missing from this list.
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

// Keyed by ARTIFACT, since the browser and node root builds export different sets.
const EXPECTED_EXPORTS = {
  "./dist/index.d.ts": ["ContainerState", "Argon2BackendInfo", "OpenOptions", "PasswordCheckContext"],
  "./dist/index.node.d.ts": [
    "ContainerState",
    "Argon2BackendInfo",
    "OpenOptions",
    "PasswordCheckContext",
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

// Both totals are EXACT, not floors: a floor tolerates the gap this exists to catch.
const EXPECTED_ARTIFACTS = 10;
const EXPECTED_ASSERTIONS = 32;

// tsup re-exports rather than re-declares, so strip any inline modifier then the alias.
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
  const root = path.dirname(require.resolve("wative-core/package.json"));
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const artifacts = declaredTypeArtifacts(pkg.exports);

  assert.strictEqual(
    artifacts.length,
    EXPECTED_ARTIFACTS,
    `the exports map declares ${artifacts.length} types entries, expected exactly ${EXPECTED_ARTIFACTS}. ` +
      `A condition lost its "types" (consumers fall back to "could not find a declaration file"), ` +
      `or a subpath was added and needs an entry in EXPECTED_EXPORTS.`,
  );

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
