// 16 — Known-answer vectors. The other examples check that operations succeed
// and that results look plausible ("is a string", "starts with 0x"). That kind
// of assertion still passes if a key is derived from the wrong path, or if a
// signature is produced by the wrong key — the two failures most likely to lose
// someone's funds.
//
// This file pins exact expected values instead. Every EVM value below was taken
// from the published BIP-39 / BIP-44 test vectors for the canonical "abandon …
// about" mnemonic, not from this library's own output, so the assertions are
// independent ground truth rather than a recording of current behaviour.

const test = require("node:test");
const assert = require("node:assert");
const { mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { Workspace } = require("../dist/index.cjs");

// The canonical all-zero BIP-39 entropy phrase. Publicly known — never fund it.
const MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

// m/44'/60'/0'/0/{0,1,2} for the mnemonic above. These are the standard vectors
// reproduced by every BIP-44 implementation; a mismatch means the derivation
// path or the seed derivation changed.
const EVM_ADDRESSES = [
  "0x9858EfFD232B4033E47d90003D41EC34EcaEda94",
  "0x6Fac4D18c912343BF86fa7049364Dd4E424Ab9C0",
  "0xb6716976A3ebe8D39aCEB04372f22Ff8e6802D7A",
];

// Solana derivation for the same mnemonic. Pinned as a regression vector: these
// are this library's values, so they guard against silent drift in the SVM
// derivation path rather than asserting an external standard.
const SVM_ADDRESSES = [
  "HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk",
  "Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb",
  "7WktogJEd2wQ9eH2oWusmcoFTgeYi6rS632UviTBJ2jm",
];

// EIP-191 personal_sign of "hello" by the first EVM address. ECDSA here is
// deterministic (RFC 6979), so the signature is a fixed value, and it verifies
// externally as recovering to EVM_ADDRESSES[0].
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

  // A different message under the same key must not reuse the signature.
  assert.notStrictEqual(first.signMessage("hello!"), EVM_SIGNATURE_HELLO);
  // The same message under a different key must not either.
  assert.notStrictEqual(second.signMessage("hello"), EVM_SIGNATURE_HELLO);
  // And signing is repeatable for a given key and message.
  assert.strictEqual(first.signMessage("hello"), EVM_SIGNATURE_HELLO);

  await ws.lock();
});
