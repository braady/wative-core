// 04 — Network management. Pre-loaded networks, add custom networks,
// override an existing network's RPC URL, drop user networks.

const test = require("node:test");
const assert = require("node:assert");
const { mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { Workspace, Network } = require("../dist/index.cjs");

test("network — 9 pre-loaded networks ship at workspace open", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-net-builtin-"));
  const ws = await Workspace.open(root, "wsp-pwd", true);

  const slugs = ws.networks.map((n) => n.slug).sort();
  assert.deepStrictEqual(slugs, [
    "arbitrum", "base", "bnbchain", "ethereum", "optimism",
    "sepolia", "solana", "solana-devnet", "solana-testnet",
  ]);

  assert.strictEqual(Network.Ethereum.chainId, 1);
  assert.strictEqual(Network.Solana.vm, "svm");
  assert.strictEqual(ws.networks.bySlug("ethereum").chainId, 1);
  assert.strictEqual(ws.networks.byChainId(8453).slug, "base");

  await ws.lock();
});

test("network — add a brand-new user network", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-net-add-"));
  const ws = await Workspace.open(root, "wsp-pwd", true);

  const monad = new Network({
    slug: "monad-testnet",
    name: "Monad Testnet",
    chainId: 10143,
    rpcUrl: "https://testnet-rpc.monad.xyz",
    nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
    vm: "evm",
  });
  await ws.networks.add(monad);

  assert.strictEqual(ws.networks.length, 10);
  assert.strictEqual(ws.networks.bySlug("monad-testnet").chainId, 10143);
  await assert.rejects(ws.networks.add(monad), (err) => err.code === "PARAMETER_ERROR");

  await ws.lock();
});

test("network — override a pre-loaded RPC URL via update()", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-net-override-"));
  const ws = await Workspace.open(root, "wsp-pwd", true);

  const eth = ws.networks.bySlug("ethereum");
  const customEth = new Network({
    ...eth,
    rpcUrl: "https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY",
  });
  await ws.networks.update(customEth);

  assert.strictEqual(
    ws.networks.bySlug("ethereum").rpcUrl,
    "https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY",
  );
  assert.strictEqual(ws.networks.length, 9);

  await ws.lock();
});

test("network — drop user network; pre-loaded networks reject drop", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-net-drop-"));
  const ws = await Workspace.open(root, "wsp-pwd", true);

  const custom = new Network({
    slug: "my-net",
    name: "My Net",
    chainId: 99999,
    rpcUrl: "https://rpc.example",
    nativeCurrency: { name: "Foo", symbol: "FOO", decimals: 18 },
    vm: "evm",
  });
  await ws.networks.add(custom);

  await ws.networks.drop(custom);
  assert.strictEqual(ws.networks.bySlug("my-net"), null);

  const eth = ws.networks.bySlug("ethereum");
  await assert.rejects(ws.networks.drop(eth), (err) => err.code === "UNSUPPORTED_OP");

  await ws.lock();
});
