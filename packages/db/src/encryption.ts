/**
 * Encryption utilities — AES-256-GCM encryption/decryption for sensitive data.
 *
 * Used to encrypt API tokens, keys, and other secrets before storing in SQLite.
 * Format: `iv:tag:ciphertext` (all hex-encoded). Requires a 32-byte (64 hex char)
 * ENCRYPTION_KEY environment variable.
 *
 * Supports key rotation via ENCRYPTION_KEY_PREVIOUS: decrypt() falls back to the
 * previous key when the current key fails, and reEncrypt() re-encrypts data from
 * the previous key to the current key.
 *
 * @module encryption
 */
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto"

/** AES-256-GCM algorithm identifier. */
const ALGORITHM = "aes-256-gcm"
/** Initialization vector length in bytes. */
const IV_LENGTH = 12
/** Authentication tag length in bytes. */
const TAG_LENGTH = 16

/**
 * Validate that a hex-encoded key is exactly 32 bytes.
 *
 * @param hex - The hex string to validate
 * @param label - Label for error messages
 * @returns 32-byte Buffer
 * @throws Error if the key is not 64 hex characters (32 bytes)
 */
function validateKey(hex: string, label: string): Buffer {
  const buf = Buffer.from(hex, "hex")
  if (buf.length !== 32) {
    throw new Error(`${label} must be a 64-character hex string (32 bytes)`)
  }
  return buf
}

/**
 * Load and validate encryption keys from environment variables.
 *
 * @returns Current key (required) and optional previous key for rotation
 * @throws Error if ENCRYPTION_KEY is not set or invalid
 */
function getKeys(): { current: Buffer; previous: Buffer | null } {
  const currentHex = process.env.ENCRYPTION_KEY
  if (!currentHex) {
    throw new Error("ENCRYPTION_KEY environment variable is required")
  }
  const current = validateKey(currentHex, "ENCRYPTION_KEY")

  const previousHex = process.env.ENCRYPTION_KEY_PREVIOUS
  const previous = previousHex ? validateKey(previousHex, "ENCRYPTION_KEY_PREVIOUS") : null

  return { current, previous }
}

/**
 * Attempt to decrypt a ciphertext string with a specific key.
 *
 * @param stored - Encrypted value in `iv:tag:ciphertext` hex format
 * @param key - 32-byte AES key
 * @returns Decrypted plaintext
 * @throws Error if decryption fails (wrong key, corrupted data, etc.)
 */
function decryptWithKey(stored: string, key: Buffer): string {
  const parts = stored.split(":")
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted value format")
  }
  const [ivHex, tagHex, dataHex] = parts
  const iv = Buffer.from(ivHex!, "hex")
  const tag = Buffer.from(tagHex!, "hex")
  const encrypted = Buffer.from(dataHex!, "hex")

  if (tag.length !== TAG_LENGTH) {
    throw new Error("Invalid authentication tag")
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted).toString("utf8") + decipher.final("utf8")
}

/** Encrypt plaintext using AES-256-GCM with the current key. Returns `iv:tag:ciphertext` in hex. */
export function encrypt(plaintext: string): string {
  const { current } = getKeys()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, current, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`
}

/**
 * Decrypt a value produced by `encrypt()`.
 *
 * Tries the current key first. If decryption fails and a previous key is configured
 * via ENCRYPTION_KEY_PREVIOUS, falls back to the previous key. This allows reading
 * data that was encrypted before a key rotation.
 *
 * @param stored - Encrypted value in `iv:tag:ciphertext` hex format
 * @returns Decrypted plaintext
 * @throws Error if decryption fails with all available keys
 */
export function decrypt(stored: string): string {
  const { current, previous } = getKeys()

  try {
    return decryptWithKey(stored, current)
  } catch (currentError) {
    if (!previous) throw currentError

    try {
      return decryptWithKey(stored, previous)
    } catch {
      // Throw the original error from the current key — it's more relevant
      throw currentError
    }
  }
}

/**
 * Re-encrypt a ciphertext from the previous key to the current key.
 *
 * - If the value already decrypts with the current key, returns null (no rotation needed).
 * - If the value decrypts with the previous key, re-encrypts with the current key and returns
 *   the new ciphertext.
 * - If decryption fails with all keys, returns null (cannot rotate corrupt/unknown data).
 *
 * @param ciphertext - Encrypted value to potentially re-encrypt
 * @returns New ciphertext encrypted with current key, or null if no rotation needed/possible
 */
export function reEncrypt(ciphertext: string): string | null {
  const { current, previous } = getKeys()

  // Try current key — if it works, already on current key
  try {
    decryptWithKey(ciphertext, current)
    return null
  } catch {
    // Not encrypted with current key — try previous
  }

  if (!previous) return null

  try {
    const plaintext = decryptWithKey(ciphertext, previous)
    return encrypt(plaintext)
  } catch {
    return null
  }
}
