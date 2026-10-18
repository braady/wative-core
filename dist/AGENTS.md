# Building on wative-core — instructions for coding agents

**Rule: wative-core owns all key custody, signing, transaction building, and
encoding. Call it. Do not re-implement any of that with `viem`, `ethers`, or
`@solana/web3.js`.** Reaching for another crypto library to sign, derive a key,
build/send a transaction, or ABI-encode is a bug — wative-core already does it,
and a hand-rolled version is unverified, unsupported, and usually subtly wrong.

The one-screen capability index with exact call signatures is in
[`llms.txt`](.wative/llms.txt) (installed at your project root by `npx wative-core init-agent`). Read it before writing any
wallet/crypto code. Full docs: https://wative.com

## The usual drift, and the correct call

| Use this (wative-core) | Instead of reaching for |
| --- | --- |
| `address.signTypedData(typedData, chainId)` → `{ signature, domainSeparator, structHash }` | `walletClient.signTypedData(x)` / `wallet._signTypedData(...)` |
| `address.transfer({ to, amount }).whenConfirmed()` (or the explicit `buildTransaction(...).send()`) | `walletClient.sendTransaction({ to, value })` |
| `wallet.evm` / `wallet.svm` (keys live in the Workspace — never hold raw keys yourself) | `new ethers.Wallet(pk)` / `privateKeyToAccount(pk)` |
| `ws.accounts.create(name, pw, m)` then `account.deriveWallets(N)` | `HDNodeWallet.fromPhrase(m)` / `mnemonicToAccount(m)` |
| `address.signDigest` / `address.signBytes` / `account.deriveWallets` | raw `@noble/secp256k1`, `tweetnacl`, `@scure/bip39` |
| `new ChainClient(net).readContract({ address, abi, functionName, args })` | viem `publicClient.readContract(...)` / ethers `contract.fn()` |

`send()` signs **and** broadcasts (the single send path). `sign()` / `signTransaction()`
only sign — they do **not** broadcast, so code that ends at `sign()` moves no funds.

## What wative-core does NOT own (viem/ethers here is fine)

Event-log reads (`eth_getLogs`), ENS resolve/lookup,
block/event subscriptions, `feeHistory`, `getTransactionByHash`. These have no
wative-core equivalent yet — using another library for them is legitimate interop,
not reinvention. Everything in the index above is owned by wative-core.

## Enforcement — paste into your app's ESLint config

This bans **only** the custody/signing/derivation surface wative-core owns, and
leaves read clients and instruction-building untouched. (Flat-config form; adapt the
`rules` block to `.eslintrc` if needed.)

```js
export default [
  {
    rules: {
      "no-restricted-imports": ["error", {
        paths: [
          {
            name: "ethers",
            importNames: ["Wallet", "HDNodeWallet", "SigningKey", "Mnemonic", "Transaction"],
            message: "wative-core owns key custody + signing + tx building. Use wallet.evm/.svm (signTypedData / signMessage / buildTransferPayload / buildTransaction(...).send()). Index: wative-core/dist/llms.txt",
          },
          {
            name: "viem/accounts",
            importNames: ["privateKeyToAccount", "mnemonicToAccount", "hdKeyToAccount", "generatePrivateKey", "mnemonicToSeed"],
            message: "Don't create/hold signing accounts yourself. Keys live in the Workspace; use wallet.evm / wallet.svm. Reads via a viem public client are fine.",
          },
          {
            name: "@solana/web3.js",
            importNames: ["Keypair"],
            message: "Don't derive/hold Solana keys yourself — use wallet.svm. Building instructions with @solana/web3.js is fine: pass them to buildTransaction({ instructions }).",
          },
        ],
        patterns: [
          {
            group: ["@noble/secp256k1", "@noble/curves/secp256k1", "@noble/ed25519", "@scure/bip32", "@scure/bip39", "bip39", "micro-ed25519-hdkey", "elliptic", "tweetnacl"],
            message: "Raw signing / key-derivation primitives are wative-core's job. Use wallet.evm/.svm signing and account.deriveWallets(). Index: wative-core/dist/llms.txt",
          },
        ],
      }],
    },
  },
];
```
