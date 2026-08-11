#!/usr/bin/env node
// Runs the example suite; fails unless every test ran and passed. [dir] [--expect N] [--tests-in SUBDIR]

import { readdirSync } from "node:fs";
import { join, resolve, relative, basename } from "node:path";
import { spawnSync } from "node:child_process";

const EXPECTED_TESTS = 62;
const DEFAULT_TESTS_IN = "examples";

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

// Positional, since a find() over non-flags treats a flag VALUE as the directory.
const args = process.argv.slice(2);
let dirArg = null;
let expected = EXPECTED_TESTS;
let testsIn = DEFAULT_TESTS_IN;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--expect") expected = Number(args[++i]);
  else if (a === "--tests-in") testsIn = args[++i];
  else if (a.startsWith("--")) fail(`unknown option "${a}"`);
  else if (dirArg === null) dirArg = a;
  else fail(`unexpected extra argument "${a}"`);
}
const dir = resolve(dirArg ?? ".");
// Output is pasted into release logs, so strip the absolute root from all of it.
const redact = (s) => String(s).replaceAll(dir, ".");
if (!Number.isInteger(expected) || expected < 1) fail(`--expect must be a positive integer, got "${expected}"`);
if (!testsIn) fail("--tests-in requires a directory");

const testsDir = join(dir, testsIn);
let files;
try {
  files = readdirSync(testsDir)
    .filter((f) => f.endsWith(".test.cjs") || f.endsWith(".test.mjs"))
    .sort();
} catch (e) {
  fail(`cannot read ${testsIn}: ${redact(e.message)}`);
}
if (files.length === 0) fail(`no test files in ${testsIn} — they did not ship, or the path is wrong`);

// Relative to `cwd: dir`, so a failing run's per-file label is not an absolute path.
const run = spawnSync(process.execPath, ["--test", ...files.map((f) => join(testsIn, f))], {
  encoding: "utf8",
  cwd: dir,
});
// Strip ANSI, or FORCE_COLOR makes every summary lookup miss and the gate false-red.
const out = `${run.stdout ?? ""}${run.stderr ?? ""}`.replace(/\x1b\[[0-9;]*m/g, "");
process.stdout.write(redact(out));

// The summary prefix is reporter-dependent and varies by Node version; accept either.
const sum = (name) => {
  const m = [...out.matchAll(new RegExp(`^(?:#|ℹ) ${name} (\\d+)$`, "gm"))];
  return m.length === 0 ? null : Number(m[m.length - 1][1]);
};
const total = sum("tests");
const passed = sum("pass");
const failed = sum("fail");

console.log(
  `${testsIn} suite: files=${files.length} exit=${run.status} tests=${total ?? "?"} pass=${passed ?? "?"} fail=${failed ?? "?"}`,
);

if (run.error) fail(`could not run node --test: ${run.error.message}`);
if (run.status !== 0) fail(`node --test exited ${run.status}`);
// A missing summary means the runner never finished; that is not success.
if (total === null || passed === null || failed === null) {
  fail("no test summary — the runner did not finish");
}
// `tests` sums all five dispositions, so this covers skipped/todo/cancelled too.
if (passed !== total) fail(`${passed}/${total} passed — ${total - passed} failed, skipped, todo or cancelled`);
// EXACT, not a floor: a floor is how a suite silently shrinks.
if (total !== expected) {
  fail(`expected exactly ${expected} tests in ${testsIn}, ran ${total}. Either they did not all ship, or a test was added and this number needs updating`);
}

// relative() can still escape upward and carry the layout, so fall back to basename.
const rel = relative(process.cwd(), dir) || ".";
console.log(`✓ ${testsIn} suite: ${total}/${total} passed in ${rel.startsWith("..") ? basename(dir) : rel}`);
