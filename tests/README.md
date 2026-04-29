# Examples & integration tests

Runnable JavaScript demos covering every domain in the library. Each file is both:

- **A use-case example** — read it top-to-bottom for a self-contained walkthrough.
- **An integration test** — run it via `node:test` to verify the library works in your environment.

Zero external dependencies beyond the package itself. Uses Node's built-in test runner (`node --test`), available since Node 18.

Files are written as CommonJS (`.test.cjs`) because the CJS build is the most-tested path. The package also exposes an ESM entry, but a couple of underlying chain libraries currently force a CJS-style runtime path. Once those upgrade, an ESM example set will follow.

## Run them

From the repo root:

```bash
node --test tests/
```

Or run a single file:

```bash
node --test tests/01-quick-start.test.cjs
```

All tests work fully offline — no RPC calls, no real networks. Each test creates its own temporary workspace under your OS tmp dir; nothing persists between runs.

## What each example demonstrates

| File | Demonstrates |
|---|---|
| [01-quick-start.test.cjs](01-quick-start.test.cjs) | Open a workspace, create an HD account, derive 5 wallets, inspect EVM + Solana addresses, lock. |
| [02-hd-account.test.cjs](02-hd-account.test.cjs) | HD-specific flows — deriving / slicing wallets, dumping the mnemonic, account-level passwords with `resetPassword`, round-trip across lock + reopen. |
| [03-pk-account.test.cjs](03-pk-account.test.cjs) | PK accounts — creating from a private key, importing more keys (mix EVM + Solana under one account), duplicate-import rejection, dropping wallets. |
| [04-network-management.test.cjs](04-network-management.test.cjs) | The 9 pre-loaded networks, adding a brand-new network, overriding a pre-loaded RPC URL via `update()`, dropping user networks, the built-in protection guard. |
| [05-asset-management.test.cjs](05-asset-management.test.cjs) | The 23 pre-loaded tokens, adding a custom user token, id collision rejection, contract-address collision rejection, dropping user tokens, `workspace.filter(q, "Asset")` search. |
| [06-address-signing.test.cjs](06-address-signing.test.cjs) | Personal-message signing on EVM and Solana, building a transaction fully offline (no RPC). |
| [07-custom-provider.test.cjs](07-custom-provider.test.cjs) | Plugging your own storage backend by extending the `Provider` base class. The example uses an in-memory key-value store but the same shape works for databases, cloud storage, and browser storage like IndexedDB. |
| [08-persistence.test.cjs](08-persistence.test.cjs) | Round-trip across `lock()` + reopen — multiple accounts, user networks, custom assets, and logger configuration. |
| [09-workspace-filter.test.cjs](09-workspace-filter.test.cjs) | `workspace.filter(query, objective)` for all four objectives — Account (by name or slug), Wallet (by id or tag), Address (by public key), Asset (by symbol or contract address). |
| [10-default-network.test.cjs](10-default-network.test.cjs) | `account.setDefaultNetwork(value)` accepts a slug, a chain id, a hex chain id, or a `Network` instance. The choice persists across reopen. Unknown networks are rejected. |
| [11-subpath-imports.test.cjs](11-subpath-imports.test.cjs) | Heavier chain helpers via `wative-core/artifacts/evm` (`ERC20`) and `wative-core/artifacts/svm` (`TokenProgram`, `Token2022Program`). |
| [12-logger.test.cjs](12-logger.test.cjs) | The workspace logger — six log levels, runtime `setLevel`, and config persistence across reopen. |

## Adapting for your project

In each file, replace:

```js
const { Workspace } = require("../dist/index.cjs");
```

with:

```js
const { Workspace } = require("wative-core");
```

once you've done `pnpm add wative-core` (or `npm i wative-core`) in your own project. Or, if your project is ESM-flagged, use `import` instead — both syntax styles resolve to the right entry via the package's `exports` map.

## Notes

- **No real money.** The mnemonics and private keys used in these tests are well-known testing values. Never fund them.
- **No network calls.** Tests sign offline only. To actually broadcast a transaction, configure a real RPC URL on the network and call `address.sendTransaction(tx)` — see the README for the full lifecycle.
- **Custom Provider example** uses a deliberately simple cipher (XOR). Real Providers should seal data with an authenticated cipher — see the bundled `HybridProvider` for a reference implementation.
