/**
 * I/O helpers shared by every hook.
 *
 * Hooks read a single JSON object from stdin and write zero or one JSON
 * objects to stdout. These helpers normalize that contract so individual
 * hooks can focus on their policy logic.
 */

/**
 * Read stdin to completion and parse as JSON.
 * Returns null on empty or malformed input (fail open).
 */
export async function readStdinJson() {
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString("utf8").trim()
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * Emit a deny response and exit 0.
 * @param {string} reason - user-visible explanation
 */
export function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        permissionDecision: "deny",
        reason,
      },
    }) + "\n",
  )
  process.exit(0)
}

/**
 * Emit an allow-with-message response and exit 0.
 * Used by advisory hooks that want to surface a warning without blocking.
 * @param {string} message
 */
export function allowWithMessage(message) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        permissionDecision: "allow",
        message,
      },
    }) + "\n",
  )
  process.exit(0)
}

/**
 * Silent allow — exit 0 with no stdout output.
 */
export function allow() {
  process.exit(0)
}

/**
 * Fail open on an unexpected error.
 * Logs to stderr (visible in Claude Code's hook output) and exits 0.
 * @param {string} hookName
 * @param {unknown} err
 */
export function failOpen(hookName, err) {
  const message = err instanceof Error ? err.message : String(err)
  process.stderr.write(`[${hookName}] internal error (fail-open): ${message}\n`)
  process.exit(0)
}
