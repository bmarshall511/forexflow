/**
 * Hook runner for test fixtures.
 *
 * Takes a hook script path and a synthetic JSON payload, spawns the
 * hook with the payload on stdin, captures stdout/stderr/exit, and
 * returns a parsed response.
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, "../../..");
export const HOOKS_DIR = path.join(REPO_ROOT, ".claude/hooks");

/**
 * @param {string} hookName - filename under .claude/hooks (e.g., "guard-bash.mjs")
 * @param {object} payload  - the JSON object to pipe to stdin
 * @param {object} [opts]
 * @param {Record<string,string>} [opts.env] - extra env vars merged over process.env
 * @param {string}                [opts.cwd] - working directory (default: repo root)
 */
export function runHook(hookName, payload, opts = {}) {
  return new Promise((resolve) => {
    const script = path.join(HOOKS_DIR, hookName);
    const env = {
      ...process.env,
      CLAUDE_PROJECT_DIR: opts.cwd || REPO_ROOT,
      ...(opts.env || {}),
    };
    const proc = spawn("node", [script], {
      cwd: opts.cwd || REPO_ROOT,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (b) => (stdout += b.toString()));
    proc.stderr.on("data", (b) => (stderr += b.toString()));
    proc.on("close", (code) => {
      let parsed = null;
      let parseError = null;
      if (stdout.trim()) {
        try {
          parsed = JSON.parse(stdout.trim().split("\n").pop());
        } catch (err) {
          parseError = err instanceof Error ? err.message : String(err);
        }
      }
      resolve({ code, stdout, stderr, parsed, parseError });
    });

    try {
      proc.stdin.write(JSON.stringify(payload));
      proc.stdin.end();
    } catch {
      // Process may close early on its own — that's fine.
    }
  });
}

/**
 * Extract the permission decision from a hook response (if any).
 */
export function permissionDecisionFrom(parsed) {
  if (!parsed) return null;
  if (parsed.hookSpecificOutput?.permissionDecision) {
    return parsed.hookSpecificOutput.permissionDecision;
  }
  return parsed.permissionDecision ?? null;
}

/**
 * Extract the reason (deny) or message (allow-with-message).
 */
export function reasonFrom(parsed) {
  if (!parsed) return null;
  return (
    parsed.hookSpecificOutput?.reason ??
    parsed.reason ??
    parsed.hookSpecificOutput?.message ??
    null
  );
}
