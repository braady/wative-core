// 19 — The short way to write a backend: extend ContainerProvider, move bytes, done.

const test = require("node:test");
const assert = require("node:assert");

const { Workspace, ContainerProvider, WativeError } = require("wative-core");

/** A whole storage backend. Keys are strings, values are bytes. */
class MapProvider extends ContainerProvider {
  #store = new Map();
  #dirs = new Set([""]);

  _exist(path) {
    if (this.#store.has(path) || this.#dirs.has(path)) return true;
    const prefix = path.endsWith("/") ? path : path + "/";
    for (const k of this.#store.keys()) if (k.startsWith(prefix)) return true;
    return false;
  }

  _read(path) {
    const v = this.#store.get(path);
    if (!v) throw new WativeError("RECORD_NOT_FOUND", `nothing at ${path}`);
    return v;
  }

  _write(path, data) {
    this.#store.set(path, data);
  }

  _remove(path) {
    this.#store.delete(path);
  }

  _ensureDir(path) {
    this.#dirs.add(path);
  }

  _listItems(path) {
    const prefix = path.endsWith("/") ? path : path + "/";
    const names = new Set();
    for (const k of this.#store.keys()) {
      if (!k.startsWith(prefix)) continue;
      const head = k.slice(prefix.length).split("/")[0];
      if (head) names.add(head);
    }
    return [...names];
  }

  /** Not part of the contract — this example looks at the raw bytes below. */
  dumpForTest() {
    return this.#store;
  }
}

test("a twenty-line backend runs a whole workspace", async () => {
  const provider = new MapProvider("map://desk");

  let ws = await Workspace.open({ provider, password: "wsp-pwd" });
  assert.strictEqual(ws.locked, false);

  assert.ok(ws.networks.map((n) => n.slug).includes("ethereum"));

  const acc = await ws.accounts.create(
    "Desk One",
    "wsp-pwd",
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
  );
  await acc.deriveWallets(2);
  assert.strictEqual(acc.wallets.length, 3);

  const evm = acc.wallets[0].evm;
  assert.match(evm.publicKey, /^0x[0-9a-fA-F]{40}$/);
  const sig = await evm.signMessage("hello from a Map");
  assert.match(sig, /^0x[0-9a-fA-F]{130}$/);

  await ws.lock();

  ws = await Workspace.open({ provider, password: "wsp-pwd" });
  const again = ws.accounts.bySlug(acc.slug);
  assert.ok(again);
  assert.strictEqual(again.wallets.length, 3);
  await again.tryUnlock("wsp-pwd");
  assert.strictEqual(again.wallets[0].evm.publicKey, evm.publicKey);

  await ws.lock();
});

test("the encryption comes with the base class, not with your code", async () => {
  const provider = new MapProvider("map://opaque");
  const ws = await Workspace.open({ provider, password: "wsp-pwd" });
  await ws.accounts.create(
    "Secret Holder",
    "wsp-pwd",
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
  );
  await ws.lock();

  const everything = Buffer.concat(
    [...provider.dumpForTest().values()].map((b) => Buffer.from(b)),
  ).toString("latin1");

  assert.ok(everything.length > 0, "the store should not be empty");
  assert.ok(!everything.includes("abandon"), "the mnemonic must not appear in stored bytes");
  assert.ok(!everything.includes("Secret Holder"), "the account name must not appear either");
});

test("a wrong password cannot open the container", async () => {
  const provider = new MapProvider("map://guarded");
  const ws = await Workspace.open({ provider, password: "right-pwd" });
  await ws.lock();

  await assert.rejects(
    Workspace.open({ provider, password: "wrong-pwd" }),
    (err) => err.code === "BAD_PASSWORD",
  );
});
