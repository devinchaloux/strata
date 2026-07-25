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

/** Roman numeral characters, used to disambiguate a leading `b`. */
const ROMAN = /[ivxIVX]/

/**
 * Convert ASCII accidentals to their Unicode equivalents.
 *
 * `#` is always a sharp in these fields. `b` is a flat everywhere except as a
 * bare leading character, where it is the note B — so `Bb` becomes `B♭`, `bVI`
 * becomes `♭VI` (leading `b` followed by a Roman numeral), and a lone `b`
 * stays the note name.
 */
export function toAccidentals(input: string): string {
  if (!input) return input
  let out = ''
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (ch === '#') {
      out += '♯'
      continue
    }
    if (ch === 'b') {
      const next = input[i + 1]
      const leading = i === 0
      if (!leading || (next !== undefined && ROMAN.test(next))) {
        out += '♭'
        continue
      }
    }
    out += ch
  }
  return out
}
