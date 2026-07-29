// 02 — HD account flows. derive / slice wallets, dump mnemonic, reset password,
// reopen a locked workspace.

const test = require("node:test");
const assert = require("node:assert");
const { mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { Workspace } = require("wative-core");

const MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

test("HD account — derive, slice, dump mnemonic", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-hd-"));
  const ws = await Workspace.open({ path: root, password: "wsp-pwd" });

  const acc = await ws.accounts.create("Desk", "wsp-pwd", MNEMONIC);
  await acc.deriveWallets(10);
  assert.strictEqual(acc.wallets.length, 11);

  await acc.sliceWallets(6);
  assert.strictEqual(acc.wallets.length, 6);

  assert.strictEqual(acc.dumpMnemonic(), MNEMONIC);

  await ws.lock();
});

test("HD account — own password + resetPassword", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-hd-pwd-"));
  const ws = await Workspace.open({ path: root, password: "wsp-pwd" });

  const sub = await ws.accounts.create("SubAccount", "sub-pwd", MNEMONIC, undefined, {
    hasOwnPassword: true,
  });
  assert.strictEqual(sub.locked, false);

  sub.lock();
  assert.strictEqual(sub.locked, true);

  await assert.rejects(sub.tryUnlock("wrong"), (err) => err.code === "BAD_PASSWORD");
  await sub.tryUnlock("sub-pwd");

  await sub.resetPassword("sub-pwd", "new-sub-pwd");
  sub.lock();
  await assert.rejects(sub.tryUnlock("sub-pwd"), (err) => err.code === "BAD_PASSWORD");
  await sub.tryUnlock("new-sub-pwd");

  await ws.lock();
});

test("HD account — round-trip across lock + reopen", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-hd-reopen-"));
  let ws = await Workspace.open({ path: root, password: "wsp-pwd" });

  const acc = await ws.accounts.create("Persistent", "wsp-pwd", MNEMONIC);
  await acc.deriveWallets(2);
  const firstAddr = acc.wallets[0].addresses[0].publicKey;

  await ws.lock();

  ws = await Workspace.open({ path: root, password: "wsp-pwd" });
  const reopened = ws.accounts.bySlug(acc.slug);
  assert.ok(reopened);
  assert.strictEqual(reopened.wallets.length, 3);
  assert.strictEqual(reopened.wallets[0].addresses[0].publicKey, firstAddr);

  await ws.lock();
});
