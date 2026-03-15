---
title: "Security Settings"
description: "Manage your PIN, sessions, and remote access"
category: "settings"
order: 2
---

# Security Settings

These settings protect your FXFlow account from unauthorised access. Since FXFlow can place real trades with real money, keeping it secure is important.

## PIN Management

Your PIN is a 6-digit code you type to log in to FXFlow. It works just like the PIN on your phone.

- **Create a PIN**: choose 6 numbers you can remember. Avoid obvious ones like `000000` or `123456`.
- **Change your PIN**: enter your current PIN first, then choose a new one.

> [!TIP]
> Pick something you will remember but others cannot guess. A birthday or phone number is not ideal because people who know you could figure it out.

## Session Duration

A "session" is how long FXFlow remembers that you are logged in. After the session expires, you will need to enter your PIN again.

You can choose how long sessions last:

| Option       | Good for                                 |
| ------------ | ---------------------------------------- |
| **1 hour**   | Maximum security — you will log in often |
| **8 hours**  | A full trading day                       |
| **24 hours** | Daily use on a private computer          |
| **7 days**   | Convenience on your personal device      |
| **30 days**  | You rarely want to re-enter your PIN     |

> [!NOTE]
> Shorter sessions are more secure. If someone else could access your computer, use a shorter duration.

## Active Sessions

This section shows every device currently logged in to your FXFlow. Each entry shows:

- The device type (computer, phone, tablet)
- When the session started
- The last time it was active

If you see a device you do not recognise, click the **X** button next to it to revoke (end) that session immediately.

### Log Out All Devices

The **Log out all devices** button ends every session everywhere. This is useful if:

- You think someone else accessed your account
- You lost a device that was logged in
- You just want a fresh start

After clicking this, everyone (including you) will need to enter the PIN again.

## Lockout Protection

If someone tries to guess your PIN, FXFlow will lock them out:

- **5 wrong attempts** = locked out for **5 minutes**
- **10 wrong attempts** = locked out for **30 minutes**

> [!WARNING]
> This also applies to you. If you forget your PIN and keep guessing, you will be locked out too. Take your time and think carefully before trying again.

## Remote Access

Remote access lets you use FXFlow from your phone or another computer outside your home network.

- **Cloudflare Tunnel URL**: this is a special web address that securely connects your phone to your FXFlow running at home.
- In developer mode, this URL is auto-generated for you.
- Copy this URL and open it in your phone's browser to access FXFlow on the go.

> [!TIP]
> Remote access uses Cloudflare Tunnel, which is a secure "tunnel" through the internet. Your data is encrypted the entire way, so it is safe to use on public Wi-Fi.
