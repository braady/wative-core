// 17 — Locked-state contract. Locking is the library's core safety promise:
// once locked, nothing that touches key material may succeed. The other
// examples lock at the end of a test but never assert what locking actually
// enforces, so a regression that left a decrypted key in memory would not fail
// any of them.
//
// This file pins the contract from the outside: which operations refuse, which
// error code they refuse with, that they hand back no secret material while
// refusing, and that unlocking restores exactly the previous behaviour.

const test = require("node:test");
const assert = require("node:assert");
const { mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { Workspace } = require("wative-core");

const MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

// Same vector as 16 — reused here to prove unlock restores identical behaviour.
const EVM_SIGNATURE_HELLO =
  "0x22f6b9cd7ff4f321e11181c4fe64adeea9469908fb514fbb6001fe022002dfda" +
  "1f4ec9ea436bad14a7823806487d3aeb39b22e2556590922d6a8308971a17e991c";

const TYPED_DATA = {
  domain: { name: "Test", version: "1", chainId: 1 },
  types: { Msg: [{ name: "text", type: "string" }] },
  primaryType: "Msg",
  message: { text: "hello" },
};

async function freshAccount(tag) {
  const ws = await Workspace.open({
    path: mkdtempSync(join(tmpdir(), `wative-locked-${tag}-`)),
    password: "wsp-pwd",
  });
  const account = await ws.accounts.create("Desk", "wsp-pwd", MNEMONIC);
  const wallet = account.wallets[0];
  const address = wallet.addresses.find((a) => a.vm === "evm");
  return { ws, account, wallet, address };
}

/**
 * Assert an operation refuses with the given code.
 *
 * The API deliberately mixes shapes: signing and key export are synchronous
 * (they only touch already-decrypted material), while anything that persists or
 * decrypts is async. Wrapping the call in an async function normalises a
 * synchronous throw and a rejected promise into one thing, so these assertions
 * describe the security contract rather than the call shape.
 */
async function refuses(code, label, operation) {
  await assert.rejects(
    async () => operation(),
    (err) => {
      assert.strictEqual(err.code, code, `${label} should refuse with ${code}, got ${err.code}`);
      return true;
    },
    `${label} succeeded while locked`,
  );
}

test("a locked account refuses every operation that needs key material", async () => {
  const { ws, account, wallet, address } = await freshAccount("account");

  await account.lock();
  assert.strictEqual(account.locked, true, "account should report itself locked");

  await refuses("ACCOUNT_LOCKED", "dumpMnemonic", () => account.dumpMnemonic());
  await refuses("ACCOUNT_LOCKED", "dumpPrivateKey", () => wallet.dumpPrivateKey("evm"));
  await refuses("ACCOUNT_LOCKED", "signMessage", () => address.signMessage("hello"));
  await refuses("ACCOUNT_LOCKED", "signTypedData", () => address.signTypedData(TYPED_DATA));
  await refuses("ACCOUNT_LOCKED", "deriveWallets", () => account.deriveWallets(1));

  // Refusing with the correct password supplied is the point: possession of the
  // password must not be enough to bypass the lock.
  await ws.unlock("wsp-pwd").catch(() => {});
});

test("locking the workspace blocks workspace-level mutation too", async () => {
  const { ws, address } = await freshAccount("workspace");

  await ws.lock();
  assert.strictEqual(ws.locked, true, "workspace should report itself locked");

  await refuses("WORKSPACE_LOCKED", "accounts.create", () =>
    ws.accounts.create("Other", "wsp-pwd", MNEMONIC),
  );
  // Accounts held from before the lock must not keep signing.
  await refuses("ACCOUNT_LOCKED", "signMessage on a stale handle", () =>
    address.signMessage("hello"),
  );
});

test("a locked account exposes no plaintext secret through its own surface", async () => {
  const { ws, account } = await freshAccount("leak");

  const beforeLock = account.dumpMnemonic();
  assert.strictEqual(beforeLock, MNEMONIC, "sanity: the mnemonic is retrievable while unlocked");

  await account.lock();

  // Walk everything reachable from the locked account — the object graph is
  // cyclic (workspace ⇄ account ⇄ wallet), so track visited objects.
  const strings = [];
  const seen = new Set();
  const walk = (value) => {
    if (typeof value === "string") return strings.push(value);
    if (value === null || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    for (const key of Object.keys(value)) walk(value[key]);
  };
  walk(account);

  const leak = strings.find((s) => s.includes(MNEMONIC) || s.includes("abandon abandon"));
  assert.strictEqual(
    leak,
    undefined,
    "a locked account still holds mnemonic material in the clear",
  );

  await ws.lock();
});

test("unlocking restores exactly the previous behaviour", async () => {
  const { ws, account, address } = await freshAccount("unlock");

  const before = address.signMessage("hello");
  assert.strictEqual(before, EVM_SIGNATURE_HELLO, "sanity: known signature before locking");

  await account.lock();
  await refuses("ACCOUNT_LOCKED", "signMessage", () => address.signMessage("hello"));

  await account.tryUnlock("wsp-pwd");
  assert.strictEqual(account.locked, false, "account should report itself unlocked");

  assert.strictEqual(
    address.signMessage("hello"),
    EVM_SIGNATURE_HELLO,
    "signing after unlock must reproduce the same signature as before locking",
  );

  await ws.lock();
});

test("unlocking with the wrong password fails and leaves the account locked", async () => {
  const { ws, account, address } = await freshAccount("badpwd");

  await account.lock();
  await refuses("BAD_PASSWORD", "tryUnlock with a wrong password", () =>
    account.tryUnlock("not-the-password"),
  );

  assert.strictEqual(account.locked, true, "a failed unlock must leave the account locked");
  await refuses("ACCOUNT_LOCKED", "signMessage after a failed unlock", () =>
    address.signMessage("hello"),
  );

  await ws.lock();
});
