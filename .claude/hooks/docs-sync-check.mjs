#!/usr/bin/env node
/**
 * PreToolUse hook: intercepts `git commit` commands and checks whether
 * staged code changes have corresponding documentation updates staged too.
 * If docs may be stale, it denies the commit with a helpful message so
 * Claude can update docs before re-committing.
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

function deny(reason) {
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

// ── Documentation map: code path patterns → doc files that cover them ──────
const DOC_MAP = [
  {
    pattern: /^apps\/web\/src\/components\//,
    docs: ["apps/web/CLAUDE.md"],
    label: "web components",
  },
  {
    pattern: /^apps\/web\/src\/hooks\//,
    docs: ["apps/web/CLAUDE.md"],
    label: "web hooks",
  },
  {
    pattern: /^apps\/web\/src\/app\/api\//,
    docs: ["apps/web/CLAUDE.md"],
    label: "API routes",
  },
  {
    pattern: /^apps\/web\/src\/state\//,
    docs: ["apps/web/CLAUDE.md"],
    label: "state management",
  },
  {
    pattern: /^apps\/web\/src\/middleware\.ts/,
    docs: ["apps/web/CLAUDE.md", "docs/ai/remote-access.md"],
    label: "auth middleware",
  },
  {
    pattern: /^apps\/web\/server\.ts/,
    docs: ["apps/web/CLAUDE.md", "docs/ai/remote-access.md"],
    label: "WS proxy / remote access",
  },
  {
    pattern: /^apps\/daemons\/src\//,
    docs: ["apps/daemons/CLAUDE.md", "docs/ai/realtime.md"],
    label: "daemon services",
  },
  {
    pattern: /^apps\/cf-worker\//,
    docs: ["apps/cf-worker/CLAUDE.md"],
    label: "CF worker",
  },
  {
    pattern: /^packages\/db\/prisma\//,
    docs: ["packages/db/CLAUDE.md"],
    label: "database schema",
  },
  {
    pattern: /^packages\/db\/src\//,
    docs: ["packages/db/CLAUDE.md"],
    label: "DB services",
  },
  {
    pattern: /^packages\/types\//,
    docs: ["packages/types/CLAUDE.md"],
    label: "shared types",
  },
  {
    pattern: /^packages\/shared\//,
    docs: ["packages/shared/CLAUDE.md"],
    label: "shared utilities",
  },
  {
    pattern: /^\.claude\/rules\//,
    docs: [".claude/CLAUDE.md"],
    label: "Claude rules",
  },
  {
    pattern: /^\.claude\/skills\//,
    docs: [".claude/CLAUDE.md"],
    label: "Claude skills",
  },
]

// Files that are themselves docs — never flag these as needing doc updates
const DOC_FILES = new Set([
  "apps/web/CLAUDE.md",
  "apps/daemons/CLAUDE.md",
  "apps/cf-worker/CLAUDE.md",
  "apps/mcp-server/CLAUDE.md",
  "packages/db/CLAUDE.md",
  "packages/types/CLAUDE.md",
  "packages/shared/CLAUDE.md",
  ".claude/CLAUDE.md",
  "README.md",
])

// Skip doc check for these file patterns (tests, styles, config)
const SKIP_PATTERNS = [
  /\.test\.[jt]sx?$/,
  /\.spec\.[jt]sx?$/,
  /\.css$/,
  /\.scss$/,
  /\.json$/,
  /\.yml$/,
  /\.yaml$/,
  /\.config\.[jt]s$/,
  /\.d\.ts$/,
]

const inputRaw = await readStdin()
if (!inputRaw.trim()) process.exit(0)

let input
try {
  input = JSON.parse(inputRaw)
} catch {
  process.exit(0)
}

const toolName = input?.tool_name
const command = input?.tool_input?.command

if (toolName !== "Bash" || typeof command !== "string") process.exit(0)

// Only intercept git commit commands
if (!/\bgit\s+commit\b/.test(command)) process.exit(0)

// Get staged files with status (A=added, M=modified, R=renamed, D=deleted)
let stagedEntries
try {
  stagedEntries = execSync("git diff --cached --name-status", {
    encoding: "utf8",
    timeout: 5000,
  })
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [status, ...rest] = line.split("\t")
      return { status: status.charAt(0), file: rest[rest.length - 1] }
    })
} catch {
  process.exit(0)
}

if (stagedEntries.length === 0) process.exit(0)

const stagedSet = new Set(stagedEntries.map((e) => e.file))

// Only NEW (A), RENAMED (R), DELETED (D) files need doc updates.
// Modified (M) files are enhancements/bug fixes where docs are usually already accurate.
const significantFiles = stagedEntries
  .filter((e) => e.status === "A" || e.status === "R" || e.status === "D")
  .map((e) => e.file)

if (significantFiles.length === 0) process.exit(0)

// Check which docs areas have significant file changes but docs aren't staged
const missingDocs = new Map() // doc path → set of labels

for (const file of significantFiles) {
  // Skip if the file is itself a doc
  if (DOC_FILES.has(file)) continue
  if (file.startsWith("docs/")) continue

  // Skip non-significant changes
  if (SKIP_PATTERNS.some((p) => p.test(file))) continue

  for (const mapping of DOC_MAP) {
    if (mapping.pattern.test(file)) {
      for (const doc of mapping.docs) {
        if (!stagedSet.has(doc)) {
          // Doc is tracked and unmodified — consider it up-to-date
          try {
            const modifiedFiles = execSync("git diff --name-only", {
              encoding: "utf8",
              timeout: 3000,
            })
              .trim()
              .split("\n")
            if (!modifiedFiles.includes(doc)) continue
          } catch {
            /* fall through to flag it */
          }
          if (!missingDocs.has(doc)) missingDocs.set(doc, new Set())
          missingDocs.get(doc).add(mapping.label)
        }
      }
    }
  }
}

if (missingDocs.size === 0) process.exit(0)

// Build a helpful message
const lines = [
  "Documentation sync check: new/renamed/deleted files detected in documented areas.\nThe following docs may need updating:\n",
]

for (const [doc, labels] of missingDocs) {
  lines.push(`  • ${doc} (covers: ${[...labels].join(", ")})`)
}

lines.push(
  "\nPlease review these docs using the documentation map in .claude/rules/09-docs-sync.md.",
  "Please review these docs and either update them or stage them as-is if already accurate.",
)

deny(lines.join("\n"))
