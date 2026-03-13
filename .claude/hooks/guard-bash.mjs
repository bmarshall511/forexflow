#!/usr/bin/env node
import process from "node:process"

function readStdin() {
  return new Promise((resolve) => {
    let data = ""
    process.stdin.setEncoding("utf8")
    process.stdin.on("data", (chunk) => (data += chunk))
    process.stdin.on("end", () => resolve(data))
  })
}

function deny(reason) {
  // Claude Code reads JSON decisions only on exit 0.
  // PreToolUse decision schema: hookSpecificOutput.permissionDecision = "deny"
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    }),
  )
  process.exit(0)
}

const SUPER_DESTRUCTIVE_PATTERNS = [
  /\brm\s+-rf\s+\/\b/,
  /\brm\s+-rf\s+\/\*\b/,
  /\brm\s+-rf\s+~\b/,
  /\bsudo\s+rm\s+-rf\s+\/\b/,
  /\bmkfs\./,
  /\bdd\s+if=/,
  /\b:\(\)\s*\{\s*:\|\:&\s*\}\s*;\s*:\b/, // fork bomb
]

const inputRaw = await readStdin()
if (!inputRaw.trim()) process.exit(0)

let input
try {
  input = JSON.parse(inputRaw)
} catch {
  // If stdin isn't JSON, don't block anything.
  process.exit(0)
}

const toolName = input?.tool_name
const command = input?.tool_input?.command

if (toolName !== "Bash" || typeof command !== "string") process.exit(0)

for (const re of SUPER_DESTRUCTIVE_PATTERNS) {
  if (re.test(command)) {
    deny(`Blocked super-destructive command: "${command}"`)
  }
}

process.exit(0)
