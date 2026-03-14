import { NextResponse } from "next/server"
import { existsSync, readFileSync } from "fs"
import { execSync } from "child_process"
import { homedir } from "os"
import { join, resolve } from "path"

export async function GET(): Promise<NextResponse> {
  try {
    const configPath = join(homedir(), ".cloudflared", "config.yml")
    const hasConfig = existsSync(configPath)

    let installed = false
    try {
      execSync("command -v cloudflared", { stdio: "ignore" })
      installed = true
    } catch {
      // cloudflared not installed
    }

    let running = false
    if (installed) {
      try {
        execSync("pgrep -x cloudflared", { stdio: "ignore" })
        running = true
      } catch {
        // not running
      }
    }

    // Read tunnel URL from file written by dev.sh
    // process.cwd() is monorepo root in dev, apps/web in some prod setups
    let url: string | null = null
    const candidates = [
      resolve(process.cwd(), "data/.tunnel-url"),
      resolve(process.cwd(), "../../data/.tunnel-url"),
    ]
    for (const candidate of candidates) {
      try {
        if (existsSync(candidate)) {
          const content = readFileSync(candidate, "utf-8").trim()
          if (content) {
            url = content
            break
          }
        }
      } catch {
        // file not readable
      }
    }

    return NextResponse.json({
      ok: true,
      data: { installed, configured: hasConfig, running, url },
    })
  } catch (error) {
    console.error("[GET /api/settings/tunnel-status]", error)
    return NextResponse.json({ ok: false, error: "Failed to check tunnel status" }, { status: 500 })
  }
}
