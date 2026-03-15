---
title: "Installing FXFlow"
description: "Three ways to install FXFlow: Desktop app, Developer mode, or Cloud deployment."
category: "getting-started"
order: 2
---

# Installing FXFlow

There are three ways to install FXFlow. Pick the one that fits you best — if you're not sure, go with **Option A**.

---

## Option A: Desktop App (Recommended for Beginners)

This is the easiest way. You download one file, drag it into your Applications folder, and you're done.

### Steps

1. **Go to the GitHub Releases page** — Visit the FXFlow repository on GitHub and find the latest release.
2. **Download the DMG file** — Look for the file ending in `.dmg` (this is a Mac installer package).
3. **Open the DMG** — Double-click the downloaded file. A window will appear showing the FXFlow icon and your Applications folder.
4. **Drag FXFlow to Applications** — Drag the FXFlow icon onto the Applications folder. That's it — it's installed.
5. **Open FXFlow** — Go to your Applications folder and double-click FXFlow.

### First Launch: macOS Security Warning

Because FXFlow isn't downloaded from the Mac App Store, macOS might block it the first time. Here's how to get past that:

1. **Right-click** (or Control-click) on FXFlow in your Applications folder
2. Click **Open** from the menu
3. A warning dialog will appear — click **Open** again

> [!TIP]
> You only need to do this once. After the first time, FXFlow will open normally like any other app.

If you see a message saying the app is **"damaged"**, open the Terminal app (search for "Terminal" in Spotlight) and paste this command:

```bash
xattr -cr /Applications/FXFlow.app
```

Press Enter, then try opening FXFlow again.

### Auto-Updates

FXFlow checks for updates every 4 hours. When a new version is available, it will ask if you'd like to install it. Easy.

---

## Option B: Developer Mode

This is for people who are comfortable with the command line (Terminal) and want to run FXFlow from the source code. If terms like "Node.js" and "git clone" mean nothing to you, stick with Option A.

### Prerequisites

You need these installed on your computer first:

- **Node.js 22 or newer** — Download from [nodejs.org](https://nodejs.org)
- **pnpm 10 or newer** — Install by running `npm install -g pnpm` in Terminal

### Steps

1. **Clone the repository** (download the code):

```bash
git clone https://github.com/bmarshall511/forexflow.git
cd forexflow
```

2. **Install dependencies** (download all the libraries FXFlow needs):

```bash
pnpm install
```

3. **Generate the database**:

```bash
pnpm db:generate
```

4. **Create environment files** — You need two `.env` files with your secret settings.

In `apps/web/`, create a file called `.env` with:

```
DATABASE_URL="file:../../data/fxflow.db"
ENCRYPTION_KEY="your-encryption-key-here"
```

In `apps/daemons/`, create a file called `.env` with:

```
DATABASE_URL="file:../../data/fxflow.db"
ENCRYPTION_KEY="your-encryption-key-here"
```

5. **Generate an encryption key** (this keeps your data safe):

```bash
openssl rand -hex 32
```

Copy the output and paste it as your `ENCRYPTION_KEY` in both `.env` files.

> [!WARNING]
> Never share your encryption key or commit your `.env` files to GitHub. These are secrets that protect your trading data.

6. **Start FXFlow**:

```bash
pnpm dev
```

7. **Open your browser** and go to `http://localhost:3000`

> [!NOTE]
> Developer mode runs two services: the web app on port 3000 and the daemon (background worker) on port 4100. Both start automatically with `pnpm dev`.

---

## Option C: Cloud Deployment

This is for advanced users who want FXFlow running 24/7 on a server, accessible from any device. It requires familiarity with cloud platforms.

### Architecture Overview

- **Daemon** runs on a cloud platform like Railway or Fly.io
- **Database** lives on Turso (a cloud SQLite service)
- **Web app** connects to the remote daemon

### Steps

1. **Create a Turso database**:
   - Sign up at [turso.tech](https://turso.tech)
   - Create a new database
   - Note your database URL and auth token

2. **Deploy the daemon** using the included Dockerfile:
   - Push the FXFlow repository to your cloud platform
   - Point the build at the Dockerfile in `apps/daemons/`

3. **Set environment variables** on your cloud platform:

```
DATABASE_URL=libsql://your-db-name.turso.io
TURSO_AUTH_TOKEN=your-turso-token
ENCRYPTION_KEY=your-encryption-key
```

4. **Configure the web app** to connect to your cloud daemon:
   - In FXFlow settings, set the deployment mode to "Cloud"
   - Enter the URL of your deployed daemon

> [!TIP]
> Cloud mode is great if you want FXFlow monitoring markets and executing trades even when your computer is off.

---

## Which Option Should I Pick?

| Feature                | Desktop App           | Developer Mode                | Cloud             |
| ---------------------- | --------------------- | ----------------------------- | ----------------- |
| **Difficulty**         | Easy                  | Medium                        | Advanced          |
| **Best for**           | Most people           | Developers / tinkerers        | Always-on trading |
| **Always running?**    | Only when app is open | Only when Terminal is running | Yes, 24/7         |
| **Multi-device?**      | No (Mac only)         | No (local only)               | Yes, any browser  |
| **Auto-updates?**      | Yes                   | Manual (git pull)             | Manual (redeploy) |
| **Requires Terminal?** | No                    | Yes                           | Yes               |

> [!NOTE]
> No matter which option you choose, the next steps are the same: set up your OANDA account and connect it to FXFlow.
