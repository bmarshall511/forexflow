import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12
const TAG_LENGTH = 16

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
