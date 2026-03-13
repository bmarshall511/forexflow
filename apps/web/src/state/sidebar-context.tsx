"use client"

import { createContext, useCallback, useEffect, useState, type ReactNode } from "react"
import { SIDEBAR_COOKIE_NAME, SIDEBAR_COOKIE_MAX_AGE } from "@/lib/constants"

export interface SidebarContextValue {
  /** Desktop sidebar expanded state */
  isOpen: boolean
  /** Mobile drawer open state */
  isMobileOpen: boolean
  /** Toggle desktop sidebar between expanded and collapsed */
  toggleSidebar: () => void
  /** Toggle mobile drawer */
  toggleMobileSidebar: () => void
  /** Programmatically set desktop sidebar state */
  setOpen: (open: boolean) => void
  /** Programmatically set mobile drawer state */
  setMobileOpen: (open: boolean) => void
}

export const SidebarContext = createContext<SidebarContextValue | null>(null)

interface SidebarProviderProps {
  children: ReactNode
  defaultOpen?: boolean
}

export function SidebarProvider({ children, defaultOpen = true }: SidebarProviderProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  // Sync desktop sidebar state to cookie
  useEffect(() => {
    document.cookie = `${SIDEBAR_COOKIE_NAME}=${isOpen}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; SameSite=Lax`
  }, [isOpen])

  const toggleSidebar = useCallback(() => setIsOpen((prev) => !prev), [])
  const toggleMobileSidebar = useCallback(() => setIsMobileOpen((prev) => !prev), [])
  const setOpen = useCallback((open: boolean) => setIsOpen(open), [])
  const setMobileOpen = useCallback((open: boolean) => setIsMobileOpen(open), [])

  return (
    <SidebarContext.Provider
      value={{ isOpen, isMobileOpen, toggleSidebar, toggleMobileSidebar, setOpen, setMobileOpen }}
    >
      {children}
    </SidebarContext.Provider>
  )
}
