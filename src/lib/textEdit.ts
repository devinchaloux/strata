/**
 * Markdown formatting for a text box's selection: the commentary editor's
 * toolbar and keys (widgets/written-analysis/CommentaryEditor.tsx). Pure: each
 * takes the text and the selection and returns the new text and selection.
 */

export interface Edit {
  text: string
  start: number
  end: number
}

/**
 * Wrap the selection in `mark` (** for bold, * for italic, ` for code), or
 * unwrap it if it is already wrapped. With nothing selected, the marks go in
 * with the cursor between them.
 */
export function toggleWrap(text: string, start: number, end: number, mark: string): Edit {
  const n = mark.length
  const before = text.slice(start - n, start)
  const after = text.slice(end, end + n)
  // Already wrapped (marks just outside the selection): take them off.
  if (before === mark && after === mark && !(mark === '*' && (text[start - n - 1] === '*' || text[end + n] === '*'))) {
    return { text: text.slice(0, start - n) + text.slice(start, end) + text.slice(end + n), start: start - n, end: end - n }
  }
  const inner = text.slice(start, end)
  // Marks selected along with the words: take them off.
  if (inner.length >= 2 * n && inner.startsWith(mark) && inner.endsWith(mark)) {
    return { text: text.slice(0, start) + inner.slice(n, -n) + text.slice(end), start, end: end - 2 * n }
  }
  return { text: text.slice(0, start) + mark + inner + mark + text.slice(end), start: start + n, end: end + n }
}

const LINE_MARKS = /^(#{1,6} |[-*] |\d+[.)] |> )/

/**
 * Give every line the selection touches a line mark (`## `, `- `, `1. `,
 * `> `), replacing any other such mark; if every line already has this kind,
 * take it off. Numbered lines count up from 1.
 */
export function toggleLinePrefix(text: string, start: number, end: number, kind: 'heading' | 'bullet' | 'number' | 'quote'): Edit {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1
  // A selection ending just after a line break doesn't take in the next line.
  const last = end > start && text[end - 1] === '\n' ? end - 1 : end
  const nextBreak = text.indexOf('\n', last)
  const lineEnd = nextBreak === -1 ? text.length : nextBreak
  const lines = text.slice(lineStart, lineEnd).split('\n')
  const has: Record<typeof kind, RegExp> = { heading: /^#{1,6} /, bullet: /^[-*] /, number: /^\d+[.)] /, quote: /^> / }
  const remove = lines.every((l) => has[kind].test(l))
  let n = 0
  const next = lines.map((l) => {
    const bare = l.replace(LINE_MARKS, '')
    if (remove) return bare
    const mark = kind === 'heading' ? '## ' : kind === 'bullet' ? '- ' : kind === 'quote' ? '> ' : `${++n}. `
    return mark + bare
  })
  const joined = next.join('\n')
  return { text: text.slice(0, lineStart) + joined + text.slice(lineEnd), start: lineStart, end: lineStart + joined.length }
}

/** Replace the selection with `insert`, the cursor after it. */
export function replaceSelection(text: string, start: number, end: number, insert: string): Edit {
  const at = start + insert.length
  return { text: text.slice(0, start) + insert + text.slice(end), start: at, end: at }
}
