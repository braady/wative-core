// 06 — Address signing. Sign personal messages and build transactions
// fully offline.

const test = require("node:test");
const assert = require("node:assert");
const { mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { Workspace, Network } = require("../dist/index.cjs");

const MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

test("address — signMessage on EVM and SVM", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-sign-msg-"));
  const ws = await Workspace.open({ path: root, password: "wsp-pwd" });

  const acc = await ws.accounts.create("Desk", "wsp-pwd", MNEMONIC);
  const evm = acc.wallets[0].addresses.find((a) => a.vm === "evm");
  const svm = acc.wallets[0].addresses.find((a) => a.vm === "svm");

  const evmSig = evm.signMessage("hello");
  const svmSig = svm.signMessage("hello");

  assert.ok(typeof evmSig === "string" && evmSig.startsWith("0x"));
  assert.ok(typeof svmSig === "string" && svmSig.length > 0);
  assert.notStrictEqual(evmSig, svmSig);

  await ws.lock();
});

test("address — buildTransaction convenience helper (offline)", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-build-tx-"));
  const ws = await Workspace.open({ path: root, password: "wsp-pwd" });

  const acc = await ws.accounts.create("Desk", "wsp-pwd", MNEMONIC);
  const evm = acc.wallets[0].addresses.find((a) => a.vm === "evm");

  const tx = await evm.buildTransaction({
    to: "0x1234567890123456789012345678901234567890",
    value: 1_000_000_000_000_000n,
    chainId: 1,
    nonce: 0,
    gasLimit: 21000n,
    maxFeePerGas: 50_000_000_000n,
    maxPriorityFeePerGas: 1_000_000_000n,
    type: 2,
    network: Network.Ethereum,
  });

  assert.strictEqual(tx.from.toLowerCase(), evm.publicKey.toLowerCase());

  await ws.lock();
});
