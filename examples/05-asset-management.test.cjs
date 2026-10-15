// 05 — Assets: pre-loaded tokens, the live network.assets collection, adding, editing, persisting and dropping tokens, two-tier edits, and filter search.

const test = require("node:test");
const assert = require("node:assert");
const { mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { Workspace, Network, Asset } = require("wative-core");

const PEPE_ADDR = "0x6982508145454Ce325dDbE47a25d4ec3d2311933";
const SHIB_ADDR = "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE";
const USDC_ADDR = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

test("asset — pre-loaded tokens per network", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-asset-builtin-"));
  const ws = await Workspace.open({ path: root, password: "wsp-pwd" });

  const ethAssets = await ws.assets(Network.Ethereum);
  assert.deepStrictEqual(ethAssets.map((a) => a.symbol).sort(), ["ETH", "USDC", "USDT", "WETH"]);

  const solAssets = await ws.assets(Network.Solana);
  assert.deepStrictEqual(solAssets.map((a) => a.symbol).sort(), ["SOL", "USDC", "USDT", "WSOL"]);

  const sepoliaAssets = await ws.assets("sepolia");
  assert.strictEqual(sepoliaAssets.length, 1);

  const arbSepoliaAssets = await ws.assets("arbitrum-sepolia");
  const arbSepoliaUsdc = arbSepoliaAssets.find((a) => a.symbol === "USDC");
  assert.ok(arbSepoliaUsdc);
  assert.strictEqual(arbSepoliaUsdc.decimals, 6);
  assert.strictEqual(arbSepoliaUsdc.contractAddress, "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d");
  assert.strictEqual(arbSepoliaUsdc.native, false);

  await ws.lock();
});

test("asset — add a custom token with addAsset(init); the library allocates the id", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-asset-add-"));
  const ws = await Workspace.open({ path: root, password: "wsp-pwd" });

  const pepe = await ws.addAsset({
    network: Network.Ethereum,
    symbol: "PEPE",
    name: "Pepe",
    decimals: 18,
    contractAddress: PEPE_ADDR,
  });
  assert.ok(pepe.id >= 1000);

  const ethAssets = await ws.assets(Network.Ethereum);
  assert.strictEqual(ethAssets.length, 5);
  assert.ok(ethAssets.some((a) => a.id === pepe.id && a.symbol === "PEPE"));

  await ws.lock();
});

test("asset — network.assets is a live collection (add, byId, update, move, drop)", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-asset-collection-"));
  const ws = await Workspace.open({ path: root, password: "wsp-pwd" });

  const eth = ws.networks.bySlug("ethereum");
  assert.ok(Array.isArray(eth.assets));
  const before = eth.assets.length;

  const added = await eth.assets.add({
    symbol: "PEPE",
    name: "Pepe",
    decimals: 18,
    contractAddress: PEPE_ADDR,
  });
  assert.ok(added.id >= 1000);
  assert.strictEqual(eth.assets.length, before + 1);
  assert.strictEqual(eth.assets.byId(added.id).symbol, "PEPE");

  await eth.assets.update(added.id, { displayStatus: false });
  assert.strictEqual(eth.assets.byId(added.id).displayStatus, false);

  await eth.assets.move(added.id, 0);
  assert.strictEqual(eth.assets[0].id, added.id);

  await eth.assets.drop(added.id);
  assert.strictEqual(eth.assets.byId(added.id), null);

  await ws.lock();
});

test("asset — asset.save() persists an edit across reopen; a detached asset cannot save", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-asset-save-"));
  let ws = await Workspace.open({ path: root, password: "wsp-pwd" });

  const eth = ws.networks.bySlug("ethereum");
  const added = await eth.assets.add({
    symbol: "PEPE",
    name: "Pepe",
    decimals: 18,
    contractAddress: PEPE_ADDR,
  });

  const held = eth.assets.byId(added.id);
  held.displayStatus = false;
  held.name = "Pepe Token";
  await held.save();

  await ws.lock();
  ws = await Workspace.open({ path: root, password: "wsp-pwd" });
  const reopened = ws.networks.bySlug("ethereum").assets.byId(added.id);
  assert.strictEqual(reopened.displayStatus, false);
  assert.strictEqual(reopened.name, "Pepe Token");

  const detached = new Asset({
    id: 5000,
    symbol: "DET",
    name: "Detached",
    decimals: 18,
    contractAddress: SHIB_ADDR,
    network: Network.Ethereum,
  });
  await assert.rejects(detached.save(), (err) => err.code === "UNSUPPORTED_OP");

  await ws.lock();
});

test("asset — two-tier edits: a user token edits all metadata, a built-in only its display fields", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-asset-tier-"));
  const ws = await Workspace.open({ path: root, password: "wsp-pwd" });

  const eth = ws.networks.bySlug("ethereum");
  const mine = await eth.assets.add({
    symbol: "MINE",
    name: "Mine",
    decimals: 18,
    contractAddress: PEPE_ADDR,
  });

  const updated = await ws.updateAsset(mine.id, {
    symbol: "MINE2",
    name: "My Token",
    decimals: 8,
    displayDecimals: 8,
    displayStatus: false,
  });
  assert.strictEqual(updated.symbol, "MINE2");
  assert.strictEqual(updated.decimals, 8);
  assert.strictEqual(updated.displayStatus, false);

  assert.strictEqual(mine.isBuiltin, false);
  const usdc = eth.assets.find((a) => a.symbol === "USDC");
  assert.strictEqual(usdc.isBuiltin, true);
  const builtinEdited = await ws.updateAsset(usdc.id, { displayStatus: false });
  assert.strictEqual(builtinEdited.displayStatus, false);
  await assert.rejects(ws.updateAsset(usdc.id, { symbol: "USDX" }), (err) => err.code === "PARAMETER_ERROR");

  await ws.lock();
});

test("asset — a standalone network's assets are a read-only template", async () => {
  const builtins = Network.Ethereum.assets;
  assert.ok(builtins.length >= 4);
  assert.ok(builtins.every((a) => a instanceof Asset));
  assert.ok(builtins.find((a) => a.symbol === "ETH"));
  await assert.rejects(
    Network.Ethereum.assets.add({ symbol: "X", name: "X", decimals: 18, contractAddress: PEPE_ADDR }),
    (err) => err.code === "UNSUPPORTED_OP",
  );
});

test("asset — a duplicate contract address is rejected", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-asset-collide-"));
  const ws = await Workspace.open({ path: root, password: "wsp-pwd" });

  await assert.rejects(
    ws.addAsset({
      network: Network.Ethereum,
      symbol: "USDC2",
      name: "Other USDC",
      decimals: 6,
      contractAddress: USDC_ADDR,
    }),
    (err) => err.code === "DUPLICATE_IDENTITY",
  );

  await ws.lock();
});

test("asset — drop a user token via network.assets; built-in tokens reject drop", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-asset-drop-"));
  const ws = await Workspace.open({ path: root, password: "wsp-pwd" });

  const eth = ws.networks.bySlug("ethereum");
  const my = await eth.assets.add({
    symbol: "MINE",
    name: "Mine",
    decimals: 18,
    contractAddress: PEPE_ADDR,
  });
  await eth.assets.drop(my.id);
  assert.strictEqual(eth.assets.byId(my.id), null);

  const ethId = eth.assets.find((a) => a.symbol === "ETH").id;
  await assert.rejects(eth.assets.drop(ethId), (err) => err.code === "UNSUPPORTED_OP");

  await ws.lock();
});

test("asset — workspace.filter('Asset', q) finds by symbol or contract address", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-asset-filter-"));
  const ws = await Workspace.open({ path: root, password: "wsp-pwd" });

  const bySymbol = await ws.filter("USDC", "Asset");
  assert.ok(bySymbol && bySymbol.symbol === "USDC");

  const byAddr = await ws.filter("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "Asset");
  assert.ok(byAddr && byAddr.symbol === "USDC");

  await ws.lock();
});
