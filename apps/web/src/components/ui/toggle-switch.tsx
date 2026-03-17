/**
 * Accessible toggle switch used across settings pages.
 * Mirrors the inline Toggle pattern from AI Trader settings but extracted for reuse.
 */
export function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`focus-visible:ring-ring relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${checked ? "bg-primary" : "bg-input"}`}
    >
      <span
        className={`bg-background pointer-events-none inline-block h-4 w-4 rounded-full shadow-lg ring-0 transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`}
      />
    </button>
  )
}
