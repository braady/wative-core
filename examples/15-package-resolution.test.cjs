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

const SUBPATHS = ["wative-core", "wative-core/artifacts/evm", "wative-core/artifacts/svm"];

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
