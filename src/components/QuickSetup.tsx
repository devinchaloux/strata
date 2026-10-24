/**
 * QuickSetup — a first layer laid out from the tempo, for a new analysis.
 *
 * Shown in the open area above the diagram while the source is linked and no
 * layer has spans yet, as a "Quick setup by tempo" button that opens the card
 * in place, so the empty screen stays calm. The analyst gives the tempo (from Document settings, or
 * typed here), where the first downbeat falls, and how many bars a span lasts;
 * Fill starts a beat grid there (unless one already covers it) and tiles the
 * layer to where the grid stops, in one undo step (documentStore
 * fillLayerWithBars). A span that runs a bar long or short is then fixed from
 * the Inspector's bar buttons, which move every later boundary with it.
 * docs/decisions.md, "Quick Setup From the Tempo".
 */
import { useState } from 'react'
import { X } from 'lucide-react'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { segmentAt, sortedSegments } from '@/lib/beatGrid'
import { TimeInput } from '@/components/TimeInput'
import { Button } from '@/components/ui/button'
import type { Layer, StrataDocument } from '@/types/strata'

const field =
  'rounded border border-border bg-card px-1.5 py-0.5 text-center text-xs tabular-nums text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring'

export function QuickSetup({ doc, layer }: { doc: StrataDocument; layer: Layer }) {
  const [open, setOpen] = useState(false)
  if (!open)
    return (
      <Button variant="outline" size="sm" className="mt-3 h-7 text-xs" onClick={() => setOpen(true)}>
        Quick setup by tempo…
      </Button>
    )
  return <QuickSetupCard doc={doc} layer={layer} onClose={() => setOpen(false)} />
}

function QuickSetupCard({ doc, layer, onClose }: { doc: StrataDocument; layer: Layer; onClose: () => void }) {
  const updateMeta = useDocumentStore((s) => s.updateMeta)
  const fill = useDocumentStore((s) => s.fillLayerWithBars)
  const segs = sortedSegments(doc.beatGrid)
  const [start, setStart] = useState(() => segs[0]?.start ?? 0)
  const [bars, setBars] = useState('4')
  const [bpmText, setBpmText] = useState(doc.bpm != null ? String(doc.bpm) : '')
  const [message, setMessage] = useState<string | null>(null)
  // Follow a tempo set elsewhere (Document settings, undo), during render.
  const [bpmSeen, setBpmSeen] = useState(doc.bpm)
  if (bpmSeen !== doc.bpm) {
    setBpmSeen(doc.bpm)
    setBpmText(doc.bpm != null ? String(doc.bpm) : '')
  }

  // A grid already running at the start sets the tempo; otherwise the
  // document's tempo starts one there.
  const gridHere = segmentAt(segs, start, doc.duration)?.seg ?? null
  const meter = gridHere
    ? `${gridHere.beatsPerBar}/${gridHere.beatUnit ?? 4}`
    : `${doc.timeSignature?.numerator ?? 4}/${doc.timeSignature?.denominator ?? 4}`
  const barsPer = Number(bars)
  // The track's length comes from the player once the media loads.
  const loaded = doc.duration > 0
  const canFill = loaded && (gridHere != null || doc.bpm != null) && Number.isInteger(barsPer) && barsPer >= 1

  function commitBpm() {
    const n = Number(bpmText)
    const bpm = bpmText.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null
    updateMeta({ bpm })
    setBpmText(bpm != null ? String(bpm) : '')
  }

  function run() {
    const made = fill(layer.id, start, barsPer)
    setMessage(made ? null : 'Nothing to fill there. Is the start inside the grid?')
  }

  return (
    <section
      aria-label="Quick setup"
      className="relative mt-4 w-full max-w-md rounded-md border border-border bg-card px-4 py-3 text-xs text-foreground"
    >
      <button
        type="button"
        aria-label="Close quick setup"
        onClick={onClose}
        className="absolute right-2 top-2 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <X size={14} aria-hidden />
      </button>
      <h2 className="text-[13px] font-semibold">Quick setup by tempo</h2>
      <p className="mt-0.5 text-muted-foreground">Know the phrase length? Fill a layer with a span every few bars.</p>
      <div className="mt-2.5 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
        <span className="text-muted-foreground">Tempo</span>
        <span className="flex items-center gap-1.5">
          {gridHere ? (
            <span className="tabular-nums">{gridHere.bpm} BPM, from the grid</span>
          ) : (
            <>
              <input
                aria-label="Tempo in BPM"
                inputMode="decimal"
                placeholder="120"
                className={`${field} w-14`}
                value={bpmText}
                onChange={(e) => setBpmText(e.target.value)}
                onBlur={commitBpm}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              />
              BPM
            </>
          )}
          <span className="text-muted-foreground">· {meter}</span>
        </span>

        <span className="text-muted-foreground">First downbeat</span>
        <span className="flex items-center gap-1.5">
          <TimeInput value={start} onCommit={(t) => setStart(Math.max(0, Math.min(t, doc.duration)))} title="First downbeat" />
          <button
            type="button"
            className="rounded border border-border px-2 py-0.5 hover:bg-accent"
            onClick={() => setStart(useUIStore.getState().currentTime)}
          >
            Use playhead
          </button>
        </span>

        <span className="text-muted-foreground">A span every</span>
        <span className="flex items-center gap-1.5">
          <input
            aria-label="Bars per span"
            inputMode="numeric"
            className={`${field} w-10`}
            value={bars}
            onChange={(e) => setBars(e.target.value)}
          />
          bars, in <span className="font-medium">{layer.label}</span>
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-muted-foreground" role="status">
          {!loaded
            ? 'Waiting for the track’s length from the player…'
            : message ?? 'Pause on the first downbeat, then press Use playhead.'}
        </p>
        <Button size="sm" className="h-7 shrink-0 text-xs" disabled={!canFill} onClick={run}>
          Fill
        </Button>
      </div>
    </section>
  )
}
