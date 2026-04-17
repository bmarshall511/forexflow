#!/usr/bin/env node
/**
 * Stop hook: runs `pnpm typecheck` when a session ends to catch accumulated
 * type drift. Informational only — never blocks the session from ending.
 *
 * Outputs a brief summary so the user sees any issues in the final output.
 */
import { execSync } from "node:child_process"
import process from "node:process"

function readStdin() {
  return new Promise((resolve) => {
    let data = ""
    process.stdin.setEncoding("utf8")
    process.stdin.on("data", (chunk) => (data += chunk))
    process.stdin.on("end", () => resolve(data))
  })
}

// Consume stdin (required by Claude Code hook protocol)
await readStdin()

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd()

try {
  execSync("pnpm typecheck", {
    cwd: projectDir,
    encoding: "utf8",
    timeout: 60_000,
    stdio: "pipe",
  })

  // Typecheck passed — output brief confirmation
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        message: "Session end typecheck: PASS",
      },
    }),
  )
} catch (err) {
  // Typecheck failed — report the errors but don't block
  const stderr = err.stderr || ""
  const errorLines = stderr
    .split("\n")
    .filter((line) => line.includes("error TS"))
    .slice(0, 10)

  const summary =
    errorLines.length > 0
      ? `Session end typecheck: ${errorLines.length}+ type errors found.\n${errorLines.join("\n")}`
      : "Session end typecheck: FAIL (run `pnpm typecheck` for details)"

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        message: summary,
      },
    }),
  )
}

// Always exit 0 — Stop hooks should never block
process.exit(0)
