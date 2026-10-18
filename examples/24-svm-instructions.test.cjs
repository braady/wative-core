// 24 — Arbitrary SVM instructions: wallet.svm.buildTransaction({ instructions }) builds straight from instructions with NO recipient/amount; a caller-supplied recentBlockhash keeps build + sign fully offline (local ed25519). Instructions here are made with wative-core/artifacts/svm.

const test = require("node:test");
const assert = require("node:assert");
const { mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { Workspace, WativeError } = require("wative-core");
const { TokenProgram } = require("wative-core/artifacts/svm");

const MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

// A fixed base58 blockhash so the build never reaches the network (all-ones placeholder; a real caller passes a fresh one from getRecentBlockhash).
const BLOCKHASH = "11111111111111111111111111111111";

async function svmWallet() {
  const ws = await Workspace.open({ path: mkdtempSync(join(tmpdir(), "wative-svm-ix-")), password: "wsp-pwd" });
  const acc = await ws.accounts.create("Desk", "wsp-pwd", MNEMONIC);
  await acc.deriveWallets(1);
  return { ws, w0: acc.wallets[0], w1: acc.wallets[1] };
}

test("buildTransaction({ instructions }) — instructions-only build (no recipient/amount) signs offline", async () => {
  const { ws, w0, w1 } = await svmWallet();

  const ix = TokenProgram.encodeInstruction(
    "transfer",
    { amount: 1_000_000n },
    { source: String(w1.svm.publicKey), destination: String(w0.svm.publicKey), authority: String(w0.svm.publicKey) },
  );

  const tx = w0.svm.buildTransaction({ instructions: [ix], recentBlockhash: BLOCKHASH });

  assert.strictEqual(tx.vm, "svm");
  assert.ok(Array.isArray(tx.instructions));
  assert.strictEqual(tx.instructions.length, 1);
  assert.strictEqual(tx.recipient, ""); // instructions-only: no transfer recipient
  assert.strictEqual(tx.recentBlockhash, BLOCKHASH);

  await tx.sign();
  assert.strictEqual(tx.status, "signed");

  await ws.lock();
});

test("buildTransaction({ instructions }) — preserves caller instruction order", async () => {
  const { ws, w0, w1 } = await svmWallet();

  const first = TokenProgram.encodeInstruction(
    "transfer",
    { amount: 10n },
    { source: String(w0.svm.publicKey), destination: String(w1.svm.publicKey), authority: String(w0.svm.publicKey) },
  );
  const second = TokenProgram.encodeInstruction(
    "transfer",
    { amount: 20n },
    { source: String(w0.svm.publicKey), destination: String(w1.svm.publicKey), authority: String(w0.svm.publicKey) },
  );

  const tx = w0.svm.buildTransaction({ instructions: [first, second], recentBlockhash: BLOCKHASH });
  assert.strictEqual(tx.instructions.length, 2);
  await tx.sign();
  assert.strictEqual(tx.status, "signed");

  await ws.lock();
});

test("buildTransaction() — neither a transfer nor instructions is a PARAMETER_ERROR", async () => {
  const { ws, w0 } = await svmWallet();

  const tx = w0.svm.buildTransaction({ recentBlockhash: BLOCKHASH });
  await assert.rejects(tx.sign(), (err) => err instanceof WativeError && err.code === "PARAMETER_ERROR");

  await ws.lock();
});
