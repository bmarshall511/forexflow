/**
 * Shared fixture builders and scratch-file helpers.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Create a temporary scratch directory under the OS tmpdir and schedule
 * cleanup when the current process exits.
 * @returns {{ dir: string, cleanup: () => void }}
 */
export function scratchDir() {
  const base = process.env.TMPDIR || os.tmpdir();
  const dir = fs.mkdtempSync(path.join(base, "forexflow-harness-"));
  const cleanup = () => {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  };
  process.on("exit", cleanup);
  return { dir, cleanup };
}

/**
 * Write a file under a scratch directory, creating parent directories.
 */
export function writeScratch(scratch, relPath, content) {
  const full = path.join(scratch, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");
  return full;
}

/**
 * Build a plausible PreToolUse Write payload.
 */
export function writePayload({ filePath, content }) {
  return {
    tool_name: "Write",
    tool_input: { file_path: filePath, content },
  };
}

/**
 * Build a plausible PreToolUse Edit payload.
 */
export function editPayload({
  filePath,
  oldString,
  newString,
  replaceAll = false,
}) {
  return {
    tool_name: "Edit",
    tool_input: {
      file_path: filePath,
      old_string: oldString,
      new_string: newString,
      replace_all: replaceAll,
    },
  };
}

/**
 * Build a plausible PreToolUse Bash payload.
 */
export function bashPayload(command) {
  return {
    tool_name: "Bash",
    tool_input: { command },
  };
}

/**
 * Build a plausible PostToolUse TodoWrite payload.
 */
export function todoWritePayload(todos) {
  return {
    tool_name: "TodoWrite",
    tool_input: { todos },
  };
}
