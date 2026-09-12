// 21 — Token-aware buildTransferPayload(): one intent lowered per chain into the buildTransaction payload — native value, ERC-20 by address, SPL by mint, and by symbol. Payload only (does not send); amounts are raw base units.

const test = require("node:test");
const assert = require("node:assert");
const { mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { Workspace } = require("wative-core");

const MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

// Real mainnet token identifiers, used only for their format; the EVM address is lowercase and gets canonicalized.
const USDC_EVM = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const USDC_SVM_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// A workspace with two wallets: wallet 0 sends, wallet 1's public keys are valid recipients on each chain.
async function twoWallets() {
  const root = mkdtempSync(join(tmpdir(), "wative-transfer-"));
  const ws = await Workspace.open({ path: root, password: "wsp-pwd" });
  const acc = await ws.accounts.create("Desk", "wsp-pwd", MNEMONIC);
  await acc.deriveWallets(1);
  return { ws, w0: acc.wallets[0], w1: acc.wallets[1] };
}

test("buildTransferPayload() —native value on EVM and SVM (asset omitted)", async () => {
  const { ws, w0, w1 } = await twoWallets();

  const evmTx = w0.evm.buildTransferPayload({ to: String(w1.evm.publicKey), amount: 1_000_000_000_000_000n });
  assert.strictEqual(String(evmTx.to).toLowerCase(), String(w1.evm.publicKey).toLowerCase());
  assert.strictEqual(evmTx.value, 1_000_000_000_000_000n);

  const svmTx = w0.svm.buildTransferPayload({ to: String(w1.svm.publicKey), amount: 5000n });
  assert.ok(svmTx);

  await ws.lock();
});

test("buildTransferPayload() —EVM ERC-20 by contract address", async () => {
  const { ws, w0, w1 } = await twoWallets();
  const tx = w0.evm.buildTransferPayload({ to: String(w1.evm.publicKey), asset: { address: USDC_EVM }, amount: 1_000_000n });

  assert.strictEqual(String(tx.to).toLowerCase(), USDC_EVM.toLowerCase());
  assert.strictEqual(tx.value, 0n);
  assert.strictEqual(String(tx.data).slice(0, 10), "0xa9059cbb");
  assert.strictEqual((String(tx.data).length - 2) / 2, 68);

  await ws.lock();
});

test("buildTransferPayload() —SVM SPL by mint prepends an idempotent recipient-ATA create", async () => {
  const { ws, w0, w1 } = await twoWallets();
  const tx = w0.svm.buildTransferPayload({ to: String(w1.svm.publicKey), asset: { address: USDC_SVM_MINT }, amount: 1_000_000n });

  assert.ok(Array.isArray(tx.instructions));
  assert.strictEqual(tx.instructions.length, 2);

  await ws.lock();
});

test("buildTransferPayload() —by token symbol resolves to native vs token", async () => {
  const { ws, w0, w1 } = await twoWallets();

  const usdc = w0.evm.buildTransferPayload({ to: String(w1.evm.publicKey), asset: { symbol: "USDC" }, amount: 1_000_000n });
  assert.strictEqual(String(usdc.data).slice(0, 10), "0xa9059cbb");

  const eth = w0.evm.buildTransferPayload({ to: String(w1.evm.publicKey), asset: { symbol: "ETH" }, amount: 777n });
  assert.strictEqual(eth.value, 777n);

  await ws.lock();
});

test("buildTransferPayload() —an out-of-range amount is a PARAMETER_ERROR", async () => {
  const { ws, w0, w1 } = await twoWallets();
  let code;
  try {
    w0.evm.buildTransferPayload({ to: String(w1.evm.publicKey), asset: { address: USDC_EVM }, amount: -1n });
  } catch (e) {
    code = e.code;
  }
  assert.strictEqual(code, "PARAMETER_ERROR");

  await ws.lock();
});
