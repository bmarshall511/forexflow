/** Build-time version constants injected via next.config.ts */

export const APP_VERSION: string = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev"
export const BUILD_SHA: string = process.env.NEXT_PUBLIC_BUILD_SHA ?? "local"
export const BUILD_DATE: string = process.env.NEXT_PUBLIC_BUILD_DATE ?? new Date().toISOString()

/** Formatted version string (e.g. "v0.1.0") */
export function formatVersion(): string {
  return APP_VERSION === "dev" ? "dev" : `v${APP_VERSION}`
}

/** Short build info for tooltips (e.g. "Build abc1234 · Mar 14, 2026") */
export function formatBuildInfo(): string {
  const sha = BUILD_SHA === "local" ? "local" : BUILD_SHA.slice(0, 7)
  const date = new Date(BUILD_DATE).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
  return `Build ${sha} · ${date}`
}
