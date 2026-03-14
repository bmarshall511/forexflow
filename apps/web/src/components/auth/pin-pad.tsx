"use client"

import { useCallback, useEffect } from "react"
import { Delete } from "lucide-react"

interface PinPadProps {
  /** Called when a digit is pressed */
  onDigit: (digit: string) => void
  /** Called when backspace is pressed */
  onBackspace: () => void
  /** Called when submit is triggered (enter key) */
  onSubmit?: () => void
  /** Disable all input */
  disabled?: boolean
}

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const

export function PinPad({ onDigit, onBackspace, onSubmit, disabled }: PinPadProps) {
  // Handle physical keyboard input
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (disabled) return
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault()
        onDigit(e.key)
      } else if (e.key === "Backspace") {
        e.preventDefault()
        onBackspace()
      } else if (e.key === "Enter" && onSubmit) {
        e.preventDefault()
        onSubmit()
      }
    },
    [onDigit, onBackspace, onSubmit, disabled],
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  const buttonClass =
    "flex h-16 w-16 items-center justify-center rounded-full text-xl font-medium transition-colors select-none " +
    "bg-secondary/50 hover:bg-secondary active:bg-secondary/80 active:scale-95 " +
    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring " +
    "disabled:pointer-events-none disabled:opacity-40"

  return (
    <div className="grid grid-cols-3 place-items-center gap-3" role="group" aria-label="PIN keypad">
      {DIGITS.map((digit) => (
        <button
          key={digit}
          type="button"
          className={buttonClass}
          onClick={() => onDigit(digit)}
          disabled={disabled}
          aria-label={`Digit ${digit}`}
        >
          {digit}
        </button>
      ))}

      {/* Bottom row: empty, 0, backspace */}
      <div aria-hidden="true" />
      <button
        type="button"
        className={buttonClass}
        onClick={() => onDigit("0")}
        disabled={disabled}
        aria-label="Digit 0"
      >
        0
      </button>
      <button
        type="button"
        className={`${buttonClass} hover:bg-secondary/30 bg-transparent`}
        onClick={onBackspace}
        disabled={disabled}
        aria-label="Delete last digit"
      >
        <Delete className="h-5 w-5" />
      </button>
    </div>
  )
}
