// 08 — Persistence. Verify that accounts, networks, custom assets, and the
// logger configuration all round-trip correctly across `lock()` + reopen.

const test = require("node:test");
const assert = require("node:assert");
const { mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { Workspace, Network, Asset } = require("../dist/index.cjs");

const MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

test("persistence — multiple HD + PK accounts round-trip", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-persist-acc-"));
  let ws = await Workspace.open({ path: root, password: "wsp-pwd" });

  const hd = await ws.accounts.create("Desk One", "wsp-pwd", MNEMONIC);
  await hd.deriveWallets(3);

  const pk = await ws.accounts.create(
    "Hot Wallet",
    "wsp-pwd",
    "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d",
    undefined,
    { kind: "PK" },
  );

  await ws.lock();
  ws = await Workspace.open({ path: root, password: "wsp-pwd" });
  assert.strictEqual(ws.accounts.length, 2);
  const reopenHd = ws.accounts.bySlug(hd.slug);
  const reopenPk = ws.accounts.bySlug(pk.slug);
  assert.ok(reopenHd && reopenPk);
  assert.strictEqual(reopenHd.organizationType, "HD");
  assert.strictEqual(reopenPk.organizationType, "PK");
  assert.strictEqual(reopenHd.wallets.length, 4);
  assert.strictEqual(reopenPk.wallets.length, 1);

  await ws.lock();
});

test("persistence — added user network round-trips with all fields", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-persist-net-"));
  let ws = await Workspace.open({ path: root, password: "wsp-pwd" });

  await ws.networks.add(new Network({
    slug: "monad-testnet",
    name: "Monad Testnet",
    chainId: 10143,
    rpcUrl: "https://testnet-rpc.monad.xyz",
    nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
    color: "#7e22ce",
    vm: "evm",
  }));

  await ws.lock();
  ws = await Workspace.open({ path: root, password: "wsp-pwd" });
  const monad = ws.networks.bySlug("monad-testnet");
  assert.ok(monad);
  assert.strictEqual(monad.chainId, 10143);
  assert.strictEqual(monad.rpcUrl, "https://testnet-rpc.monad.xyz");
  assert.strictEqual(monad.nativeCurrency.symbol, "MON");
  assert.strictEqual(monad.color, "#7e22ce");

  await ws.lock();
});

test("persistence — custom user asset round-trips", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-persist-asset-"));
  let ws = await Workspace.open({ path: root, password: "wsp-pwd" });

  await ws.addAsset(new Asset({
    id: 250,
    symbol: "PEPE",
    name: "Pepe",
    decimals: 18,
    contractAddress: "0x6982508145454Ce325dDbE47a25d4ec3d2311933",
    network: Network.Ethereum,
  }));

  await ws.lock();
  ws = await Workspace.open({ path: root, password: "wsp-pwd" });
  const ethAssets = await ws.assets(Network.Ethereum);
  const pepe = ethAssets.find((a) => a.id === 250);
  assert.ok(pepe);
  assert.strictEqual(pepe.symbol, "PEPE");
  assert.strictEqual(pepe.decimals, 18);

  await ws.lock();
});

test("persistence — custom logger config round-trips", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-persist-log-"));
  let ws = await Workspace.open({ path: root, password: "wsp-pwd" });

  await ws.logger.setLevel("debug");

  await ws.lock();
  ws = await Workspace.open({ path: root, password: "wsp-pwd" });
  assert.strictEqual(ws.logger.config.minLevel, "debug");

  await ws.lock();
});
