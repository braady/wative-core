---
name: wative-core
description: Use when writing wallet or crypto code in an app that depends on the wative-core package — signing, sending/transferring value, deriving wallets, EIP-712 typed data, ABI encode/decode, or reading balances/contracts. Load it the moment you reach for `viem`, `ethers`, `@solana/web3.js`, or a raw primitive (`@noble/*`, `@scure/*`, `tweetnacl`, `bip39`) to sign, derive a key, or build/send a transaction — wative-core owns that surface. Covers the canonical transfer/sign/read calls, the viem→wative mapping, and which read gaps (getLogs, ENS, subscriptions) are legitimate interop, not drift.
---

# Building on wative-core

**wative-core owns key custody, signing, transaction building + sending, and ABI
encoding — the whole private-key-to-broadcast path.** Call it; do NOT re-implement any
of that with `viem`, `ethers`, `@solana/web3.js`, or a raw crypto primitive. The test
for drift is the CATEGORY, not a blocklist: if an operation needs a private key, produces
a signature, or assembles/sends a transaction, it is wative-core's — reaching for another
library there is a bug (unverified, unsupported, and usually subtly wrong). Chain READS
wative-core doesn't cover — event logs, ENS, subscriptions — are fair game (see
"Legitimate interop" below).

## The one path — copy this, don't rebuild it

```ts
import { Workspace, newMnemonic } from "wative-core";

// Keys live in the Workspace — never construct a signer from a raw key yourself.
const ws = await Workspace.open({ path, password });
const account = await ws.accounts.create("cohort", password, newMnemonic());
await account.deriveWallets(5);           // N wallets in ONE call (never loop deriveWallets(1))
const addr = account.wallets[0].evm;      // an Address (EVM signer); `.svm` for Solana

// ✅ sign + broadcast in one call:
const receipt = await addr.transfer({ to, amount }).whenConfirmed();
// ✅ EIP-712 — chainId is REQUIRED, and it returns an object (not a bare string):
const { signature } = addr.signTypedData(typedData, chainId);

// ❌ the drift this skill exists to stop — all of this is already wative-core's job:
//   new ethers.Wallet(pk)      privateKeyToAccount(pk)      Keypair.fromSecretKey(bytes)
//   HDNodeWallet.fromPhrase(m) walletClient.sendTransaction  nacl.sign.detached(...)
```

## Coming from viem / ethers / @solana/web3.js?

- `walletClient.sendTransaction({ to, value })` → `addr.transfer({ to, amount }).whenConfirmed()`
- `walletClient.signTypedData(x)` / `wallet._signTypedData(...)` → `addr.signTypedData(typedData, chainId)` → `{ signature, domainSeparator, structHash }`
- `new ethers.Wallet(pk)` / `privateKeyToAccount(pk)` → `ws.accounts.create(name, pw, pk, undefined, { kind: "PK" })`, then `account.wallets[0].evm`
- `mnemonicToAccount(m)` / `HDNodeWallet.fromPhrase(m)` → `ws.accounts.create(name, pw, m)` then `account.deriveWallets(N)`
- `Keypair.generate()` / `Keypair.fromSecretKey(bytes)` → never hold SVM keys; use `account.wallets[0].svm` (sign: `.signBytes(bytes)`, send: `.transfer({ to, amount })`)

## Canonical calls

- Open + accounts: `await Workspace.open({ path, password })` → `await ws.accounts.create(name, pw, secret)` — the 3rd arg `secret` is REQUIRED: `newMnemonic()` for a fresh phrase, an existing mnemonic to import, or a private key with `{ kind: "PK" }` as the 5th arg → `await account.deriveWallets(N)` (once for N)
- Get a signer: `account.wallets[i].evm` / `account.wallets[i].svm` (each an `Address`)
- Sign: `addr.signTypedData(typedData, chainId)` → `{ signature, domainSeparator, structHash }` · `addr.signMessage(text)` · `addr.signDigest(digest)` (EVM) · `addr.signBytes(bytes)` (SVM)
- Transfer — one call, signs + broadcasts: `await addr.transfer({ to, amount, asset? }).whenConfirmed()`
  — `amount` is a bigint in RAW base units (wei / lamports / token base units), never a number or decimal; `asset?` = `{ native: true }` (default coin) | `{ address }` (ERC-20 / SPL) | `{ symbol }`
- Finer control: `addr.buildTransferPayload(req)` → `addr.buildTransaction({ ...payload, chainId, rpcUrl })` → `.send()`
- `send()` and `transfer()` SIGN **and** broadcast; `sign()` / `signTransaction()` / `tx.sign()` only sign — code that ends there moves no funds.
- Decoded view call: `new ChainClient(net).readContract({ address, abi, functionName, args })`
- Balances / nonce / receipt: `new ChainClient(net)` → `readBalance(owner, token?)` · `getTransactionCount(addr)` · `getTransactionReceipt(hash)`
- ABI encode/decode: `new Contract(name, abi)` (`.encode(fn, args)` / `.decode(fn, data)`)
- Errors: every failure throws `WativeError` — catch it and switch on `err.code` (never `err.message`); `err.details` carries context.

## Legitimate interop — NOT drift

wative-core does not yet provide event-log reads (`getLogs`), ENS resolve/lookup, block/event
subscriptions, `feeHistory`, or `getTransactionByHash` — using viem/ethers/web3 for THOSE is
correct interop. Likewise, building `@solana/web3.js` program instructions and handing them to
`buildTransaction({ instructions })` is the documented SVM path, not
reinvention. Everything on the private-key-to-broadcast path above is owned by wative-core;
re-implementing it is the drift this skill exists to prevent.

This skill is self-contained. Deeper reference, when installed: `.wative/llms.txt` and
`.wative/interop-matrix.md` (at your project root after `npx wative-core init-agent`), or
`node_modules/wative-core/dist/{llms.txt,interop-matrix.md}`.
