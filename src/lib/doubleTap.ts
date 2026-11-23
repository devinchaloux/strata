/**
 * Double tap on a touch screen. Phones don't reliably turn two taps into a
 * dblclick (iOS Safari never does, and Chrome only when it isn't zooming), so
 * a span or marker counts the taps itself: a second tap on the same thing
 * within DOUBLE_TAP_MS plays from it, as a double-click does with a mouse.
 */
export const DOUBLE_TAP_MS = 350

let last: { key: string; at: number } | null = null

/** Record a tap on `key`; true when it's the second tap on it in time. */
export function isDoubleTap(key: string, now = Date.now()): boolean {
  const second = last != null && last.key === key && now - last.at <= DOUBLE_TAP_MS
  // A double tap is consumed, so a third tap starts afresh.
  last = second ? null : { key, at: now }
  return second
}

/** Whether a click came from a finger, from the pointer event that started it. */
export function tappedWithFinger(e: React.MouseEvent): boolean {
  const pointerType = (e.nativeEvent as PointerEvent).pointerType
  return pointerType === 'touch' || pointerType === 'pen'
}
