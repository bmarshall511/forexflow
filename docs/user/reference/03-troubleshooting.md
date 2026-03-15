---
title: "Troubleshooting"
description: "Solutions for common FXFlow issues"
category: "reference"
order: 3
---

# Troubleshooting

If something is not working the way you expect, check this page first. Issues are listed from most common to least common.

---

## "Daemon Disconnected" (red dot in the header)

The daemon is the background service that connects FXFlow to your broker. A red dot means it is not running or not reachable.

**Developer mode** (running with `pnpm dev`):

- Make sure you ran `pnpm dev` in your terminal and it is still running.
- Check the terminal output for any error messages.

**Desktop app**:

- Look for the FXFlow icon in your system tray (top-right of your Mac menu bar). If it is missing, the app may not have started properly.
- Quit FXFlow completely (right-click the tray icon and choose Quit), then reopen it.

**Cloud mode**:

- Go to **Settings > Deployment** and verify the daemon URL is correct.
- Click the "Test Connection" button to check if the remote daemon is reachable.

---

## "OANDA Connection Failed"

FXFlow cannot reach your OANDA account.

- Go to **Settings > OANDA** and double-check your API key. Make sure there are no extra spaces.
- Verify your account ID looks like `101-001-XXXXXXXX-001`.
- If you have a practice (demo) account, make sure you are using a practice API token, not a live one (and vice versa).
- Check [OANDA's status page](https://www.oanda.com) to see if they are experiencing an outage.

> [!WARNING]
> Never share your OANDA API key with anyone. It gives full access to your trading account.

---

## "Signal Rejected" (TradingView Alerts)

When a TradingView alert arrives but FXFlow does not place a trade, a reason code is shown on the TV Alerts page. Here is what each one means:

| Reason                    | What it means                                               | What to do                                                                         |
| ------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **cooldown_active**       | A signal for this pair was processed recently.              | Wait for the cooldown timer to expire, or clear it manually on the TV Alerts page. |
| **max_positions_reached** | You already have the maximum number of open trades allowed. | Close some trades or increase the limit in TV Alerts settings.                     |
| **daily_loss_limit**      | You have hit your daily loss limit.                         | This resets automatically the next trading day.                                    |
| **market_closed**         | The forex market is closed.                                 | Forex is closed from Friday 5 pm to Sunday 5 pm (US Eastern time).                 |
| **kill_switch_active**    | The emergency kill switch has been turned on.               | Go to TV Alerts settings and turn it off if you want to resume trading.            |
| **pair_not_whitelisted**  | The currency pair is not in your allowed list.              | Add the pair in TV Alerts settings under the pair whitelist.                       |

---

## Desktop App Won't Open (macOS)

**"FXFlow is damaged and can't be opened"**

This is a macOS Gatekeeper warning, not actual damage. Open Terminal and run:

```
xattr -cr /Applications/FXFlow.app
```

Then try opening FXFlow again.

**"FXFlow can't be opened because it is from an unidentified developer"**

Right-click (or Control-click) the FXFlow app icon, choose **Open** from the menu, then click **Open** again in the confirmation dialog. You only need to do this once.

---

## Blank Screen in Desktop App

- Wait 10 to 15 seconds. The first launch takes a little longer because the app needs to set up its database.
- Check if the FXFlow icon appears in the system tray. If it does, the daemon is running and the web app may just need a moment.
- If the screen is still blank after 30 seconds, quit the app completely and reopen it.

> [!NOTE]
> If the blank screen keeps happening after multiple restarts, try deleting the app and reinstalling it from a fresh DMG.

---

## Trades Not Syncing

FXFlow automatically syncs with OANDA every 2 minutes. If a trade you just placed on OANDA is not showing up:

- Click the **refresh button** on the Positions page to force an immediate sync.
- Check the daemon connection status (the dot in the header should be green).
- Check the OANDA connection status in the header.

> [!TIP]
> Trades placed _through_ FXFlow appear almost instantly. The 2-minute sync mainly catches trades placed directly on OANDA's own platform.

---

## AI Analysis Stuck or Failed

- Go to **Settings > AI Analysis** and verify your Claude API key is entered correctly.
- If an analysis has been running for more than a minute, click the **Cancel** button next to it and try again.
- Check that you still have API credits remaining on your Anthropic account.

---

## WebSocket Connection Issues

WebSockets are how FXFlow receives real-time updates. If data seems stale or the connection keeps dropping:

- Your firewall or network may be blocking WebSocket connections. Try a different network to test.
- Refresh the page in your browser.
- **Cloud mode**: make sure the daemon URL in **Settings > Deployment** starts with `https://` (not `http://`).

---

## Can't Access FXFlow Remotely

If you are trying to reach FXFlow from your phone or another computer:

- **Developer mode**: make sure `cloudflared` is installed (`brew install cloudflared` on Mac). The tunnel URL is shown in **Settings > Security**.
- The tunnel URL changes every time you restart the dev server, unless you set up a named tunnel.
- Check that your local FXFlow instance is actually running on the computer you are trying to reach.

> [!NOTE]
> For a stable remote URL that does not change, consider setting up a named Cloudflare tunnel or using Cloud mode with a deployed daemon.
