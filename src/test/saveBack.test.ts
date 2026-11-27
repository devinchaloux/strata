import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RECEIPT_MS, readReply, saveBackParam, sendToOpener, type SaveBackTarget, type SaveRequest } from '@/lib/saveBack'

// ── The link ──

describe('saveBackParam', () => {
  const page = (q: string) => `https://strata.example/?src=https%3A%2F%2Ffiles.example%2Fa.strata&${q}`

  it('reads an https origin and its name', () => {
    expect(saveBackParam(page('return=https%3A%2F%2Fadmin.example.org&returnName=Archive'))).toEqual({
      origin: 'https://admin.example.org',
      name: 'Archive',
    })
  })

  it('names the host when the link gives no name, or one too long to show', () => {
    expect(saveBackParam(page('return=https://admin.example.org'))?.name).toBe('admin.example.org')
    expect(saveBackParam(page(`return=https://admin.example.org&returnName=${'x'.repeat(41)}`))?.name).toBe('admin.example.org')
  })

  it('takes a trailing slash but not a path, query or hash', () => {
    expect(saveBackParam(page('return=https://admin.example.org/'))?.origin).toBe('https://admin.example.org')
    expect(saveBackParam(page('return=https://admin.example.org/tracks'))).toBeNull()
    expect(saveBackParam(page('return=' + encodeURIComponent('https://admin.example.org/?a=1')))).toBeNull()
  })

  it('refuses plain http except on localhost, and anything that is not a URL', () => {
    expect(saveBackParam(page('return=http://admin.example.org'))).toBeNull()
    expect(saveBackParam(page('return=http://localhost:5173'))?.origin).toBe('http://localhost:5173')
    expect(saveBackParam(page('return=javascript:alert(1)'))).toBeNull()
    expect(saveBackParam(page('return=nonsense'))).toBeNull()
    expect(saveBackParam(page('other=1'))).toBeNull()
  })
})

// ── The messages ──

describe('readReply', () => {
  it('reads each reply for this request only', () => {
    expect(readReply({ type: 'strata:saved', id: 'a' }, 'a')).toEqual({ type: 'strata:saved', id: 'a' })
    expect(readReply({ type: 'strata:saved', id: 'b' }, 'a')).toBeNull()
    expect(readReply({ type: 'something-else', id: 'a' }, 'a')).toBeNull()
    expect(readReply('strata:saved', 'a')).toBeNull()
  })

  it('gives a refusal a reason even when the host sent none', () => {
    expect(readReply({ type: 'strata:save-refused', id: 'a', reason: ' Not an analysis. ' }, 'a')).toEqual({
      type: 'strata:save-refused', id: 'a', reason: 'Not an analysis.',
    })
    expect(readReply({ type: 'strata:save-refused', id: 'a' }, 'a')).toMatchObject({ reason: 'It gave no reason.' })
  })
})

// ── Sending ──

const target: SaveBackTarget = { origin: 'https://admin.example.org', name: 'Archive' }
const file = { text: '{"title":"Alive"}', filename: 'alive.strata' }

/** A stand-in for the opening tab and for this window's message events. */
function fakeChannel() {
  const sent: { message: SaveRequest; origin: string }[] = []
  const opener = {
    closed: false,
    postMessage: (message: SaveRequest, origin: string) => sent.push({ message, origin }),
  } as unknown as Window & { closed: boolean }
  let listener: ((e: MessageEvent) => void) | null = null
  const events = {
    addEventListener: (_: string, fn: (e: MessageEvent) => void) => { listener = fn },
    removeEventListener: () => { listener = null },
  } as unknown as Pick<Window, 'addEventListener' | 'removeEventListener'>
  const reply = (data: unknown, from: { origin?: string; source?: unknown } = {}) =>
    listener?.({ data, origin: from.origin ?? target.origin, source: from.source ?? opener } as MessageEvent)
  return { opener, events, sent, reply, listening: () => listener !== null }
}

describe('sendToOpener', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('sends the file to the opener at the target origin only', () => {
    const c = fakeChannel()
    void sendToOpener(target, file, c, 'r1')
    expect(c.sent).toEqual([{ message: { type: 'strata:save', id: 'r1', ...file }, origin: target.origin }])
  })

  it('resolves saved once the host says so, after its receipt', async () => {
    const c = fakeChannel()
    const onReceived = vi.fn()
    const p = sendToOpener(target, file, { ...c, onReceived }, 'r1')
    c.reply({ type: 'strata:save-received', id: 'r1' })
    expect(onReceived).toHaveBeenCalledOnce()
    // The host may ask the analyst for as long as they take.
    vi.advanceTimersByTime(RECEIPT_MS * 6)
    c.reply({ type: 'strata:saved', id: 'r1' })
    await expect(p).resolves.toEqual({ kind: 'saved' })
    expect(c.listening()).toBe(false)
  })

  it('passes on a refusal and a cancel', async () => {
    const a = fakeChannel()
    const refused = sendToOpener(target, file, a, 'r1')
    a.reply({ type: 'strata:save-refused', id: 'r1', reason: 'A newer copy exists.' })
    await expect(refused).resolves.toEqual({ kind: 'refused', reason: 'A newer copy exists.' })

    const b = fakeChannel()
    const cancelled = sendToOpener(target, file, b, 'r2')
    b.reply({ type: 'strata:save-cancelled', id: 'r2' })
    await expect(cancelled).resolves.toEqual({ kind: 'cancelled' })
  })

  it('ignores replies from another origin, another window or another request', async () => {
    const c = fakeChannel()
    const p = sendToOpener(target, file, c, 'r1')
    c.reply({ type: 'strata:saved', id: 'r1' }, { origin: 'https://evil.example' })
    c.reply({ type: 'strata:saved', id: 'r1' }, { source: {} })
    c.reply({ type: 'strata:saved', id: 'other' })
    vi.advanceTimersByTime(RECEIPT_MS)
    await expect(p).resolves.toEqual({ kind: 'no-answer' })
  })

  it('gives up when no receipt comes, or the host tab closes while it waits', async () => {
    const quiet = fakeChannel()
    const p1 = sendToOpener(target, file, quiet, 'r1')
    vi.advanceTimersByTime(RECEIPT_MS)
    await expect(p1).resolves.toEqual({ kind: 'no-answer' })

    const closing = fakeChannel()
    const p2 = sendToOpener(target, file, closing, 'r2')
    closing.reply({ type: 'strata:save-received', id: 'r2' })
    ;(closing.opener as { closed: boolean }).closed = true
    vi.advanceTimersByTime(2_000)
    await expect(p2).resolves.toEqual({ kind: 'no-answer' })
  })

  it('answers no-answer at once without an opener', async () => {
    const c = fakeChannel()
    await expect(sendToOpener(target, file, { ...c, opener: null }, 'r1')).resolves.toEqual({ kind: 'no-answer' })
    expect(c.sent).toEqual([])
  })
})
