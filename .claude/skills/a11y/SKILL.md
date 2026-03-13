---
name: a11y
description: Perform an accessibility audit on UI changes.
disable-model-invocation: true
---

# Accessibility Audit

Perform an AAA accessibility pass on the current UI changes.

## Checklist

1. **Keyboard navigation** — All interactive elements reachable via Tab/Shift+Tab
2. **Focus visible** — Clear focus indicators on all focusable elements
3. **Focus order** — Tab order matches visual layout
4. **Labels/ARIA** — Correct labels, no redundant or missing aria attributes
5. **Contrast** — Text meets WCAG AAA contrast ratios (7:1 normal, 4.5:1 large)
6. **Reduced motion** — Animations respect `prefers-reduced-motion`
7. **No hover-only** — All hover interactions have keyboard/touch alternatives
8. **Touch targets** — Minimum 44x44px for mobile

## Steps

1. Identify all changed/new interactive components.
2. Run through the checklist for each.
3. Fix any violations found.
4. Document any gaps that need design input.
