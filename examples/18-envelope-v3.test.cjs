// 18 — HybridProviderV3 and the v3 envelope, exercised through the published package.

const test = require("node:test");
const assert = require("node:assert");
const { mkdtempSync, readFileSync, readdirSync, statSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

// Both from the SAME entry point — each entry is its own bundle with its own classes.
const { Workspace, HybridProviderV3 } = require("wative-core");

const MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const PW = "v3-example-password";

/** Envelope version byte of every record under `root`. */
function versions(root) {
  const out = {};
  const walk = (dir, prefix) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p, `${prefix}${name}/`);
      else out[`${prefix}${name}`] = readFileSync(p)[0];
    }
  };
  walk(root, "");
  return out;
}

test("HybridProviderV3 writes v3 records, and they all share one salt", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-v3-example-"));
  const ws = await Workspace.open(new HybridProviderV3(root), PW, true);
  const acc = await ws.accounts.create("V3 Desk", PW, MNEMONIC);
  await acc.deriveWallets(3);
  await ws.lock();

  const byFile = versions(root);
  const names = Object.keys(byFile);
  assert.ok(names.length >= 5, `expected several records, got ${names.length}`);
  for (const name of names) {
    assert.strictEqual(
      byFile[name],
      3,
      `${name} is a v${byFile[name]} envelope — HybridProviderV3 silently degraded to v2`,
    );
  }

  const saltOf = (rel) => readFileSync(join(root, rel)).subarray(1, 17).toString("hex");
  const salts = new Set(names.map(saltOf));
  assert.strictEqual(salts.size, 1, `expected one container salt, got ${salts.size}`);
});

test("a v3 container reopens and yields the original secrets", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-v3-example-"));
  let ws = await Workspace.open(new HybridProviderV3(root), PW, true);
  const created = await ws.accounts.create("V3 Desk", PW, MNEMONIC);
  await created.deriveWallets(2);
  const expected = created.wallets.map((w) => w.addresses.map((a) => a.publicKey).join(","));
  await ws.lock();

  ws = await Workspace.open(new HybridProviderV3(root), PW);
  const acc = ws.accounts.bySlug(created.slug);
  assert.ok(acc, "account did not survive the reopen");
  await acc.tryUnlock(PW);
  assert.strictEqual(acc.dumpMnemonic(), MNEMONIC);
  assert.deepStrictEqual(
    acc.wallets.map((w) => w.addresses.map((a) => a.publicKey).join(",")),
    expected,
  );
  await ws.lock();
});

test("a wrong password is rejected, and does not damage the container", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-v3-example-"));
  let ws = await Workspace.open(new HybridProviderV3(root), PW, true);
  await ws.accounts.create("V3 Desk", PW, MNEMONIC);
  await ws.lock();

  await assert.rejects(
    () => Workspace.open(new HybridProviderV3(root), "not-the-password"),
    (e) => e.code === "BAD_PASSWORD",
  );

  ws = await Workspace.open(new HybridProviderV3(root), PW);
  assert.strictEqual(ws.accounts.length, 1);
  await ws.lock();
});
