import type { StrataDocument } from '@/types/strata'

const RECOVERY_KEY = 'strata:recovery'

export interface RecoveryEntry {
  doc: StrataDocument
  savedAt: string // ISO 8601
}

/** Writes the current document to localStorage. Silently ignores storage errors. */
export function saveRecovery(doc: StrataDocument): void {
  try {
    const entry: RecoveryEntry = { doc, savedAt: new Date().toISOString() }
    localStorage.setItem(RECOVERY_KEY, JSON.stringify(entry))
  } catch {
    // localStorage full or unavailable — skip silently
  }
}

/** Returns the stored recovery entry, or null if none exists or the entry is malformed. */
export function loadRecovery(): RecoveryEntry | null {
  try {
    const raw = localStorage.getItem(RECOVERY_KEY)
    if (!raw) return null
    return JSON.parse(raw) as RecoveryEntry
  } catch {
    return null
  }
}

/** Removes the recovery entry after an explicit save or user dismissal. */
export function clearRecovery(): void {
  try {
    localStorage.removeItem(RECOVERY_KEY)
  } catch {
    // silently skip
  }
}
