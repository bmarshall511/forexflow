/** Currency code to flag emoji mapping for visual flair in the pair picker. */
export const CURRENCY_FLAGS: Record<string, string> = {
  EUR: "\uD83C\uDDEA\uD83C\uDDFA",
  USD: "\uD83C\uDDFA\uD83C\uDDF8",
  GBP: "\uD83C\uDDEC\uD83C\uDDE7",
  JPY: "\uD83C\uDDEF\uD83C\uDDF5",
  CHF: "\uD83C\uDDE8\uD83C\uDDED",
  AUD: "\uD83C\uDDE6\uD83C\uDDFA",
  NZD: "\uD83C\uDDF3\uD83C\uDDFF",
  CAD: "\uD83C\uDDE8\uD83C\uDDE6",
}

/** Get flag emojis for a pair like "EUR_USD" -> "EU US" */
export function getPairFlags(value: string): string {
  const [base, quote] = value.split("_")
  const baseFlag = CURRENCY_FLAGS[base ?? ""] ?? ""
  const quoteFlag = CURRENCY_FLAGS[quote ?? ""] ?? ""
  return `${baseFlag}\u200A${quoteFlag}`
}
