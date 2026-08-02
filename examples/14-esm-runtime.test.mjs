import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

async function importDist() {
  // Import by PACKAGE SPECIFIER, not by file path. The root entry is
  // condition-split: a raw path to dist/index.js bypasses the exports map and
  // lands on the browser build, which deliberately has no filesystem backend.
  // "wative-core" resolves through the node condition, which is what an ESM
  // consumer actually gets — and still loads real ESM, so this keeps testing
  // that the dist needs no CJS require shims.
  return import("wative-core");
}

const PASSWORD = "wsp-pwd";
const MNEMONIC = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const EVM_PK = "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d";

test("ESM dist consumer creates HD and PK accounts without global require shims", async () => {
  const { Workspace } = await importDist();
  assert.equal(globalThis.require, undefined);
  const root = await mkdtemp(path.join(tmpdir(), "wative-core-esm-runtime-"));
  const ws = await Workspace.open({ path: root, password: PASSWORD });

  const hd = await ws.accounts.create("ESM HD", PASSWORD, MNEMONIC, undefined, { kind: "HD" });
  const pk = await ws.accounts.create("ESM PK", PASSWORD, EVM_PK, undefined, { kind: "PK" });

  assert.equal(hd.organizationType, "HD");
  assert.equal(pk.organizationType, "PK");
});

test("ESM dist consumer signs EVM transactions without global require shims", async () => {
  const { Workspace } = await importDist();
  assert.equal(globalThis.require, undefined);
  const root = await mkdtemp(path.join(tmpdir(), "wative-core-esm-tx-sign-"));
  const ws = await Workspace.open({ path: root, password: PASSWORD });
  const account = await ws.accounts.create("ESM TX PK", PASSWORD, EVM_PK, undefined, { kind: "PK" });
  await account.tryUnlock(PASSWORD);
  const address = account.wallets[0].addresses.find((candidate) => candidate.vm === "evm");

  const tx = address.buildTransaction({
    to: "0x000000000000000000000000000000000000dEaD",
    value: "0",
    nonce: 0,
    chainId: 1,
    gasLimit: "21000",
    maxFeePerGas: "2000000000",
    maxPriorityFeePerGas: "1000000000",
  });
  await tx.sign();

  assert.match(tx.rawTransaction, /^0x[0-9a-fA-F]+$/);
});

test("ESM dist consumer signs SVM transactions without global require shims", async () => {
  // Regression: the SVM signing path used require() for @solana/web3.js, bs58
  // and tweetnacl, which throws "Dynamic require ... is not supported" under
  // native ESM. These are now static imports like web3 on the EVM side.
  const { Workspace } = await importDist();
  assert.equal(globalThis.require, undefined);
  const root = await mkdtemp(path.join(tmpdir(), "wative-core-esm-svm-sign-"));
  const ws = await Workspace.open({ path: root, password: PASSWORD });
  const account = await ws.accounts.create("ESM SVM HD", PASSWORD, MNEMONIC, undefined, { kind: "HD" });
  await account.tryUnlock(PASSWORD);
  const svm = account.wallets[0].addresses.find((candidate) => candidate.vm === "svm");
  assert.ok(svm, "wallet exposes an SVM address");

  const tx = svm.buildTransaction({
    recipient: "11111111111111111111111111111111",
    amount: "1000000",
    recentBlockhash: "11111111111111111111111111111111",
  });
  await tx.sign();
  assert.equal(tx.status, "signed");
  assert.ok(typeof tx.hash === "string" && tx.hash.length > 0);
});
