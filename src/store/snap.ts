/**
 * Snapping a time to the beat grid, when the analyst has snapping on. Every
 * placement and drag that should respect the grid goes through here, so the
 * rule lives in one place (lib/beatGrid.ts has the arithmetic).
 */
import { snapToGrid, sortedSegments } from '@/lib/beatGrid'
import { useDocumentStore } from './documentStore'
import { useUIStore } from './uiStore'

export function snapToActiveGrid(t: number): number {
  const doc = useDocumentStore.getState().document
  const mode = useUIStore.getState().snapMode
  if (!doc || mode === 'off' || !doc.beatGrid?.length) return t
  return snapToGrid(t, sortedSegments(doc.beatGrid), doc.duration, mode)
}
