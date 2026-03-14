/**
 * TradingView webhook IP whitelist.
 * These are the known IPs that TradingView sends webhook alerts from.
 * @see https://www.tradingview.com/support/solutions/43000529348-about-webhooks/
 * Last verified: 2026-03-03
 */
const TRADINGVIEW_IPS = new Set(["52.89.214.238", "34.212.75.30", "54.218.53.128", "52.32.178.7"])

/** Check if a request IP is in the TradingView whitelist. */
export function isAllowedIP(ip: string | null): boolean {
  if (!ip) return false
  if (TRADINGVIEW_IPS.has(ip)) return true

  // Log rejected IPs to help diagnose if TradingView adds new egress IPs
  console.warn(`[ip-whitelist] Rejected non-whitelisted IP: ${ip}`)
  return false
}

/**
 * Check if the request is authorized as a test signal.
 * Test signals bypass IP checks by providing the daemon secret
 * in the X-Test-Signal header.
 */
export function isTestSignal(request: Request, daemonSecret: string): boolean {
  const header = request.headers.get("X-Test-Signal")
  return !!header && header === daemonSecret
}
