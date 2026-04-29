# Changelog

All notable changes to `wative-core` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.1] — 2026-04-29

First release of the v2 line.

### Added

- Seven domain classes: `Workspace`, `Account`, `Wallet`, `Address`, `Network`, `Asset`, `Transaction`. Workspace, Account, Wallet, and Address are constructed via factory methods (`Workspace.open(...)`, `accounts.create(...)`, `account.deriveWallets(...)`, `account.importPrivateKey(...)`). Network, Asset, and the transaction subclasses (`EvmTransaction`, `SvmTransaction`) are constructed directly.
- HD account mode (BIP-39 mnemonic, derives many wallets) and PK account mode (raw private keys, one wallet per import). Mix EVM and Solana wallets under a single PK account.
- Optional per-account password. Accounts created without their own password share the workspace password.
- 9 pre-loaded networks: ethereum, base, bnbchain, arbitrum, optimism, sepolia, solana, solana-testnet, solana-devnet.
- 23 pre-loaded tokens. Native gas tokens for every network. USDC and USDT on each EVM mainnet (BSC versions are 18-decimal Binance-Peg). WETH on ethereum. USDC, USDT, and WSOL on solana mainnet.
- `EvmTransaction` and `SvmTransaction` with a `TransactionTracker`. Subscribe to `change`, `confirmed`, and `failed` events via `tracker.on(...)`. Or await terminal states with `tracker.whenSubmitted()`, `tracker.whenMined()`, `tracker.whenConfirmed(blocks?)`, `tracker.whenFinalized()`.
- `Token2022Program` support alongside the legacy `TokenProgram`. Token-2022 extension instructions are out of scope.
- Workspace search via `workspace.filter(query, "Account" | "Wallet" | "Address" | "Asset")`.
- Custom storage backends: extend the `Provider` base class and pass an instance to `Workspace.open()`. The default `HybridProvider` writes encrypted files on local disk.
- Subpath imports `wative-core/artifacts/evm` and `wative-core/artifacts/svm` for heavier chain helpers.
- Both ESM and CJS builds, with TypeScript declaration files for IDE support.
- Workspace-scoped logger. Six levels (`trace` / `debug` / `info` / `warn` / `error` / `fatal`). Configuration persists with the workspace.

### Notes

- Requires Node.js 18.18+.
- Deno, Bun, and browser support is partial. Some compiled dependencies don't have universal builds yet.
- A few compiled dependencies lack pre-built binaries for Windows-ARM64 and Alpine-musl. macOS / Linux x64 / Linux ARM64 install cleanly.
- Opening the same workspace from two Node processes simultaneously isn't supported.

[2.0.1]: https://github.com/braady/wative-core/releases/tag/v2.0.1
