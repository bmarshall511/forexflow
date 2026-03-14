"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

interface ShortcutEntry {
  keys: string[]
  label: string
}

interface ShortcutSection {
  title: string
  items: ShortcutEntry[]
}

const SECTIONS: ShortcutSection[] = [
  {
    title: "Navigation",
    items: [
      { keys: ["\u2318", "K"], label: "Command palette" },
      { keys: ["G", "D"], label: "Go to Dashboard" },
      { keys: ["G", "P"], label: "Go to Positions" },
      { keys: ["G", "C"], label: "Go to Charts" },
      { keys: ["G", "A"], label: "Go to AI Analysis" },
      { keys: ["G", "R"], label: "Go to AI Trader" },
      { keys: ["G", "L"], label: "Go to Alerts" },
      { keys: ["G", "S"], label: "Go to Settings" },
    ],
  },
  {
    title: "App",
    items: [
      { keys: ["\u2318", "B"], label: "Toggle sidebar" },
      { keys: ["?"], label: "Show this help" },
      { keys: ["Esc"], label: "Close dialog / sheet / palette" },
    ],
  },
]

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="bg-muted text-muted-foreground border-border inline-flex h-6 min-w-6 items-center justify-center rounded border px-1.5 font-mono text-xs font-medium">
      {children}
    </kbd>
  )
}

interface ShortcutsHelpProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ShortcutsHelp({ open, onOpenChange }: ShortcutsHelpProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Navigate quickly with keyboard shortcuts. Press Esc to close.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h3 className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wider">
                {section.title}
              </h3>
              <ul className="space-y-1.5" role="list">
                {section.items.map((item) => (
                  <li key={item.label} className="flex items-center justify-between py-0.5">
                    <span className="text-sm">{item.label}</span>
                    <span className="flex items-center gap-1">
                      {item.keys.map((k, i) => (
                        <Kbd key={i}>{k}</Kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
