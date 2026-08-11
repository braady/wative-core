// 03 — PK accounts: vm inferred from the key, and one import yielding both chains.

const test = require("node:test");
const assert = require("node:assert");
const { mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { Workspace } = require("wative-core");

const EVM_PK = "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d";
const SVM_PK = "xtGWcHvQsr5ue8zG2F5fm31bW8vyn597Y92gUWaZZg3S1Z6FeJMATL8KU3xJMGbLfALnokcct9y5wYtCRrwNXZW";
const SVM_PK_2 = "gaiC7Rnf9J6tV3SGwJyzvMDdz9RMmreSWZDyDK682MUKZHaWdZbbqgf35qD7FSwXka2Rf2o4MuhbWQTg82W9mbV";
const SVM_KEYGEN_BYTES = [
  51, 51, 51, 51, 51, 51, 51, 51, 51, 51, 51, 51, 51, 51, 51, 51,
  51, 51, 51, 51, 51, 51, 51, 51, 51, 51, 51, 51, 51, 51, 51, 51,
  23, 203, 121, 251, 43, 65, 32, 242, 177, 236, 101, 228, 25, 141, 110, 8,
  178, 142, 129, 63, 235, 1, 228, 164, 0, 131, 155, 133, 225, 128, 128, 206,
];

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
  assert.strictEqual(acc.wallets[0].addresses[1].vm, "svm");

  await acc.importPrivateKey(SVM_PK, "svm");
  assert.strictEqual(acc.wallets.length, 2);
  assert.strictEqual(acc.wallets[1].addresses[0].vm, "svm");
  assert.strictEqual(acc.wallets[1].addresses[1].vm, "evm");

  await ws.lock();
});

test("PK account — the key formats importPrivateKey accepts", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-pk-fmt-"));
  const ws = await Workspace.open({ path: root, password: "wsp-pwd" });
  const acc = await ws.accounts.create("Formats", "wsp-pwd", EVM_PK, undefined, { kind: "PK" });

  const evm = await acc.importPrivateKey(
    "0x6cbed15c793ce57650b9877cf6fa156fbef513c4e6134f022a85b1ffdd59b2a1",
  );
  assert.strictEqual(evm.addresses[0].vm, "evm");

  const svm = await acc.importPrivateKey(SVM_PK_2);
  assert.strictEqual(svm.addresses[0].vm, "svm");

  const fromKeygen = await acc.importPrivateKey(JSON.stringify(SVM_KEYGEN_BYTES));
  assert.strictEqual(fromKeygen.addresses[0].vm, "svm");

  await assert.rejects(
    acc.importPrivateKey("definitely-not-a-key"),
    (err) => err.code === "INVALID_PRIVATE_KEY",
  );

  await assert.rejects(
    acc.importPrivateKey("0x" + "0".repeat(64), "evm"),
    (err) => err.code === "INVALID_PRIVATE_KEY",
  );

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
