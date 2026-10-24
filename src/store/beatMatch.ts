/**
 * Beat-matching actions, shared by the Metronome panel's buttons and its keys
 * (PlayerDock). A run of adjustments with under 1.5 s between them is one undo
 * step, so fine-tuning a tempo by ear doesn't fill the history.
 */
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { newGestureKey, withHistoryGroup } from '@/store/history'

export type BeatMatchAction =
  | 'tempo-down'
  | 'tempo-up'
  | 'tempo-coarse-down'
  | 'tempo-coarse-up'
  | 'earlier'
  | 'later'
  | 'earlier-coarse'
  | 'later-coarse'
  | 'pin'

const TEMPO_STEP = { 'tempo-down': -0.01, 'tempo-up': 0.01, 'tempo-coarse-down': -0.1, 'tempo-coarse-up': 0.1 } as const
const NUDGE = { earlier: -0.005, later: 0.005, 'earlier-coarse': -0.025, 'later-coarse': 0.025 } as const

let gesture = ''
let last = 0

/**
 * Apply `action` to the grid row at `time` (the playhead by default). Returns
 * the result of a pin (its tempo and how many bars in), else null.
 */
export function beatMatch(
  action: BeatMatchAction,
  time = useUIStore.getState().currentTime,
): { bpm: number; bars: number } | null {
  const store = useDocumentStore.getState()
  const wall = performance.now()
  if (wall - last > 1500) gesture = newGestureKey('beat-match')
  last = wall
  let pinned: { bpm: number; bars: number } | null = null
  withHistoryGroup(gesture, () => {
    if (action === 'pin') pinned = store.pinDownbeat(time)
    else if (action in TEMPO_STEP) store.stepGridTempo(time, TEMPO_STEP[action as keyof typeof TEMPO_STEP])
    else store.nudgeGrid(time, NUDGE[action as keyof typeof NUDGE])
  })
  // Assigned inside the callback, which TypeScript can't follow.
  return pinned as { bpm: number; bars: number } | null
}

/** The action for a key press while the metronome is on, or null. */
export function beatMatchKey(key: string): BeatMatchAction | null {
  switch (key) {
    case '[': return 'tempo-down'
    case ']': return 'tempo-up'
    case '{': return 'tempo-coarse-down'
    case '}': return 'tempo-coarse-up'
    case ',': return 'earlier'
    case '.': return 'later'
    case '<': return 'earlier-coarse'
    case '>': return 'later-coarse'
    case 'd':
    case 'D': return 'pin'
    default: return null
  }
}
