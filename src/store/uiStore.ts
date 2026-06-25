import { create } from 'zustand'
import type { YTPlayerState } from '@/lib/youtube'
import type { Span } from '@/types/strata'
import type { MergeConflict } from '@/lib/mergeSpans'

// Re-export so consumers don't need a separate import
export type { YTPlayerState }

/**
 * Open-merge-dialog state. Set when a merge has unresolved field conflicts; the
 * MergeConflictDialog renders from it. `draft` already carries the new span id
 * and all auto-resolved fields; the dialog fills the conflict fields on confirm.
 */
export interface MergeDialogState {
  layerId: string
  sourceIds: string[]
  draft: Span
  conflicts: MergeConflict[]
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PlayerStatus = 'uninitialized' | 'loading' | 'ready' | 'error'

export type PlaybackRate = 0.5 | 0.75 | 1 | 1.25

export interface ViewState {
  zoom: number
  scrollOffset: number
  viewportWidth: number
}

/**
 * Pixel position formula (document this interface so all widgets use the same):
 *   px = (timestamp / duration) * viewportWidth * zoom - scrollOffset
 */
export interface UIState {
  // Playback
  currentTime: number
  duration: number           // seconds; 0 until player is ready
  playbackState: YTPlayerState
  playbackRate: PlaybackRate
  playerStatus: PlayerStatus
  playerError: string | null

  // Timeline view
  zoom: number
  scrollOffset: number
  viewportWidth: number

  // Selection — multi-select set is the source of truth. Single-select call
  // sites read selectedSpanIds[0]. selectionAnchorId is the pivot for shift-range.
  selectedSpanIds: string[]
  selectionAnchorId: string | null
  hoveredSpanId: string | null
  activeLayerId: string | null

  // Panels
  videoPanelVisible: boolean
  headersCollapsed: boolean // layer-header column collapsed to the icon rail

  // Merge conflict dialog (null = closed)
  mergeDialog: MergeDialogState | null

  // Actions — playback
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  setPlaybackState: (state: YTPlayerState) => void
  setPlaybackRate: (rate: PlaybackRate) => void
  setPlayerStatus: (status: PlayerStatus, error?: string | null) => void

  // Actions — timeline view
  setZoom: (zoom: number) => void
  setScrollOffset: (offset: number) => void
  setViewportWidth: (width: number) => void

  // Actions — selection
  selectSpan: (id: string | null) => void       // single select (replace); null clears
  toggleSpan: (id: string) => void               // ctrl/cmd-click: add/remove from set
  setSelection: (ids: string[], anchorId?: string | null) => void // shift-range / box-drag
  clearSelection: () => void
  hoverSpan: (id: string | null) => void
  setActiveLayer: (id: string | null) => void

  // Actions — panels
  toggleVideoPanel: () => void
  setVideoPanelVisible: (visible: boolean) => void
  toggleHeadersCollapsed: () => void

  // Actions — merge dialog
  openMergeDialog: (state: MergeDialogState) => void
  closeMergeDialog: () => void
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const useUIStore = create<UIState>()((set) => ({
  currentTime: 0,
  duration: 0,
  playbackState: 'unstarted',
  playbackRate: 1,
  playerStatus: 'uninitialized',
  playerError: null,

  zoom: 1,
  scrollOffset: 0,
  viewportWidth: 0,

  selectedSpanIds: [],
  selectionAnchorId: null,
  hoveredSpanId: null,
  activeLayerId: null,

  // Default true — the panel is expanded when a video first loads
  videoPanelVisible: true,
  headersCollapsed: false,

  mergeDialog: null,

  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setPlaybackState: (playbackState) => set({ playbackState }),
  setPlaybackRate: (rate) => set({ playbackRate: rate }),
  setPlayerStatus: (status, error = null) => set({ playerStatus: status, playerError: error }),

  setZoom: (zoom) => set({ zoom }),
  setScrollOffset: (offset) => set({ scrollOffset: offset }),
  setViewportWidth: (width) => set({ viewportWidth: width }),

  selectSpan: (id) =>
    set({ selectedSpanIds: id ? [id] : [], selectionAnchorId: id }),
  toggleSpan: (id) =>
    set((s) => ({
      selectedSpanIds: s.selectedSpanIds.includes(id)
        ? s.selectedSpanIds.filter((x) => x !== id)
        : [...s.selectedSpanIds, id],
      selectionAnchorId: id,
    })),
  setSelection: (ids, anchorId) =>
    set({
      selectedSpanIds: ids,
      selectionAnchorId: anchorId !== undefined ? anchorId : ids[ids.length - 1] ?? null,
    }),
  clearSelection: () => set({ selectedSpanIds: [], selectionAnchorId: null }),
  hoverSpan: (id) => set({ hoveredSpanId: id }),
  setActiveLayer: (id) => set({ activeLayerId: id }),

  toggleVideoPanel: () => set((s) => ({ videoPanelVisible: !s.videoPanelVisible })),
  setVideoPanelVisible: (visible) => set({ videoPanelVisible: visible }),
  toggleHeadersCollapsed: () => set((s) => ({ headersCollapsed: !s.headersCollapsed })),

  openMergeDialog: (state) => set({ mergeDialog: state }),
  closeMergeDialog: () => set({ mergeDialog: null }),
}))

export { useUIStore }
