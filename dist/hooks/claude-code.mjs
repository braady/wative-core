#!/usr/bin/env node
// Claude Code PreToolUse adapter — registered for the Write|Edit tools. Reads the
// pending tool call on stdin; if the content about to be written introduces a banned
// crypto-primitive import, it writes the remediation to stderr and exits 2, which
// Claude Code treats as a block (feeding the message back to the model). Escape hatch:
// a `// wative-allow: <reason>` on, or just above, the offending import line.
//
// FAIL-OPEN on infra errors (kit not installed, unreadable input): a hook bug must
// never brick every write in a consumer's repo. The ESLint rule + CI are the hard,
// tamper-proof floor; this hook is the real-time, in-agent speed-bump on top.
//
// Installed by `npx wative-core init-agent` to .claude/hooks/no-reinvent.mjs, beside a
// copy of no-reinvent-core.mjs, and registered in .claude/settings.json.

import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { findBannedConfig, loadBannedSet, scanText, remediation } from "./no-reinvent-core.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

try {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const tool = input.tool_name;
  const ti = input.tool_input ?? {};
  const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || HERE;
  const configPath = findBannedConfig(root) || findBannedConfig(HERE);
  if (!configPath) process.exit(0); // kit not installed here → don't block; eslint/CI covers it
  const banned = await loadBannedSet(configPath);

  let hit = null;
  if (tool === "Write") {
    hit = scanText(ti.content ?? "", banned);
  } else if (tool === "Edit") {
    const added = scanText(ti.new_string ?? "", banned);
    if (added) {
      // Only block a NEWLY introduced banned import, not one already present pre-edit.
      const pre = scanText(ti.old_string ?? "", banned);
      if (!pre || pre.module !== added.module || pre.name !== added.name) hit = added;
    }
  } else {
    process.exit(0);
  }

  if (hit) {
    process.stderr.write(`wative-core: ${remediation(hit)}\n`);
    process.exit(2);
  }
  process.exit(0);
} catch (err) {
  process.stderr.write(`wative-core hook: skipped (${err?.message ?? err}); eslint/CI still enforces.\n`);
  process.exit(0);
}
