// 10 — Account default network. `account.setDefaultNetwork(value)` accepts
// a slug, a chain id, a hex chain id, or a Network instance — and the choice
// persists across reopen.

const test = require("node:test");
const assert = require("node:assert");
const { mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { Workspace, Network } = require("wative-core");

const MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

test("setDefaultNetwork — accepts slug, chainId, hex chainId, and Network instance", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-default-net-forms-"));
  const ws = await Workspace.open({ path: root, password: "wsp-pwd" });

  const acc = await ws.accounts.create("Desk", "wsp-pwd", MNEMONIC);

  await acc.setDefaultNetwork("base");
  assert.strictEqual(acc.defaultNetwork, "base");

  await acc.setDefaultNetwork(8453);
  assert.strictEqual(acc.defaultNetwork, "base");

  await acc.setDefaultNetwork("0xa");
  assert.strictEqual(acc.defaultNetwork, "optimism");

  await acc.setDefaultNetwork(Network.Arbitrum);
  assert.strictEqual(acc.defaultNetwork, "arbitrum");

  await ws.lock();
});

test("setDefaultNetwork — rejects an unknown network", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-default-net-bad-"));
  const ws = await Workspace.open({ path: root, password: "wsp-pwd" });

  const acc = await ws.accounts.create("Desk", "wsp-pwd", MNEMONIC);

  await assert.rejects(
    acc.setDefaultNetwork("does-not-exist"),
    (err) => err.code === "UNSUPPORTED_NETWORK",
  );
  await assert.rejects(
    acc.setDefaultNetwork(99999999),
    (err) => err.code === "UNSUPPORTED_NETWORK",
  );

  await ws.lock();
});

test("setDefaultNetwork — choice persists across lock + reopen", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-default-net-persist-"));
  let ws = await Workspace.open({ path: root, password: "wsp-pwd" });

  const acc = await ws.accounts.create("Desk", "wsp-pwd", MNEMONIC);
  await acc.setDefaultNetwork(Network.Solana);
  assert.strictEqual(acc.defaultNetwork, "solana");

  await ws.lock();
  ws = await Workspace.open({ path: root, password: "wsp-pwd" });
  const reopened = ws.accounts.bySlug(acc.slug);
  assert.ok(reopened);
  assert.strictEqual(reopened.defaultNetwork, "solana");

  await ws.lock();
});
