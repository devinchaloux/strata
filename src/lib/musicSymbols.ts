/**
 * Accidental transliteration for the Roman-numeral and tonic fields.
 *
 * Analysts type `bVI` and `F#`; the conventional typography is `♭VI` and `F♯`.
 * Converting on input means the stored value is always the canonical Unicode
 * form, so a corpus query never has to match two spellings of the same claim.
 *
 * Deliberately scoped to fields whose contents are known to be note names or
 * Roman numerals (Span.keyArea, PointMarker.harmonicContext, homeKey.tonic).
 * It must never run over free text — `b` is a letter, and "breakdown" is not a
 * flat.
 */

/**
 * A flat is recognised only in two whole-token shapes, never character by
 * character, so ordinary words ("Subdominant", "ambiguous") are left alone:
 *
 *   flats before a Roman numeral   bVI  → ♭VI    bbVII → ♭♭VII
 *   a note letter followed by flats Bb  → B♭     eb    → e♭    Bbb → B♭♭
 *
 * A token is a run of ASCII letters; `/`, digits, spaces and existing ♭/♯
 * separate tokens, so applied chords (`V/bVI`) and inversions (`bII6`) work.
 */
const FLATS_BEFORE_NUMERAL = /^(b+)([ivxIVX]+)$/
const NOTE_THEN_FLATS = /^([A-Ga-g])(b+)$/

function convertToken(token: string): string {
  const numeral = FLATS_BEFORE_NUMERAL.exec(token)
  if (numeral) return '♭'.repeat(numeral[1].length) + numeral[2]
  const note = NOTE_THEN_FLATS.exec(token)
  if (note) return note[1] + '♭'.repeat(note[2].length)
  return token
}

/**
 * Convert ASCII accidentals to their Unicode equivalents. `#` is always a
 * sharp in these fields; `b` is a flat only in the token shapes above, so a
 * lone `b` stays the note B.
 *
 * Runs on every keystroke, so a word that *begins* like a flat ("ab…") is
 * converted at its second letter. These fields hold Roman numerals and key
 * names (Devin, 2026-09-27), so that is accepted rather than engineered around.
 */
export function toAccidentals(input: string): string {
  if (!input) return input
  return input.replace(/#/g, '♯').replace(/[A-Za-z]+/g, convertToken)
}
