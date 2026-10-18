#!/usr/bin/env node
// Codex CLI PreToolUse adapter. Codex applies file edits through `apply_patch`; this
// scans the ADDED lines of the patch for a banned crypto-primitive import and blocks
// via exit 2 (reason on stderr) — the mechanism Codex documents alongside its JSON
// `permissionDecision: "deny"`. Same shared detector + `// wative-allow` escape as the
// other adapters.
//
// ⚠️ Codex hooks are a RECENT feature. Confirm your Codex build exposes them (a
// `/hooks` command, or `[features] hooks` in config) — if it predates the feature this
// never fires, and AGENTS.md + the ESLint/CI gate carry the load. The `tool_input`
// shape for apply_patch can vary across builds, so this reads defensively.
//
// FAIL-OPEN on infra errors, like the other adapters: never brick a write on our bug.
// Installed by `npx wative-core init-agent` to .codex/hooks/no-reinvent.mjs beside a
// copy of no-reinvent-core.mjs, and registered in .codex/hooks.json.

import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { findBannedConfig, loadBannedSet, scanText, remediation } from "./no-reinvent-core.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

try {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const ti = input.tool_input ?? input.toolInput ?? {};
  const root = process.env.CODEX_PROJECT_DIR || input.cwd || HERE;
  const configPath = findBannedConfig(root) || findBannedConfig(HERE);
  if (!configPath) process.exit(0);
  const banned = await loadBannedSet(configPath);

  // Pull whatever patch / content text the tool call carries (shape varies by build).
  const blob =
    [ti.patch, ti.input, ti.content, ti.command, typeof ti === "string" ? ti : ""]
      .filter((x) => typeof x === "string" && x)
      .join("\n") || JSON.stringify(ti);
  // An apply_patch body marks new content with leading `+` (but `+++` is a file header);
  // scan only the added lines. If it isn't a patch, scan the whole blob.
  const added = blob
    .split("\n")
    .filter((l) => /^\+(?!\+\+)/.test(l))
    .map((l) => l.slice(1))
    .join("\n");
  const target = added || blob;

  const hit = scanText(target, banned);
  if (hit) {
    process.stderr.write(`wative-core: ${remediation(hit)}\n`);
    process.exit(2);
  }
  process.exit(0);
} catch (err) {
  process.stderr.write(`wative-core hook: skipped (${err?.message ?? err}); eslint/CI still enforces.\n`);
  process.exit(0);
}
