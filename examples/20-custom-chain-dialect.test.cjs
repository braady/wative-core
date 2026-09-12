// 20 — Custom chain: subclass ChainDialect and register a vm to add a blockchain the library does not ship; the "xvm" chain, its toy formats and stand-in signer are illustrative only.

const test = require("node:test");
const assert = require("node:assert");
const { mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { Workspace, Network, Address, ChainDialect, registerDialect } = require("wative-core");

// A super-simple, dependency-free digest standing in for a real hash — illustrative only, not collision-resistant.
function toyHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

// The signer subclass a chain author exports, mirroring EvmSigner / SvmSigner.
class XvmSigner extends Address {}

// The dialect a chain author writes: the keyless ChainDialect contract for "xvm".
class XvmDialect extends ChainDialect {
  get vm() {
    return "xvm";
  }
  get curve() {
    return "ed25519";
  }

  signMessage(ctx, message) {
    const raw = ctx._signBytes(new TextEncoder().encode(`xvm:${message}`));
    return `xvm-sig:${Buffer.from(raw).toString("hex")}`;
  }
  signMessageEncoded(ctx, message, _encoding) {
    return { signature: this.signMessage(ctx, message), messageHash: `0x${toyHash(message)}` };
  }
  signTypedData(ctx, typedData, _chainId) {
    const payload = JSON.stringify(typedData);
    return {
      signature: this.signMessage(ctx, payload),
      domainSeparator: `0x${toyHash(`domain:${payload}`)}`,
      structHash: `0x${toyHash(`struct:${payload}`)}`,
    };
  }
  buildTransaction(ctx, params) {
    return { vm: "xvm", from: String(ctx.publicKey), to: params.to, value: params.value ?? 0n, nonce: params.nonce ?? 0 };
  }
  transfer(ctx, req) {
    const tx = { vm: "xvm", from: String(ctx.publicKey), to: req.to, amount: req.amount };
    if (req.asset && req.asset.address) tx.token = req.asset.address;
    return tx;
  }
  derive(seed, index) {
    const h = toyHash(`${Buffer.from(seed).toString("hex")}:${index}`);
    return { publicKey: `xvm1${h}${index}`, privateKey: `xsk1${h}${index}` };
  }
  addressFromPrivateKey(privateKey) {
    if (typeof privateKey !== "string" || !privateKey.startsWith("xsk1")) throw new Error("malformed xvm private key");
    return `xvm1${privateKey.slice(4)}`;
  }
  privateKeyMatches(privateKey, publicKey) {
    try {
      return this.addressFromPrivateKey(privateKey) === publicKey;
    } catch {
      return false;
    }
  }
}

// One call teaches the library about "xvm" and opens the vm whitelist to that token.
registerDialect("xvm", () => new XvmDialect());

test("a registered vm becomes a first-class network; an unknown vm is refused", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-xvm-net-"));
  const ws = await Workspace.open({ path: root, password: "wsp-pwd" });

  const xnet = new Network({
    slug: "xvm-testnet",
    name: "XVM Testnet",
    chainId: 909090,
    rpcUrl: "https://rpc.xvm.example",
    nativeCurrency: { name: "XVM", symbol: "XVM", decimals: 9 },
    vm: "xvm",
  });
  await ws.networks.add(xnet);
  assert.strictEqual(ws.networks.bySlug("xvm-testnet").vm, "xvm");

  assert.throws(
    () =>
      new Network({
        slug: "nope-net",
        name: "Nope",
        chainId: 111111,
        rpcUrl: "https://nope.example",
        nativeCurrency: { name: "N", symbol: "N", decimals: 9 },
        vm: "totally-unregistered",
      }),
  );

  await ws.lock();
});

test("the custom dialect signs, builds a tx, and transfers via a keyless ctx", () => {
  const dialect = new XvmDialect();
  assert.strictEqual(dialect.vm, "xvm");
  assert.strictEqual(dialect.curve, "ed25519");

  const ctx = {
    publicKey: "xvm1deadbeef0",
    vm: "xvm",
    network: null,
    assets: [],
    _signBytes: (bytes) => new Uint8Array([bytes.length & 0xff, 0x42, 0x99]),
  };

  const sig = dialect.signMessage(ctx, "hello");
  assert.ok(sig.startsWith("xvm-sig:"));

  const tx = dialect.buildTransaction(ctx, { to: "xvm1recipient", value: 1000n, nonce: 7 });
  assert.strictEqual(tx.vm, "xvm");
  assert.strictEqual(tx.from, "xvm1deadbeef0");
  assert.strictEqual(tx.to, "xvm1recipient");
  assert.strictEqual(tx.nonce, 7);

  const native = dialect.transfer(ctx, { to: "xvm1bob", amount: 500n });
  assert.strictEqual(native.to, "xvm1bob");
  assert.strictEqual(native.amount, 500n);
  assert.strictEqual(native.token, undefined);

  const token = dialect.transfer(ctx, { to: "xvm1bob", asset: { address: "xtoken1" }, amount: 5n });
  assert.strictEqual(token.token, "xtoken1");
});

test("the custom dialect derives addresses and round-trips private keys", () => {
  const dialect = new XvmDialect();
  const seed = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);

  const { publicKey, privateKey } = dialect.derive(seed, 0);
  assert.ok(publicKey.startsWith("xvm1"));
  assert.ok(privateKey.startsWith("xsk1"));

  assert.strictEqual(dialect.addressFromPrivateKey(privateKey), publicKey);
  assert.ok(dialect.privateKeyMatches(privateKey, publicKey));
  assert.ok(!dialect.privateKeyMatches("xsk1wrongkey", publicKey));
  assert.ok(!dialect.privateKeyMatches("not-even-an-xvm-key", publicKey));

  assert.notStrictEqual(dialect.derive(seed, 1).publicKey, publicKey);
});

test("XvmSigner extends Address — the per-chain signer pattern", () => {
  assert.ok(XvmSigner.prototype instanceof Address);
});
