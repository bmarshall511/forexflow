import type { LucideIcon } from "lucide-react"

export interface CommandItem {
  id: string
  label: string
  shortcut?: string
  icon?: LucideIcon
  section: "navigate" | "actions" | "quick"
  action: () => void
  keywords?: string[]
}

export const COMMAND_SECTIONS = [
  { id: "navigate", label: "Navigate" },
  { id: "actions", label: "Actions" },
  { id: "quick", label: "Quick Settings" },
] as const

export type CommandSectionId = (typeof COMMAND_SECTIONS)[number]["id"]
