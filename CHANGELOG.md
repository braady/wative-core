# Changelog

All notable changes to `wative-core` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.4] — 2026-05-04

### Changed
- Better cross-platform reliability. Long workspace paths on Windows (over 240 characters) now work without manual prefixing. Workspaces with symlinked roots are resolved to their real paths at unlock; symlinked ancestors are refused on writes, defending against a class of redirection attacks on shared and multi-user systems.
- Cleaner crash recovery. Stale `.tmp.*` files left behind by a previous crash are swept on the next `Workspace.open()`.

### Security
- Passwords are now normalized at the encryption boundary. ASCII passwords are unaffected; non-ASCII passwords now round-trip cleanly across hosts that disagree on Unicode normalization (a copy-paste manager auto-converting between sessions, for instance).
- Strict UTF-8 decoding on encrypted record payloads. Tampered or corrupt records now fail loudly with a clear error instead of silently substituting replacement characters.
- Account slug reserved-name lookup is case-insensitive. Reinforces existing protection against Windows device-name collisions (`CON`, `PRN`, `AUX`, etc.).
- Workspace path resolver throws a clear error when no home directory is available. Containers and jails without `HOME` / `USERPROFILE` previously fell through silently.

## [2.0.3] — 2026-05-04

### Changed
- **Default workspace directory renamed** from `<cwd>/.wative` to `<cwd>/.wative2`. Existing workspaces under `.wative/` are not migrated automatically — pass the old path explicitly to `Workspace.open()` if you want to keep using one, or rename the folder.
- **`Workspace.open()` no-arg path now resolves through a 3-tier strategy:**
  1. `WATIVE_WORKSPACE_PATH` env var (if set & non-empty) — wins unconditionally. `~` is expanded.
  2. `<process.cwd()>/.wative2` — used when the env var is unset and the directory already exists on disk. Symlinked paths are refused at this tier (fall through to home) to defend against attacker-controlled redirection on shared/multi-user systems.
  3. `<os.homedir()>/.wative2` — last-resort fallback. Where `create=true` lands on a fresh machine when no env var is set and there's no project-local `.wative2/`.

  Calls that pass an explicit path or `Provider` instance are unaffected — those short-circuit before any resolution.

### Security
- **Stronger encryption envelope (v2): Argon2id + identity-bound auth tags.** Workspace records, per-account mnemonics, per-address private keys, and recovery envelopes are now sealed with Argon2id (RFC 9106; t=3, m=64 MiB, p=1) and bind their AES-GCM auth tag to the record's on-disk identity. This closes a class of attack where someone with file-level write access to the workspace folder (but not the password) could swap encrypted blobs between records — the auth tag now fails on any swap. Reading older v1 workspaces (PBKDF2-SHA256, no AAD) still works; new writes always use v2. No consumer code changes required.
- **CSPRNG slug suffix.** Account slug-collision suffix now sourced from `crypto.randomInt`, not `Math.random`. Prevents predictable filenames in `accounts/<slug>-<suffix>.db`.
- **In-memory secret hygiene.** `Account.lock()` zeroes the BIP-39 seed Buffer before dropping the reference. JS string immutability still prevents perfect zeroization of mnemonics + plaintext private keys; documented on `Workspace.lock()` — for forensic-grade hygiene, restart the host process after lock.

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

- Requires Node.js 18.18+. The crypto and address-encoding paths are pure-JS via `@noble/hashes`, `@noble/curves`, and `bs58` — no native gyp build is needed for installation, so macOS, Linux x64, Linux ARM64, Linux musl, and Windows (incl. ARM64) install cleanly.
- Some chain helpers (`web3@1.7.x`, `@solana/web3.js`) and a few transitive deps (`ethereumjs-wallet`, `tweetnacl`) currently target Node and are loaded lazily on first use. Full Deno / Bun / browser support is partial pending those upgrades.
- Source maps are not published. The npm package contains compiled JavaScript and TypeScript declaration files only; TypeScript source lives in a separate private repository.
- Opening the same workspace from two Node processes simultaneously isn't supported.

[2.0.3]: https://github.com/braady/wative-core/releases/tag/v2.0.3
[2.0.1]: https://github.com/braady/wative-core/releases/tag/v2.0.1
