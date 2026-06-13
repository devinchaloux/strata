import { create } from 'zustand'

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
  isPlaying: boolean
  playbackRate: PlaybackRate
  playerStatus: PlayerStatus
  playerError: string | null

  // Timeline view
  zoom: number
  scrollOffset: number
  viewportWidth: number

  // Selection
  selectedSpanId: string | null
  hoveredSpanId: string | null
  activeLayerId: string | null

  // Panels
  videoPanelVisible: boolean

  // Actions — playback
  setCurrentTime: (time: number) => void
  setIsPlaying: (playing: boolean) => void
  setPlaybackRate: (rate: PlaybackRate) => void
  setPlayerStatus: (status: PlayerStatus, error?: string | null) => void

  // Actions — timeline view
  setZoom: (zoom: number) => void
  setScrollOffset: (offset: number) => void
  setViewportWidth: (width: number) => void

  // Actions — selection
  selectSpan: (id: string | null) => void
  hoverSpan: (id: string | null) => void
  setActiveLayer: (id: string | null) => void

  // Actions — panels
  toggleVideoPanel: () => void
  setVideoPanelVisible: (visible: boolean) => void
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const useUIStore = create<UIState>()((set) => ({
  currentTime: 0,
  isPlaying: false,
  playbackRate: 1,
  playerStatus: 'uninitialized',
  playerError: null,

  zoom: 1,
  scrollOffset: 0,
  viewportWidth: 0,

  selectedSpanId: null,
  hoveredSpanId: null,
  activeLayerId: null,

  videoPanelVisible: false,

  setCurrentTime: (time) => set({ currentTime: time }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setPlaybackRate: (rate) => set({ playbackRate: rate }),
  setPlayerStatus: (status, error = null) => set({ playerStatus: status, playerError: error }),

  setZoom: (zoom) => set({ zoom }),
  setScrollOffset: (offset) => set({ scrollOffset: offset }),
  setViewportWidth: (width) => set({ viewportWidth: width }),

  selectSpan: (id) => set({ selectedSpanId: id }),
  hoverSpan: (id) => set({ hoveredSpanId: id }),
  setActiveLayer: (id) => set({ activeLayerId: id }),

  toggleVideoPanel: () => set((s) => ({ videoPanelVisible: !s.videoPanelVisible })),
  setVideoPanelVisible: (visible) => set({ videoPanelVisible: visible }),
}))

export { useUIStore }
