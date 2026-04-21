---
name: accessibility
scope:
  - "apps/web/src/components/**"
  - "apps/web/src/app/**"
  - "apps/desktop/src/**/*.tsx"
enforcement: strict
version: 0.1.0
related:
  - "agents/code-reviewer.md"
  - "skills/a11y/SKILL.md"
applies_when: "Editing UI components, pages, or anything rendered to a screen"
---

# Accessibility — AAA Baseline

AAA is the minimum, not the aspiration. Every interactive element supports keyboard, screen reader, and touch. Every page remains usable under `prefers-reduced-motion`, increased text size, and high-contrast mode.

If a design spec conflicts with AAA, the spec loses. File a design-review issue; do not ship the violation.

## Keyboard

- **Every interactive element reachable by Tab.** No mouse-only controls.
- **Focus visible.** Every focusable element has a visible focus ring — Tailwind's `focus-visible:ring-*` minimum. Never remove the ring via `outline-none` without replacing it.
- **Focus order matches visual order.** No `tabindex` values other than `0` and `-1`. Let the DOM order drive tab order.
- **Escape closes modals, dropdowns, sheets.** Enter submits forms. Arrow keys navigate menus.
- **Skip links** on pages with significant navigation ("Skip to content" as the first focusable element).

## Semantics

- **Use the right element.** `<button>` for actions. `<a>` for navigation. `<input type="checkbox">` for checkboxes. `<nav>`, `<main>`, `<aside>`, `<header>`, `<footer>` for landmarks.
- **No div-as-button.** A clickable div is a keyboard trap and a screen-reader dead zone. Use `<button>` or `<a>` and style with Tailwind.
- **Headings in hierarchy.** One `<h1>` per page. `<h2>` inside `<h1>`. No skipping levels.
- **Labels on every form control.** `<label htmlFor="id">` paired with `id`, or visually-hidden labels where the visual design omits them. Never rely on placeholder alone.

## ARIA — last resort

Use HTML semantics first. Add ARIA only when the native element genuinely can't express the role. When you do:

- `aria-label` — short, imperative, context-aware ("Close menu", not "Close")
- `aria-labelledby` — preferred over `aria-label` when a visible label exists
- `aria-describedby` — for supplementary context (errors, hints)
- `aria-live` — for asynchronous updates (polite for most; assertive only for urgent)
- `aria-expanded`, `aria-selected`, `aria-pressed` — for disclosure patterns

Never duplicate: if `<button>Close</button>` exists, do not add `aria-label="Close"`.

## Color and contrast

- **AAA contrast**: 7:1 for normal text, 4.5:1 for large text (≥18.66px or ≥14px bold).
- **Focus ring contrast**: 3:1 against adjacent colors.
- **Never convey meaning by color alone.** Pair color with an icon, label, or shape. A red dot and a green dot are indistinguishable to deuteranopes.
- **Semantic tokens** from the theme: `text-status-connected`, `text-status-disconnected`, `bg-surface-elevated`, etc. No raw hex.

## Motion

- **`prefers-reduced-motion` is respected at the component level.** Framer-Motion and CSS animations read the user's preference and degrade to instant transitions.
- **No autoplay.** No parallax. No gratuitous motion. Animations serve comprehension, not decoration.
- **Toast timing**: default 6 seconds, long messages 10s, user can dismiss. Never auto-dismiss an error.

## Touch targets

- **Minimum 44×44 CSS pixels** for every tappable element on mobile. Button padding + content must meet this. No exceptions.
- **Spacing between targets**: 8px minimum between tappable siblings to prevent adjacent-tap errors.
- **Gestures always have a button alternative.** Swipe-to-close has a visible close button. Pull-to-refresh has a refresh button.

## Responsive and zoom

- **Layouts must not break at 400% zoom** (WCAG 2.1 requirement).
- **No horizontal scrolling** at standard viewport widths (≥320px mobile, ≥1024px desktop) — except for data tables which can overflow with a sticky first column.
- **Text is never truncated below 16px** on mobile. `text-base` is the floor for body copy.
- **Container queries** over media queries where the component's local context matters more than the viewport.

## Forms

- **Error messages associated with fields** via `aria-describedby`.
- **Required fields marked** with a visible indicator AND `required` attribute, not just red asterisks.
- **Validation is not on-type.** It runs on blur or on submit. On-type validation punishes the user mid-input.
- **Successful submission announced** to screen readers via `aria-live="polite"` region.

## Tables

- `<th scope="col">` and `<th scope="row">` — explicit scope on every header cell.
- **Caption** (`<caption>`) for data tables that are not obvious from surrounding context.
- **Sortable headers** have `aria-sort="ascending" | "descending" | "none"`.

## Images and icons

- **Decorative images**: `alt=""` (not missing).
- **Informative images**: `alt="concise description"`.
- **Icons without accompanying text**: `aria-label` or `<span class="sr-only">label</span>`.
- **Charts and graphs**: have an adjacent text summary conveying the same information.

## Testing

Every UI component ships with:

1. **A Playwright spec** asserting keyboard navigation and focus order
2. **An axe-playwright assertion** — `expect(page).toHaveNoViolations()` — on the page that renders it
3. **A visual regression snapshot** at mobile, tablet, and desktop viewports

The `/a11y` skill runs a targeted audit against changed components. The `code-reviewer` agent treats AAA violations as blocking.

## Quick checklist for every UI change

Before marking complete, walk through:

- [ ] I Tab-reached every interactive element
- [ ] I pressed Escape in every modal and it closed
- [ ] I zoomed to 400% and nothing broke
- [ ] I inspected with axe and there are zero violations
- [ ] I toggled `prefers-reduced-motion` and animations respect it
- [ ] I tested with a screen reader (VoiceOver on macOS, NVDA on Windows) — labels announce sensibly
- [ ] Touch targets measure ≥44×44 in the mobile viewport
- [ ] No color-only meaning — every status signal pairs with a label or icon

If any box is unchecked, the change is not done.
