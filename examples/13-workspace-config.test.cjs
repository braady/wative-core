// 13 — Workspace config: business-wide settings without reaching for the Provider.

const test = require("node:test");
const assert = require("node:assert");
const { mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const { Workspace } = require("wative-core");

test("workspace config — setBusinessTimezone/getConfig work from release dist", async () => {
  const root = mkdtempSync(join(tmpdir(), "wative-config-"));
  const ws = await Workspace.open({ path: root, password: "wsp-pwd" });

  await ws.setBusinessTimezone("UTC");
  assert.deepStrictEqual(await ws.getConfig(), { businessTimezone: "UTC" });

  await ws.setBusinessTimezone("Etc/UTC");
  assert.deepStrictEqual(await ws.getConfig(), { businessTimezone: "Etc/UTC" });

  await assert.rejects(ws.setBusinessTimezone("Not/AZone"), (err) => (
    err.code === "PARAMETER_ERROR"
    && /INVALID_BUSINESS_TIMEZONE/.test(err.message)
    && !err.message.includes("Not/AZone")
  ));

  const snapshot = ws.config;
  assert.strictEqual(Object.isFrozen(snapshot), true);
  snapshot.settlementWindow = "ny-close";
  assert.strictEqual(snapshot.settlementWindow, undefined);

  await ws.setBusinessTimezone("America/New_York");
  assert.deepStrictEqual(await ws.getConfig(), { businessTimezone: "America/New_York" });

  assert.strictEqual(Object.prototype.hasOwnProperty.call(ws, "_provider"), false);
  assert.strictEqual("_provider" in ws, false);

  await ws.lock();
});
