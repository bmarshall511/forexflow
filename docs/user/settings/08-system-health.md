---
title: "System Health"
description: "Monitor the status of all FXFlow services and connections"
category: "settings"
order: 8
---

# System Health

The System Health page is like a dashboard for your car — it shows you whether all the important parts of FXFlow are working properly. If something goes wrong, this is the first place to check.

## Status Indicators

Each service shows a coloured dot:

- **Green** = working perfectly
- **Red** = something is wrong

### Daemon Status

The daemon is FXFlow's background service. It is the engine that syncs your trades, processes signals, and runs the AI. If this is red, almost nothing else will work.

**If it is red:**

- Make sure the daemon is running (check your terminal or the desktop app)
- In cloud mode, check that your hosting service (Railway/Fly.io) is online
- Try restarting FXFlow

### Database Status

The database is where FXFlow stores all your trades, settings, and history. If this is red, FXFlow cannot save or load any data.

**If it is red:**

- In local mode, check that the database file exists and is not corrupted
- In cloud mode, check your Turso database dashboard
- Try restarting the daemon

### OANDA Connection

This shows whether FXFlow can talk to your OANDA broker account. If this is red, FXFlow cannot see your trades or place new ones.

**If it is red:**

- Check your internet connection
- Verify your API token has not expired (go to OANDA settings)
- OANDA might be having a service outage — check their status page
- Make sure you are using the right token for your mode (practice vs live)

### WebSocket Connection

WebSocket is the real-time connection between the FXFlow web page in your browser and the daemon. If this is red, you will not see live updates (prices, new trades, notifications) until you refresh.

**If it is red:**

- Refresh the page in your browser
- Check that the daemon is running (see Daemon Status above)
- If using remote access, make sure your tunnel is active

## General Troubleshooting

> [!TIP]
> The number one fix for most problems is: restart the daemon, then refresh the browser page. This solves about 80% of issues.

If multiple indicators are red:

1. **Everything red** — the daemon is probably not running. Start it first.
2. **Daemon green, others red** — likely a configuration problem. Check your settings.
3. **Only WebSocket red** — try refreshing the page. If that does not work, restart the daemon.
4. **Only OANDA red** — an OANDA-specific problem. Check your API token and internet connection.

> [!NOTE]
> FXFlow checks these statuses automatically every few seconds. You do not need to keep refreshing this page — the indicators update on their own.
