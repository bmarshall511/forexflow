---
title: "Deployment Mode"
description: "Choose between local and cloud deployment for FXFlow"
category: "settings"
order: 7
---

# Deployment Mode

Deployment mode controls where FXFlow's brain (the "daemon" — the background service that syncs trades and processes signals) runs. You have two options.

## Local Mode (Default)

In local mode, everything runs right on your computer.

**How it works:**

- The daemon runs as a program on your machine
- Your trading data is stored in a file on your computer
- Everything stays private and under your control

**Best for:**

- Using FXFlow on one computer
- Maximum privacy (nothing leaves your machine)
- Simple setup — it just works out of the box

**Downsides:**

- If your computer is off, FXFlow is off. No trade syncing, no alerts, no AI analysis.
- You can only access FXFlow from that one computer (unless you set up remote access)

## Cloud Mode

In cloud mode, the daemon runs on a server on the internet that is always on.

**How it works:**

- The daemon runs on a hosting service like Railway or Fly.io
- Your trading data is stored in a cloud database (Turso)
- FXFlow on your computer connects to the remote daemon

**Best for:**

- Always-on trading (the daemon runs 24/7 even when your computer is off)
- Accessing FXFlow from multiple devices
- Running automated strategies that need to react at any time

**Downsides:**

- Costs a small monthly fee for hosting
- Requires more setup
- Your data lives on someone else's server (encrypted, but still remote)

## Switching to Cloud Mode

1. Set up a daemon on Railway or Fly.io (see the deployment guide)
2. Enter the **Daemon URL** in the field (it looks like `https://fxflow-daemon.up.railway.app`)
3. Click **Test Connection** to verify FXFlow can reach it
4. Save the settings

> [!NOTE]
> The desktop app (macOS) can also use cloud mode. This means you can use the app on your Mac while the daemon runs in the cloud, giving you the best of both worlds.

## Choosing the Right Mode

| Question                       | Local                  | Cloud                        |
| ------------------------------ | ---------------------- | ---------------------------- |
| Is my computer always on?      | Yes → Local works fine | No → Cloud is better         |
| Do I need multi-device access? | No → Local is simpler  | Yes → Cloud is needed        |
| Do I run automated strategies? | Casual use → Local     | Serious automation → Cloud   |
| Do I want the simplest setup?  | Yes → Local            | Willing to configure → Cloud |

> [!TIP]
> There is a middle ground: run in local mode but enable a Cloudflare Tunnel (see Security settings). This gives you mobile access to your local FXFlow without paying for cloud hosting. The only catch is your computer still needs to be on.
