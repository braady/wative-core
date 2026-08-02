// 12 — Logger. Workspace exposes `ws.logger` after unlock. Write structured
// logs at any level, change the level via `ws.logger.setLevel(...)`, and the
// configuration persists across reopen.

const test = require("node:test");
const assert = require("node:assert");
const { mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { Workspace } = require("wative-core");

test("logger — write at every level + change minLevel at runtime", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-logger-write-"));
  const ws = await Workspace.open({ path: root, password: "wsp-pwd" });

  ws.logger.trace("trace event", { phase: "init" });
  ws.logger.debug("debug event", { phase: "init" });
  ws.logger.info("info event", { phase: "init" });
  ws.logger.warn("warn event", { phase: "init" });
  ws.logger.error("error event", { phase: "init" });

  await ws.logger.setLevel("warn");
  assert.strictEqual(ws.logger.config.minLevel, "warn");

  ws.logger.warn("still works");
  ws.logger.info("filtered out below minLevel");

  await ws.lock();
});

test("logger — config persists across reopen", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-logger-persist-"));
  let ws = await Workspace.open({ path: root, password: "wsp-pwd" });

  await ws.logger.setLevel("error");
  assert.strictEqual(ws.logger.config.minLevel, "error");

  await ws.lock();
  ws = await Workspace.open({ path: root, password: "wsp-pwd" });
  assert.strictEqual(ws.logger.config.minLevel, "error");

  await ws.lock();
});
