#!/usr/bin/env node
/**
 * Test-harness orchestrator.
 *
 * Auto-discovers every .mjs file in fixtures/, imports it, invokes its
 * exported run() function, and reports pass/fail. Exit 0 on all-green;
 * exit 1 on any failure.
 *
 * Flags:
 *   --fixture <name>   run only the named fixture (basename, no .mjs)
 *   --verbose          print per-fixture stdout/stderr from hook runs
 *   --bail             stop at first failure
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(HERE, "fixtures");

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fixtures = discoverFixtures(args.fixture);

  if (fixtures.length === 0) {
    console.error("No fixtures found.");
    process.exit(1);
  }

  const results = [];
  const start = Date.now();

  for (const file of fixtures) {
    const rel = path.relative(HERE, file);
    process.stdout.write(`  ${rel} ... `);
    try {
      const mod = await import(pathToFileURL(file).href);
      if (typeof mod.run !== "function") {
        results.push({
          file: rel,
          passed: false,
          reason: "fixture has no run() export",
        });
        console.log("FAIL (no run)");
        continue;
      }
      const result = await mod.run({ verbose: args.verbose });
      results.push({ file: rel, passed: result.passed, reason: result.reason });
      console.log(
        result.passed ? "PASS" : `FAIL: ${result.reason || "(no reason)"}`,
      );
      if (!result.passed && args.bail) break;
    } catch (err) {
      const message =
        err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
      results.push({ file: rel, passed: false, reason: message });
      console.log(`FAIL (threw): ${message.split("\n")[0]}`);
      if (args.bail) break;
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(2);
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;

  console.log("");
  console.log(`Summary: ${passed} passed, ${failed} failed · ${elapsed}s`);

  if (failed > 0) {
    console.log("\nFailures:");
    for (const r of results.filter((x) => !x.passed)) {
      console.log(`  - ${r.file}`);
      if (r.reason) {
        for (const line of String(r.reason).split("\n"))
          console.log(`      ${line}`);
      }
    }
    process.exit(1);
  }
  process.exit(0);
}

function discoverFixtures(filter) {
  const entries = fs
    .readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".mjs"))
    .sort();
  const full = entries.map((f) => path.join(FIXTURES_DIR, f));
  if (!filter) return full;
  return full.filter((f) => path.basename(f, ".mjs") === filter);
}

function parseArgs(argv) {
  const out = { fixture: null, verbose: false, bail: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--fixture") out.fixture = argv[++i];
    else if (a === "--verbose") out.verbose = true;
    else if (a === "--bail") out.bail = true;
  }
  return out;
}

main();
