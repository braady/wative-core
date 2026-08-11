// 01 — Quick start: open a workspace, create an HD account, derive wallets, lock.

const test = require("node:test");
const assert = require("node:assert");
const { mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { Workspace } = require("wative-core");

test("quick start — open, create HD account, derive wallets, lock", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-quickstart-"));
  const password = "your-workspace-password";

  const ws = await Workspace.open({ path: root, password });
  assert.strictEqual(ws.locked, false);

  const account = await ws.accounts.create(
    "Trading Desk",
    password,
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
  );
  assert.strictEqual(account.wallets.length, 1);

  await account.deriveWallets(4);
  assert.strictEqual(account.wallets.length, 5);

  const wallet = account.wallets[0];
  const evm = wallet.addresses.find((a) => a.vm === "evm");
  const svm = wallet.addresses.find((a) => a.vm === "svm");
  assert.ok(evm && evm.publicKey.startsWith("0x"));
  assert.ok(svm && svm.publicKey.length >= 32);

  await ws.lock();
  assert.strictEqual(ws.locked, true);
});
