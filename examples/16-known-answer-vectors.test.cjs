// 16 — Known-answer vectors: exact published BIP-44 values, not "looks plausible".

const test = require("node:test");
const assert = require("node:assert");
const { mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { Workspace } = require("wative-core");

// The canonical all-zero BIP-39 entropy phrase. Publicly known — never fund it.
const MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

// m/44'/60'/0'/0/{0,1,2}: standard vectors; a mismatch means the derivation moved.
const EVM_ADDRESSES = [
  "0x9858EfFD232B4033E47d90003D41EC34EcaEda94",
  "0x6Fac4D18c912343BF86fa7049364Dd4E424Ab9C0",
  "0xb6716976A3ebe8D39aCEB04372f22Ff8e6802D7A",
];

// Solana, same mnemonic — this library's own values, pinned against silent drift.
const SVM_ADDRESSES = [
  "HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk",
  "Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb",
  "7WktogJEd2wQ9eH2oWusmcoFTgeYi6rS632UviTBJ2jm",
];

// EIP-191 "hello" by the first address; RFC 6979 makes it a fixed value.
const EVM_SIGNATURE_HELLO =
  "0x22f6b9cd7ff4f321e11181c4fe64adeea9469908fb514fbb6001fe022002dfda" +
  "1f4ec9ea436bad14a7823806487d3aeb39b22e2556590922d6a8308971a17e991c";

// Well-known test private key and the address it must produce.
const EVM_PRIVATE_KEY = "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d";
const EVM_PRIVATE_KEY_ADDRESS = "0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1";

function newWorkspaceRoot(tag) {
  return mkdtempSync(join(tmpdir(), `wative-kat-${tag}-`));
}

function addressFor(wallet, vm) {
  const found = wallet.addresses.find((a) => a.vm === vm);
  assert.ok(found, `wallet has no ${vm} address`);
  return found;
}

test("HD derivation reproduces the published BIP-44 vectors for EVM", async () => {
  const ws = await Workspace.open({ path: newWorkspaceRoot("hd"), password: "wsp-pwd" });
  const acc = await ws.accounts.create("Desk", "wsp-pwd", MNEMONIC);
  await acc.deriveWallets(EVM_ADDRESSES.length);

  EVM_ADDRESSES.forEach((expected, i) => {
    assert.strictEqual(
      addressFor(acc.wallets[i], "evm").publicKey,
      expected,
      `m/44'/60'/0'/0/${i} derived the wrong address`,
    );
  });

  await ws.lock();
});

test("HD derivation stays stable for Solana", async () => {
  const ws = await Workspace.open({ path: newWorkspaceRoot("svm"), password: "wsp-pwd" });
  const acc = await ws.accounts.create("Desk", "wsp-pwd", MNEMONIC);
  await acc.deriveWallets(SVM_ADDRESSES.length);

  SVM_ADDRESSES.forEach((expected, i) => {
    assert.strictEqual(
      addressFor(acc.wallets[i], "svm").publicKey,
      expected,
      `Solana derivation slot ${i} changed`,
    );
  });

  await ws.lock();
});

test("an imported private key produces its known address", async () => {
  const ws = await Workspace.open({ path: newWorkspaceRoot("pk"), password: "wsp-pwd" });
  const acc = await ws.accounts.create("HotWallet", "wsp-pwd", EVM_PRIVATE_KEY, undefined, {
    kind: "PK",
  });

  assert.strictEqual(
    addressFor(acc.wallets[0], "evm").publicKey,
    EVM_PRIVATE_KEY_ADDRESS,
    "the private key produced an address it does not own",
  );

  await ws.lock();
});

test("personal-message signing produces the exact expected signature", async () => {
  const ws = await Workspace.open({ path: newWorkspaceRoot("sign"), password: "wsp-pwd" });
  const acc = await ws.accounts.create("Desk", "wsp-pwd", MNEMONIC);

  const signature = addressFor(acc.wallets[0], "evm").signMessage("hello");

  assert.strictEqual(
    signature,
    EVM_SIGNATURE_HELLO,
    "signing 'hello' no longer yields the signature that recovers to " + EVM_ADDRESSES[0],
  );

  await ws.lock();
});

test("signatures are bound to the message and to the signing key", async () => {
  const ws = await Workspace.open({ path: newWorkspaceRoot("bind"), password: "wsp-pwd" });
  const acc = await ws.accounts.create("Desk", "wsp-pwd", MNEMONIC);
  await acc.deriveWallets(2);

  const first = addressFor(acc.wallets[0], "evm");
  const second = addressFor(acc.wallets[1], "evm");

  assert.notStrictEqual(first.signMessage("hello!"), EVM_SIGNATURE_HELLO);
  assert.notStrictEqual(second.signMessage("hello"), EVM_SIGNATURE_HELLO);
  assert.strictEqual(first.signMessage("hello"), EVM_SIGNATURE_HELLO);

  await ws.lock();
});
