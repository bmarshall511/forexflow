---
paths:
  - "apps/web/src/components/**"
---

# Accessibility (AAA Baseline)

- Semantic HTML first.
- Keyboard navigation for all interactive elements.
- Visible focus states (never remove without replacement).
- Correct labels for inputs. No redundant aria.
- No color-only meaning. Respect prefers-reduced-motion.
- Reasonable contrast for text and critical states.
- Touch-friendly targets (min 44x44px).
- Test: keyboard-only navigation, focus order, screen-reader labels, contrast.
