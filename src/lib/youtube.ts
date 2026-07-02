// Pure utilities for YouTube IFrame API integration.
// No React imports — these are safe to call anywhere.

export type YTPlayerState =
  | 'unstarted'
  | 'ended'
  | 'playing'
  | 'paused'
  | 'buffering'
  | 'cued'

/**
 * YouTube video IDs are exactly 11 characters of [A-Za-z0-9_-]. Validating the
 * shape (not just presence) matters because ?v= and path segments can carry
 * arbitrary strings — a malformed ID would silently produce a dead player.
 */
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/

export function isValidVideoId(id: string): boolean {
  return VIDEO_ID_RE.test(id)
}

/** Extract video ID from a YouTube URL. Returns null for invalid/non-YouTube URLs. */
export function extractVideoId(url: string): string | null {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return null
  }

  let candidate: string | null = null

  // youtu.be/<id> — short share links
  if (u.hostname === 'youtu.be') {
    candidate = u.pathname.slice(1).split('/')[0] || null
  } else if (u.hostname === 'youtube.com' || u.hostname.endsWith('.youtube.com')) {
    // Covers www / m / music subdomains.
    // watch?v=<id> is the canonical form; shorts/embed/live/v carry the ID as
    // the path segment after the prefix.
    const pathMatch = u.pathname.match(/^\/(shorts|embed|live|v)\/([^/?]+)/)
    if (pathMatch) {
      candidate = pathMatch[2]
    } else {
      candidate = u.searchParams.get('v')
    }
  }

  return candidate && isValidVideoId(candidate) ? candidate : null
}

/**
 * Paste-to-detect parser for the link-source flow. Accepts anything an analyst
 * might paste: any YouTube URL shape (with or without protocol) or a bare
 * 11-character video ID. Returns the validated video ID, or null.
 */
export function parseYouTubeInput(input: string): string | null {
  const text = input.trim()
  if (!text) return null

  // Bare video ID
  if (isValidVideoId(text)) return text

  // Full URL
  const fromUrl = extractVideoId(text)
  if (fromUrl) return fromUrl

  // Protocol-less URL ("youtube.com/watch?v=…", "youtu.be/…")
  if (/^(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\//i.test(text)) {
    return extractVideoId(`https://${text}`)
  }

  return null
}

/** Canonical shareable URL for a video ID — what gets stored in the .strata file. */
export function canonicalYouTubeUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}

/**
 * Format seconds as M:SS.mmm (tracks < 1 hour) or H:MM:SS.mmm (≥ 1 hour).
 * Three decimal places always shown — required for boundary nudge feedback.
 */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00.000'
  const totalMs = Math.round(seconds * 1000)
  const ms = totalMs % 1000
  const totalSec = Math.floor(totalMs / 1000)
  const sec = totalSec % 60
  const totalMin = Math.floor(totalSec / 60)
  const min = totalMin % 60
  const hours = Math.floor(totalMin / 60)

  const msStr = String(ms).padStart(3, '0')
  const secStr = String(sec).padStart(2, '0')

  if (hours > 0) {
    return `${hours}:${String(min).padStart(2, '0')}:${secStr}.${msStr}`
  }
  return `${min}:${secStr}.${msStr}`
}

/** Map YT API numeric state code to our string enum. */
export function mapYTState(code: number): YTPlayerState {
  switch (code) {
    case -1: return 'unstarted'
    case 0:  return 'ended'
    case 1:  return 'playing'
    case 2:  return 'paused'
    case 3:  return 'buffering'
    case 5:  return 'cued'
    default: return 'unstarted'
  }
}

/** Returns true when a text input, textarea, or contenteditable element is focused. */
export function isInputFocused(): boolean {
  const el = document.activeElement
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  )
}

// ---------------------------------------------------------------------------
// API loader — singleton promise so the script is only injected once
// ---------------------------------------------------------------------------

let apiLoadPromise: Promise<void> | null = null

/** Dynamically load the YouTube IFrame API script. Safe to call multiple times. */
export function loadYTApi(): Promise<void> {
  if (apiLoadPromise) return apiLoadPromise

  // API already loaded (e.g. HMR reload)
  if (typeof window !== 'undefined' && window.YT?.Player) {
    apiLoadPromise = Promise.resolve()
    return apiLoadPromise
  }

  apiLoadPromise = new Promise((resolve) => {
    // Chain onto any existing ready callback rather than overwriting it
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve()
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(script)
  })

  return apiLoadPromise
}
