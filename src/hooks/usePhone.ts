/**
 * Phone width: narrower than NARROW_PX. On a phone Strata reads and plays but
 * doesn't edit (docs/decisions.md, "Read and Play on a Phone"); the embed
 * stacks its parts at the same width.
 */
import { useSyncExternalStore } from 'react'

export const NARROW_PX = 640

const QUERY = `(max-width: ${NARROW_PX - 1}px)`

function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia(QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

const snapshot = () => window.matchMedia(QUERY).matches

/** True while the window is phone width; follows rotation and resizing. */
export function usePhone(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false)
}
