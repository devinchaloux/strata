/**
 * Embed mode: Strata inside another page's iframe, read-only, showing one
 * analysis or a part of it. The page addresses it with
 *
 *   /?embed&src=<file URL>[&focus=<span slug | m:ss-m:ss>][&layers=<label>,<label>]
 *
 * and drives it with window messages (EmbedMessage below). docs/decisions.md,
 * "Embedding an Analysis".
 */
import type { StrataDocument } from '@/types/strata'
import { srcParam } from '@/lib/shareLink'
import { allSpans } from '@/lib/slug'

export interface EmbedParams {
  src: string
  focus: string | null
  layers: string[] | null
}

/** The embed's settings, or null when the page isn't an embed. */
export function parseEmbedParams(pageUrl: string): EmbedParams | null {
  const params = new URL(pageUrl).searchParams
  if (!params.has('embed')) return null
  const src = srcParam(pageUrl)
  if (!src) return null
  const layers = params.get('layers')
  return {
    src,
    focus: params.get('focus')?.trim() || null,
    layers: layers
      ? layers
          .split(',')
          .map((l) => l.trim())
          .filter(Boolean)
      : null,
  }
}

// ── Focus: a span or a stretch of time ────────────────────────────────────────

/** Seconds from "m:ss", "h:mm:ss" or plain seconds ("64.5"). */
function seconds(t: string): number | null {
  const parts = t.trim().split(':')
  if (parts.length > 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return null
  return parts.reduce((acc, p) => acc * 60 + Number(p), 0)
}

/** "1:04-1:30" or "64-90" as [start, end] in seconds; null if it isn't a range. */
export function parseTimeRange(text: string): [number, number] | null {
  const m = /^\s*([\d:.]+)\s*[-–]\s*([\d:.]+)\s*$/.exec(text)
  if (!m) return null
  const start = seconds(m[1])
  const end = seconds(m[2])
  if (start == null || end == null || end <= start) return null
  return [start, end]
}

export interface Focus {
  start: number
  end: number
  /** The span named, when the focus was a slug. */
  spanId: string | null
}

/** What a focus names in this document: a span (by slug) or a time range. */
export function resolveFocus(doc: StrataDocument, focus: string): Focus | null {
  const range = parseTimeRange(focus)
  if (range) {
    const end = doc.duration > 0 ? Math.min(range[1], doc.duration) : range[1]
    return end > range[0] ? { start: range[0], end, spanId: null } : null
  }
  const span = allSpans(doc).find((s) => s.slug === focus)
  return span ? { start: span.startTime, end: span.endTime, spanId: span.id } : null
}

/** The stretch to show for a focus: the focus plus a margin each side. */
export function viewAround(focus: Focus, duration: number): [number, number] {
  const pad = (focus.end - focus.start) * 0.15
  return [Math.max(0, focus.start - pad), duration > 0 ? Math.min(duration, focus.end + pad) : focus.end + pad]
}

// ── Layers ────────────────────────────────────────────────────────────────────

/**
 * A copy showing only the named layers (by label, case-insensitive, or id).
 * Unknown names are ignored; if none match, the document is shown as it is.
 */
export function onlyLayers(doc: StrataDocument, names: string[]): StrataDocument {
  const wanted = new Set(names.map((n) => n.toLowerCase()))
  const matches = (l: StrataDocument['layers'][number]) => wanted.has(l.label.toLowerCase()) || wanted.has(l.id.toLowerCase())
  if (!doc.layers.some(matches)) return doc
  return { ...doc, layers: doc.layers.map((l) => ({ ...l, visibility: matches(l) })) }
}

// ── Messages ──────────────────────────────────────────────────────────────────

/** Page → embed. */
export type EmbedCommand =
  | { type: 'strata:cue'; focus: string; play?: boolean }
  | { type: 'strata:play' }
  | { type: 'strata:pause' }

/** Embed → page. */
export type EmbedEvent =
  | { type: 'strata:ready' }
  | { type: 'strata:height'; height: number }
  | { type: 'strata:playing'; playing: boolean }
  | { type: 'strata:error'; message: string }

/** A message from the page this embed understands, or null. */
export function readCommand(data: unknown): EmbedCommand | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  if (d.type === 'strata:play' || d.type === 'strata:pause') return { type: d.type }
  if (d.type === 'strata:cue' && typeof d.focus === 'string') return { type: 'strata:cue', focus: d.focus, play: d.play === true }
  return null
}
