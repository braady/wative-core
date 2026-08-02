# Changelog

All notable changes to `wative-core` are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.2.1] — 2026-07-29

Documentation and packaging only — the library code is identical to 2.2.0.

### Changed
- The runnable examples moved from `tests/` to `examples/`; update any path references.
- Clearer README: how Workspace, Account, Wallet and Address relate, and when to use a recovery-phrase account versus an imported-key one.

### Fixed
- One example failed when run from an installed copy.

## [2.2.0] — 2026-07-28

Runs in the browser now. Existing Node code keeps working unchanged.

### Added
- **Browser support.** The library works in a web app, keeping wallets in the browser's own storage. See the browser example in the Quick start.
- **Backup and restore.** Export a workspace as encrypted data and load it somewhere else. A workspace created in a browser opens on a desktop, and the other way round.
- **Writing your own storage is simpler.** A custom backend now needs six small methods; encryption and file layout are handled for you.

### Changed
- `HybridProvider` and `FileSink` are still available from the main import in Node. They also live at `wative-core/node`, which is where new code should get them.

### Please note
- Browsers can clear their own storage. Creating a **new** wallet in a browser is blocked unless the browser promises to keep the data, or you explicitly accept the risk — an existing wallet always opens. Give users a way to back up.
- A `Buffer` polyfill is needed in the browser. One line, shown in the Quick start.

## [2.1.0] — 2026-07-28

> **Browser groundwork.** This release removes every Node-builtin dependency from the crypto and EVM layers. `wative-core/artifacts/evm` and `wative-core/artifacts/svm` now bundle for the browser with **zero** unresolvable Node builtins; the main entry is down to four (`fs`, `fs/promises`, `os`, `path`), all belonging to the filesystem provider. **No public API changed** — this is a drop-in upgrade from 2.0.7.

### License
- **Relicensed to a Modified MIT License** (previously BUSL-1.1). The library is now free for any use, including commercial. The sole added condition: a product or service generating more than 50,000 USD in monthly revenue must prominently display "Wative" on its user interface. Measured per product, not per company. `package.json` declares `"license": "SEE LICENSE IN LICENSE"`, the npm convention for a non-standard licence.

### Changed
- **`web3` 1.7.3 and `ethereumjs-wallet` 1.0.2 replaced by `ethers` 6.** Both were used only for offline work — a provider-less `new Web3()` for the ABI codec and transaction/message signing, and `ethereumjs-wallet` solely for BIP-44 derivation. All RPC already went through `fetch`. web3's transitive tree (`web3-providers-http`/`ws`, `xhr2-cookies`, `readable-stream`, `cipher-base`, `ethereumjs-util`, `@ethereumjs/common`) pulled in `http`, `https`, `stream`, `events`, `url`, `assert` and `os`, which alone made the package impossible to bundle for a browser. web3 1.x is also end-of-life.
- **Crypto core moved from `node:crypto` to `@noble`.** AES-256-GCM now runs on `@noble/ciphers`; PBKDF2, HMAC and CSPRNG bytes on `@noble/hashes` (Argon2id already used `@noble/hashes`). Every primitive was verified byte-identical against `node:crypto` before the switch. **`Cipher.encrypt`/`decrypt` remain synchronous** — that is why `@noble` was chosen over WebCrypto, whose async-only `SubtleCrypto` would have forced the whole `Cipher` contract async and made this a breaking change.
- **`node:net.isIP` replaced by a pure-JS classifier**, differential-tested against `node:net.isIP` over ~600 valid, malformed and adversarial inputs.
- **Wire format, key derivation and on-disk layout are unchanged.** A workspace written by 2.0.7 opens under 2.1.0 with byte-identical results, and the production KDF parameters (PBKDF2 600 000 iterations; Argon2id t=3, m=64 MiB, p=1) are pinned by test.

### Fixed
- **EIP-712 with an empty `bytes` field no longer crashes.** web3's `keccak256("0x")` returned `null` and broke the signer; empty bytes now hash to the canonical empty-input digest, which is what EIP-712 specifies.
- **Intrinsic-gas validation preserved.** web3 rejected an under-funded `gasLimit` before signing and ethers does not, so the check is reimplemented — a transaction that can never execute is no longer signed and broadcast, burning the nonce.

### Notes for browser consumers
- `wative-core/artifacts/evm` and `wative-core/artifacts/svm` bundle cleanly today (the EVM artifact is ~128 KB min+gzip).
- A **`Buffer` polyfill is still required**, because `@solana/web3.js` and `@coral-xyz/anchor` depend on the global. This is standard for any Solana dapp.
- The main entry still requires the filesystem builtins listed above. Splitting the Node-only surface (`HybridProvider`, `FileSink`) behind a `wative-core/node` subpath, and adding an IndexedDB provider, is planned for 2.2.0.

### Internal
- `scripts/check-browser-bundle.mjs` bundles every published entry for `platform=browser` and ratchets the set of unresolvable Node builtins — failing both on a regression and on a stale baseline, so browser compatibility can only improve. Wired into `prepublishOnly`.
- Known-answer vectors (`tests/kat/`) pin exact bytes for HD derivation, EIP-191/712 signing, ed25519, the ABI codec, all three EVM transaction types, both KDFs and the envelope wire format; a committed v2.0.7 workspace fixture is opened on every run.

## [2.0.7] — 2026-07-21

> **Runtime requirement changed:** this release requires **Node.js 22.12+** (was 18.18+). See *Changed → Dependencies* below.

### Added
- **`Workspace.open()` options object.** `open()` now accepts `{ provider?, path?, password? }` alongside the existing positional form, so the default location no longer needs an `undefined` placeholder: `await Workspace.open({ password })`. Passing both `provider` and `path` is rejected.
- **Automatic create-vs-open with folder validation.** `open()` decides for itself: an existing workspace is opened, an empty or absent location is created, and a **non-empty location that is not a wative workspace is refused** — so a mistyped path can no longer write a workspace into unrelated files. Backed by a new overridable `Provider.inspectContainer()`; `HybridProvider` implements the filesystem check and the base class defaults to permissive, leaving custom providers unaffected.

### Changed
- **`create` parameter is deprecated and ignored.** The third positional argument to `open()` still type-checks so existing calls compile, but create-vs-open is now automatic. The former `"Workspace is not initialized. Pass create=true"` error is gone.
- **Dependencies.** `@solana/web3.js` 1.91.8 → **1.98.4**. The previous pin resolved `rpc-websockets@^7.11.0` to 7.11.2, which no longer ships the `dist/lib/client` entry that 1.91.8 deep-requires — leaving the published package unloadable under plain Node. 1.98.4 requires the package root instead. Its dependency chain reaches an ESM-only `uuid`, which is why the minimum Node version moves to **22.12** (the first release where `require()` of an ES module is supported).

### Fixed
- **Signing.** `signTypedData` rejects a malformed `domain.chainId` with `PARAMETER_ERROR` instead of leaking a raw `SyntaxError`.
- **Transactions.** EIP-1559 auto-fill clamps a defaulted priority fee to a user-supplied sub-gwei `maxFeePerGas` (previously produced an invalid tip-over-cap pair); receipt status is compared numerically so a non-canonical `0x01` is no longer misread as a revert; an auto-estimated `gasLimit` gets a 1.2x safety buffer.
- **Transaction tracker.** `abort()` now wakes pending `whenMined`/`whenConfirmed`/`whenFinalized` awaiters instead of hanging them forever; a failed send rejects those awaiters with the real cause rather than a misleading `TX_TIMEOUT`; `whenConfirmed(n)` with `n > 1` fails loudly instead of silently resolving at first inclusion.
- **Solana.** Anchor instruction accounts now take their signer/writable flags from the IDL instead of being forced to writable non-signer; `memo` is encoded as a real Memo-program instruction; `addressLookupTables` are rejected rather than silently dropped.
- **Workspace.** A network can no longer be dropped while a user-asset still references it, and the cross-queue race that could orphan an asset or an account's default network is closed.
- **Accounts & wallets.** A forced `kind: "HD"` now validates the mnemonic checksum at create time; wallet tag read-modify-write runs inside the account mutation queue; invisible Hangul filler characters are rejected in validated text; `formatUnits` no longer emits a misleading `"-0"`.

### Packaging
- `exports` carries per-condition `types`, so CJS TypeScript consumers resolve the `.d.cts` declarations.
- The `files` allowlist no longer ships the internal `tests/` directory, which had been leaking TypeScript sources into the tarball.

## [2.0.5] — 2026-05-04

### Added
- **`EvmTransaction.toRawTx()` and `SvmTransaction.toRawTx()`.** Hand-off accessors that return the lowest-level transaction representation each chain ecosystem already understands, so callers can route a wative-core transaction through any external signer / RPC client without re-deriving the inputs.
  - **`EvmTransaction.toRawTx(): EvmRawTx`** — synchronous. Returns a plain `{ from, to, value, data, type, chainId, nonce?, gasLimit?, gasPrice?, maxFeePerGas?, maxPriorityFeePerGas?, accessList? }` object matching the `web3.js` / `ethers` / `viem` `TransactionRequest` shape. Unset autofill fields are simply omitted, leaving the consumer's provider to fill them in. Does not sign or hit the network.
  - **`SvmTransaction.toRawTx(): Promise<unknown>`** — async. Returns the underlying `@solana/web3.js` `Transaction` instance with `instructions`, `feePayer`, and `recentBlockhash` populated. The build is cached, so repeated calls return the same instance and a subsequent `.sign()` reuses it.
  - **Build-requirement relaxation on the SVM side.** `SvmTransaction` no longer requires a bound `Address` purely to construct the underlying transaction object — if `recentBlockhash` is supplied at construction, `toRawTx()` builds entirely structurally. An Address is still required when blockhash needs to be fetched over RPC.
- **`EvmRawTx`** type exported from the package entry.

### Changed
- **Cross-OS IO hardening pass.** The `HybridProvider` file backend now applies the Windows `\\?\` long-path prefix when a resolved path crosses 240 chars, canonicalizes the workspace root via `fs.realpath` at unlock, and refuses to traverse symlinked ancestors at write time. Atomic-write temp files use a 64-bit random suffix (was 48-bit) and retry on `EEXIST`; orphan `*.tmp.<rand>` files older than 60 s are swept on first unlock. Directory `fsync` is gated to POSIX. The logger `chmod`s pre-existing log files to `0o600` after open so they don't inherit permissive bits from a prior run under a different `umask`.
- **`tweetnacl` is now loaded behind a lazy singleton.** Matches the existing `web3.js` / `bs58` lazy-load pattern; first call loads, subsequent calls reuse.
- **Per-process KDF cache HMAC secret is lazy-initialized.** No `crypto.randomBytes` call at module load time, removing one pre-condition for browser/Edge runtimes.

### Security
- **Passwords are normalized to NFC at the KDF boundary.** Clipboard managers and OS input methods occasionally hand back equivalent strings in different Unicode normalization forms; without normalization, a workspace sealed on one host would refuse to unlock on another. ASCII passwords are unaffected.
- **`TextDecoder` calls now use `{ fatal: true }`** in every record-payload, recovery-envelope, and decoded-bytes path. Malformed UTF-8 surfaces as `DECRYPT_FAILED` instead of silently substituting `U+FFFD`.
- **Account slug reserved-name lookup is case-insensitive.** Belt-and-suspenders over the slug regex (which already enforces lowercase output) — Windows resolves `CON`/`con`/`Con` to the same device, so reserved-name matching now follows the same rule explicitly.
- **Workspace path resolver throws clearly when no home is available.** Containers and jails without `HOME` / `USERPROFILE` previously fell through to a malformed path; now `Workspace.open()` surfaces a `PARAMETER_ERROR` directing the caller to set `WATIVE_WORKSPACE_PATH` or pass an explicit path.
- **`ENAMETOOLONG` on the on-disk path now returns `PROVIDER_IO`** with an actionable "relocate workspace closer to root" message, distinguishing OS-limit overflow from invalid input (slug length is already capped by the validator).

## [2.0.3] — 2026-05-04

### Changed
- **Default workspace path renamed** from `<cwd>/.wative` to `<cwd>/.wative2`. Existing on-disk workspaces under `.wative/` are not migrated automatically — pass the old path explicitly to `Workspace.open()` if you want to keep using one, or rename the directory.
- **`Workspace.open()` no-arg path now resolves through a 3-tier strategy:**
  1. `WATIVE_WORKSPACE_PATH` env var (if set & non-empty) — wins unconditionally. `~` is expanded.
  2. `<process.cwd()>/.wative2` — used when the env var is unset and the directory already exists on disk. Symlinks at this path are refused (fall through to home) to defend against attacker-controlled redirection on shared/multi-user systems.
  3. `<os.homedir()>/.wative2` — last-resort fallback. Where `create=true` lands on a fresh machine when no env var is set and there's no project-local `.wative2/`.

  Calls that pass an explicit path or `Provider` instance are unaffected — those short-circuit before any resolution.

### Security
- **Envelope v2 — Argon2id + AAD-bound on-disk records.** New seals use Argon2id (RFC 9106; t=3, m=64 MiB, p=1) and bind every record's GCM tag to its on-disk identity. HybridProvider records bind to `wative:v2:record:<recordType>:<slug>`; per-account mnemonic ciphertexts bind to `wative:v2:account:<slug>:mnemonic`; per-address private-key ciphertexts bind to `wative:v2:account:<slug>:wallet:<id>:<vm>:pk`; recovery envelopes bind to `wative:v2:recovery:account:<slug>`. Closes the blob-swap class of attack where an attacker with workspace-dir write access (but not the password) could substitute one record's ciphertext for another's. Legacy v1 records (PBKDF2-SHA256, no AAD) continue to read; new writes are always v2.
- **Slug-collision suffix now CSPRNG.** Was `Math.random()`; now `crypto.randomInt`. Prevents predictable filenames in `accounts/<slug>-<suffix>.db`.
- **`#seed` Buffer scrubbed before drop.** `Account.lock()` now `.fill(0)`s the BIP-39 seed Buffer before nulling the reference. JS string immutability still prevents perfect zeroization of mnemonic + plaintext private keys (documented on `Workspace.lock()`).
- **`useTestKdfIterations` Jest auto-detect removed.** The `typeof globalThis.expect !== "undefined"` opt-in arm fired in any downstream consumer using Jest, not just our own test process. Now requires explicit `WATIVE_ALLOW_TEST_KDF=1` (or `NODE_ENV=test`). Internal-only function; not on the package surface.

## [2.0.1] — 2026-04-29

First release of the v2 line.

### Added
- Seven domain classes — `Workspace`, `Account`, `Wallet`, `Address`, `Network`, `Asset`, `Transaction`. `Network`, `Asset`, `EvmTransaction`, and `SvmTransaction` accept both positional and object-form constructor arguments.
- HD (BIP-39 mnemonic) and PK (raw private key) account modes. Per-account or workspace-shared password.
- `EvmTransaction` and `SvmTransaction` with `TransactionTracker` lifecycle events (`change` / `confirmed` / `failed`) and lifecycle promises (`whenSubmitted` / `whenMined` / `whenConfirmed(blocks?)` / `whenFinalized`).
- 9 pre-loaded networks: ethereum, base, bnbchain, arbitrum, optimism, sepolia, solana, solana-testnet, solana-devnet.
- 23 pre-loaded tokens: native gas tokens for every network plus USDC and USDT on each EVM mainnet (BSC versions are 18-decimal Binance-Peg), WETH on ethereum, and USDC, USDT, WSOL on solana mainnet.
- Custom storage backends — third parties can extend the `Provider` base class and pass an instance to `Workspace.open()`. Default implementation is `HybridProvider` (encrypted files on local disk).
- Subpath imports `wative-core/artifacts/evm` and `wative-core/artifacts/svm` for heavier chain helpers.
- Both ESM and CJS builds with full TypeScript declaration files.
- `Token2022Program` support alongside the legacy SPL `TokenProgram` (extension instructions are out of scope).
- Workspace search via `workspace.filter("Account" | "Wallet" | "Address" | "Asset", query)`.

### Security
- Built-in networks and tokens cannot be dropped from the workspace (they would orphan accounts that reference them by default).
- Concurrent `addAsset` / `dropAsset` and network-collection mutations are serialized — no duplicate ids or slugs from interleaved calls.
- Hydrate-time guards reject corrupted records (duplicate asset ids or network slugs) at workspace open.

### Notes
- Requires Node.js 18.18+. The crypto and address-encoding paths are pure-JS via `@noble/hashes`, `@noble/curves`, and `bs58` — no native gyp build is needed for installation. Some chain helpers (`web3@1.7.x`, `@solana/web3.js`) and a few transitive deps (`ethereumjs-wallet`, `tweetnacl`) currently target Node and are loaded lazily on first use; full Deno / Bun / browser support is partial pending those upgrades.
- Source maps are not published. The npm package contains only compiled JavaScript and TypeScript declaration files. TypeScript source lives in a separate private repository.

[2.0.7]: https://github.com/braady/wative-core/releases/tag/v2.0.7
[2.0.3]: https://github.com/braady/wative-core/releases/tag/v2.0.3
[2.0.1]: https://github.com/braady/wative-core/releases/tag/v2.0.1
