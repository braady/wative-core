# wative-core interop matrix — the library × function landscape

The whole ecosystem at a glance, with the canonical **wative-core** call in the first column — the one
you should use. This is the LARGE-context companion to the compact viem→wative mapping in `llms.txt`;
that minimal table is enough for a small-context agent, this one is for reasoning about the whole
landscape and wative-core's coverage.

> Web3.js / viem / ethers are EVM signing + RPC libraries; `@solana/web3.js` is the Solana equivalent.
> wative-core is a multi-chain key-custody + automation platform, so it covers a wider capability surface
> — the comparison below reflects real coverage, including the read-path gaps where wative-core is `—`.

## Capabilities at a glance

✓ = first-class · partial = possible but manual / multi-step · — = not provided · n/a = not applicable

| Capability | **wative-core** | Web3.js | viem | ethers | @solana/web3.js |
|---|:--:|:--:|:--:|:--:|:--:|
| One API across **EVM + SVM** | ✓ | — | — | — | — |
| EVM chains | ✓ | ✓ | ✓ | ✓ | — |
| Solana / SVM | ✓ | — | — | — | ✓ |
| Encrypted key custody + multi-workspace vault | ✓ | — | — | — | — |
| Storage-agnostic persistence (files / IndexedDB / DB / custom) | ✓ | — | — | — | — |
| HD cohort — N wallets from one mnemonic, fast switching | ✓ | — | partial | partial | manual |
| One-call transfer (intent → build → sign → send → track) | ✓ | — | — | — | — |
| ERC-20 / SPL transfer from one intent | ✓ | partial | partial | partial | partial |
| Auto gas / fee anti-pending autofill | ✓ | — | — | — | — |
| Destination-safety guard (burn / precompile / off-curve) | ✓ | — | — | — | — |
| Session-key fast unlock / resume | ✓ | — | — | — | — |
| Pluggable custom chains (subclass a dialect) | ✓ | — | — | — | — |
| Sign message / EIP-712 / raw digest | ✓ | ✓ | ✓ | ✓ | partial |
| Core reads (balance / nonce / receipt / gas / code) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Event logs / subscriptions / ENS | — | ✓ | ✓ | ✓ | n/a |

The single `—` row in the wative-core column is the honest read-path gap (see Gaps) — using another
library there is legitimate interop, not drift. Everything else is owned by wative-core.

## Function-level calls — EVM

How to read: a call in the wative-core column means **use it, do not re-implement it**. `—` = no
equivalent yet (interop is fine). "auto" = done for you inside `buildTransaction` / `send`.

| Operation | **wative-core** | Web3.js | viem | ethers |
|---|---|---|---|---|
| Wallet from mnemonic | `ws.accounts.create(name, pw, m)` → `acc.deriveWallets(N)` → `wallet.evm` | — (use ethers/hdkey) | `mnemonicToAccount(m)` | `Wallet.fromPhrase(m)` |
| Wallet from private key | `ws.accounts.create(name, pw, pk, undefined, { kind: "PK" })` → `wallet.evm` | `web3.eth.accounts.privateKeyToAccount(pk)` | `privateKeyToAccount(pk)` | `new Wallet(pk)` |
| Sign message | `wallet.evm.signMessage(msg)` | `web3.eth.accounts.sign(msg, pk)` | `walletClient.signMessage({ account, message })` | `wallet.signMessage(msg)` |
| Sign typed data (EIP-712) | `wallet.evm.signTypedData(typedData, chainId)` | rpc `eth_signTypedData_v4` | `walletClient.signTypedData({...})` | `wallet.signTypedData(domain, types, value)` |
| Sign raw 32-byte digest | `wallet.evm.signDigest(digest)` | `web3.eth.accounts.sign(...)` | `sign({ hash, privateKey })` | `new SigningKey(pk).sign(digest)` |
| Native transfer (send) | `wallet.evm.transfer({ to, amount })` | `web3.eth.sendTransaction({ from, to, value })` | `walletClient.sendTransaction({ to, value })` | `wallet.sendTransaction({ to, value })` |
| ERC-20 transfer | `wallet.evm.transfer({ to, amount, asset: { address } })` | `erc20.methods.transfer(to, amt).send({ from })` | `walletClient.writeContract({ ...'transfer' })` | `erc20.transfer(to, amt)` |
| Encode calldata | `new Contract(name, abi).encode(fn, args)` | `web3.eth.abi.encodeFunctionCall(item, args)` | `encodeFunctionData({ abi, functionName, args })` | `iface.encodeFunctionData(fn, args)` |
| Decode return data | `new Contract(name, abi).decode(fn, data)` (positional array) | `web3.eth.abi.decodeParameters(types, data)` | `decodeFunctionResult({ abi, functionName, data })` | `iface.decodeFunctionResult(fn, data)` |
| Read a view call (eth_call) | `new ChainClient(net).readContract({ address, abi, functionName, args })` → decoded (ints as bigint) | `contract.methods.fn().call()` | `publicClient.readContract({...})` | `contract.fn()` |
| Native balance | `new ChainClient(net).readBalance(owner)` | `web3.eth.getBalance(addr)` | `publicClient.getBalance({ address })` | `provider.getBalance(addr)` |
| ERC-20 balance | `new ChainClient(net).readBalance(owner, token)` | `erc20.methods.balanceOf(a).call()` | `publicClient.readContract({...balanceOf})` | `erc20.balanceOf(a)` |
| Nonce (tx count) | `new ChainClient(net).getTransactionCount(address)` | `web3.eth.getTransactionCount(addr)` | `publicClient.getTransactionCount({ address })` | `provider.getTransactionCount(addr)` |
| Gas price | `new ChainClient(net).getGasPrice()` | `web3.eth.getGasPrice()` | `publicClient.getGasPrice()` | `provider.getFeeData()` |
| Estimate gas / fees | auto (filled by `buildTransaction` / `send`) | `web3.eth.estimateGas(tx)` | `publicClient.estimateGas(tx)` | `provider.estimateGas(tx)` |
| Tx receipt / wait | `await …transfer(...).whenConfirmed()` · `ChainClient.getTransactionReceipt(h)` | `web3.eth.getTransactionReceipt(h)` | `publicClient.waitForTransactionReceipt({ hash })` | `tx.wait()` |
| Contract bytecode | `new ChainClient(net).getCode(address)` | `web3.eth.getCode(addr)` | `publicClient.getBytecode({ address })` | `provider.getCode(addr)` |
| Read event logs | — (roadmap) | `web3.eth.getPastLogs(filter)` | `publicClient.getLogs(filter)` | `provider.getLogs(filter)` |
| Subscribe (blocks/events) | — (roadmap) | `web3.eth.subscribe('newBlockHeaders')` | `publicClient.watchBlocks(...)` | `provider.on('block', cb)` |
| ENS resolve name | — (roadmap) | `web3.eth.ens.getAddress(name)` | `publicClient.getEnsAddress({ name })` | `provider.resolveName(name)` |

## Function-level calls — SVM (Solana)

Web3.js / viem / ethers do not cover SVM; the comparison is against `@solana/web3.js`.

| Operation | **wative-core** | `@solana/web3.js` (+ spl-token) |
|---|---|---|
| Keypair from mnemonic | `ws.accounts.create(name, pw, m)` → `acc.deriveWallets(N)` → `wallet.svm` | derive seed (ed25519-hdkey) → `Keypair.fromSeed` |
| Keypair from secret | `ws.accounts.create(name, pw, pk, undefined, { kind: "PK" })` → `wallet.svm` | `Keypair.fromSecretKey(bytes)` |
| Sign bytes | `wallet.svm.signBytes(bytes)` | `nacl.sign.detached(msg, sk)` |
| Native SOL transfer | `wallet.svm.transfer({ to, amount })` | `SystemProgram.transfer(...)` + `sendAndConfirmTransaction` |
| SPL transfer | `wallet.svm.transfer({ to, amount, asset: { address: mint } })` · or `buildTransaction({ recipient, amount, tokenMint })` | `spl-token` `createTransferInstruction(...)` + send |
| Arbitrary instructions | `wallet.svm.buildTransaction({ instructions })` (pass web3.js instructions straight in) | `new TransactionInstruction(...)` |
| Recent blockhash | auto (filled by `buildTransaction`) · `ChainClient.getRecentBlockhash()` | `connection.getLatestBlockhash()` |
| Account info | `new ChainClient(net).getAccountInfo(address)` | `connection.getAccountInfo(pk)` |
| Signature status | `ChainClient.getSignatureStatus(sig)` · `await …transfer(...).whenConfirmed()` | `connection.getSignatureStatuses([sig])` |
| SPL balance | `new ChainClient(net).readBalance(owner, mint)` | `getAccount` / `getTokenAccountBalance` |

## Gaps (the `—` rows) — roadmap, and where interop is legitimate

wative-core does not yet provide: **event-log reads** (`getLogs`), **block/event subscriptions**, **ENS**
resolve/lookup, `feeHistory`, and `getTransactionByHash`. Using
viem/ethers/web3 for exactly these is expected and correct — it is NOT reinventing a wative capability.
Everything else above is owned by wative-core, and re-implementing it with another library is the drift
this matrix exists to prevent.

<!-- wative:symbols
Workspace, Account, deriveWallets, Wallet, signMessage, signTypedData, signDigest, signBytes,
transfer, buildTransferPayload, buildTransaction, send, whenConfirmed, sendTransaction,
Contract, ChainClient, readContract, readBalance, getTransactionCount, getGasPrice, getCode, getTransactionReceipt,
getAccountInfo, getSignatureStatus, getRecentBlockhash, deserializeTx,
sealMnemonic, openMnemonic, Network, TransactionTracker
-->
