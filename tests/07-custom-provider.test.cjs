// 07 — Custom storage backend. Extend the abstract `Provider` class to plug
// `Workspace.open()` into any storage system. This example uses an in-memory
// key-value store with a trivial XOR cipher; real custom Providers should use
// an authenticated cipher (AES-GCM, ChaCha20-Poly1305).

const test = require("node:test");
const assert = require("node:assert");

const { Workspace, Provider, Record, WativeError } = require("wative-core");

/**
 * In-memory `Provider` implementation. Stores records in a Map under
 * filesystem-style paths, encrypted with a single-byte-header XOR scheme.
 */
class InMemoryProvider extends Provider {
  #store = new Map();
  #dirs = new Set();
  #password = null;

  constructor(label) {
    super(label);
    this.#dirs.add("/");
    this.#dirs.add("/accounts");
  }

  _exist(path) { return this.#store.has(path) || this.#dirs.has(path); }
  _read(path) {
    const v = this.#store.get(path);
    if (!v) throw new WativeError("RECORD_NOT_FOUND", `no entry at ${path}`);
    return v;
  }
  _write(path, data) { this.#store.set(path, data); }
  _remove(path) { this.#store.delete(path); }
  _ensureDir(path) { this.#dirs.add(path); }
  _listItems(path) {
    const prefix = path.endsWith("/") ? path : path + "/";
    const out = new Set();
    for (const k of this.#store.keys()) {
      if (k.startsWith(prefix)) {
        const head = k.slice(prefix.length).split("/")[0];
        if (head) out.add(head);
      }
    }
    return Array.from(out);
  }

  async unlockContainer(password) {
    if (typeof password !== "string" || password.length === 0) return false;
    const path = this.#pathFor("CONFIG", "config");
    if (this.#store.has(path)) {
      try { this.#decrypt(this.#store.get(path), password); }
      catch { return false; }
    }
    this.#password = password;
    return true;
  }
  async lockContainer() { this.#password = null; }
  isContainerUnlocked() { return this.#password !== null; }

  async loadRecord(type, slug) {
    if (this.#password === null) throw new WativeError("PROVIDER_IO", "container locked");
    const eff = slug ?? this.#defaultSlug(type);
    const path = this.#pathFor(type, eff);
    if (!this.#store.has(path)) throw new WativeError("RECORD_NOT_FOUND", path);
    const encrypted = this.#store.get(path);
    const value = JSON.parse(new TextDecoder().decode(this.#decrypt(encrypted, this.#password)));
    return new Record(eff, path, {
      provider: this,
      recordType: type,
      encrypted,
      value,
      password: this.#password,
      decrypt: (ct, pwd) => this.#decrypt(ct, pwd),
      persist: async (val, pwd) => {
        this.#store.set(path, this.#encrypt(JSON.stringify(val), pwd));
      },
    });
  }
  async loadRecords(type) {
    if (type !== "ACCOUNTS") {
      const r = await this.loadRecord(type).catch((e) => {
        if (e instanceof WativeError && e.code === "RECORD_NOT_FOUND") return null;
        throw e;
      });
      return r ? [r] : [];
    }
    const items = this._listItems("/accounts").filter((n) => n.endsWith(".kv"));
    return Promise.all(items.map((n) => this.loadRecord("ACCOUNTS", n.slice(0, -3))));
  }
  async writeRecord(type, slug, value) {
    if (this.#password === null) throw new WativeError("PROVIDER_IO", "container locked");
    this.#store.set(this.#pathFor(type, slug), this.#encrypt(JSON.stringify(value), this.#password));
  }
  async dropRecord(type, slug) { this.#store.delete(this.#pathFor(type, slug)); }
  async close() { this.#password = null; }

  #defaultSlug(type) {
    return ({ CONFIG: "config", NETWORK: "network", ASSET: "asset", LOG: "log", ACCOUNTS: "" })[type] || "";
  }
  #pathFor(type, slug) {
    if (type === "ACCOUNTS") return `/accounts/${slug}.kv`;
    return `/${this.#defaultSlug(type)}`;
  }
  #encrypt(plaintext, password) {
    const data = new TextEncoder().encode(plaintext);
    const stream = this.#streamFor(password, data.length);
    const out = new Uint8Array(data.length + 1);
    out[0] = 0x42;
    for (let i = 0; i < data.length; i++) out[i + 1] = data[i] ^ stream[i];
    return out;
  }
  #decrypt(blob, password) {
    if (blob.length < 1 || blob[0] !== 0x42) throw new WativeError("DECRYPT_FAILED", "bad header");
    const ct = blob.subarray(1);
    const stream = this.#streamFor(password, ct.length);
    const out = new Uint8Array(ct.length);
    for (let i = 0; i < ct.length; i++) out[i] = ct[i] ^ stream[i];
    try { JSON.parse(new TextDecoder().decode(out)); }
    catch (e) { throw new WativeError("BAD_PASSWORD", "non-JSON after decrypt", { cause: e }); }
    return out;
  }
  #streamFor(password, length) {
    const seed = new TextEncoder().encode("salt|" + password);
    const out = new Uint8Array(length);
    for (let i = 0; i < length; i++) out[i] = seed[i % seed.length] ^ ((i * 7) & 0xff);
    return out;
  }
}

test("custom provider — full lifecycle against an in-memory backend", async () => {
  const provider = new InMemoryProvider("memory://desk-1");

  let ws = await Workspace.open({ provider, password: "wsp-pwd" });
  assert.strictEqual(ws.locked, false);

  const slugs = ws.networks.map((n) => n.slug).sort();
  assert.strictEqual(slugs.length, 10);
  assert.ok(slugs.includes("ethereum"));
  assert.ok(slugs.includes("arbitrum-sepolia"));

  const acc = await ws.accounts.create(
    "Trader",
    "wsp-pwd",
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
  );
  await acc.deriveWallets(2);
  assert.strictEqual(acc.wallets.length, 3);

  await ws.lock();
  ws = await Workspace.open({ provider, password: "wsp-pwd" });
  const reopened = ws.accounts.bySlug(acc.slug);
  assert.ok(reopened);
  assert.strictEqual(reopened.wallets.length, 3);

  await ws.lock();
});

test("custom provider — bad password is rejected", async () => {
  const provider = new InMemoryProvider("memory://desk-2");
  const ws = await Workspace.open({ provider, password: "right-pwd" });
  await ws.lock();

  await assert.rejects(Workspace.open({ provider, password: "wrong-pwd" }), (err) => err.code === "BAD_PASSWORD");
});
