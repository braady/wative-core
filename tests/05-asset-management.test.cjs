// 05 — Asset management. Pre-loaded tokens, add custom tokens,
// drop user tokens, search via filter.

const test = require("node:test");
const assert = require("node:assert");
const { mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { Workspace, Network, Asset } = require("../dist/index.cjs");

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

test("asset — add a custom user token", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-asset-add-"));
  const ws = await Workspace.open({ path: root, password: "wsp-pwd" });

  const pepe = new Asset({
    id: 200,
    symbol: "PEPE",
    name: "Pepe",
    decimals: 18,
    contractAddress: "0x6982508145454Ce325dDbE47a25d4ec3d2311933",
    network: Network.Ethereum,
  });
  await ws.addAsset(pepe);

  const ethAssets = await ws.assets(Network.Ethereum);
  assert.strictEqual(ethAssets.length, 5);
  assert.ok(ethAssets.some((a) => a.id === 200 && a.symbol === "PEPE"));

  await ws.lock();
});

test("asset — id and address collisions are rejected", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-asset-collide-"));
  const ws = await Workspace.open({ path: root, password: "wsp-pwd" });

  const dupId = new Asset({
    id: 1,
    symbol: "FAKE",
    name: "Fake",
    decimals: 18,
    contractAddress: "0x1234567890123456789012345678901234567890",
    network: Network.Ethereum,
  });
  await assert.rejects(ws.addAsset(dupId), (err) => err.code === "PARAMETER_ERROR");

  const dupAddr = new Asset({
    id: 201,
    symbol: "USDC2",
    name: "Other USDC",
    decimals: 6,
    contractAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    network: Network.Ethereum,
  });
  await assert.rejects(ws.addAsset(dupAddr), (err) => err.code === "PARAMETER_ERROR");

  await ws.lock();
});

test("asset — drop user token; pre-loaded tokens reject drop", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-asset-drop-"));
  const ws = await Workspace.open({ path: root, password: "wsp-pwd" });

  const my = new Asset({
    id: 300,
    symbol: "MINE",
    name: "Mine",
    decimals: 18,
    contractAddress: "0x1111111111111111111111111111111111111111",
    network: Network.Ethereum,
  });
  await ws.addAsset(my);
  await ws.dropAsset(300);

  const ethAssets = await ws.assets(Network.Ethereum);
  assert.ok(!ethAssets.some((a) => a.id === 300));

  await assert.rejects(ws.dropAsset(1), (err) => err.code === "UNSUPPORTED_OP");

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
