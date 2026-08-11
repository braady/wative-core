// 11 — Subpath imports: the heavier chain helpers under wative-core/artifacts/{evm,svm}.

const test = require("node:test");
const assert = require("node:assert");

// By SUBPATH, as a consumer writes it — a relative dist/ path would pass only in-repo.
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
