// 03 — PK account flows. Heterogeneous private keys, one wallet per import.

const test = require("node:test");
const assert = require("node:assert");
const { mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { Workspace } = require("wative-core");

const EVM_PK = "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d";
const SVM_PK = "xtGWcHvQsr5ue8zG2F5fm31bW8vyn597Y92gUWaZZg3S1Z6FeJMATL8KU3xJMGbLfALnokcct9y5wYtCRrwNXZW";

test("PK account — create from EVM key + import a Solana key", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-pk-"));
  const ws = await Workspace.open({ path: root, password: "wsp-pwd" });

  const acc = await ws.accounts.create(
    "External Hot Wallet",
    "wsp-pwd",
    EVM_PK,
    undefined,
    { kind: "PK" },
  );
  assert.strictEqual(acc.organizationType, "PK");
  assert.strictEqual(acc.wallets.length, 1);
  assert.strictEqual(acc.wallets[0].addresses[0].vm, "evm");

  await acc.importPrivateKey(SVM_PK, "svm");
  assert.strictEqual(acc.wallets.length, 2);
  assert.strictEqual(acc.wallets[1].addresses[0].vm, "svm");

  await ws.lock();
});

test("PK account — duplicate import is rejected", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-pk-dup-"));
  const ws = await Workspace.open({ path: root, password: "wsp-pwd" });

  const acc = await ws.accounts.create("HotWallet", "wsp-pwd", EVM_PK, undefined, { kind: "PK" });
  await assert.rejects(acc.importPrivateKey(EVM_PK, "evm"), (err) => err.code === "PARAMETER_ERROR");

  await ws.lock();
});

test("PK account — drop a wallet (account keeps at least one)", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-pk-drop-"));
  const ws = await Workspace.open({ path: root, password: "wsp-pwd" });

  const acc = await ws.accounts.create("HotWallet", "wsp-pwd", EVM_PK, undefined, { kind: "PK" });
  await acc.importPrivateKey(SVM_PK, "svm");

  await acc.wallets.drop(acc.wallets[1]);
  assert.strictEqual(acc.wallets.length, 1);

  await assert.rejects(acc.wallets.drop(acc.wallets[0]), (err) => err.code === "UNSUPPORTED_OP");

  await ws.lock();
});
