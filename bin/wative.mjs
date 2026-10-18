#!/usr/bin/env node
// `npx wative-core init-agent` — install wative-core's coding-agent kit into the
// consumer repo so an agent stays on the wative-core API instead of drifting to
// viem / ethers / @solana/web3.js over a long session. Flags:
//   --check   fail (exit 1) if the installed kit is stale vs the installed
//             wative-core version — for CI.
//   --force   also overwrite a customized AGENTS.md on a re-run.
//
// The kit splits into KIT-MANAGED files (.wative/*, the skill, the hooks — always
// refreshed on a re-run) and the DEV-OWNED AGENTS.md (written once; a re-run keeps
// your edits unless --force). This file ships at <package>/bin/wative.mjs, so the
// package's assets are in ../dist.

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(HERE, "..", "dist");
const CWD = process.cwd();
const argv = process.argv.slice(2);
const cmd = argv[0];
const FORCE = argv.includes("--force");
const CHECK = argv.includes("--check");

function fail(msg) {
  console.error(`wative: ${msg}`);
  process.exit(1);
}

if (cmd !== "init-agent") {
  const code = cmd ? 1 : 0;
  (code ? console.error : console.log)("wative-core — usage: npx wative-core init-agent [--check] [--force]");
  process.exit(code);
}

// The installed wative-core version — stamped into the kit and compared by --check.
function pkgVersion() {
  try {
    return JSON.parse(readFileSync(resolve(HERE, "..", "package.json"), "utf8")).version || "unknown";
  } catch {
    return "unknown";
  }
}

const dot = join(CWD, ".wative");
const stampPath = join(dot, ".version");

// --- init-agent --check : CI-friendly staleness detection --------------------
if (CHECK) {
  if (!existsSync(stampPath)) {
    console.error("wative-core: no kit found (.wative/.version missing) — run `npx wative-core init-agent`.");
    process.exit(1);
  }
  const stamped = readFileSync(stampPath, "utf8").trim();
  const installed = pkgVersion();
  if (stamped !== installed) {
    console.error(
      `wative-core: kit is STALE — generated from ${stamped}, installed is ${installed}. ` +
        "Re-run `npx wative-core init-agent` to refresh it.",
    );
    process.exit(1);
  }
  console.log(`wative-core: kit is current (${installed}).`);
  process.exit(0);
}

function fromDist(name) {
  const p = join(DIST, name);
  if (!existsSync(p)) fail(`init-agent: '${name}' is missing from the installed package (dist/). Reinstall wative-core.`);
  return p;
}

// Install a hook adapter plus a copy of the shared detector core into `dir`. The
// adapter imports `./no-reinvent-core.mjs` as a sibling, so the pair is self-contained.
function installHook(dir, adapterDistName) {
  mkdirSync(dir, { recursive: true });
  cpSync(fromDist("hooks/no-reinvent-core.mjs"), join(dir, "no-reinvent-core.mjs"), { force: true });
  cpSync(fromDist(adapterDistName), join(dir, "no-reinvent.mjs"), { force: true });
}

// Idempotently register the Claude Code PreToolUse hook in .claude/settings.json:
// create if absent, append our entry only if not already present, never touch other
// hooks. No onFailure:block — the hook fails OPEN by design (a hook bug must not brick
// every write; the ESLint + CI gate is the hard floor).
function registerClaudeHook() {
  const settingsPath = join(CWD, ".claude", "settings.json");
  const existed = existsSync(settingsPath);
  let settings = {};
  if (existed) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, "utf8"));
    } catch {
      return "NOT registered (.claude/settings.json is not valid JSON — add the PreToolUse entry by hand)";
    }
  }
  settings.hooks = settings.hooks ?? {};
  const list = Array.isArray(settings.hooks.PreToolUse) ? settings.hooks.PreToolUse : [];
  if (list.some((e) => JSON.stringify(e).includes("no-reinvent.mjs"))) return "already registered in .claude/settings.json";
  list.push({ matcher: "Write|Edit", hooks: [{ type: "command", command: "node", args: ["${CLAUDE_PROJECT_DIR}/.claude/hooks/no-reinvent.mjs"], timeout: 10 }] });
  settings.hooks.PreToolUse = list;
  mkdirSync(dirname(settingsPath), { recursive: true });
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
  return existed ? "registered in .claude/settings.json (merged, your other hooks untouched)" : "registered in .claude/settings.json (created)";
}

// The persistent "what just happened" doc — so the kit survives context loss + new
// teammates (a one-time console dump does not). Built as lines to avoid backticks
// colliding with this file's own template literals.
const kitReadme = [
  "# wative-core agent kit",
  "",
  "Installed by `npx wative-core init-agent`. It keeps your coding agent on the",
  "wative-core API instead of drifting to viem / ethers / @solana/web3.js over a long",
  "session. Commit all of it so your team and CI share it.",
  "",
  "## What's here, and who owns it",
  "",
  "- `.wative/llms.txt` — the one-screen capability index; point your agent here. KIT-MANAGED.",
  "- `.wative/interop-matrix.md` — the full library x function landscape. KIT-MANAGED.",
  "- `.wative/eslint-no-reinvent.mjs` — the importable ESLint gate. KIT-MANAGED.",
  "- `.wative/.version` — the wative-core version this kit was generated from (used by `--check`).",
  "- `AGENTS.md` (repo root) — the agent brief, auto-loaded by most harnesses. YOURS: a re-run keeps your edits unless you pass `--force`.",
  "- `.claude/skills/wative-core/SKILL.md`, `.claude/hooks/`, `.codex/hooks/` — the skill + real-time pre-write hooks. KIT-MANAGED.",
  "",
  "## Turn on the hard gate (ESLint + CI)",
  "",
  "The hooks only fire inside the agent; the enforced floor is ESLint + CI. In",
  "`eslint.config.js` (or `.mjs`):",
  "",
  "    import wative from \"./.wative/eslint-no-reinvent.mjs\";",
  "    export default [ ...wative /*, ...your config */ ];",
  "",
  "Then run `eslint .` in CI. It bans only the custody / signing / derivation surface",
  "wative-core owns; read clients and instruction-building stay allowed.",
  "",
  "## The pre-write hooks",
  "",
  "They block a banned custody/signing/derivation import the moment the agent writes one.",
  "",
  "- Claude Code: auto-registered in `.claude/settings.json`.",
  "- Codex: the script is at `.codex/hooks/no-reinvent.mjs`. Register it as a PreToolUse",
  "  command hook in your Codex config (`.codex/hooks.json` or `~/.codex/hooks.json`) — a",
  "  PreToolUse entry that runs `node .codex/hooks/no-reinvent.mjs`. Codex's hook config",
  "  schema varies by build, so check it against your version (learn.chatgpt.com/docs/hooks).",
  "- Genuine interop the hook shouldn't block? Put `// wative-allow: <reason>` on, or just",
  "  above, the import line.",
  "",
  "The hooks fail OPEN (a hook problem never blocks your writes) — ESLint + CI is the gate.",
  "",
  "## Keeping the kit current",
  "",
  "After upgrading wative-core, re-run `npx wative-core init-agent` to refresh the managed",
  "files (your `AGENTS.md` is left alone; add `--force` to refresh it too). In CI, run",
  "`npx wative-core init-agent --check` — it exits non-zero when the kit's `.version` no",
  "longer matches the installed wative-core, so a stale kit fails the build.",
  "",
].join("\n");

// --- install -----------------------------------------------------------------
const version = pkgVersion();

// DEV-OWNED: AGENTS.md at the repo root. Written once; a re-run keeps your edits.
const agentsPath = join(CWD, "AGENTS.md");
let agentsStatus;
if (existsSync(agentsPath) && !FORCE) {
  agentsStatus = "kept (your copy — pass --force to overwrite)";
} else {
  cpSync(fromDist("AGENTS.md"), agentsPath, { force: true });
  agentsStatus = FORCE ? "overwrote (--force)" : "wrote";
}

// KIT-MANAGED: always refreshed on a re-run.
mkdirSync(dot, { recursive: true });
for (const name of ["llms.txt", "interop-matrix.md", "eslint-no-reinvent.mjs"]) {
  cpSync(fromDist(name), join(dot, name), { force: true });
}
writeFileSync(stampPath, version + "\n");
writeFileSync(join(dot, "README.md"), kitReadme);

const skillDir = join(CWD, ".claude", "skills", "wative-core");
mkdirSync(skillDir, { recursive: true });
cpSync(fromDist("skill/SKILL.md"), join(skillDir, "SKILL.md"), { force: true });

installHook(join(CWD, ".claude", "hooks"), "hooks/claude-code.mjs");
const claudeHookStatus = registerClaudeHook();
installHook(join(CWD, ".codex", "hooks"), "hooks/codex.mjs");

// --- report, grouped by role (settings.json is MODIFIED, distinct from written) ---
const line = (label, text) => console.log(`  ${label.padEnd(34)} ${text}`);
console.log(`wative-core init-agent (${version}) — coding-agent kit installed.\n`);
console.log("Agent brief (auto-loaded by most harnesses):");
line("AGENTS.md", agentsStatus);
console.log("Reference — kit-managed, refreshed on every re-run:");
line(".wative/llms.txt", "the capability index — point your agent here");
line(".wative/interop-matrix.md", "the full library x function landscape");
line(".wative/eslint-no-reinvent.mjs", "the ESLint gate (step 1 below)");
line(".wative/README.md", "what this kit is + how to run it");
line(".wative/.version", `stamp for --check (= ${version})`);
line(".claude/skills/wative-core/SKILL.md", "the Claude Code skill");
console.log("Real-time pre-write hooks:");
line(".claude/hooks/", `Claude Code — ${claudeHookStatus}`);
line(".codex/hooks/", "Codex — script installed; register it by hand (see .wative/README.md)");
console.log("\nNext:");
console.log("  1. Enforce the hard gate — the hooks fire only in-agent; ESLint + CI is the floor.");
console.log("     In eslint.config.js (or .mjs):");
console.log('       import wative from "./.wative/eslint-no-reinvent.mjs";');
console.log("       export default [ ...wative /*, ...your config */ ];");
console.log("  2. Legit interop the hook shouldn't block? add  // wative-allow: <reason>  on the import line.");
console.log("  3. In CI, run  npx wative-core init-agent --check  to fail when an upgrade outdates the kit.");
console.log("  4. Commit the kit (.wative/, AGENTS.md, the hooks) so your team and CI share it.");
console.log("\nFull details: .wative/README.md");
