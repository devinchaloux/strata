/**
 * Undo-history grouping — decides which document writes become ONE undo step.
 *
 * zundo records every store write as its own history entry. That is wrong for
 * continuous gestures: a boundary drag writes on every pointermove, and a text
 * field writes on every keystroke, so a 30px drag used to cost 30 Ctrl+Z
 * presses. Grouping fixes that without touching the store actions themselves.
 *
 * The rule: consecutive writes that carry the same *group key* collapse into
 * one step — only the first write of a group records the pre-change state.
 * A write with a different key, or with no key, starts a new step. Undo, redo
 * and clear always end the current group.
 *
 * Two sources of keys:
 *   1. Explicit — a gesture wraps its writes: `withHistoryGroup(key, () => …)`.
 *      Drags mint a fresh key per pointerdown (`newGestureKey`), so two
 *      separate drags of the same boundary are still two steps.
 *   2. Implicit — a write made while the browser is dispatching an `input`
 *      event from a focused text field gets that field's focus-session key.
 *      Every text field in every panel gets "one edit = one step" without each
 *      component opting in. Discrete controls (selects, buttons, the blur that
 *      commits a time field) are never grouped.
 */

let explicitKey: string | null = null
let lastRecordedKey: string | null = null

let gestureCounter = 0
/** A key unique to one gesture (one drag, from pointerdown to pointerup). */
export function newGestureKey(prefix: string): string {
  gestureCounter += 1
  return `${prefix}:${gestureCounter}`
}

/** Run `write` so that it joins (or starts) the history group `key`. */
export function withHistoryGroup(key: string, write: () => void): void {
  const prev = explicitKey
  explicitKey = key
  try {
    write()
  } finally {
    explicitKey = prev
  }
}

/** Force the next write to start a new undo step. */
export function breakHistoryGroup(): void {
  lastRecordedKey = null
}

// ── Implicit grouping for text fields ──────────────────────────────────────
// A capture listener on window runs before React's root listener, and a bubble
// listener on window runs after it, so the flag brackets exactly the React
// onChange handlers of one `input` event.

let focusSession = 0
let inTextInputEvent: string | null = null

function isTextField(el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (el instanceof HTMLTextAreaElement) return true
  if (!(el instanceof HTMLInputElement)) return false
  // Checkboxes, radios, ranges and colour wells are discrete choices, not typing.
  return !['checkbox', 'radio', 'range', 'color', 'button', 'submit', 'file'].includes(el.type)
}

if (typeof window !== 'undefined') {
  window.addEventListener('focusin', () => {
    focusSession += 1
  })
  window.addEventListener(
    'input',
    (e) => {
      inTextInputEvent = isTextField(e.target) ? `field:${focusSession}` : null
    },
    true,
  )
  window.addEventListener('input', () => {
    inTextInputEvent = null
  })
}

// ── zundo hooks ────────────────────────────────────────────────────────────

type Push<T> = (pastState: T, replace: undefined, currentState: T, deltaState?: Partial<T> | null) => void

/**
 * zundo `handleSet` option: drops the history push for any write that
 * continues the group recorded last.
 */
export function groupingHandleSet<T>(push: Push<T>): Push<T> {
  return (pastState, replace, currentState, deltaState) => {
    const key = explicitKey ?? inTextInputEvent
    if (key !== null && key === lastRecordedKey) return
    lastRecordedKey = key
    push(pastState, replace, currentState, deltaState)
  }
}
