#!/usr/bin/env node
/**
 * One-shot migration: merge legacy per-app `apps/web/.env.local` and
 * `apps/daemons/.env.local` into a single root `.env.local`, then delete
 * the legacy files.
 *
 * Why: historically each app had its own env file with the SAME
 * `DATABASE_URL` and `ENCRYPTION_KEY`. Keeping them in sync was manual and
 * broke silently — when the keys drifted, the daemon would fail to
 * decrypt credentials the web had successfully encrypted, and the UI's
 * "OANDA: Disconnected" was indistinguishable from "OANDA not configured."
 *
 * This script:
 *   1. Refuses to run if root `.env.local` already exists (you've already
 *      migrated, or were never on the old layout).
 *   2. Reads any/all of apps/web/.env.local, apps/daemons/.env.local.
 *   3. Merges keys into a single object. If the two files disagree on a
 *      shared key's value, ABORTS with both values shown — a human must
 *      decide which one was real.
 *   4. Writes root `.env.local` with the merged result.
 *   5. Deletes the legacy per-app files.
 *   6. Validates the required keys are present and prints a summary.
 *
 * Safe to re-run: exits 0 with a "nothing to do" message if no legacy
 * files are found and root .env.local already exists.
 *
 * Usage: `pnpm setup:env`
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, "..")

const ROOT_ENV = resolve(repoRoot, ".env.local")
const LEGACY_WEB = resolve(repoRoot, "apps/web/.env.local")
const LEGACY_DAEMON = resolve(repoRoot, "apps/daemons/.env.local")

const REQUIRED_KEYS = [
  "DATABASE_URL",
  "ENCRYPTION_KEY",
  "NEXT_PUBLIC_DAEMON_REST_URL",
  "NEXT_PUBLIC_DAEMON_URL",
]

/** Minimal dotenv-style parser — handles `KEY=VALUE`, ignores blank lines and `#` comments. */
function parseEnv(contents) {
  const out = {}
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    // Strip surrounding quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

function serializeEnv(obj) {
  return (
    Object.entries(obj)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n"
  )
}

function log(msg) {
  console.log(`[setup:env] ${msg}`)
}

function die(msg, code = 1) {
  console.error(`[setup:env] ERROR: ${msg}`)
  process.exit(code)
}

function main() {
  const rootExists = existsSync(ROOT_ENV)
  const webExists = existsSync(LEGACY_WEB)
  const daemonExists = existsSync(LEGACY_DAEMON)

  if (rootExists && !webExists && !daemonExists) {
    log(`Nothing to migrate — ${ROOT_ENV} already exists and no legacy files found.`)
    process.exit(0)
  }

  if (rootExists && (webExists || daemonExists)) {
    die(
      `Root ${ROOT_ENV} already exists AND legacy files are still present. ` +
        `This is ambiguous — I don't know which is authoritative. Delete the legacy ` +
        `files manually once you've verified the root file has the values you want:\n` +
        (webExists ? `  rm ${LEGACY_WEB}\n` : "") +
        (daemonExists ? `  rm ${LEGACY_DAEMON}\n` : ""),
    )
  }

  if (!webExists && !daemonExists) {
    die(
      `No .env.local found anywhere (not at root, not in apps/web, not in apps/daemons). ` +
        `Create one at ${ROOT_ENV} with the template from README.md.`,
    )
  }

  const webEnv = webExists ? parseEnv(readFileSync(LEGACY_WEB, "utf8")) : {}
  const daemonEnv = daemonExists ? parseEnv(readFileSync(LEGACY_DAEMON, "utf8")) : {}

  log(`Legacy files found:`)
  if (webExists) log(`  - apps/web/.env.local (${Object.keys(webEnv).length} keys)`)
  if (daemonExists) log(`  - apps/daemons/.env.local (${Object.keys(daemonEnv).length} keys)`)

  // Detect divergent keys — abort rather than pick arbitrarily
  const allKeys = new Set([...Object.keys(webEnv), ...Object.keys(daemonEnv)])
  const divergent = []
  for (const k of allKeys) {
    if (k in webEnv && k in daemonEnv && webEnv[k] !== daemonEnv[k]) {
      divergent.push({ key: k, web: webEnv[k], daemon: daemonEnv[k] })
    }
  }
  if (divergent.length > 0) {
    console.error(`[setup:env] ERROR: the two legacy files disagree on ${divergent.length} key(s):`)
    for (const d of divergent) {
      console.error(`  ${d.key}`)
      console.error(`    apps/web/.env.local    = ${d.web}`)
      console.error(`    apps/daemons/.env.local= ${d.daemon}`)
    }
    console.error(
      `[setup:env] This is the exact drift that motivated consolidating to one file. ` +
        `Decide which value is correct for each key, edit one of the files so they agree, ` +
        `and re-run \`pnpm setup:env\`. (If in doubt, the web app's ENCRYPTION_KEY is the ` +
        `one that's been encrypting user credentials — use that.)`,
    )
    process.exit(1)
  }

  // Web values win on ties (they don't exist, since we aborted on divergence above)
  const merged = { ...daemonEnv, ...webEnv }

  // Supply sane defaults for NEXT_PUBLIC_DAEMON_* if neither file set them
  if (!merged.NEXT_PUBLIC_DAEMON_REST_URL) {
    merged.NEXT_PUBLIC_DAEMON_REST_URL = "http://localhost:4100"
    log(`Added default NEXT_PUBLIC_DAEMON_REST_URL=http://localhost:4100`)
  }
  if (!merged.NEXT_PUBLIC_DAEMON_URL) {
    merged.NEXT_PUBLIC_DAEMON_URL = "ws://localhost:4100"
    log(`Added default NEXT_PUBLIC_DAEMON_URL=ws://localhost:4100`)
  }

  // Write root .env.local
  writeFileSync(ROOT_ENV, serializeEnv(merged), { mode: 0o600 })
  log(`Wrote ${ROOT_ENV} with ${Object.keys(merged).length} keys (mode 0600).`)

  // Delete legacy files
  if (webExists) {
    unlinkSync(LEGACY_WEB)
    log(`Removed ${LEGACY_WEB}`)
  }
  if (daemonExists) {
    unlinkSync(LEGACY_DAEMON)
    log(`Removed ${LEGACY_DAEMON}`)
  }

  // Validate required keys
  const missing = REQUIRED_KEYS.filter((k) => !merged[k])
  if (missing.length > 0) {
    console.warn(
      `[setup:env] WARN: required keys missing from merged result: ${missing.join(", ")}`,
    )
    console.warn(
      `[setup:env] Add them to ${ROOT_ENV} before starting the app. See README.md for the template.`,
    )
  } else {
    log(`All required keys present: ${REQUIRED_KEYS.join(", ")}`)
  }

  log(`Done. Start the app with \`pnpm dev\`.`)
}

main()
