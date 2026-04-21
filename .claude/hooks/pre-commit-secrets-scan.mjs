#!/usr/bin/env node
/**
 * Hook: pre-commit-secrets-scan
 * Event: PreToolUse (Bash, on `git commit`)
 * Rule: .claude/rules/04-security.md, .claude/rules/10-git-workflow.md
 *
 * Intercepts `git commit` commands and scans the staged diff for secret
 * patterns. Prefers gitleaks if installed; falls back to a curated regex
 * list. Blocks the commit on any detection.
 */

import { execSync, spawnSync } from "node:child_process"
import { readStdinJson, allow, deny, failOpen } from "./lib/io.mjs"

const HOOK = "pre-commit-secrets-scan"

const REGEX_PATTERNS = [
  { name: "Anthropic API key", re: /\bsk-ant-[a-zA-Z0-9_\-]{40,}\b/ },
  { name: "OpenAI API key", re: /\bsk-[a-zA-Z0-9]{20,}\b/ },
  { name: "AWS access key ID", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "AWS secret access key", re: /\baws(.{0,20})?(secret|SECRET)(.{0,20})?['"][0-9a-zA-Z/+]{40}['"]/ },
  { name: "GitHub PAT (classic)", re: /\bghp_[A-Za-z0-9]{36,}\b/ },
  { name: "GitHub PAT (fine-grained)", re: /\bgithub_pat_[A-Za-z0-9_]{80,}\b/ },
  { name: "GitHub OAuth token", re: /\bgho_[A-Za-z0-9]{36,}\b/ },
  { name: "Slack bot token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: "Cloudflare API token", re: /\bv1\.0-[A-Za-z0-9_-]{40,}\b/ },
  { name: "OANDA token", re: /\b[a-f0-9]{32}-[a-f0-9]{32}\b/ },
  { name: "Generic high-entropy token assignment", re: /(api[_-]?key|secret|password|token)\s*[:=]\s*['"][A-Za-z0-9_\-+/=]{32,}['"]/i },
  { name: "Private key block", re: /-----BEGIN\s+(RSA|OPENSSH|DSA|EC|PGP|ENCRYPTED)\s+PRIVATE KEY-----/ },
]

async function main() {
  const input = await readStdinJson()
  if (!input || input.tool_name !== "Bash") return allow()

  const cmd = input.tool_input?.command ?? ""
  if (!/\bgit\s+commit\b/.test(cmd)) return allow()

  // Produce a staged-files diff to scan.
  let diff
  try {
    diff = execSync("git diff --cached --unified=0 --no-color", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 50 * 1024 * 1024,
    })
  } catch {
    return allow()
  }
  if (!diff) return allow()

  // Prefer gitleaks when available; fall back to regex list.
  const gitleaksAvailable = spawnSync("gitleaks", ["version"], { stdio: "ignore" }).status === 0
  if (gitleaksAvailable) {
    const result = spawnSync(
      "gitleaks",
      ["protect", "--staged", "--no-banner", "--redact", "--exit-code", "1"],
      { encoding: "utf8" },
    )
    if (result.status === 1) {
      deny(
        `Blocked by pre-commit-secrets-scan: gitleaks flagged secrets in staged changes.\n` +
          result.stdout +
          result.stderr +
          `\n\n` +
          `Remediate:\n` +
          `  1. Unstage the file: git reset HEAD <file>\n` +
          `  2. Remove the secret from the file\n` +
          `  3. Rotate the real credential at its source\n` +
          `  4. Re-stage and retry the commit\n` +
          `\n` +
          `Rule: .claude/rules/04-security.md`,
      )
      return
    }
  }

  // Regex fallback — scan only added lines.
  const offenders = []
  const addedLines = diff
    .split("\n")
    .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
  for (const line of addedLines) {
    for (const { name, re } of REGEX_PATTERNS) {
      if (re.test(line)) {
        offenders.push({ name, sample: line.slice(1).trim().slice(0, 120) })
        if (offenders.length >= 5) break
      }
    }
    if (offenders.length >= 5) break
  }

  if (offenders.length > 0) {
    const listed = offenders.map((o) => `  - ${o.name}: ${o.sample}`).join("\n")
    deny(
      `Blocked by pre-commit-secrets-scan: ${offenders.length} potential secret(s) in staged changes.\n\n` +
        listed +
        `\n\n` +
        `Remediate:\n` +
        `  1. Unstage the file, remove the secret, re-stage\n` +
        `  2. Rotate the real credential at its source\n` +
        `  3. For an unavoidable false positive, add the pattern to a\n` +
        `     gitleaks allowlist (install gitleaks for precise matching)\n` +
        `\n` +
        `Rule: .claude/rules/04-security.md`,
    )
    return
  }

  allow()
}

main().catch((err) => failOpen(HOOK, err))
