import { cookies } from "next/headers"
import { SIDEBAR_COOKIE_NAME } from "@/lib/constants"

/** Server-side: read sidebar open state from cookie. Defaults to true (expanded). */
export async function getSidebarCookieValue(): Promise<boolean> {
  const cookieStore = await cookies()
  const value = cookieStore.get(SIDEBAR_COOKIE_NAME)?.value
  return value !== "false"
}
