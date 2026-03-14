/**
 * Encryption utilities — AES-256-GCM encryption/decryption for sensitive data.
 *
 * Used to encrypt API tokens, keys, and other secrets before storing in SQLite.
 * Format: `iv:tag:ciphertext` (all hex-encoded). Requires a 32-byte (64 hex char)
 * ENCRYPTION_KEY environment variable.
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
 * Load and validate the encryption key from the ENCRYPTION_KEY environment variable.
 *
 * @returns 32-byte Buffer encryption key
 * @throws Error if ENCRYPTION_KEY is not set or is not 64 hex characters
 */
function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is required")
  }
  const buf = Buffer.from(key, "hex")
  if (buf.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string (32 bytes)")
  }
  return buf
}

/** Encrypt plaintext using AES-256-GCM. Returns `iv:tag:ciphertext` in hex. */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`
}

/** Decrypt a value produced by `encrypt()`. */
export function decrypt(stored: string): string {
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

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv)
  decipher.setAuthTag(tag)
  return decipher.update(encrypted).toString("utf8") + decipher.final("utf8")
}
