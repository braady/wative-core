// 25 — EIP-712 typed-data signing: address.signTypedData(typedData, chainId) returns an OBJECT { signature, domainSeparator, structHash }, not a bare string, and chainId is required and validated against domain.chainId. Fully offline (local ECDSA).

const test = require("node:test");
const assert = require("node:assert");
const { mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { Workspace, WativeError } = require("wative-core");

const MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

const CHAIN_ID = 1;

// A realistic ERC-2612 Permit payload. `owner` is filled in with the signer's address.
function permit(owner) {
  return {
    domain: {
      name: "USD Coin",
      version: "2",
      chainId: CHAIN_ID,
      verifyingContract: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    },
    types: {
      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "Permit",
    message: {
      owner,
      spender: "0x1111111111111111111111111111111111111111",
      value: 1_000_000n,
      nonce: 0n,
      deadline: 1_900_000_000n,
    },
  };
}

async function evmAddress(tag) {
  const ws = await Workspace.open({ path: mkdtempSync(join(tmpdir(), `wative-712-${tag}-`)), password: "wsp-pwd" });
  const acc = await ws.accounts.create("Desk", "wsp-pwd", MNEMONIC);
  const evm = acc.wallets[0].addresses.find((a) => a.vm === "evm");
  return { ws, acc, evm };
}

test("signTypedData — returns the { signature, domainSeparator, structHash } object, not a string", async () => {
  const { ws, evm } = await evmAddress("shape");

  const result = evm.signTypedData(permit(evm.publicKey), CHAIN_ID);

  assert.strictEqual(typeof result, "object");
  assert.notStrictEqual(typeof result, "string"); // an object, not a bare 0x-signature
  assert.match(result.signature, /^0x[0-9a-f]{130}$/i); // 65-byte secp256k1 signature
  assert.match(result.domainSeparator, /^0x[0-9a-f]{64}$/i); // keccak256 of the domain
  assert.match(result.structHash, /^0x[0-9a-f]{64}$/i); // keccak256 of the Permit struct

  await ws.lock();
});

test("signTypedData — is deterministic (RFC-6979): same payload, same three fields", async () => {
  const { ws, evm } = await evmAddress("determinism");

  const typedData = permit(evm.publicKey);
  const a = evm.signTypedData(typedData, CHAIN_ID);
  const b = evm.signTypedData(typedData, CHAIN_ID);

  assert.deepStrictEqual(a, b);

  await ws.lock();
});

test("signTypedData — chainId must match domain.chainId", async () => {
  const { ws, evm } = await evmAddress("chainid");

  const typedData = permit(evm.publicKey); // domain.chainId === 1
  assert.throws(
    () => evm.signTypedData(typedData, 137), // a chainId the domain was not built for
    (err) => err instanceof WativeError && err.code === "PARAMETER_ERROR",
  );

  await ws.lock();
});

test("signTypedData — the domain/struct hashes depend only on the payload, not the key", async () => {
  const { ws, acc, evm } = await evmAddress("two-signers");
  await acc.deriveWallets(1);
  const evm2 = acc.wallets[1].addresses.find((a) => a.vm === "evm");

  const typedData = permit(evm.publicKey);
  const first = evm.signTypedData(typedData, CHAIN_ID);
  const second = evm2.signTypedData(typedData, CHAIN_ID);

  assert.strictEqual(first.domainSeparator, second.domainSeparator);
  assert.strictEqual(first.structHash, second.structHash);
  assert.notStrictEqual(first.signature, second.signature);

  await ws.lock();
});
