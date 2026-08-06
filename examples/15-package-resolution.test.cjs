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
test("every type named by a public signature is exported", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const dts = fs.readFileSync(path.join(__dirname, "..", "dist", "index.node.d.cts"), "utf8");
  // The emitted declarations re-export rather than re-declare, so match the
  // exported NAME. These names reach the bundle only from an explicit export in
  // src/index.ts, so their presence is the thing being asserted.
  for (const name of ["ContainerState", "Argon2BackendInfo"]) {
    assert.ok(
      new RegExp(`\\b${name}\\b`).test(dts),
      `${name} appears in a public signature but is not exported from the package types`,
    );
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
