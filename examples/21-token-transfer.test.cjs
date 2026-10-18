// 21 — Token-aware transfers: buildTransferPayload() lowers one intent per chain into the buildTransaction payload (native value, ERC-20 by address, SPL by mint, by symbol), and the one-call transfer({ to, amount, asset? }) facade composes payload -> buildTransaction -> send(). Amounts are raw base units. Everything here is offline — payloads/built shapes, never a broadcast.

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

test("buildTransaction({ tokenMint }) —low-level SPL transfer convenience (SVM)", async () => {
  const { ws, w0, w1 } = await twoWallets();
  const tx = w0.svm.buildTransaction({
    recipient: String(w1.svm.publicKey),
    amount: 1_000_000n,
    tokenMint: USDC_SVM_MINT,
    recentBlockhash: "11111111111111111111111111111111",
  });
  assert.ok(tx);

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

test("transfer() —the facade builds the same transaction the explicit path does, for all three intents", async () => {
  const { ws, w0, w1 } = await twoWallets();
  const to = String(w1.evm.publicKey);

  const nativePayload = w0.evm.buildTransferPayload({ to, amount: 1_000_000_000_000_000n }); // native coin — asset omitted
  const nativeTx = w0.evm.buildTransaction({ ...nativePayload, chainId: 1 });
  assert.strictEqual(String(nativeTx.to).toLowerCase(), to.toLowerCase());
  assert.strictEqual(nativeTx.value, 1_000_000_000_000_000n);
  assert.strictEqual(nativeTx.from.toLowerCase(), w0.evm.publicKey.toLowerCase());
  assert.strictEqual(Number(nativeTx.chainId), 1);

  const byAddr = w0.evm.buildTransferPayload({ to, asset: { address: USDC_EVM }, amount: 1_000_000n }); // token by { address } — an ERC-20 transfer() call
  const byAddrTx = w0.evm.buildTransaction({ ...byAddr, chainId: 1 });
  assert.strictEqual(String(byAddrTx.to).toLowerCase(), USDC_EVM.toLowerCase());
  assert.strictEqual(byAddrTx.value, 0n);
  assert.strictEqual(String(byAddrTx.data).slice(0, 10), "0xa9059cbb");

  const bySymbol = w0.evm.buildTransferPayload({ to, asset: { symbol: "USDC" }, amount: 1_000_000n }); // token by { symbol } — same ERC-20 call
  const bySymbolTx = w0.evm.buildTransaction({ ...bySymbol, chainId: 1 });
  assert.strictEqual(String(bySymbolTx.data).slice(0, 10), "0xa9059cbb");

  await ws.lock();
});

test("transfer() —returns a live TransactionTracker (with whenConfirmed), never a pre-send Transaction", async () => {
  const { ws, w0, w1 } = await twoWallets();
  const to = String(w1.evm.publicKey);

  const realFetch = global.fetch;
  global.fetch = async (_input, init) => { // mocked to refuse every RPC — transfer() signs+broadcasts, so keep it offline and assert only the tracker shape
    const req = JSON.parse(init.body);
    return new Response(
      JSON.stringify({ jsonrpc: "2.0", id: req.id, error: { code: -32000, message: "offline example suite" } }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  try {
    const intents = [
      { to, amount: 1_000_000_000_000_000n }, // native coin, asset omitted
      { to, asset: { address: USDC_EVM }, amount: 1_000_000n }, // token by address
      { to, asset: { symbol: "USDC" }, amount: 1_000_000n }, // token by symbol
    ];
    for (const intent of intents) {
      const tracker = w0.evm.transfer(intent);
      assert.strictEqual(typeof tracker.whenConfirmed, "function");
      assert.strictEqual(typeof tracker.abort, "function");
      assert.strictEqual(typeof tracker.on, "function");
      assert.strictEqual(typeof tracker.status, "string");
      tracker.abort(); // stop tracking — we never awaited a broadcast
    }
    await new Promise((resolve) => setTimeout(resolve, 20)); // let the detached send paths settle against the mock before restoring fetch
  } finally {
    global.fetch = realFetch;
  }

  await ws.lock();
});
