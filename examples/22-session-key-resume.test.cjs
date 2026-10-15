// 22 — Session-key resume: export an unlocked workspace's key, reopen from it without the password.

const test = require("node:test");
const assert = require("node:assert");
const { mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

// A v3 provider has one container key; shown here on HybridProviderV3 (Node) — IdbProviderV3 is the browser twin.
const { Workspace, HybridProviderV3 } = require("wative-core");

const MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const PW = "session-key-example-password";

test("export the session key, then reopen the workspace from it without the password", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-session-key-"));
  const ws = await Workspace.open(new HybridProviderV3(root), PW);
  const acc = await ws.accounts.create("Desk", PW, MNEMONIC, undefined, { kind: "HD", hasOwnPassword: false });
  await acc.deriveWallets(2);
  const addresses = acc.wallets.map((w) => w.addresses.map((a) => a.publicKey).join(","));

  const key = ws.exportSessionKey();
  assert.strictEqual(key.length, 32);
  await ws.close();

  const resumed = await Workspace.openWithSessionKey(new HybridProviderV3(root), key);
  assert.strictEqual(resumed.locked, false);
  const back = resumed.accounts.bySlug(acc.slug);
  assert.ok(back, "account did not survive the resume");
  await back.tryUnlock();
  assert.strictEqual(back.dumpMnemonic(), MNEMONIC);
  assert.deepStrictEqual(
    back.wallets.map((w) => w.addresses.map((a) => a.publicKey).join(",")),
    addresses,
  );
  await resumed.close();
});

test("a wrong session key is refused and leaves the workspace locked", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-session-key-"));
  const ws = await Workspace.open(new HybridProviderV3(root), PW);
  await ws.accounts.create("Desk", PW, MNEMONIC, undefined, { kind: "HD", hasOwnPassword: false });
  await ws.close();

  await assert.rejects(
    () => Workspace.openWithSessionKey(new HybridProviderV3(root), new Uint8Array(32)),
    (e) => e.code === "BAD_PASSWORD",
  );
  const ok = await Workspace.open(new HybridProviderV3(root), PW);
  assert.strictEqual(ok.locked, false);
  await ok.close();
});

test("unlockWithSessionKey resumes a locked workspace, and exportSessionKey needs an unlocked one", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-session-key-"));
  const ws = await Workspace.open(new HybridProviderV3(root), PW);
  await ws.accounts.create("Desk", PW, MNEMONIC, undefined, { kind: "HD", hasOwnPassword: false });
  const key = ws.exportSessionKey();
  await ws.lock();

  assert.throws(() => ws.exportSessionKey(), (e) => e.code === "WORKSPACE_LOCKED");

  await ws.unlockWithSessionKey(key);
  assert.strictEqual(ws.locked, false);
  await ws.close();
});
