// 23 — Decoded EVM view calls: new ChainClient(network).readContract({ address, abi, functionName, args }) does eth_call + ABI-decode in one keyless call, integers back as native bigint. The eth_call transport is mocked, so this runs fully offline.

const test = require("node:test");
const assert = require("node:assert");

const { ChainClient, Network, WativeError } = require("wative-core");

// Minimal ERC-20 read ABI — the JSON-ABI object form readContract decodes against.
const ERC20_READ_ABI = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
];

// A real mainnet token address — used only as the call target; nothing is sent.
const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const HOLDER = "0x0000000000000000000000000000000000001234";

// ---- offline eth_call encoding helpers (what an honest node would answer) ----

/** A uint of any width, left-padded to one 32-byte ABI word. */
function abiUint(value) {
  return value.toString(16).padStart(64, "0");
}

/** A dynamic `string` return: head offset (0x20), byte length, then the right-padded bytes. */
function abiString(text) {
  const bytes = Buffer.from(text, "utf8");
  const len = abiUint(BigInt(bytes.length));
  const body = bytes.toString("hex").padEnd(Math.ceil(bytes.length / 32) * 64, "0");
  return abiUint(32n) + len + body;
}

// Canonical ERC-20 4-byte selectors, so the mock answers the right function.
const RETURNS = {
  "0x313ce567": "0x" + abiUint(6n), // decimals() -> 6
  "0x95d89b41": "0x" + abiString("USDC"), // symbol() -> "USDC"
  "0x70a08231": "0x" + abiUint(250000000n), // balanceOf(owner) -> 250.000000 USDC (6 decimals)
};

/** Install a global fetch that answers eth_call from the table above and rejects everything else, then restore it; the JSON-RPC client echoes an incrementing id, so the reply must carry the request's own id. */
async function withMockedEthCall(returns, run) {
  const realFetch = global.fetch;
  global.fetch = async (_input, init) => {
    const req = JSON.parse(init.body);
    let result;
    if (req.method === "eth_call") {
      const selector = String(req.params[0].data).slice(0, 10);
      if (!(selector in returns)) throw new Error(`unexpected eth_call selector ${selector}`);
      result = returns[selector];
    } else {
      throw new Error(`unexpected RPC method ${req.method}`);
    }
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: req.id, result }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    return await run();
  } finally {
    global.fetch = realFetch;
  }
}

test("readContract — decimals() decodes a uint8 to a bigint", async () => {
  await withMockedEthCall(RETURNS, async () => {
    const client = new ChainClient(Network.Ethereum);
    const decimals = await client.readContract({ address: USDC, abi: ERC20_READ_ABI, functionName: "decimals" });
    assert.strictEqual(decimals, 6n);
    assert.strictEqual(typeof decimals, "bigint"); // integers come back as bigint, never a string
  });
});

test("readContract — symbol() decodes a dynamic string", async () => {
  await withMockedEthCall(RETURNS, async () => {
    const client = new ChainClient(Network.Ethereum);
    const symbol = await client.readContract({ address: USDC, abi: ERC20_READ_ABI, functionName: "symbol" });
    assert.strictEqual(symbol, "USDC");
  });
});

test("readContract — balanceOf(owner) encodes the arg and decodes a uint256 bigint", async () => {
  await withMockedEthCall(RETURNS, async () => {
    const client = new ChainClient(Network.Ethereum);
    const balance = await client.readContract({
      address: USDC,
      abi: ERC20_READ_ABI,
      functionName: "balanceOf",
      args: [HOLDER],
    });
    assert.strictEqual(balance, 250000000n);
    assert.strictEqual(typeof balance, "bigint");
  });
});

test("readContract — a call that returns no data is a PROVIDER_IO error", async () => {
  await withMockedEthCall({ "0x313ce567": "0x" }, async () => { // "0x" = revert / no contract code / ABI mismatch
    const client = new ChainClient(Network.Ethereum);
    await assert.rejects(
      client.readContract({ address: USDC, abi: ERC20_READ_ABI, functionName: "decimals" }),
      (err) => err instanceof WativeError && err.code === "PROVIDER_IO",
    );
  });
});

test("readContract — SVM is unsupported (EVM-only)", () => {
  const client = new ChainClient(Network.Solana);
  assert.throws(
    () => client.readContract({ address: USDC, abi: ERC20_READ_ABI, functionName: "decimals" }),
    (err) => err instanceof WativeError && err.code === "UNSUPPORTED_OP",
  );
});
