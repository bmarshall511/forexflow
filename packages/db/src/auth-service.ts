import { randomBytes, scrypt, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"
import { db } from "./client"

const scryptAsync = promisify(scrypt)

const SALT_LENGTH = 32
const KEY_LENGTH = 64
const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 5 * 60 * 1000 // 5 minutes
const EXTENDED_LOCKOUT_MS = 30 * 60 * 1000 // 30 minutes after 10 failures

// ─── Hashing ────────────────────────────────────────────────────────────────

async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH)
  const derived = (await scryptAsync(pin, salt, KEY_LENGTH)) as Buffer
  return `${salt.toString("hex")}:${derived.toString("hex")}`
}

async function verifyHash(pin: string, stored: string): Promise<boolean> {
  const [saltHex, keyHex] = stored.split(":")
  if (!saltHex || !keyHex) return false
  const salt = Buffer.from(saltHex, "hex")
  const storedKey = Buffer.from(keyHex, "hex")
  const derived = (await scryptAsync(pin, salt, KEY_LENGTH)) as Buffer
  return timingSafeEqual(derived, storedKey)
}

// ─── PIN Management ─────────────────────────────────────────────────────────

/** Check whether a PIN has been set up. */
export async function hasPin(): Promise<boolean> {
  const count = await db.authPin.count()
  return count > 0
}

/** Create or replace the app PIN. Only allowed if no PIN exists (first-time) or via changePin. */
export async function createPin(pin: string): Promise<void> {
  const exists = await hasPin()
  if (exists) {
    throw new Error("PIN already exists. Use changePin() to update.")
  }
  const pinHash = await hashPin(pin)
  await db.authPin.create({ data: { pinHash } })
}

/** Verify the PIN and return success/failure with lockout handling. */
export async function verifyPin(pin: string): Promise<{
  success: boolean
  locked: boolean
  lockoutRemainingMs: number
  attemptsRemaining: number
}> {
  const authPin = await db.authPin.findFirst()
  if (!authPin) {
    return { success: false, locked: false, lockoutRemainingMs: 0, attemptsRemaining: 0 }
  }

  // Check lockout
  if (authPin.lockedUntil && authPin.lockedUntil > new Date()) {
    const remainingMs = authPin.lockedUntil.getTime() - Date.now()
    return {
      success: false,
      locked: true,
      lockoutRemainingMs: remainingMs,
      attemptsRemaining: 0,
    }
  }

  const valid = await verifyHash(pin, authPin.pinHash)

  if (valid) {
    // Reset failed attempts on success
    await db.authPin.update({
      where: { id: authPin.id },
      data: { failedAttempts: 0, lockedUntil: null },
    })
    return {
      success: true,
      locked: false,
      lockoutRemainingMs: 0,
      attemptsRemaining: MAX_FAILED_ATTEMPTS,
    }
  }

  // Increment failed attempts
  const newAttempts = authPin.failedAttempts + 1
  let lockedUntil: Date | null = null

  if (newAttempts >= MAX_FAILED_ATTEMPTS * 2) {
    // 10+ failures → 30 min lockout
    lockedUntil = new Date(Date.now() + EXTENDED_LOCKOUT_MS)
  } else if (newAttempts >= MAX_FAILED_ATTEMPTS) {
    // 5+ failures → 5 min lockout
    lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS)
  }

  await db.authPin.update({
    where: { id: authPin.id },
    data: { failedAttempts: newAttempts, lockedUntil },
  })

  const attemptsRemaining = Math.max(0, MAX_FAILED_ATTEMPTS - newAttempts)

  return {
    success: false,
    locked: lockedUntil !== null,
    lockoutRemainingMs: lockedUntil ? lockedUntil.getTime() - Date.now() : 0,
    attemptsRemaining,
  }
}

/** Change the PIN (requires current PIN verification). */
export async function changePin(currentPin: string, newPin: string): Promise<boolean> {
  const result = await verifyPin(currentPin)
  if (!result.success) return false

  const authPin = await db.authPin.findFirst()
  if (!authPin) return false

  const pinHash = await hashPin(newPin)
  await db.authPin.update({
    where: { id: authPin.id },
    data: { pinHash, failedAttempts: 0, lockedUntil: null },
  })
  return true
}

/** Get the configured session expiry in seconds. */
export async function getSessionExpiry(): Promise<number> {
  const authPin = await db.authPin.findFirst()
  return authPin?.sessionExpiry ?? 86400
}

/** Update the session expiry duration. */
export async function updateSessionExpiry(seconds: number): Promise<void> {
  const authPin = await db.authPin.findFirst()
  if (!authPin) return
  await db.authPin.update({
    where: { id: authPin.id },
    data: { sessionExpiry: seconds },
  })
}

// ─── Session Management ─────────────────────────────────────────────────────

/** Create a new session, returns the session token. */
export async function createSession(device?: string): Promise<string> {
  const token = randomBytes(32).toString("hex")
  const expirySeconds = await getSessionExpiry()
  const expiresAt = new Date(Date.now() + expirySeconds * 1000)

  await db.authSession.create({
    data: { token, expiresAt, device },
  })

  return token
}

/** Validate a session token. Returns true if valid and not expired. */
export async function validateSession(token: string): Promise<boolean> {
  const session = await db.authSession.findUnique({ where: { token } })
  if (!session) return false

  if (session.expiresAt < new Date()) {
    await db.authSession.delete({ where: { token } })
    return false
  }

  return true
}

/** Delete a specific session (logout). */
export async function deleteSession(token: string): Promise<void> {
  await db.authSession.deleteMany({ where: { token } })
}

/** Delete all sessions (logout everywhere). */
export async function deleteAllSessions(): Promise<number> {
  const result = await db.authSession.deleteMany()
  return result.count
}

/** List active (non-expired) sessions. */
export async function listActiveSessions(): Promise<
  Array<{ id: string; device: string | null; createdAt: Date; expiresAt: Date }>
> {
  return db.authSession.findMany({
    where: { expiresAt: { gt: new Date() } },
    select: { id: true, device: true, createdAt: true, expiresAt: true },
    orderBy: { createdAt: "desc" },
  })
}

/** Delete a session by ID (revoke from settings). */
export async function revokeSession(sessionId: string): Promise<void> {
  await db.authSession.deleteMany({ where: { id: sessionId } })
}

/** Cleanup expired sessions. */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await db.authSession.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  })
  return result.count
}
