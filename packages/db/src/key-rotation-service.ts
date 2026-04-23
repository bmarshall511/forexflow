/**
 * Key rotation service — re-encrypts all encrypted fields with the current encryption key.
 *
 * Call after rotating ENCRYPTION_KEY: set the old key as ENCRYPTION_KEY_PREVIOUS,
 * then invoke `rotateEncryptionKeys()` to migrate all stored secrets.
 *
 * @module key-rotation-service
 */
import { db } from "./client"
import { decrypt, reEncrypt } from "./encryption"

/** Encrypted field descriptor: table accessor, field name, and how to read/write/clear it. */
interface EncryptedField {
  label: string
  read: () => Promise<string | null>
  write: (ciphertext: string) => Promise<void>
  clear: () => Promise<void>
}

/** Build the list of all encrypted fields across the database. */
function getEncryptedFields(): EncryptedField[] {
  return [
    // Settings: OANDA tokens only — account IDs are stored as plaintext
    // (see settings-service.saveCredentials), so they are NOT on this list.
    // Including them here would have been harmless for rotateEncryptionKeys
    // (reEncrypt silently skips non-ciphertext) but actively destructive for
    // clearUndecryptableSecrets, which was seen in the wild as a LRN.
    ...["practiceToken", "liveToken"].map(
      (field): EncryptedField => ({
        label: `Settings.${field}`,
        read: async () => {
          const row = await db.settings.findUnique({ where: { id: 1 } })
          return (row?.[field as keyof typeof row] as string | null) ?? null
        },
        write: async (ciphertext: string) => {
          await db.settings.update({ where: { id: 1 }, data: { [field]: ciphertext } })
        },
        clear: async () => {
          await db.settings.update({ where: { id: 1 }, data: { [field]: null } })
        },
      }),
    ),
    // AiSettings: Claude and Finnhub API keys
    ...["claudeApiKey", "finnhubApiKey"].map(
      (field): EncryptedField => ({
        label: `AiSettings.${field}`,
        read: async () => {
          const row = await db.aiSettings.findUnique({ where: { id: 1 } })
          return (row?.[field as keyof typeof row] as string | null) ?? null
        },
        write: async (ciphertext: string) => {
          await db.aiSettings.update({ where: { id: 1 }, data: { [field]: ciphertext } })
        },
        clear: async () => {
          await db.aiSettings.update({ where: { id: 1 }, data: { [field]: null } })
        },
      }),
    ),
    // AiTraderConfig: FRED and Alpha Vantage API keys
    ...["fredApiKey", "alphaVantageApiKey"].map(
      (field): EncryptedField => ({
        label: `AiTraderConfig.${field}`,
        read: async () => {
          const row = await db.aiTraderConfig.findUnique({ where: { id: 1 } })
          return (row?.[field as keyof typeof row] as string | null) ?? null
        },
        write: async (ciphertext: string) => {
          await db.aiTraderConfig.update({ where: { id: 1 }, data: { [field]: ciphertext } })
        },
        clear: async () => {
          await db.aiTraderConfig.update({ where: { id: 1 }, data: { [field]: null } })
        },
      }),
    ),
  ]
}

/**
 * Null out any encrypted field whose ciphertext cannot be decrypted with the
 * current (or previous) ENCRYPTION_KEY.
 *
 * This happens when the operator rotates the encryption key without also
 * running `rotateEncryptionKeys()` — the old ciphertext is effectively garbage
 * from the application's perspective. Leaving it in the DB causes every
 * startup to log a noisy "Failed to decrypt X" error and, in some code paths
 * (e.g. `getDecryptedFinnhubKey`) silently returns null for a field that the
 * UI still thinks is configured, misleading the user.
 *
 * Safe to call on every startup: fields that decrypt successfully are left
 * untouched, and fields that are already null are skipped.
 *
 * @returns The list of labels whose orphan ciphertext was cleared.
 */
export async function clearUndecryptableSecrets(): Promise<string[]> {
  const fields = getEncryptedFields()
  const cleared: string[] = []

  for (const field of fields) {
    const stored = await field.read()
    if (!stored) continue
    try {
      decrypt(stored)
    } catch {
      await field.clear()
      cleared.push(field.label)
    }
  }

  return cleared
}

/**
 * Re-encrypt all encrypted fields in the database with the current encryption key.
 *
 * For each field: reads the stored ciphertext, attempts re-encryption via `reEncrypt()`,
 * and writes the updated value if rotation was needed. Fields already on the current key
 * or with null values are skipped.
 *
 * @returns Count of re-encrypted fields and any errors encountered
 */
export async function rotateEncryptionKeys(): Promise<{
  reEncrypted: number
  errors: string[]
}> {
  const fields = getEncryptedFields()
  let reEncrypted = 0
  const errors: string[] = []

  for (const field of fields) {
    try {
      const stored = await field.read()
      if (!stored) continue

      const rotated = reEncrypt(stored)
      if (!rotated) continue

      await field.write(rotated)
      reEncrypted++
    } catch (err) {
      errors.push(`${field.label}: ${err instanceof Error ? err.message : "Unknown error"}`)
    }
  }

  return { reEncrypted, errors }
}
