/**
 * Parse a user-entered timecode into seconds.
 *
 * Accepts either bare seconds ("90", "90.5") or clock form
 * ("1:30", "1:30.5", "1:30.500", "1:02:03.250"). Returns null if it can't be
 * parsed, so callers can reject the edit and restore the previous value.
 */
export function parseTimecode(input: string): number | null {
  const s = input.trim()
  if (s === '') return null

  // Bare seconds.
  if (!s.includes(':')) {
    const n = Number(s)
    return Number.isFinite(n) && n >= 0 ? n : null
  }

  // Colon-separated: [hh:]mm:ss[.mmm]. Last part is seconds (may be fractional),
  // earlier parts are whole minutes / hours.
  const parts = s.split(':')
  if (parts.length > 3) return null
  const seconds = Number(parts[parts.length - 1])
  if (!Number.isFinite(seconds) || seconds < 0 || seconds >= 60) return null

  let total = seconds
  let factor = 60
  for (let i = parts.length - 2; i >= 0; i--) {
    const v = Number(parts[i])
    if (!Number.isInteger(v) || v < 0) return null
    total += v * factor
    factor *= 60
  }
  return total
}
