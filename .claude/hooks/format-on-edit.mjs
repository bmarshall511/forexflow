#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { spawnSync } from "node:child_process"

function readStdin() {
  return new Promise((resolve) => {
    let data = ""
    process.stdin.setEncoding("utf8")
    process.stdin.on("data", (chunk) => (data += chunk))
    process.stdin.on("end", () => resolve(data))
  })
}

const FORMAT_EXTS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".css",
  ".scss",
  ".yml",
  ".yaml",
])

function findRepoRoot(startDir) {
  let dir = startDir
  while (true) {
    const pkg = path.join(dir, "package.json")
    if (fs.existsSync(pkg)) return dir
    const parent = path.dirname(dir)
    if (parent === dir) return startDir
    dir = parent
  }
}

function findPrettierBin(repoRoot) {
  const bin = path.join(repoRoot, "node_modules", ".bin", "prettier")
  return fs.existsSync(bin) ? bin : null
}

const inputRaw = await readStdin()
if (!inputRaw.trim()) process.exit(0)

let input
try {
  input = JSON.parse(inputRaw)
} catch {
  process.exit(0)
}

const toolName = input?.tool_name
const filePath = input?.tool_input?.file_path
if (!filePath || (toolName !== "Write" && toolName !== "Edit")) process.exit(0)

const ext = path.extname(filePath)
if (!FORMAT_EXTS.has(ext)) process.exit(0)

if (!fs.existsSync(filePath)) process.exit(0)

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd()
const repoRoot = findRepoRoot(projectDir)
const prettierBin = findPrettierBin(repoRoot)

// If prettier isn't installed yet, don't do anything (avoid surprise installs).
if (!prettierBin) process.exit(0)

const res = spawnSync(prettierBin, ["--write", filePath], {
  cwd: repoRoot,
  stdio: "ignore",
})

// Never block edits due to formatting errors; just no-op.
process.exit(res.status === 0 ? 0 : 0)
