/**
 * Key rotation service — re-encrypts all encrypted fields with the current encryption key.
 *
 * Call after rotating ENCRYPTION_KEY: set the old key as ENCRYPTION_KEY_PREVIOUS,
 * then invoke `rotateEncryptionKeys()` to migrate all stored secrets.
 *
 * @module key-rotation-service
 */
import { db } from "./client"
import { reEncrypt } from "./encryption"

/** Encrypted field descriptor: table accessor, field name, and how to read/write it. */
interface EncryptedField {
  label: string
  read: () => Promise<string | null>
  write: (ciphertext: string) => Promise<void>
}

/** Build the list of all encrypted fields across the database. */
function getEncryptedFields(): EncryptedField[] {
  return [
    // Settings: OANDA tokens and account IDs
    ...["practiceToken", "liveToken", "practiceAccountId", "liveAccountId"].map(
      (field): EncryptedField => ({
        label: `Settings.${field}`,
        read: async () => {
          const row = await db.settings.findUnique({ where: { id: 1 } })
          return (row?.[field as keyof typeof row] as string | null) ?? null
        },
        write: async (ciphertext: string) => {
          await db.settings.update({ where: { id: 1 }, data: { [field]: ciphertext } })
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
      }),
    ),
  ]
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
