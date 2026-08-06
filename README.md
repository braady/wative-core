# Wative Core 2

[![npm](https://img.shields.io/npm/v/wative-core?color=cb3837&logo=npm)](https://www.npmjs.com/package/wative-core)
[![CI](https://github.com/braady/wative-core/actions/workflows/ci.yml/badge.svg)](https://github.com/braady/wative-core/actions/workflows/ci.yml)
[![node](https://img.shields.io/node/v/wative-core)](https://nodejs.org)
[![license](https://img.shields.io/badge/license-Modified%20MIT-blue)](./LICENSE)

Hyperscale crypto wallet management library — multi-workspace, multi-chain, originally designed for on-chain market makers.

Runs in Node and in the browser. Wallets live in one encrypted container: on disk
under Node, in IndexedDB in a browser, or in any storage you plug in yourself.

## How it fits together

A workspace is the container. Everything else nests inside it:

```
Workspace                     one encrypted container, one password
│
├── Account                   an identity — HD (from a mnemonic) or PK (imported keys)
│   └── Wallet                one slot in that account
│       └── Address           one key on one chain — this is what signs
│
├── Network                   the chains you can reach (RPC, chain id)
└── Asset                     the tokens tracked on each network
```

### Two kinds of Account

The nesting is the same for both, but a `Wallet` means something different in
each — and that is the part most people get wrong first.

**HD** — one mnemonic, many slots. A `Wallet` is a derivation slot, and it holds
the EVM *and* Solana keys derived from that same slot:

```
Account "Trading Desk"   (HD)          one mnemonic
├── Wallet 0                           m/44'/60'/0'/0/0
│   ├── Address  vm: "evm"             0x9858EfFD…
│   └── Address  vm: "svm"             HAgk14JpMQ…      same slot, both chains
├── Wallet 1                           m/44'/60'/0'/0/1
│   ├── Address  vm: "evm"             0x6Fac4D18…
│   └── Address  vm: "svm"             Hh8QwFUA6…
└── …                                  account.deriveWallets(n)
```

**PK** — imported keys. A `Wallet` is one key you handed in, on the one chain
you imported it for. Wallets have no relationship to each other:

```
Account "Cold Storage"   (PK)          no mnemonic
├── Wallet 0                           the key passed to accounts.create()
│   └── Address  vm: "evm"             0x90F8bf6A…
├── Wallet 1                           account.importPrivateKey(pk, "evm")
│   └── Address  vm: "evm"             0xFFcf8FDE…
└── Wallet 2                           account.importPrivateKey(pk, "svm")
    └── Address  vm: "svm"             7WktogJEd…      one chain per wallet
```

A PK account can hold as many keys as you like, and they can be on different
chains — but it refuses the same identity twice.

|                        | HD                            | PK                              |
| ---------------------- | ----------------------------- | ------------------------------- |
| Created from           | a BIP-39 mnemonic             | one private key                 |
| Grows with             | `deriveWallets(n)`            | `importPrivateKey(pk, vm)`      |
| A `Wallet` is          | a derivation slot             | one imported key                |
| Addresses per `Wallet` | **2** — one evm, one svm      | **1** — the chain you imported  |
| `dumpMnemonic()`       | ✔                             | throws `UNSUPPORTED_OP`         |
| `sliceWallets(n)`      | ✔                             | throws `UNSUPPORTED_OP`         |
| `importPrivateKey()`   | throws `UNSUPPORTED_OP`       | ✔                               |

```ts
// HD — one slot gives you the matching keys on both chains
const hd = await ws.accounts.create("Trading Desk", password, mnemonic);
await hd.deriveWallets(5);                       // slots 1..5, alongside slot 0
hd.wallets[0].addresses.find((a) => a.vm === "evm");
hd.wallets[0].addresses.find((a) => a.vm === "svm");

// PK — each import is its own wallet, on one chain
const pk = await ws.accounts.create("Cold Storage", password, privateKey);
await pk.importPrivateKey(anotherEvmKey, "evm"); // -> a new Wallet
await pk.importPrivateKey(aSolanaKey, "svm");    // -> another new Wallet
```

## Install

```bash
pnpm add wative-core
# or
npm i wative-core
```

Node.js 22.12+ for the filesystem backend. The browser build has no Node requirement.

<img width="1280" height="720" alt="wative-hierarchy" src="https://github.com/user-attachments/assets/eea4e0de-e19f-43ff-8a2b-ea5193998166" />

## Quick start

The API is the same in both environments. Only storage differs: Node writes
encrypted files to disk, the browser writes to IndexedDB.

### Node

```ts
import { Workspace } from "wative-core";
import "wative-core/node"; // installs the filesystem backend

const ws = await Workspace.open({ password: "your-workspace-password" });

const account = await ws.accounts.create(
  "Trading Desk",
  "your-workspace-password",
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
);

await account.deriveWallets(5);

const wallet = account.wallets[0];
const evmAddress = wallet.addresses.find((a) => a.vm === "evm")!;
const svmAddress = wallet.addresses.find((a) => a.vm === "svm")!;

await ws.lock();
```

### Browser

```ts
import { Workspace, IdbProvider } from "wative-core";

const provider = await IdbProvider.create("my-dapp");
const ws = await Workspace.open({ provider, password: "your-workspace-password" });

// everything from here is identical to the Node example
const account = await ws.accounts.create(
  "Trading Desk",
  "your-workspace-password",
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
);

await account.deriveWallets(5);
await ws.lock();
```

### What differs

|                | Node                                   | Browser                          |
| -------------- | -------------------------------------- | -------------------------------- |
| Extra import   | `import "wative-core/node"`            | none                             |
| Storage        | encrypted files on disk                | IndexedDB                        |
| Where it lives | `Workspace.open({ path })`, or default | `IdbProvider.create(name)`       |
| Extra setup    | none                                   | `Buffer` polyfill                |
| Keys can vanish| no                                     | yes — storage is evictable       |

`HybridProvider`, `HybridProviderV3` and `FileSink` are re-exported from the
package root in Node.

Take the provider from the **same entry point** as `Workspace`:

```ts
// Right — one entry point.
import { Workspace, HybridProvider } from "wative-core";
const ws = await Workspace.open(new HybridProvider("~/wallets"), password);

// Wrong — rejected with a PARAMETER_ERROR naming the fix.
import { Workspace } from "wative-core";
import { HybridProvider } from "wative-core/node";
```

Each entry point is a separate bundle with its own class identities and module
state, so a provider built by one is not recognised by a `Workspace` from the
other. `Workspace.open` rejects it with an error naming the fix. A bare
`import "wative-core/node"` for its side-effects is unaffected.

### Browser: the Buffer polyfill

The Solana libraries read a global `Buffer`, which browsers do not provide.

```bash
pnpm add buffer
```

```ts
// once, before importing wative-core
import { Buffer } from "buffer";
globalThis.Buffer = Buffer;
```

### Browser: keeping keys from disappearing

Browser storage is not permanent. A browser may clear IndexedDB when disk runs
low, and Safari clears script-writable storage after about seven days without
user interaction. Losing it means losing the keys.

`IdbProvider.create()` asks the browser for persistent storage and reports the
answer:

```ts
const provider = await IdbProvider.create("my-dapp");
provider.durability; // "persistent" | "best-effort"
```

Creating a **new** workspace in non-persistent storage is refused, because keys
written there can disappear without warning:

```ts
// throws STORAGE_NOT_DURABLE when the browser refused persistence
await Workspace.open({ provider, password });

// proceed anyway — only if the keys are backed up elsewhere
await IdbProvider.create("my-dapp", { acknowledgeEvictionRisk: true });
```

Opening a workspace that already exists is never blocked.

Browsers are far more likely to grant persistence when the request comes from a
user action, so call `IdbProvider.create()` from a click rather than on page
load. Whatever the answer, give users a backup — `exportContainer()` returns the
encrypted records, and they import into a Node workspace unchanged:

```ts
const backup = await provider.exportContainer(); // still encrypted
await otherProvider.importContainer(backup);     // same password opens it
```

## Key derivation

Passwords are stretched with Argon2id (RFC 9106) at t=3, m=64 MiB, p=1 before
they ever touch a key. That is deliberately expensive, and an account unlock
runs one derivation per sealed secret — so the implementation matters.

By default it runs on a vendored WebAssembly build: no native binary, no build
step, nothing to install. Measured over a full workspace lifecycle it is about
**25x** faster than the pure-JS implementation it replaced.

### Browser: grant `'wasm-unsafe-eval'`

```
Content-Security-Policy: script-src 'self' 'wasm-unsafe-eval'
```

Without it the browser blocks WebAssembly compilation entirely — synchronously
and asynchronously, main thread and worker alike. **Nothing throws.** Key
derivation quietly falls back to a pure-JS implementation that produces
identical bytes roughly 17x slower, so unlocking a wallet with a dozen addresses
goes from under a second to tens of seconds. The fallback is announced once on
the console and reported permanently by `argon2BackendInfo()`.

## Upgrading to 2.3.0

**v1 containers can no longer be opened.** Support for the v1 envelope
(PBKDF2-HMAC-SHA256, written by wative-core 1.x) was removed and there is no
migration path in this release. Containers written by any 2.x version are v2 and
open unchanged.

If you hold a v1 container, recover it with **2.2.x or earlier** before
upgrading. `exportContainer()` will not do it — it copies sealed bytes without
decrypting, so the export is as unreadable as the original. Use the accessors
that return plaintext:

```ts
// under wative-core 2.2.x — NOT 2.3.0, which can no longer open a v1 container
import { Workspace, HybridProvider } from "wative-core";

const ws = await Workspace.open(new HybridProvider("~/wallets"), password);

for (const account of ws.accounts) {
  await account.tryUnlock(password);

  // HD accounts: the mnemonic regenerates every derived key, so it is the only
  // thing you need.
  if (account.organizationType === "HD") {
    console.log(account.slug, "mnemonic:", account.dumpMnemonic());
    continue;
  }

  // PK accounts: there is no mnemonic, so every imported key must be kept.
  // `dumpPrivateKey` lives on the WALLET and takes the VM of the address you
  // want — a wallet holds at most one address per VM.
  for (const wallet of account.wallets) {
    for (const address of wallet.addresses) {
      console.log(account.slug, wallet.id, address.vm, wallet.dumpPrivateKey(address.vm));
    }
  }
}
```

Keep that material somewhere safe, upgrade, then re-import it with
`accounts.create(...)` and `importPrivateKey(...)`.

Three public members were removed with v1: `Provider.passwordTanren`,
`ContainerProvider.passwordTanren` and `HybridProvider.kdfIterations`. All three
existed only to expose the PBKDF2 derivation.

### One derivation per container: `HybridProviderV3` (Node only)

```ts
import { Workspace, HybridProviderV3 } from "wative-core";

const ws = await Workspace.open(new HybridProviderV3("~/wallets"), password);
```

The default provider derives an Argon2 key per sealed secret, so unlocking an
account costs one derivation per address — at production parameters that is
essentially the whole cost, and it grows with the account. `HybridProviderV3`
derives once per container instead. Measured: unlocking a 50-address account
goes from 7.3 s to 144 ms, and the v3 figure does not grow with the address
count.

It is opt-in, and Node-only: it derives through native `@node-rs/argon2`, which
has no browser build. In a browser use `HybridProvider`, which needs no binary
and no install and is already about 25x faster than what preceded it.

⚠️ **The speedup applies to records written as v3, not to ones you already
have.** Pointing `HybridProviderV3` at a container built by 2.x keeps every
existing secret on its own salt, so it keeps costing one derivation each — the
container still opens, it just does not get faster. Rewriting an account's
secrets with `account.resetPassword(old, new)` converts them. A container
reaches one derivation once all of its records have been written as v3, which
happens on its own only for containers created under v3.

The first v3 unlock of an existing container costs one extra derivation, once,
and converts its CONFIG record to v3 — after which wative-core 2.2.x and earlier
can no longer open it.

Reads do not depend on the choice — every record carries its own version byte,
so either 2.3.0 provider opens either format, in both directions. ⚠️ But **older
library versions cannot read v3**: wative-core 2.2.x and earlier know only v1 and
v2 and will fail with `Unknown envelope version: 3`. Adopting v3 is a one-way
door with respect to the library version.

### Checking which implementation ran

```ts
import { argon2BackendInfo } from "wative-core";

argon2BackendInfo();
// { backend: "wasm", wasm: true, overrides: [] }
// { backend: "noble", wasm: false, reason: "...", overrides: [] }  ← degraded
// { backend: "unresolved", wasm: false, ..., overrides: ["node-rs"] }
```

`backend` is the process-wide default. A provider may carry its own — a
`HybridProviderV3` does — so check **`overrides`** to confirm the native path
took. It is a pure read and resolves nothing, so before the first unlock it
honestly answers `"unresolved"`.

## Runnable examples

An `examples/` folder ships with the package — runnable JavaScript files demonstrating every domain's use cases. Read them top-to-bottom as walkthroughs, or run them as integration tests via Node's built-in test runner.

Copy them out of `node_modules` first, then run the whole set:

```bash
cp -R node_modules/wative-core/tests wative-examples
node --test wative-examples/
```

The copy is required: Node's test runner skips anything under `node_modules`, so pointing `--test` there finds no files. To run a single example without copying, execute it directly — a `node:test` file runs itself:

```bash
node node_modules/wative-core/examples/01-quick-start.test.cjs
```

Files cover: quick start, HD vs PK accounts, network management, asset management, address signing, custom storage backends, persistence, workspace search, default-network selection, subpath imports, the workspace logger, workspace config, the ESM entry, and package resolution. See [examples/README.md](./examples/README.md) for the index.

## What you can do

The library is organized around seven things you'll work with:

- **`Workspace`** — your top-level container. Holds the password, your accounts, your network and asset list, and a built-in logger.
- **`Account`** — either an HD account (one BIP-39 mnemonic, can derive many wallets) or a PK account (raw private keys you import one at a time). Each account can have its own password or share the workspace password.
- **`Wallet`** — a unit inside an account. HD wallets carry one EVM and one Solana address; PK wallets carry one address.
- **`Address`** — an on-chain identity. Sign messages, build transactions, send them.
- **`Network`** — chain metadata. 10 networks ship pre-loaded.
- **`Asset`** — token metadata. 25 tokens ship pre-loaded.
- **`Transaction`** — `EvmTransaction` or `SvmTransaction`. Subscribe to lifecycle events (`change` / `confirmed` / `failed`) or await terminal states (`whenSubmitted` / `whenMined` / `whenConfirmed` / `whenFinalized`).

Everything is encrypted on disk under your workspace password.

### Pre-loaded networks and tokens

| Networks (10) | Tokens (25) |
|---|---|
| ethereum, base, bnbchain, arbitrum, optimism | native gas + USDC + USDT on each EVM mainnet (BSC versions are 18-decimal Binance-Peg); plus WETH on ethereum |
| sepolia, arbitrum-sepolia | native ETH on both testnets; plus USDC on arbitrum-sepolia |
| solana, solana-testnet, solana-devnet | native SOL + USDC + USDT + WSOL on solana mainnet; native-only on testnets |

## Examples by domain

### Workspace — open / unlock / lock

```ts
import { Workspace } from "wative-core";

const ws = await Workspace.open({ password: "wsp-pwd" });

const ws2 = await Workspace.open({ path: "/var/lib/wative-prod", password: "wsp-pwd" });

const locked = await Workspace.open({ path: "/var/lib/wative-prod" });
console.log(locked.locked);
await locked.unlock("wsp-pwd");

ws.logger.info("trading session opened", { desk: "alpha" });
await ws.logger.setLevel("debug");

await ws.lock();
```

#### Creating vs. opening — it's automatic

You don't tell `open()` whether to create or open. It decides from what's already at the location:

- **Nothing there (or an empty folder)** → a new workspace is created.
- **A wative workspace already there** → it's opened, and your password is checked.
- **Something else there** (a folder with unrelated files) → the call is **refused** with a `PARAMETER_ERROR`, so a mistyped path never turns one of your other folders into a workspace.

Pass the password to get an unlocked workspace, or omit it to get a locked one you unlock later:

```ts
const ws = await Workspace.open({ path: "/var/lib/wative-prod", password: "wsp-pwd" }); // unlocked
const later = await Workspace.open({ path: "/var/lib/wative-prod" });                   // locked
await later.unlock("wsp-pwd");
```

`open()` also accepts the older positional form — `Workspace.open(pathOrProvider, password)` — which works exactly the same way.

#### Where the workspace lives on disk

Most apps pass an explicit path as the first argument — that path is used verbatim (with `~` expansion). When you omit the path, the library resolves it through a **3-tier strategy**, in order:

1. **`WATIVE_WORKSPACE_PATH` environment variable** — if set and non-empty, this wins. Use it for ops/CI overrides without touching code:

   ```bash
   WATIVE_WORKSPACE_PATH=/var/lib/wative-prod   node app.js
   WATIVE_WORKSPACE_PATH=~/.wative2             node app.js   # ~ is expanded
   ```

2. **`<process.cwd()>/.wative2`** — used when the env var is unset *and* this directory already exists on disk. Lets a project pin its workspace by simply having a `.wative2/` folder at the repo root.

3. **`<os.homedir()>/.wative2`** — last-resort fallback. Where `Workspace.open({ password })` lands on a fresh machine when no env var is set and there's no project-local `.wative2/`. Acts as the user-wide default workspace.

So a typical lifecycle looks like:

```ts
// First run on a fresh machine — env unset, no <cwd>/.wative2 → creates ~/.wative2
await Workspace.open({ password: "wsp-pwd" });

// Later, opt the project into a local workspace
// $ mkdir .wative2
// Now <cwd>/.wative2 exists → tier 2 wins
await Workspace.open({ password: "wsp-pwd" });

// Or override via env in CI/staging
// $ WATIVE_WORKSPACE_PATH=/srv/wative-staging node app.js
await Workspace.open({ password: "wsp-pwd" });
```

If you'd rather not rely on the resolver, just pass the path explicitly — it short-circuits all three tiers.

### Account — HD vs PK, derive wallets, import keys

```ts
const hd = await ws.accounts.create(
  "Trading Desk",
  "wsp-pwd",
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
);
await hd.deriveWallets(10);
await hd.sliceWallets(6);

const pk = await ws.accounts.create(
  "External Hot Wallet",
  "wsp-pwd",
  "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d",
  undefined,
  { kind: "PK" },
);
await pk.importPrivateKey(
  "xtGWcHvQsr5ue8zG2F5fm31bW8vyn597Y92gUWaZZg3S1Z6FeJMATL8KU3xJMGbLfALnokcct9y5wYtCRrwNXZW",
  "svm",
);

const sub = await ws.accounts.create(
  "Sub Account",
  "sub-pwd",
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
  undefined,
  { hasOwnPassword: true },
);
await sub.tryUnlock("sub-pwd");
await sub.resetPassword("sub-pwd", "new-sub-pwd");

console.log(hd.dumpMnemonic());

hd.lock();
await pk.drop();
```

### Wallet — derivation slot, tags, drop

```ts
const wallet = hd.wallets[2];
console.log(wallet.id);
console.log(wallet.addresses.length);

await wallet.addTag("hot");
await wallet.addTag("alpha-strategy");

await hd.wallets.drop(hd.wallets[10]);
```

### Address — sign messages, build transactions

```ts
const evmAddr = hd.wallets[0].addresses.find((a) => a.vm === "evm")!;
const svmAddr = hd.wallets[0].addresses.find((a) => a.vm === "svm")!;

const sig = evmAddr.signMessage("hello hedgue");

import { Network } from "wative-core";
const tx = await evmAddr.buildTransaction({
  to: "0x1234567890123456789012345678901234567890",
  value: 1_000_000_000_000_000n,
  network: Network.Ethereum,
});
await evmAddr.signTransaction(tx);
const tracker = await evmAddr.sendTransaction(tx);

tracker.on("change",    (state)   => console.log("state →", state.status));
tracker.on("confirmed", (receipt) => console.log("confirmed", receipt));
tracker.on("failed",    (err)     => console.error("failed", err));

const hash = await tracker.whenSubmitted();
const receipt = await tracker.whenConfirmed(3);

const sim = await evmAddr.simulateTransaction(tx);
console.log(sim.gasUsed);
```

### Network — pre-loaded networks + your own

```ts
import { Network, type ChainId, type Slug } from "wative-core";

console.log(Network.Ethereum.chainId);
console.log(Network.Solana.vm);

const eth = ws.networks.bySlug("ethereum" as Slug)!;
const arb = ws.networks.byChainId(42161 as ChainId)!;

const monad = new Network({
  slug: "monad-testnet" as Slug,
  name: "Monad Testnet",
  chainId: 10143 as ChainId,
  rpcUrl: "https://testnet-rpc.monad.xyz",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  vm: "evm",
});
await ws.networks.add(monad);

const customEth = new Network({
  ...eth,
  rpcUrl: "https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY",
});
await ws.networks.update(customEth);

await ws.networks.drop(monad);

await hd.setDefaultNetwork("base");
await hd.setDefaultNetwork(8453 as ChainId);
await hd.setDefaultNetwork("0x2105");
await hd.setDefaultNetwork(Network.Base);
```

### Asset — pre-loaded tokens + custom tokens

```ts
import { Asset, Network, type AssetId } from "wative-core";

const ethAssets = await ws.assets(Network.Ethereum);
console.log(ethAssets.map((a) => a.symbol));

const myToken = new Asset({
  id: 200 as AssetId,
  symbol: "PEPE",
  name: "Pepe",
  decimals: 18,
  contractAddress: "0x6982508145454Ce325dDbE47a25d4ec3d2311933",
  network: Network.Ethereum,
});
await ws.addAsset(myToken);

await ws.dropAsset(200 as AssetId);

const found  = await ws.filter("USDC", "Asset");
const byAddr = await ws.filter("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "Asset");
```

### Transaction — build, sign, simulate, send

```ts
import { EvmTransaction, Network, type EvmAddress } from "wative-core";

const evmTx = new EvmTransaction({
  from: evmAddr.publicKey as EvmAddress,
  to: "0x1234567890123456789012345678901234567890" as EvmAddress,
  value: 10_000_000n,
  network: Network.Base,
  gasLimit: 21000n,
  maxFeePerGas: 50_000_000_000n,
  maxPriorityFeePerGas: 1_000_000_000n,
});
await evmAddr.signTransaction(evmTx);
const evmTracker = await evmAddr.sendTransaction(evmTx);

const receipt = await evmTracker.whenConfirmed(3);
```

For Solana transactions, build instructions with `@solana/web3.js` (or your preferred Solana toolkit) and pass them to `new SvmTransaction({ from, instructions, network })`. The signing, sending, and tracker lifecycle then mirror the EVM flow.

#### Hand off to an external signer / RPC client

Both `EvmTransaction` and `SvmTransaction` expose `toRawTx()` for routing the transaction through any chain-native tool you already use:

```ts
// EVM — synchronous; returns a plain web3.js / ethers / viem TransactionRequest
const evmTx = evmAddr.buildTransaction({
  to: "0x1234567890123456789012345678901234567890" as EvmAddress,
  value: 10_000_000n,
  gasLimit: 21000n,
});
const rawEvm = evmTx.toRawTx();
// { from, to, value, data, type, chainId, gasLimit, ... }
// pass `rawEvm` to web3.eth.sendTransaction, ethers Signer, viem walletClient, etc.
```

```ts
// Solana — async; returns the underlying @solana/web3.js Transaction
const svmTx = svmAddr.buildTransaction({
  recipient: "11111111111111111111111111111112",
  amount: 1_000_000n,
});
const rawSvm = await svmTx.toRawTx();
// rawSvm.add(extraIx);
// rawSvm.sign(theirKeypair);
// connection.sendRawTransaction(rawSvm.serialize());
```

For SVM, if you supply `recentBlockhash` at construction time, `toRawTx()` builds entirely offline — no Address binding required.

### Workspace search

```ts
const account = await ws.filter("Trading Desk", "Account");
const wallet  = await ws.filter("alpha-strategy", "Wallet");
const address = await ws.filter("0xab12345678…cdef", "Address");
const asset   = await ws.filter("USDC", "Asset");
```

## Custom storage backends

By default, `Workspace.open(...)` stores everything as encrypted files under the path you pass it. If you want to store the workspace somewhere else — a database, an object store, a browser's IndexedDB — extend the `Provider` base class and pass an instance to `Workspace.open()`:

```ts
import { Workspace, Provider, Record, type RecordInit, type RecordType } from "wative-core";
import type { Slug } from "wative-core";

class MyDatabaseProvider extends Provider {
  constructor(connectionString: string) {
    super(connectionString);
  }

  protected async _exist(path: string)             { return false; }
  protected async _read(path: string)              { return new Uint8Array(); }
  protected async _write(path: string, b: Uint8Array) {}
  protected async _remove(path: string)            {}
  protected async _ensureDir(path: string)         {}
  protected async _listItems(path: string)         { return []; }

  async unlockContainer(password: string): Promise<boolean> { return true; }
  async lockContainer():                  Promise<void>    {}
  isContainerUnlocked():                  boolean          { return true; }

  async loadRecord<T>(type: RecordType, slug?: Slug): Promise<Record<T>> { throw new Error(); }
  async loadRecords<T>(type: RecordType): Promise<readonly Record<T>[]>  { return []; }
  async writeRecord<T>(type: RecordType, slug: Slug, value: T): Promise<void> {}
  async dropRecord(type: RecordType, slug: Slug): Promise<void> {}

  async close(): Promise<void> {}
}

const ws = await Workspace.open({ provider: new MyDatabaseProvider("postgres://..."), password: "wsp-pwd" });
```

`Workspace.open()` accepts any `Provider` subclass — the rest of the library is identical regardless of where state lives.

## Imports from sub-paths

Heavier chain helpers are kept on separate import paths so you only pull them in if you need them:

```ts
import { ERC20 } from "wative-core/artifacts/evm";
import { TokenProgram, Token2022Program } from "wative-core/artifacts/svm";
```

## Compatibility notes

- **Content-Security-Policy (browser)**: grant `'wasm-unsafe-eval'` in `script-src`, or key derivation silently degrades to a ~17x slower pure-JS path. See [Key derivation](#key-derivation).
- **Runtime**: Node.js 22.12+. Deno / Bun / browser support is partial. Some chain libraries that ship as compiled dependencies do not have universal builds yet.
- **Platform builds**: a few compiled dependencies lack pre-built binaries for Windows-ARM64 and Alpine-musl. Most installs on macOS / Linux x64 / Linux ARM64 won't notice.
- **One process at a time**: opening the same workspace from two Node processes simultaneously isn't supported.

## License

[Modified MIT](./LICENSE) — MIT terms with one added condition: products or services earning over US$50,000 monthly revenue must display "Wative" in their user interface. Everything else is standard MIT. The `LICENSE` file also carries third-party notices for the compiled components embedded in `dist/`.
