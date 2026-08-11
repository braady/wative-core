#!/usr/bin/env node
// Runs the release example suite in a given directory and FAILS LOUDLY unless
// every test ran and passed.
//
// This exists because `node --test` is not self-gating, and the release
// procedure trusted it three separate times:
//
//   * a glob matching nothing reports `tests 0 / fail 0` and EXITS 0. The
//     publish guide's `node --test ... > /dev/null 2>&1` then prints
//     "✓ release tests pass" over a run of nothing. That is not hypothetical:
//     the CI glob pointed at the wrong directory for eleven days and the job
//     stayed green the whole time.
//   * an unmatched glob is ignored silently even when a sibling glob matches,
//     so a half-staged directory runs fewer tests and says nothing.
//   * a failing `{ todo: true }` test reports `fail 0` and exits 0; a timed-out
//     test reports `fail 0` with `cancelled 1`. Neither is visible to a check
//     that only looks at `fail`.
//
// Files are enumerated here rather than shell-globbed, so "the glob matched
// nothing" becomes a countable fact instead of a silent no-op.
//
// Also used for the dev repo's own node:test suites, which jest does not match
// (`testMatch` is `**/*.test.ts`) and which therefore ran zero times for as long
// as they existed — the same defect one level up: not a gate that passes
// vacuously, but a gate nobody wired to a door.
//
// Usage: node <path>/check-example-suite.mjs [dir] [--expect N] [--tests-in SUBDIR]

import { readdirSync } from "node:fs";
import { join, resolve, relative, basename } from "node:path";
import { spawnSync } from "node:child_process";

const EXPECTED_TESTS = 61;
const DEFAULT_TESTS_IN = "examples";

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

// Parsed positionally rather than with `args.find(a => !a.startsWith("--"))`,
// which silently treats a FLAG VALUE as the directory: `--expect 5` with no
// directory made `dir` "5", and the run then failed for a reason that had
// nothing to do with the suite.
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
// `dir` is resolve()d, so it is always absolute. Everything this script prints —
// its own failure messages and the runner's output verbatim — is read at publish
// time and pasted into release logs and issues, so strip the root from all of it.
// Measured: without this, a FAILING run leaks the layout through V8 stack frames
// (`ERR_UNKNOWN_FILE_EXTENSION … for /abs/path`), because node resolves a test
// file before loading it no matter how the path was passed on the command line.
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
  // redact(): readdirSync was handed the ABSOLUTE testsDir, so the path is inside
  // e.message even though the prefix here is relative.
  fail(`cannot read ${testsIn}: ${redact(e.message)}`);
}
if (files.length === 0) fail(`no test files in ${testsIn} — they did not ship, or the path is wrong`);

// Paths RELATIVE to `cwd: dir`. What this buys, measured on Node 24 rather than
// assumed: the reporter's own per-file label becomes `✖ examples/x.test.cjs`
// instead of an absolute path. It buys nothing on a PASSING run — both the spec
// and tap reporters label subtests by test NAME, never by path — so `redact()`
// above, not this, is what makes a failing run safe to paste.
const run = spawnSync(process.execPath, ["--test", ...files.map((f) => join(testsIn, f))], {
  encoding: "utf8",
  cwd: dir,
});
// Strip ANSI: with FORCE_COLOR the spec reporter emits "\x1b[34mℹ …" and every
// summary lookup returns empty. That fails closed (the missing-summary check
// fires) but it is a false red, and a red gate nobody believes is a dead gate.
const out = `${run.stdout ?? ""}${run.stderr ?? ""}`.replace(/\x1b\[[0-9;]*m/g, "");
process.stdout.write(redact(out));

// The summary prefix depends on the reporter — `spec` writes "ℹ", `tap` writes
// "# " — and which is default varies by Node version. Accept either.
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
// A missing summary means the runner never finished. Reading that as success is
// the same mistake as trusting the exit code alone.
if (total === null || passed === null || failed === null) {
  fail("no test summary — the runner did not finish");
}
// Every test must PASS, not merely "not fail". `tests` is the sum of all five
// dispositions, so this single comparison covers failed, skipped, todo and
// cancelled without enumerating any of them.
if (passed !== total) fail(`${passed}/${total} passed — ${total - passed} failed, skipped, todo or cancelled`);
// EXACT, not a floor. A floor tolerates a gap, which is how a suite silently
// shrinks; the previous CI gate allowed 40 against a 58-test suite. Recount with:
//   rg --no-filename -c '^test\(' <tests-in>/*.test.{cjs,mjs} | awk '{s+=$1} END{print s}'
if (total !== expected) {
  fail(`expected exactly ${expected} tests in ${testsIn}, ran ${total}. Either they did not all ship, or a test was added and this number needs updating`);
}

// This line, not the spawn arguments, is the one place a PASSING run leaked the
// absolute root — measured at exactly 1 line per run before the change.
//
// `relative()` only shortens when cwd and dir share a prefix; run from an
// unrelated cwd it yields `../../Users/<user>/...`, which still carries the
// layout and which redact() cannot catch (the string holds no absolute `dir` to
// match). So escape upward => print the basename instead, which names the build
// without locating it.
const rel = relative(process.cwd(), dir) || ".";
console.log(`✓ ${testsIn} suite: ${total}/${total} passed in ${rel.startsWith("..") ? basename(dir) : rel}`);
