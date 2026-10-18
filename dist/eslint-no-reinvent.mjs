// wative-core — ESLint flat-config fragment that keeps a consumer's coding agent
// on the wative-core API. Bans ONLY the custody / signing / key-derivation surface
// wative-core owns; read clients and instruction-building stay allowed. Import and
// spread it into your eslint.config.js:
//
//   import wative from "./.wative/eslint-no-reinvent.mjs";
//   export default [ ...wative /*, ...your config */ ];
//
// Shipped by `npx wative-core init-agent`.

export default [
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "ethers",
              importNames: ["Wallet", "HDNodeWallet", "SigningKey", "Mnemonic", "Transaction"],
              message:
                "wative-core owns key custody + signing + tx building. Use wallet.evm/.svm (signTypedData / signMessage / buildTransferPayload / buildTransaction(...).send()). Index: wative-core/dist/llms.txt",
            },
            {
              name: "viem/accounts",
              importNames: ["privateKeyToAccount", "mnemonicToAccount", "hdKeyToAccount", "generatePrivateKey", "mnemonicToSeed"],
              message:
                "Don't create/hold signing accounts yourself. Keys live in the Workspace; use wallet.evm / wallet.svm. Reads via a viem public client are fine.",
            },
            {
              name: "@solana/web3.js",
              importNames: ["Keypair"],
              message:
                "Don't derive/hold Solana keys yourself — use wallet.svm. Building instructions with @solana/web3.js is fine: pass them to buildTransaction({ instructions }).",
            },
          ],
          patterns: [
            {
              group: ["@noble/secp256k1", "@noble/curves/secp256k1", "@noble/ed25519", "@scure/bip32", "@scure/bip39", "bip39", "micro-ed25519-hdkey", "elliptic", "tweetnacl"],
              message:
                "Raw signing / key-derivation primitives are wative-core's job. Use wallet.evm/.svm signing and account.deriveWallets(). Index: wative-core/dist/llms.txt",
            },
          ],
        },
      ],
    },
  },
];
