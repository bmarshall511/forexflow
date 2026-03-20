import type { NextConfig } from "next"
import bundleAnalyzer from "@next/bundle-analyzer"
import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
})

// Read base version from monorepo root package.json
const rootPkg = JSON.parse(readFileSync(resolve(import.meta.dirname, "../../package.json"), "utf8"))
const baseVersion = rootPkg.version ?? "0.0.0"

// Get git SHA and commit count at build time for dynamic versioning
let buildSha = "local"
let commitCount = "0"
try {
  buildSha = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim()
  commitCount = execSync("git rev-list --count HEAD", { encoding: "utf8" }).trim()
} catch {
  // Not a git repo or git not available — use fallback
}

// Dynamic version: base version + commit count (e.g. "0.1.0+342")
const appVersion = buildSha === "local" ? baseVersion : `${baseVersion}+${commitCount}`

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: resolve(import.meta.dirname, "../../"),
  // Include native libsql binaries that Next.js file tracing can't auto-detect.
  // libsql uses dynamic require(`@libsql/${platform}`) which can't be traced statically.
  outputFileTracingIncludes: {
    "/**": [
      "../../node_modules/.pnpm/@libsql+darwin-arm64@*/node_modules/@libsql/darwin-arm64/**/*",
      "../../node_modules/.pnpm/@libsql+darwin-x64@*/node_modules/@libsql/darwin-x64/**/*",
    ],
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
    NEXT_PUBLIC_BUILD_SHA: buildSha,
    NEXT_PUBLIC_BUILD_DATE: new Date().toISOString(),
  },
  transpilePackages: ["@fxflow/db", "@fxflow/shared", "@fxflow/types"],
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-libsql", "@libsql/client", "libsql"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ]
  },
}

export default withBundleAnalyzer(nextConfig)
