import { NextResponse } from "next/server"
import { exec } from "node:child_process"
import { randomBytes } from "node:crypto"
import path from "node:path"
import fs from "node:fs"
import { getTVAlertsConfig, updateTVAlertsConfig } from "@fxflow/db"
import type { ApiResponse } from "@fxflow/types"

const DAEMON_URL = process.env.NEXT_PUBLIC_DAEMON_REST_URL ?? "http://localhost:4100"

interface DeployResult {
  workerUrl: string
  cfWorkerUrl: string
  webhookUrl: string
}

function execAsync(
  cmd: string,
  opts?: { cwd?: string },
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(cmd, { ...opts, timeout: 120_000 }, (error, stdout, stderr) => {
      if (error) reject(Object.assign(error, { stdout, stderr }))
      else resolve({ stdout, stderr })
    })
  })
}

function findCFWorkerDir(): string {
  // turbo dev typically runs from monorepo root
  const fromRoot = path.resolve(process.cwd(), "apps/cf-worker")
  if (fs.existsSync(path.join(fromRoot, "wrangler.toml"))) return fromRoot

  // fallback: running from apps/web
  const fromWeb = path.resolve(process.cwd(), "../../apps/cf-worker")
  if (fs.existsSync(path.join(fromWeb, "wrangler.toml"))) return fromWeb

  throw new Error(
    "Could not find apps/cf-worker directory. Are you running from the monorepo root?",
  )
}

export async function POST(): Promise<NextResponse<ApiResponse<DeployResult>>> {
  try {
    const cfWorkerDir = findCFWorkerDir()

    // 1. Check wrangler auth — auto-login if needed (opens browser)
    let loggedIn = false
    try {
      await execAsync("npx wrangler whoami", { cwd: cfWorkerDir })
      loggedIn = true
    } catch {
      // Not logged in — attempt auto-login (opens browser for OAuth)
    }

    if (!loggedIn) {
      try {
        await execAsync("npx wrangler login", { cwd: cfWorkerDir })
        // Verify login succeeded
        await execAsync("npx wrangler whoami", { cwd: cfWorkerDir })
      } catch {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Cloudflare login failed or was cancelled. A browser window should have opened — please authorize and try again.",
          },
          { status: 400 },
        )
      }
    }

    // 2. Generate secrets (reuse existing webhook token if set)
    const daemonSecret = randomBytes(24).toString("hex")
    const existingConfig = await getTVAlertsConfig()
    const webhookToken = existingConfig.webhookToken || randomBytes(16).toString("hex")

    // 3. Deploy the worker
    let deployOutput: string
    try {
      const { stdout, stderr } = await execAsync("npx wrangler deploy", {
        cwd: cfWorkerDir,
      })
      deployOutput = stdout + "\n" + stderr
    } catch (err: unknown) {
      const execErr = err as {
        stdout?: string
        stderr?: string
        message?: string
      }
      return NextResponse.json(
        {
          ok: false,
          error: `Deploy failed: ${execErr.stderr || execErr.stdout || execErr.message}`,
        },
        { status: 500 },
      )
    }

    // 4. Parse worker URL from deploy output
    const urlMatch = deployOutput.match(/https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev/)
    if (!urlMatch) {
      return NextResponse.json(
        {
          ok: false,
          error: `Deploy succeeded but could not parse worker URL from output:\n${deployOutput}`,
        },
        { status: 500 },
      )
    }
    const workerUrl = urlMatch[0]

    // 5. Set CF Worker secrets
    try {
      await execAsync(
        `echo "${webhookToken}" | npx wrangler secret put WEBHOOK_TOKEN --name fxflow-tv-alerts`,
        { cwd: cfWorkerDir },
      )
      await execAsync(
        `echo "${daemonSecret}" | npx wrangler secret put DAEMON_SECRET --name fxflow-tv-alerts`,
        { cwd: cfWorkerDir },
      )
    } catch (err: unknown) {
      const execErr = err as { stderr?: string; message?: string }
      return NextResponse.json(
        {
          ok: false,
          error: `Deployed but failed to set secrets: ${execErr.stderr || execErr.message}`,
        },
        { status: 500 },
      )
    }

    // 6. Build connection URLs
    const wsHost = workerUrl.replace("https://", "")
    const cfWorkerUrl = `wss://${wsHost}/ws/${daemonSecret}`
    const webhookUrl = `${workerUrl}/webhook/${webhookToken}`

    // 7. Save to DB
    await updateTVAlertsConfig({
      cfWorkerUrl,
      cfWorkerSecret: daemonSecret,
      webhookToken,
    })

    // 8. Trigger daemon reconnect (best-effort)
    try {
      await fetch(`${DAEMON_URL}/actions/tv-alerts/reconnect-cf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    } catch {
      // Daemon might not be running yet — that's OK
    }

    return NextResponse.json({
      ok: true,
      data: { workerUrl, cfWorkerUrl, webhookUrl },
    })
  } catch (error) {
    console.error("[POST /api/tv-alerts/deploy-cf-worker]", error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
