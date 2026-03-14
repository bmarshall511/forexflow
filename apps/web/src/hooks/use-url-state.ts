import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useCallback } from "react"

/**
 * Sync a key-value pair to URL search params.
 * Returns [value, setValue] similar to useState.
 * When setValue is called, the URL is updated via replace (no history entry).
 * Default values are omitted from the URL to keep it clean.
 */
export function useUrlState(key: string, defaultValue: string): [string, (value: string) => void] {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const value = searchParams.get(key) ?? defaultValue

  const setValue = useCallback(
    (newValue: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (newValue === defaultValue) {
        params.delete(key)
      } else {
        params.set(key, newValue)
      }
      const query = params.toString()
      router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false })
    },
    [key, defaultValue, searchParams, router, pathname],
  )

  return [value, setValue]
}

/**
 * Numeric variant of useUrlState.
 * Parses the URL param as an integer, falling back to defaultValue on invalid input.
 */
export function useUrlStateNumber(
  key: string,
  defaultValue: number,
): [number, (value: number) => void] {
  const [raw, setRaw] = useUrlState(key, String(defaultValue))

  const parsed = Number.parseInt(raw, 10)
  const value = Number.isFinite(parsed) ? parsed : defaultValue

  const setValue = useCallback((n: number) => setRaw(String(n)), [setRaw])

  return [value, setValue]
}
