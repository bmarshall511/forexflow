---
title: "Accessibility Standards"
description: "AAA-level accessibility requirements, ARIA patterns, and testing checklist"
category: "dev"
order: 5
---

# Accessibility Standards (AAA Baseline)

## Semantic HTML

- Use correct elements: `<button>` for actions, `<a>` for navigation, `<table>` for tabular data.
- Headings in order (`h1` → `h2` → `h3`). One `h1` per page.
- Use `<nav>`, `<main>`, `<section>`, `<aside>` landmarks. Every landmark needs an accessible name if duplicated.
- Lists for groups of related items (trade lists, signal lists, menu items).

## Keyboard Navigation

- All interactive elements reachable via Tab. No keyboard traps.
- Custom widgets (sheets, dropdowns, modals) follow WAI-ARIA patterns:
  - Escape closes overlays and returns focus to trigger.
  - Arrow keys navigate within composite widgets (menus, tabs, lists).
- Trade tables: row actions accessible via keyboard (Enter/Space on action triggers).
- Chart interactions: provide keyboard alternatives for hover-only data points.

## Focus Management

- Visible focus ring on every interactive element. Never `outline: none` without a styled replacement.
- Focus ring style: 2px offset ring using Tailwind `focus-visible:ring-2 ring-offset-2`.
- When opening sheets/modals, move focus to the first interactive element inside.
- When closing, return focus to the trigger element.
- Focus order must match visual reading order (no positive `tabIndex`).

## Labels & ARIA

- Every `<input>`, `<select>`, `<textarea>` has a visible `<label>` or `aria-label`.
- Icon-only buttons require `aria-label` describing the action (e.g., "Close trade", "Open AI analysis").
- Do not add redundant ARIA — if the semantic HTML conveys meaning, skip `role` and `aria-*`.
- Live regions (`aria-live="polite"`) for: price updates, trade status changes, notification toasts.
- Status indicators (connected/disconnected) use `aria-label`, not color alone.

## Color & Contrast

- Text contrast: minimum 7:1 for normal text, 4.5:1 for large text (AAA).
- UI component contrast: minimum 3:1 against adjacent colors.
- Never use color as the only indicator — pair with icons, text, or patterns:
  - Profit/loss: green/red + up/down arrow + numeric sign.
  - Connection status: color dot + text label.
  - Trade source badges: color + text label.

## Motion & Responsiveness

- Wrap animations in `@media (prefers-reduced-motion: no-preference)`.
- Chart animations, loading spinners, and transitions must respect this.
- No auto-playing motion that cannot be paused.

## Touch & Interaction

- Touch targets: minimum 44x44px for all interactive elements.
- No hover-only interactions — anything revealed on hover must also work on tap/focus.
- Dropdown menus and tooltips: trigger on click/tap, not hover-only.
- Swipe gestures (if any) must have a visible button alternative.

## Testing Checklist

Before shipping a new page or component:

- [ ] Tab through entire page — all controls reachable, logical order
- [ ] Use with screen reader (VoiceOver) — all content announced correctly
- [ ] Resize to 400% zoom — no content overflow or loss
- [ ] Test at 320px width — mobile layout functional
- [ ] Verify with `prefers-reduced-motion: reduce` — no jarring animations
- [ ] Run axe DevTools — zero violations
