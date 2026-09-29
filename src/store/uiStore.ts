import { create } from 'zustand'
import type { YTPlayerState } from '@/lib/youtube'
import type { Span } from '@/types/strata'
import type { MergeConflict } from '@/lib/mergeSpans'
import type { SnapMode } from '@/lib/beatGrid'

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

/**
 * Current zoom/scroll state of the shared timeline viewport. This is the one
 * place the timestamp→pixel formula is documented so every widget converts the
 * same way (decisions.md "ViewState").
 *
 * Since the Phase 2 zoom rework, 100% (zoom = 1) is a fixed physical scale of
 * BASE_PPS px/second, decoupled from viewport width and track duration:
 *
 *   pps = BASE_PPS * zoom
 *   px  = timestamp * pps - scrollOffset
 *
 * `scrollOffset` is in PIXELS (the SVG's horizontal translation), not seconds.
 * See lib/timeline.ts for BASE_PPS and the pure conversion helpers.
 */
export interface ViewState {
  zoom: number          // 1.0 = the standard fixed scale (BASE_PPS px/s); fit is a separate computed zoom
  scrollOffset: number  // viewport's left-edge scroll position, in pixels
  viewportWidth: number // pixel width of the timeline viewport
}

export interface AppMessage {
  title: string
  lines: string[]
}

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

  // Point marker selection — mutually exclusive with span selection (the
  // Inspector shows one or the other). Selecting a marker clears span
  // selection and vice versa.
  selectedPointMarkerId: string | null

  // Local audio source — the picked File for a source of type "local".
  // Runtime-only: the document stores just the filename (browsers can't reopen
  // a path), so the analyst re-picks the file each session ("Locate audio…").
  audioFile: File | null

  // Panels
  // Where the YouTube player sits: docked under the transport bar, or as a
  // mini player in the work area's top-right corner. Never hidden and never
  // smaller than 200×200 — YouTube's embed rules require the player to stay
  // present at that minimum size (Devin, 2026-09-27).
  videoMini: boolean
  headersCollapsed: boolean // layer-header column collapsed to the icon rail

  // Merge conflict dialog (null = closed)
  mergeDialog: MergeDialogState | null

  // Link-source dialog — openable from the transport bar and document settings
  linkSourceOpen: boolean

  // Document settings dialog (also hosts the new-analysis setup modal).
  documentSettingsOpen: boolean

  // A message for the analyst that must be read and dismissed: a file that
  // couldn't open or save, or one that opened with warnings. Replaces errors
  // that used to go only to the developer console.
  appMessage: AppMessage | null

  // The export dialog (SVG / PNG of the form diagram).
  exportOpen: boolean

  // Snapping to the beat grid: the analyst's choice, off by default
  // (docs/decisions.md, "Beat Grid"). View state, not saved in the file.
  snapMode: SnapMode

  // A request for the player to jump to a time, from outside the transport
  // (e.g. a commentary link). PlayerDock owns the engine and carries it out;
  // `n` makes two requests for the same time distinct.
  seekRequest: { time: number; n: number } | null

  // Actions — playback
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  setPlaybackState: (state: YTPlayerState) => void
  setPlaybackRate: (rate: PlaybackRate) => void
  setPlayerStatus: (status: PlayerStatus, error?: string | null) => void
  setAudioFile: (file: File | null) => void

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

  // Actions — point marker selection
  selectPointMarker: (id: string | null) => void

  // Actions — panels
  toggleVideoMini: () => void
  toggleHeadersCollapsed: () => void

  // Actions — merge dialog
  openMergeDialog: (state: MergeDialogState) => void
  closeMergeDialog: () => void

  // Actions — link-source dialog
  setLinkSourceOpen: (open: boolean) => void

  // Actions — document settings dialog
  setDocumentSettingsOpen: (open: boolean) => void
  showAppMessage: (title: string, lines: string[]) => void
  dismissAppMessage: () => void
  setExportOpen: (open: boolean) => void
  setSnapMode: (mode: SnapMode) => void
  requestSeek: (time: number) => void
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
  selectedPointMarkerId: null,

  audioFile: null,

  // Default true — the panel is expanded when a video first loads
  videoMini: false,
  headersCollapsed: false,

  mergeDialog: null,
  linkSourceOpen: false,
  documentSettingsOpen: false,
  appMessage: null,
  exportOpen: false,
  snapMode: 'off',
  seekRequest: null,

  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setPlaybackState: (playbackState) => set({ playbackState }),
  setPlaybackRate: (rate) => set({ playbackRate: rate }),
  setPlayerStatus: (status, error = null) => set({ playerStatus: status, playerError: error }),
  setAudioFile: (file) => set({ audioFile: file }),

  setZoom: (zoom) => set({ zoom }),
  setScrollOffset: (offset) => set({ scrollOffset: offset }),
  setViewportWidth: (width) => set({ viewportWidth: width }),


  selectSpan: (id) =>
    set({ selectedSpanIds: id ? [id] : [], selectionAnchorId: id, selectedPointMarkerId: null }),
  toggleSpan: (id) =>
    set((s) => ({
      selectedSpanIds: s.selectedSpanIds.includes(id)
        ? s.selectedSpanIds.filter((x) => x !== id)
        : [...s.selectedSpanIds, id],
      selectionAnchorId: id,
      selectedPointMarkerId: null,
    })),
  setSelection: (ids, anchorId) =>
    set({
      selectedSpanIds: ids,
      selectionAnchorId: anchorId !== undefined ? anchorId : ids[ids.length - 1] ?? null,
      selectedPointMarkerId: null,
    }),
  clearSelection: () =>
    set({ selectedSpanIds: [], selectionAnchorId: null, selectedPointMarkerId: null }),
  hoverSpan: (id) => set({ hoveredSpanId: id }),
  setActiveLayer: (id) => set({ activeLayerId: id }),

  selectPointMarker: (id) =>
    set({ selectedPointMarkerId: id, selectedSpanIds: [], selectionAnchorId: null }),

  toggleVideoMini: () => set((s) => ({ videoMini: !s.videoMini })),
  toggleHeadersCollapsed: () => set((s) => ({ headersCollapsed: !s.headersCollapsed })),

  openMergeDialog: (state) => set({ mergeDialog: state }),
  closeMergeDialog: () => set({ mergeDialog: null }),

  setLinkSourceOpen: (open) => set({ linkSourceOpen: open }),
  setDocumentSettingsOpen: (open) => set({ documentSettingsOpen: open }),
  showAppMessage: (title, lines) => set({ appMessage: { title, lines } }),
  dismissAppMessage: () => set({ appMessage: null }),
  setExportOpen: (open) => set({ exportOpen: open }),
  setSnapMode: (mode) => set({ snapMode: mode }),
  requestSeek: (time) => set((s) => ({ seekRequest: { time, n: (s.seekRequest?.n ?? 0) + 1 } })),
}))

export { useUIStore }
