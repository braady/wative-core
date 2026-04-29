// 09 — Workspace search. `filter(query, objective)` returns the live object
// matching `query` for the given objective: Wallet, Address, Account, or Asset.

const test = require("node:test");
const assert = require("node:assert");
const { mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { Workspace } = require("../dist/index.cjs");

const MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

test("filter — find an Account by displayName or slug", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-filter-acc-"));
  const ws = await Workspace.open(root, "wsp-pwd", true);

  const acc = await ws.accounts.create("Trading Desk", "wsp-pwd", MNEMONIC);

  const byName = await ws.filter("Trading Desk", "Account");
  const bySlug = await ws.filter(acc.slug, "Account");
  assert.ok(byName && byName.slug === acc.slug);
  assert.ok(bySlug && bySlug.slug === acc.slug);

  const missing = await ws.filter("nonexistent", "Account");
  assert.strictEqual(missing, null);

  await ws.lock();
});

test("filter — find a Wallet by id or by tag", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-filter-wallet-"));
  const ws = await Workspace.open(root, "wsp-pwd", true);

  const acc = await ws.accounts.create("Desk", "wsp-pwd", MNEMONIC);
  await acc.deriveWallets(2);

  await acc.wallets[1].addTag("alpha-strategy");

  const byId = await ws.filter("1", "Wallet");
  assert.ok(byId);
  assert.strictEqual(byId.id, 1);

  const byTag = await ws.filter("alpha-strategy", "Wallet");
  assert.ok(byTag);
  assert.strictEqual(byTag.id, 1);

  await ws.lock();
});

test("filter — find an Address by its public key (case-insensitive for EVM)", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-filter-addr-"));
  const ws = await Workspace.open(root, "wsp-pwd", true);

  const acc = await ws.accounts.create("Desk", "wsp-pwd", MNEMONIC);
  const evm = acc.wallets[0].addresses.find((a) => a.vm === "evm");

  const found = await ws.filter(evm.publicKey, "Address");
  assert.ok(found);
  assert.strictEqual(found.publicKey, evm.publicKey);

  const foundLower = await ws.filter(evm.publicKey.toLowerCase(), "Address");
  assert.ok(foundLower);
  assert.strictEqual(foundLower.publicKey, evm.publicKey);

  await ws.lock();
});

test("filter — find an Asset; returns null for unknown query", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-filter-asset-"));
  const ws = await Workspace.open(root, "wsp-pwd", true);

  const usdc = await ws.filter("USDC", "Asset");
  assert.ok(usdc && usdc.symbol === "USDC");

  const usdt = await ws.filter("0xdAC17F958D2ee523a2206206994597C13D831ec7", "Asset");
  assert.ok(usdt && usdt.symbol === "USDT");

  const missing = await ws.filter("DOES-NOT-EXIST", "Asset");
  assert.strictEqual(missing, null);

  await ws.lock();
});
