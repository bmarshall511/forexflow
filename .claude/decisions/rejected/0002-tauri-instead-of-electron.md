---
id: rejected-0002
title: Use Tauri instead of Electron for the desktop app
status: rejected
date: 2026-04-21
owner: maintainer
supersedes: null
superseded_by: null
tags: [stack, desktop, rejected]
---

# rejected-0002 — Use Tauri instead of Electron for the desktop app

## Context

Tauri ships a much smaller bundle (~10-20 MB vs Electron's ~80-120 MB), uses the system webview (WebKit on macOS) instead of bundling Chromium, and has a reputation for better energy behavior on laptops.

## Why rejected

1. **Node ecosystem access in the daemon.** The daemon is a long-running Node process: OANDA integration, WebSocket relay, Prisma, Pino, Anthropic SDK. Tauri's Rust-first architecture would require either (a) rewriting the daemon in Rust, or (b) still shelling out to Node to run the daemon — which negates Tauri's size benefit in a local-mode install because Node is still on disk.

2. **WebKit divergence from Chromium.** The web app uses Next.js 15 + shadcn + Tailwind 4 + Lightweight Charts. These target Chromium-consistent behavior; WebKit-specific quirks (form validation, scrollbar styling, date-picker rendering, IndexedDB corner cases) would turn into a per-target bug stream. Not worth the binary-size win.

3. **Electron's maturity.** `electron-builder`, `electron-store`, `electron-updater` are battle-tested for the exact shape this project wants (DMG, persistent settings, GitHub-Releases auto-update). Tauri's equivalents exist but are younger; the bug tail would be on us.

4. **macOS-only for v3.** Cross-platform via a single webview engine would matter if we targeted Windows + Linux. We do not (yet). Tauri's cross-platform story is a future concern.

## When to reconsider

- A truly cross-platform release becomes a product requirement
- The daemon is reshaped to run entirely in the browser (no Node) — unlikely given OANDA integration needs
- Electron's auto-updater or signing story breaks in a way that moves the cost ratio

Reopening requires a new ADR that supersedes this one.

## References

- `.claude/context/stack.md` §"Desktop"
- A `desktop-patterns` rule may land alongside the Electron packaging work in a future phase; not yet present in this repo
