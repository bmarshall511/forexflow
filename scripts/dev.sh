#!/bin/bash
# ─── FXFlow Dev Environment ─────────────────────────────────────────────────
# Starts turbo dev + Cloudflare Quick Tunnel for remote access.
#
# Quick Tunnel = zero config. No Cloudflare account, no domain, no login.
# Just installs cloudflared and gets a public URL automatically.
#
# The URL changes each restart — that's fine for personal use.
# For a persistent URL, set up a named tunnel (see docs/ai/remote-access.md).
#
# Use `pnpm dev:local` to skip the tunnel entirely.

TUNNEL_PID=""
TUNNEL_LOG="$TMPDIR/fxflow-tunnel.log"
TUNNEL_URL_FILE="$(cd "$(dirname "$0")/.." && pwd)/data/.tunnel-url"
LOCAL_PORT="${LOCAL_PORT:-3000}"
CONFIG_FILE="$HOME/.cloudflared/config.yml"

cleanup() {
  if [ -n "$TUNNEL_PID" ]; then
    kill "$TUNNEL_PID" 2>/dev/null
    wait "$TUNNEL_PID" 2>/dev/null
  fi
  rm -f "$TUNNEL_LOG" "$TUNNEL_URL_FILE" 2>/dev/null
}
trap cleanup EXIT INT TERM

start_quick_tunnel() {
  # Quick tunnel: no account, no config, no login. Just works.
  cloudflared tunnel --url "http://localhost:${LOCAL_PORT}" > "$TUNNEL_LOG" 2>&1 &
  TUNNEL_PID=$!

  # Wait for the URL to appear in the log (up to 10s)
  echo "  Starting Cloudflare Quick Tunnel..."
  for i in $(seq 1 20); do
    sleep 0.5
    TUNNEL_URL=$(grep -aoE 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | head -1)
    if [ -n "$TUNNEL_URL" ]; then
      break
    fi
    # Check if process died
    if ! kill -0 "$TUNNEL_PID" 2>/dev/null; then
      echo "  ✗ Tunnel failed to start. Check logs: $TUNNEL_LOG"
      TUNNEL_PID=""
      return 1
    fi
  done

  if [ -n "$TUNNEL_URL" ]; then
    # Write URL to file so the web app can read it
    echo "$TUNNEL_URL" > "$TUNNEL_URL_FILE"

    echo ""
    echo "  ┌─────────────────────────────────────────────┐"
    echo "  │  Remote access URL:                         │"
    echo "  │  $TUNNEL_URL  │"
    echo "  │                                             │"
    echo "  │  Open this on your phone to access FXFlow.  │"
    echo "  │  Also visible in Settings > Security.       │"
    echo "  └─────────────────────────────────────────────┘"
    echo ""
  else
    echo "  ✓ Tunnel started (URL will appear in logs: $TUNNEL_LOG)"
  fi

  return 0
}

start_named_tunnel() {
  cloudflared tunnel run 2>&1 | sed 's/^/[tunnel] /' &
  TUNNEL_PID=$!
  echo "  ✓ Named tunnel started (PID $TUNNEL_PID)"
}

# ─── Tunnel Logic ────────────────────────────────────────────────────────────

if ! command -v cloudflared &>/dev/null; then
  # Not installed → offer to install
  echo ""
  echo "  Remote access requires cloudflared."
  read -rp "  Install it now via Homebrew? (y/n): " INSTALL_ANSWER
  echo ""

  if [ "$INSTALL_ANSWER" = "y" ] || [ "$INSTALL_ANSWER" = "Y" ]; then
    echo "  Installing cloudflared..."
    brew install cloudflare/cloudflare/cloudflared
    if ! command -v cloudflared &>/dev/null; then
      echo "  ✗ Install failed. Starting without tunnel."
      echo ""
    fi
  fi
fi

if command -v cloudflared &>/dev/null; then
  if [ -f "$CONFIG_FILE" ]; then
    # Named tunnel configured → use it (persistent URL)
    start_named_tunnel
  else
    # No config → use quick tunnel (random URL, zero config)
    start_quick_tunnel
  fi
fi

# ─── Start Dev ───────────────────────────────────────────────────────────────

exec turbo dev
