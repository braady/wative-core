// 11 — Subpath imports. Heavier chain helpers ship under `wative-core/artifacts/evm`
// and `wative-core/artifacts/svm` so they're only pulled in when used. In your
// own project: require("wative-core/artifacts/evm") / require("wative-core/artifacts/svm").

const test = require("node:test");
const assert = require("node:assert");

// Imported by SUBPATH, which is the whole point of this example — and what a
// consumer writes. A relative path into dist/ would resolve here but nowhere
// else, so it would pass in-repo while failing for every real installation.
const evmArtifacts = require("wative-core/artifacts/evm");
const svmArtifacts = require("wative-core/artifacts/svm");

test("subpath import — evm artifacts expose a usable ERC20 contract", () => {
  assert.ok(evmArtifacts.ERC20);
  assert.strictEqual(typeof evmArtifacts.ERC20.encode, "function");
});

test("subpath import — svm artifacts expose TokenProgram and Token2022Program", () => {
  assert.ok(svmArtifacts.TokenProgram);
  assert.ok(svmArtifacts.Token2022Program);
  assert.strictEqual(typeof svmArtifacts.TokenProgram.encodeInstruction, "function");
  assert.strictEqual(typeof svmArtifacts.Token2022Program.encodeInstruction, "function");
});
