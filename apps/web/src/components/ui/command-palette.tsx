"use client"

import { Command } from "cmdk"
import { useEffect, useRef } from "react"
import { COMMAND_SECTIONS, type CommandItem, type CommandSectionId } from "@/lib/command-registry"

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  commands: CommandItem[]
}

export function CommandPalette({ open, onOpenChange, commands }: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      // Focus input after dialog animation starts
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  if (!open) return null

  const grouped = COMMAND_SECTIONS.reduce(
    (acc, section) => {
      acc[section.id] = commands.filter((c) => c.section === section.id)
      return acc
    },
    {} as Record<CommandSectionId, CommandItem[]>,
  )

  return (
    <div className="fixed inset-0 z-50" role="presentation">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Palette */}
      <div className="fixed left-1/2 top-[20%] w-full max-w-lg -translate-x-1/2 px-4">
        <Command
          className="bg-popover border-border overflow-hidden rounded-xl border shadow-2xl"
          label="Command palette"
          onKeyDown={(e) => {
            if (e.key === "Escape") onOpenChange(false)
          }}
        >
          <div className="border-border flex items-center border-b px-4">
            <SearchIcon />
            <Command.Input
              ref={inputRef}
              className="placeholder:text-muted-foreground flex h-12 w-full bg-transparent text-sm outline-none"
              placeholder="Type a command or search..."
            />
            <Kbd>Esc</Kbd>
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="text-muted-foreground py-8 text-center text-sm">
              No results found.
            </Command.Empty>

            {COMMAND_SECTIONS.map((section) => {
              const items = grouped[section.id]
              if (items.length === 0) return null
              return (
                <Command.Group
                  key={section.id}
                  heading={section.label}
                  className="[&_[cmdk-group-heading]]:text-muted-foreground/60 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider"
                >
                  {items.map((item) => (
                    <Command.Item
                      key={item.id}
                      value={item.label}
                      keywords={item.keywords}
                      onSelect={() => item.action()}
                      className="aria-selected:bg-accent aria-selected:text-accent-foreground flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm outline-none"
                    >
                      {item.icon && <item.icon className="text-muted-foreground size-4 shrink-0" />}
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.shortcut && <Kbd>{item.shortcut}</Kbd>}
                    </Command.Item>
                  ))}
                </Command.Group>
              )
            })}
          </Command.List>
        </Command>
      </div>
    </div>
  )
}

function SearchIcon() {
  return (
    <svg
      className="text-muted-foreground mr-2 size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle cx={11} cy={11} r={8} />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="bg-muted text-muted-foreground pointer-events-none ml-auto shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium tracking-widest">
      {children}
    </kbd>
  )
}
