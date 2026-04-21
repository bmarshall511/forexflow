/**
 * Tiny structured stderr logger for hooks.
 *
 * Hooks write to stderr for operator-visible diagnostics (the Claude Code
 * console shows these), and to stdout only for the formal hook response.
 */

export function log(hookName, level, fields) {
  const base = {
    ts: new Date().toISOString(),
    hook: hookName,
    level,
  }
  process.stderr.write(JSON.stringify({ ...base, ...fields }) + "\n")
}

export const info = (hookName, fields) => log(hookName, "info", fields)
export const warn = (hookName, fields) => log(hookName, "warn", fields)
export const error = (hookName, fields) => log(hookName, "error", fields)
export const debug = (hookName, fields) => {
  if (process.env.CLAUDE_HOOK_DEBUG === "1") log(hookName, "debug", fields)
}
