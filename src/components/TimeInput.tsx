import { useEffect, useState } from 'react'
import { formatTime } from '@/lib/youtube'
import { parseTimecode } from '@/lib/timecode'

/**
 * Editable timecode field. Shows the formatted value; on Enter/blur it parses
 * the text and commits (the parent clamps it). Escape or an unparseable value
 * restores the current value.
 */
export function TimeInput({
  value,
  onCommit,
  title,
}: {
  value: number
  onCommit: (seconds: number) => void
  title: string
}) {
  const [text, setText] = useState(() => formatTime(value))
  // Re-sync when the underlying value changes (commit result, undo, reselect).
  useEffect(() => setText(formatTime(value)), [value])

  function commit() {
    const parsed = parseTimecode(text)
    if (parsed == null) setText(formatTime(value))
    else onCommit(parsed)
  }

  return (
    <input
      className="w-[88px] rounded border border-border bg-card px-1.5 py-0.5 text-center text-xs tabular-nums text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring"
      value={text}
      title={title}
      aria-label={title}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        else if (e.key === 'Escape') {
          setText(formatTime(value))
          e.currentTarget.blur()
        }
      }}
    />
  )
}
