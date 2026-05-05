# Wative Core 2

Hyperscale crypto wallet management library — multi-workspace, multi-chain, originally designed for on-chain market makers.

## Install

```bash
pnpm add wative-core
# or
npm i wative-core
```

Requires Node.js 18.18+.

## Quick start

```ts
import { Workspace } from "wative-core";

const ws = await Workspace.open(undefined, "your-workspace-password", true);

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

## Runnable examples

A `tests/` folder ships with the package — runnable JavaScript files demonstrating every domain's use cases. Read them top-to-bottom as walkthroughs, or run them as integration tests via Node's built-in test runner:

```bash
node --test node_modules/wative-core/tests/*.test.cjs
```

Files cover: quick start, HD vs PK accounts, network management, asset management, address signing, custom storage backends, persistence, workspace search, default-network selection, subpath imports, and the workspace logger. See [tests/README.md](./tests/README.md) for the index.

## What you can do

The library is organized around seven things you'll work with:

- **`Workspace`** — your top-level container. Holds the password, your accounts, your network and asset list, and a built-in logger.
- **`Account`** — either an HD account (one BIP-39 mnemonic, can derive many wallets) or a PK account (raw private keys you import one at a time). Each account can have its own password or share the workspace password.
- **`Wallet`** — a unit inside an account. HD wallets carry one EVM and one Solana address; PK wallets carry one address.
- **`Address`** — an on-chain identity. Sign messages, build transactions, send them.
- **`Network`** — chain metadata. 9 networks ship pre-loaded.
- **`Asset`** — token metadata. 23 tokens ship pre-loaded.
- **`Transaction`** — `EvmTransaction` or `SvmTransaction`. Subscribe to lifecycle events (`change` / `confirmed` / `failed`) or await terminal states (`whenSubmitted` / `whenMined` / `whenConfirmed` / `whenFinalized`).

Everything is encrypted on disk under your workspace password.

### Pre-loaded networks and tokens

| Networks (9) | Tokens (23) |
|---|---|
| ethereum, base, bnbchain, arbitrum, optimism, sepolia | native gas + USDC + USDT on each EVM mainnet (BSC versions are 18-decimal Binance-Peg); plus WETH on ethereum |
| solana, solana-testnet, solana-devnet | native SOL + USDC + USDT + WSOL on solana mainnet; native-only on testnets |

## Examples by domain

### Workspace — open / unlock / lock

```ts
import { Workspace } from "wative-core";

const ws = await Workspace.open(undefined, "wsp-pwd", true);

const ws2 = await Workspace.open("/var/lib/wative-prod", "wsp-pwd", true);

const locked = await Workspace.open("/var/lib/wative-prod");
console.log(locked.locked);
await locked.unlock("wsp-pwd");

ws.logger.info("trading session opened", { desk: "alpha" });
await ws.logger.setLevel("debug");

await ws.lock();
```

#### Where the workspace lives on disk

Most apps pass an explicit path as the first argument — that path is used verbatim (with `~` expansion). When you omit the path (`Workspace.open(undefined, …)`), the library resolves it through a **3-tier strategy**, in order:

1. **`WATIVE_WORKSPACE_PATH` environment variable** — if set and non-empty, this wins. Use it for ops/CI overrides without touching code:

   ```bash
   WATIVE_WORKSPACE_PATH=/var/lib/wative-prod   node app.js
   WATIVE_WORKSPACE_PATH=~/.wative2             node app.js   # ~ is expanded
   ```

2. **`<process.cwd()>/.wative2`** — used when the env var is unset *and* this directory already exists on disk. Lets a project pin its workspace by simply having a `.wative2/` folder at the repo root.

3. **`<os.homedir()>/.wative2`** — last-resort fallback. Where `Workspace.open(undefined, pwd, true)` lands on a fresh machine when no env var is set and there's no project-local `.wative2/`. Acts as the user-wide default workspace.

So a typical lifecycle looks like:

```ts
// First run on a fresh machine — env unset, no <cwd>/.wative2 → creates ~/.wative2
await Workspace.open(undefined, "wsp-pwd", true);

// Later, opt the project into a local workspace
// $ mkdir .wative2
// Now <cwd>/.wative2 exists → tier 2 wins
await Workspace.open(undefined, "wsp-pwd", true);

// Or override via env in CI/staging
// $ WATIVE_WORKSPACE_PATH=/srv/wative-staging node app.js
await Workspace.open(undefined, "wsp-pwd", true);
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

const sig = await evmAddr.signMessage("hello hedgue");

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

const ws = await Workspace.open(new MyDatabaseProvider("postgres://..."), "wsp-pwd", true);
```

`Workspace.open()` accepts any `Provider` subclass — the rest of the library is identical regardless of where state lives.

## Imports from sub-paths

Heavier chain helpers are kept on separate import paths so you only pull them in if you need them:

```ts
import { ERC20 } from "wative-core/artifacts/evm";
import { TokenProgram, Token2022Program } from "wative-core/artifacts/svm";
```

## Compatibility notes

- **Runtime**: Node.js 18.18+. Deno / Bun / browser support is partial. Some chain libraries that ship as compiled dependencies do not have universal builds yet.
- **Platform builds**: a few compiled dependencies lack pre-built binaries for Windows-ARM64 and Alpine-musl. Most installs on macOS / Linux x64 / Linux ARM64 won't notice.
- **One process at a time**: opening the same workspace from two Node processes simultaneously isn't supported.

## License

[BUSL-1.1](./LICENSE) — Business Source License 1.1.
