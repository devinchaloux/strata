/**
 * Saving back to the page that opened Strata. A host that keeps analyses
 * (a research database, a course site) opens Strata on a file with
 *
 *   /?src=<file URL>&return=<the host's origin>[&returnName=<its name>]
 *
 * and Strata offers "Save to <name>" in the File menu. Saving sends the file's
 * text to the opening tab by window message; the host saves it with its own
 * sign-in and answers. Strata holds no credential and stores nothing: it only
 * hands the file back to the tab that gave it. docs/decisions.md, "Saving Back
 * to the Page That Opened Strata".
 *
 * The exchange, every message carrying the request's `id`:
 *   Strata → host  { type: 'strata:save', id, text, filename }
 *   host → Strata  { type: 'strata:save-received', id }   within 10 s, or Strata gives up
 *   host → Strata  { type: 'strata:saved', id }
 *               or { type: 'strata:save-refused', id, reason }
 *               or { type: 'strata:save-cancelled', id }
 * The host may ask the analyst something before it saves (draft or published
 * version, a newer copy in the meantime), so only the receipt has a deadline.
 */

// ── The link ──

export interface SaveBackTarget {
  /** The origin the file goes back to, e.g. https://admin.example.org. */
  origin: string
  /** What the menu calls it: the link's returnName, else the host's name. */
  name: string
}

const MAX_NAME = 40

/**
 * The save-back target a page URL names, or null. The origin must be https
 * (http only for localhost, for a host in development); anything else, or a
 * value with a path, is ignored, so the file can only go to a whole site.
 */
export function saveBackParam(pageUrl: string): SaveBackTarget | null {
  const params = new URL(pageUrl).searchParams
  const raw = params.get('return')
  if (!raw) return null
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return null
  }
  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1'
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) return null
  // `return` names a site, not a page: a path, query or hash means a malformed link.
  if (u.origin !== raw.replace(/\/$/, '')) return null
  const given = params.get('returnName')?.trim().replace(/\s+/g, ' ') ?? ''
  const name = given && given.length <= MAX_NAME ? given : u.hostname
  return { origin: u.origin, name }
}

// ── The messages ──

export interface SaveRequest {
  type: 'strata:save'
  id: string
  text: string
  filename: string
}

export type SaveReply =
  | { type: 'strata:save-received'; id: string }
  | { type: 'strata:saved'; id: string }
  | { type: 'strata:save-refused'; id: string; reason: string }
  | { type: 'strata:save-cancelled'; id: string }

/** A reply to request `id`, or null when the message is anything else. */
export function readReply(data: unknown, id: string): SaveReply | null {
  if (typeof data !== 'object' || data === null) return null
  const m = data as Record<string, unknown>
  if (m.id !== id) return null
  switch (m.type) {
    case 'strata:save-received':
    case 'strata:saved':
    case 'strata:save-cancelled':
      return { type: m.type, id }
    case 'strata:save-refused':
      return {
        type: 'strata:save-refused',
        id,
        // The host's words, shown as text; a missing reason still reads as a sentence.
        reason: typeof m.reason === 'string' && m.reason.trim() ? m.reason.trim() : 'It gave no reason.',
      }
    default:
      return null
  }
}

// ── Sending ──

/** How long the host has to say it got the file. */
export const RECEIPT_MS = 10_000
/** How often Strata checks the host's tab is still open while it waits. */
const CLOSED_POLL_MS = 1_000

export type SaveOutcome =
  | { kind: 'saved' }
  | { kind: 'refused'; reason: string }
  | { kind: 'cancelled' }
  /** The host never confirmed it got the file: its tab was closed, reloaded or moved on. */
  | { kind: 'no-answer' }

export interface SaveChannel {
  /** The tab that opened Strata (window.opener), or null if it's gone. */
  opener: Window | null
  /** Where replies arrive (window). */
  events: Pick<Window, 'addEventListener' | 'removeEventListener'>
  /** Called once the host confirms it got the file, while it asks the analyst. */
  onReceived?: () => void
}

/**
 * Send the file to the opening tab and wait for its answer. Replies count only
 * from that tab, at that origin, for this request: another page can't fake a
 * save. Never throws.
 */
export function sendToOpener(
  target: SaveBackTarget,
  file: { text: string; filename: string },
  channel: SaveChannel,
  id: string = crypto.randomUUID(),
): Promise<SaveOutcome> {
  const { opener, events } = channel
  if (!opener || opener.closed) return Promise.resolve({ kind: 'no-answer' })

  return new Promise((resolve) => {
    let received = false
    // Once the host has the file it may wait on the analyst for as long as they
    // take; if its tab closes meanwhile, no answer is coming.
    let watch: ReturnType<typeof setInterval> | undefined
    const finish = (outcome: SaveOutcome) => {
      clearTimeout(timer)
      clearInterval(watch)
      events.removeEventListener('message', onMessage)
      resolve(outcome)
    }
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== target.origin || e.source !== opener) return
      const reply = readReply(e.data, id)
      if (!reply) return
      if (reply.type === 'strata:save-received') {
        if (!received) {
          received = true
          clearTimeout(timer)
          watch = setInterval(() => {
            if (opener.closed) finish({ kind: 'no-answer' })
          }, CLOSED_POLL_MS)
          channel.onReceived?.()
        }
      } else if (reply.type === 'strata:saved') finish({ kind: 'saved' })
      else if (reply.type === 'strata:save-refused') finish({ kind: 'refused', reason: reply.reason })
      else finish({ kind: 'cancelled' })
    }
    const timer = setTimeout(() => finish({ kind: 'no-answer' }), RECEIPT_MS)
    events.addEventListener('message', onMessage)
    const request: SaveRequest = { type: 'strata:save', id, ...file }
    // The browser delivers this only if the opener is still at target.origin,
    // so the file can't reach a page that has since navigated elsewhere.
    try {
      opener.postMessage(request, target.origin)
    } catch {
      finish({ kind: 'no-answer' })
    }
  })
}
