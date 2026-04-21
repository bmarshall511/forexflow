#!/usr/bin/env node
/**
 * Hook: guard-bash
 * Event: PreToolUse (Bash)
 * Rule: .claude/rules/10-git-workflow.md, .claude/rules/00-foundation.md
 *
 * Blocks super-destructive shell commands that would cause irrecoverable
 * damage. Deliberately narrow — this is not a general lint; it's a
 * tripwire against foot-guns.
 */

import { readStdinJson, allow, deny, failOpen } from "./lib/io.mjs"

const HOOK = "guard-bash"

/**
 * Patterns that always block. Order matters only for readability.
 */
const BLOCKED = [
  { re: /\brm\s+-rf\s+\/(\s|$)/, reason: "rm -rf / — destroys the whole filesystem" },
  { re: /\brm\s+-rf\s+\/\*(\s|$)/, reason: "rm -rf /* — destroys the whole filesystem" },
  { re: /\brm\s+-rf\s+~(\s|$|\/)/, reason: "rm -rf ~ — destroys your home directory" },
  { re: /\bsudo\s+rm\s+-rf\s+\//, reason: "sudo rm -rf / — destroys the whole filesystem (with privileges)" },
  { re: /\bmkfs\./, reason: "mkfs.* — reformats a disk" },
  { re: /\bdd\s+if=/, reason: "dd if=... — low-level disk copy; too easy to overwrite the wrong device" },
  { re: /:\s*\(\s*\)\s*\{[^}]*:\s*\|\s*:\s*&[^}]*\}\s*;\s*:/, reason: "fork bomb — will hang the system" },
  { re: /\bgit\s+push\s+(?:--force|-f)\b[^&|;]*\b(?:main|v3)\b/, reason: "force-push to main or v3 is blocked by policy" },
  { re: /\bgit\s+push\s+(?:--force|-f)\b[^&|;]*\borigin\s+(?:main|v3)\b/, reason: "force-push to origin main or v3 is blocked by policy" },
  { re: /\bgit\s+branch\s+-D\s+(main|v3)\b/, reason: "deleting main or v3 is blocked by policy" },
]

async function main() {
  let input
  try {
    input = await readStdinJson()
  } catch (err) {
    failOpen(HOOK, err)
    return
  }

  if (!input || input.tool_name !== "Bash") {
    allow()
    return
  }

  const command = input.tool_input?.command
  if (typeof command !== "string" || command.length === 0) {
    allow()
    return
  }

  for (const { re, reason } of BLOCKED) {
    if (re.test(command)) {
      deny(
        `Blocked by guard-bash: ${reason}\n` +
          `Command: ${command}\n` +
          `If you genuinely need this, run it manually outside Claude Code.`,
      )
      return
    }
  }

  allow()
}

main().catch((err) => failOpen(HOOK, err))
