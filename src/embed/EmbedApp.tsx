/**
 * EmbedApp — Strata inside another page's iframe (lib/embed.ts).
 *
 * Read-only: the reading view's diagram and player without the toolbar,
 * the Inspector or the commentary panel. The page can point it at a span or
 * a stretch of time (a "cue"); it then zooms there, loops it and dims the
 * rest. It reports its height and whether it is playing, so the page can
 * size the iframe and keep its own controls in step.
 * docs/decisions.md, "Embedding an Analysis".
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { FormDiagram } from '@/components/FormDiagram'
import { PlayerDock } from '@/components/PlayerDock'
import { fetchSharedAnalysis, shareUrl } from '@/lib/shareLink'
import { onlyLayers, readCommand, resolveFocus, viewAround, type EmbedEvent, type EmbedParams } from '@/lib/embed'
import { clampScrollOffset, totalContentWidth } from '@/lib/timeline'

// Narrower than this, the embed stacks video over diagram, collapses the
// layer names to a rail and opens at a readable scale that scrolls.
const NARROW_PX = 640
// After a cue, how long playback may sit outside the focus before the loop
// lets go (the seek that the cue asked for may not have landed yet).
const CUE_SETTLE_MS = 1500
// A hand pan holds the playhead-following for this long.
const PAN_HOLD_MS = 4000

function post(event: EmbedEvent) {
  if (window.parent !== window) window.parent.postMessage(event, '*')
}

export function EmbedApp({ params }: { params: EmbedParams }) {
  const doc = useDocumentStore((s) => s.document)
  const loadDocument = useDocumentStore((s) => s.loadDocument)
  const [error, setError] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  // ── Focus: zoom, loop, dim ────────────────────────────────────────────────
  // A seek made before the player is ready is lost, so it waits here.
  const pendingSeek = useRef<{ time: number; play: boolean } | null>(null)
  const focusSetAt = useRef(0)
  const applyFocus = useCallback((focus: string, play: boolean) => {
    const d = useDocumentStore.getState().document
    if (!d) return
    const f = resolveFocus(d, focus)
    if (!f) {
      post({ type: 'strata:error', message: `Nothing in this analysis is called “${focus}”.` })
      return
    }
    const ui = useUIStore.getState()
    focusSetAt.current = Date.now()
    ui.setFocusRange({ start: f.start, end: f.end })
    if (f.spanId) ui.selectSpan(f.spanId)
    else ui.clearSelection()
    const [from, to] = viewAround(f, d.duration)
    ui.requestView(from, to)
    if (ui.playerStatus === 'ready') ui.requestSeek(f.start, play)
    else pendingSeek.current = { time: f.start, play }
  }, [])

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const ui = useUIStore.getState()
    ui.setEmbed(true)
    ui.setReadingView(true)
    ui.setReadingShow('commentary', false)
    const narrow = window.innerWidth < NARROW_PX
    useUIStore.setState({ headersCollapsed: narrow })
    fetchSharedAnalysis(params.src)
      .then((result) => {
        loadDocument(params.layers ? onlyLayers(result.doc, params.layers) : result.doc)
        useDocumentStore.temporal.getState().clear()
        ui.setSharedFrom(params.src)
        if (params.focus) applyFocus(params.focus, false)
        // A whole track on a phone: the standard scale, scrolling, rather than
        // a fit that makes every span a sliver.
        else if (narrow) ui.requestView(0, null)
        post({ type: 'strata:ready' })
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        setError(message)
        post({ type: 'strata:error', message })
      })
  }, [params, loadDocument, applyFocus])

  // ── The player: a waiting seek, the loop, playing state ───────────────────
  useEffect(
    () =>
      useUIStore.subscribe((s, prev) => {
        if (s.playerStatus === 'ready' && prev.playerStatus !== 'ready' && pendingSeek.current) {
          const { time, play } = pendingSeek.current
          pendingSeek.current = null
          s.requestSeek(time, play)
        }
        if (s.playbackState !== prev.playbackState) {
          if (s.playbackState === 'playing' || prev.playbackState === 'playing')
            post({ type: 'strata:playing', playing: s.playbackState === 'playing' })
        }
        const focus = s.focusRange
        if (!focus || s.currentTime === prev.currentTime || s.playbackState !== 'playing') return
        const t = s.currentTime
        if (t >= focus.end && t < focus.end + 1) s.requestSeek(focus.start, true)
        // The reader moved the playhead well away: the loop lets go.
        else if ((t < focus.start - 1 || t > focus.end + 1) && Date.now() - focusSetAt.current > CUE_SETTLE_MS)
          s.setFocusRange(null)
      }),
    [],
  )

  // ── Messages from the page ────────────────────────────────────────────────
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const cmd = readCommand(e.data)
      if (!cmd) return
      if (cmd.type === 'strata:cue') applyFocus(cmd.focus, cmd.play ?? false)
      else useUIStore.getState().requestPlay(cmd.type === 'strata:play')
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [applyFocus])

  // ── Height, for the page to size the iframe ───────────────────────────────
  // Re-attached when the root element changes (loading → loaded, or an error).
  const loaded = doc != null
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    let last = 0
    const report = () => {
      const h = Math.ceil(el.getBoundingClientRect().height)
      if (h !== last) post({ type: 'strata:height', height: (last = h) })
    }
    report()
    const ro = new ResizeObserver(report)
    ro.observe(el)
    return () => ro.disconnect()
  }, [loaded, error])

  // ── Touch: drag the diagram sideways ──────────────────────────────────────
  // Phones have no wheel, and the editor's drag is a box-select; here a drag
  // pans, and holds the playhead-following for a moment.
  const pan = useRef<{ x: number; offset: number; moved: boolean } | null>(null)
  const swallowClick = useRef(false)
  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType !== 'touch') return
    pan.current = { x: e.clientX, offset: useUIStore.getState().scrollOffset, moved: false }
  }
  function onPointerMove(e: React.PointerEvent) {
    const p = pan.current
    if (!p) return
    const dx = e.clientX - p.x
    if (!p.moved && Math.abs(dx) < 8) return
    p.moved = true
    const ui = useUIStore.getState()
    const duration = useDocumentStore.getState().document?.duration ?? 0
    ui.setScrollOffset(clampScrollOffset(p.offset - dx, totalContentWidth(duration, ui.zoom), ui.viewportWidth))
    ui.holdFollow(PAN_HOLD_MS)
  }
  function onPointerEnd() {
    // A pan isn't a tap: the click that follows it mustn't select a span.
    swallowClick.current = pan.current?.moved ?? false
    pan.current = null
  }
  function onClickCapture(e: React.MouseEvent) {
    if (!swallowClick.current) return
    swallowClick.current = false
    e.stopPropagation()
  }

  if (error)
    return (
      <div ref={rootRef} className="embed-error rounded-md border border-border bg-card p-4 text-sm text-foreground">
        <p className="font-medium">This analysis couldn’t be opened.</p>
        <p className="mt-1 text-muted-foreground">{error}</p>
      </div>
    )

  const fullView = shareUrl(params.src, window.location.origin + '/')
  return (
    <div ref={rootRef} className="embed-grid bg-background text-foreground">
      {!params.bare && (
        <div className="embed-head flex items-baseline gap-1.5 px-3 py-1.5 text-xs">
          {doc ? (
            <>
              <span className="truncate font-medium">{doc.title}</span>
              {doc.artist.length > 0 && <span className="truncate text-muted-foreground">{doc.artist.join(', ')}</span>}
            </>
          ) : (
            <span className="text-muted-foreground">Loading…</span>
        )}
        <a
          href={fullView}
          target="_blank"
          rel="noopener"
          className="ml-auto shrink-0 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Open in Strata ↗
        </a>
      </div>
      )}
      <div
        className="embed-diagram flex min-w-0 flex-col"
        style={{ touchAction: 'pan-y' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={onClickCapture}
      >
        {doc && <FormDiagram />}
      </div>
      {/* PlayerDock's transport bar and video place themselves in this grid
          (embed-transport, embed-video). */}
      <PlayerDock />
    </div>
  )
}
