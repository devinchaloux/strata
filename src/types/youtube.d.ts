// Minimal YouTube IFrame API type declarations.
// Only what Phase 1.5 actually uses — expand as needed.
// Full API reference: https://developers.google.com/youtube/iframe_api_reference

declare namespace YT {
  class Player {
    constructor(element: string | HTMLElement, options: PlayerOptions)
    playVideo(): void
    pauseVideo(): void
    seekTo(seconds: number, allowSeekAhead: boolean): void
    cueVideoById(videoId: string): void
    setPlaybackRate(suggestedRate: number): void
    getAvailablePlaybackRates(): number[]
    getCurrentTime(): number
    getDuration(): number
    getPlayerState(): number
    destroy(): void
  }

  interface PlayerOptions {
    videoId?: string
    width?: number | string
    height?: number | string
    playerVars?: PlayerVars
    events?: PlayerEvents
  }

  interface PlayerVars {
    controls?: 0 | 1 | 2
    modestbranding?: 0 | 1
    rel?: 0 | 1
    iv_load_policy?: 1 | 3
    disablekb?: 0 | 1
  }

  interface PlayerEvents {
    onReady?: (event: PlayerEvent) => void
    onStateChange?: (event: OnStateChangeEvent) => void
    onError?: (event: OnErrorEvent) => void
  }

  interface PlayerEvent {
    target: Player
  }

  interface OnStateChangeEvent {
    target: Player
    data: number
  }

  interface OnErrorEvent {
    target: Player
    data: number
  }
}

interface Window {
  YT: typeof YT
  onYouTubeIframeAPIReady?: () => void
}
