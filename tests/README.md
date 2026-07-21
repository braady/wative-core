# Examples & integration tests

Runnable JavaScript demos covering every domain in the library. Each file is both:

- **A use-case example** — read it top-to-bottom for a self-contained walkthrough.
- **An integration test** — run it via `node:test` to verify the library works in your environment.

Zero external dependencies beyond the package itself. Uses Node's built-in test runner (`node --test`), available since Node 18.

Most files are written as CommonJS (`.test.cjs`) because the CJS build is the most-tested path. The ESM entry is exercised too — [14-esm-runtime.test.mjs](14-esm-runtime.test.mjs) runs the same flows through `import`, and [15-package-resolution.test.cjs](15-package-resolution.test.cjs) checks that both builds resolve by bare package name and expose the same API.

## Run them

From the repo root:

```bash
node --test tests/
```

Or run a single file:

```bash
node --test tests/01-quick-start.test.cjs
```

If you are reading this inside `node_modules` after installing the package, copy the folder out before running `--test` — Node's test runner skips anything under `node_modules`. A single file can still be run in place with plain `node <file>`.

All tests work fully offline — no RPC calls, no real networks. Each test creates its own temporary workspace under your OS tmp dir; nothing persists between runs.

## What each example demonstrates

| File | Demonstrates |
|---|---|
| [01-quick-start.test.cjs](01-quick-start.test.cjs) | Open a workspace, create an HD account, derive 5 wallets, inspect EVM + Solana addresses, lock. |
| [02-hd-account.test.cjs](02-hd-account.test.cjs) | HD-specific flows — deriving / slicing wallets, dumping the mnemonic, account-level passwords with `resetPassword`, round-trip across lock + reopen. |
| [03-pk-account.test.cjs](03-pk-account.test.cjs) | PK accounts — creating from a private key, importing more keys (mix EVM + Solana under one account), duplicate-import rejection, dropping wallets. |
| [04-network-management.test.cjs](04-network-management.test.cjs) | The 10 pre-loaded networks, adding a brand-new network, overriding a pre-loaded RPC URL via `update()`, dropping user networks, the built-in protection guard. |
| [05-asset-management.test.cjs](05-asset-management.test.cjs) | The 25 pre-loaded tokens, adding a custom user token, id collision rejection, contract-address collision rejection, dropping user tokens, `workspace.filter(q, "Asset")` search. |
| [06-address-signing.test.cjs](06-address-signing.test.cjs) | Personal-message signing on EVM and Solana, building a transaction fully offline (no RPC). |
| [07-custom-provider.test.cjs](07-custom-provider.test.cjs) | Plugging your own storage backend by extending the `Provider` base class. The example uses an in-memory key-value store but the same shape works for databases, cloud storage, and browser storage like IndexedDB. |
| [08-persistence.test.cjs](08-persistence.test.cjs) | Round-trip across `lock()` + reopen — multiple accounts, user networks, custom assets, and logger configuration. |
| [09-workspace-filter.test.cjs](09-workspace-filter.test.cjs) | `workspace.filter(query, objective)` for all four objectives — Account (by name or slug), Wallet (by id or tag), Address (by public key), Asset (by symbol or contract address). |
| [10-default-network.test.cjs](10-default-network.test.cjs) | `account.setDefaultNetwork(value)` accepts a slug, a chain id, a hex chain id, or a `Network` instance. The choice persists across reopen. Unknown networks are rejected. |
| [11-subpath-imports.test.cjs](11-subpath-imports.test.cjs) | Heavier chain helpers via `wative-core/artifacts/evm` (`ERC20`) and `wative-core/artifacts/svm` (`TokenProgram`, `Token2022Program`). |
| [12-logger.test.cjs](12-logger.test.cjs) | The workspace logger — six log levels, runtime `setLevel`, and config persistence across reopen. |
| [13-workspace-config.test.cjs](13-workspace-config.test.cjs) | Workspace config public API — `setBusinessTimezone()` / `getConfig()` from the release dist without provider record access. |
| [14-esm-runtime.test.mjs](14-esm-runtime.test.mjs) | The same core flows driven through the ESM build via `import`, proving the package works from an ESM-flagged project. |
| [15-package-resolution.test.cjs](15-package-resolution.test.cjs) | Resolution by bare package name — every declared subpath under both `require()` and `import()`, identical export surfaces from the two builds, and the declared Node version. |
| [16-known-answer-vectors.test.cjs](16-known-answer-vectors.test.cjs) | Exact expected values — published BIP-44 addresses for the canonical mnemonic, a known address from an imported private key, and a fixed EIP-191 signature. Catches derivation from the wrong path or signing with the wrong key. |
| [17-locked-state.test.cjs](17-locked-state.test.cjs) | What locking enforces — which operations refuse and with which error code, that a locked account holds no mnemonic in the clear, and that unlocking restores identical behaviour. |

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
