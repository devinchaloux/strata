/**
 * ExportDialog — save the form diagram as a figure (SVG, or PNG for slides).
 *
 * The range defaults to the selected spans when there are any, which is the
 * vision's "span as shortcut": click the Exposition, open Export, and the range
 * is already the Exposition; adjust the times to take in an elision or a
 * pickup. Hidden layers are left out, so hiding a layer is how to leave it out
 * of a figure. The preview is the exported SVG itself, so what you see is
 * exactly what you save.
 */
import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { exportFormDiagramSvg, exportLayers } from '@/widgets/form-diagram/exportSvg'
import { isStaleBuildError, STALE_BUILD_MESSAGE } from '@/lib/staleBuild'
import { downloadBlob, fileBaseName } from '@/lib/fileIO'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TimeInput } from './TimeInput'
import { allBlocks, commentaryToHtml, commentaryToMarkdown } from '@/widgets/written-analysis/commentary'
import type { StrataDocument } from '@/types/strata'

type RangeMode = 'all' | 'selection' | 'custom'

/** The time range covered by the selected spans, or null with no selection. */
function selectionRange(doc: StrataDocument, ids: string[]): [number, number] | null {
  if (ids.length === 0) return null
  const set = new Set(ids)
  const spans = doc.layers.flatMap((l) => (l.type === 'form-diagram' ? l.data.spans : [])).filter((s) => set.has(s.id))
  if (spans.length === 0) return null
  return [Math.min(...spans.map((s) => s.startTime)), Math.max(...spans.map((s) => s.endTime))]
}

/** Rasterise an SVG string at `scale`× for slides and documents that don't take SVG. */
async function svgToPng(svg: string, scale: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error("The browser couldn't draw the figure as an image."))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error("The browser couldn't create an image to draw into.")
    ctx.scale(scale, scale)
    ctx.drawImage(img, 0, 0)
    return await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("The browser couldn't encode the PNG."))), 'image/png'),
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function ExportDialog() {
  const doc = useDocumentStore((s) => s.document)
  const open = useUIStore((s) => s.exportOpen)
  const setOpen = useUIStore((s) => s.setExportOpen)
  const selectedIds = useUIStore((s) => s.selectedSpanIds)
  const showAppMessage = useUIStore((s) => s.showAppMessage)

  const selRange = useMemo(() => (doc ? selectionRange(doc, selectedIds) : null), [doc, selectedIds])
  const [mode, setMode] = useState<RangeMode>('all')
  const [custom, setCustom] = useState<[number, number]>([0, 0])
  const [width, setWidth] = useState(1200)
  const [includeMarkers, setIncludeMarkers] = useState(true)
  const [includeAxis, setIncludeAxis] = useState(true)
  const [svg, setSvg] = useState('')
  // Which layers go in the figure: chosen here, apart from what the editor
  // shows. Starts from the visible ones each time the dialog opens.
  const [layerIds, setLayerIds] = useState<string[]>([])

  // Each time the dialog opens, start from the selection if there is one.
  useEffect(() => {
    if (!open || !doc) return
    setMode(selRange ? 'selection' : 'all')
    setCustom(selRange ?? [0, doc.duration])
    setLayerIds(exportLayers(doc).map((l) => l.id))
    // Only on open: later selection changes shouldn't reset a range being edited.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const range: [number, number] | null = !doc
    ? null
    : mode === 'selection' && selRange
      ? selRange
      : mode === 'custom'
        ? custom
        : [0, doc.duration]

  // Re-render the preview whenever an option changes.
  useEffect(() => {
    if (!open || !doc || !range || range[1] <= range[0]) return
    let cancelled = false
    exportFormDiagramSvg(doc, { start: range[0], end: range[1], width, includeMarkers, includeAxis, layerIds })
      .then((s) => !cancelled && setSvg(s))
      .catch((e: unknown) => {
        if (cancelled) return
        setSvg('')
        if (isStaleBuildError(e)) showAppMessage(STALE_BUILD_MESSAGE.title, STALE_BUILD_MESSAGE.lines)
        else console.error('Export preview failed:', e)
      })
    return () => {
      cancelled = true
    }
    // range is derived from the values listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, doc, mode, custom[0], custom[1], selRange?.[0], selRange?.[1], width, includeMarkers, includeAxis, layerIds])

  if (!doc) return null
  const allLayers = exportLayers(doc, doc.layers.map((l) => l.id))
  const noLayers = layerIds.length === 0
  const hasCommentary = allBlocks(doc).length > 0
  const base = fileBaseName(doc)

  async function savePng() {
    try {
      downloadBlob(await svgToPng(svg, 2), `${base}-form-diagram.png`)
    } catch (e) {
      showAppMessage("Couldn't make the PNG", [e instanceof Error ? e.message : String(e), 'The SVG download still works.'])
    }
  }

  const radio = (value: RangeMode, label: string, disabled = false) => (
    <label className={`flex items-center gap-1.5 text-xs ${disabled ? 'opacity-40' : ''}`}>
      <input
        type="radio"
        name="export-range"
        id={`export-range-${value}`}
        checked={mode === value}
        disabled={disabled}
        onChange={() => setMode(value)}
      />
      {label}
    </label>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Export the form diagram</DialogTitle>
          <DialogDescription>Choose the layers and the time range.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="text-xs font-medium text-foreground">Range</span>
            {radio('all', 'Whole track')}
            {radio('selection', 'Selected spans', !selRange)}
            {radio('custom', 'Custom')}
            {mode === 'custom' && (
              <span className="flex items-center gap-1.5">
                <TimeInput value={custom[0]} title="Start" onCommit={(t) => setCustom([Math.max(0, t), custom[1]])} />
                <span className="text-xs text-muted-foreground">to</span>
                <TimeInput value={custom[1]} title="End" onCommit={(t) => setCustom([custom[0], Math.min(doc.duration, t)])} />
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2" role="group" aria-label="Layers">
            <span className="text-xs font-medium text-foreground">Layers</span>
            {allLayers.map((l) => (
              <label key={l.id} className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={layerIds.includes(l.id)}
                  onChange={(e) => setLayerIds(e.target.checked ? [...layerIds, l.id] : layerIds.filter((id) => id !== l.id))}
                />
                {l.label || 'Untitled layer'}
              </label>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <label className="flex items-center gap-1.5 text-xs" htmlFor="export-width">
              Width
              <input
                id="export-width"
                type="number"
                min={300}
                max={6000}
                step={100}
                value={width}
                onChange={(e) => setWidth(Math.max(300, Math.min(6000, Number(e.target.value) || 1200)))}
                className="w-20 rounded border border-border bg-card px-1.5 py-0.5 text-xs tabular-nums"
              />
              px
            </label>
            <label className="flex items-center gap-1.5 text-xs" htmlFor="export-markers">
              <input id="export-markers" type="checkbox" checked={includeMarkers} onChange={(e) => setIncludeMarkers(e.target.checked)} />
              Point markers
            </label>
            <label className="flex items-center gap-1.5 text-xs" htmlFor="export-axis">
              <input id="export-axis" type="checkbox" checked={includeAxis} onChange={(e) => setIncludeAxis(e.target.checked)} />
              Time axis
            </label>
          </div>

          <div className="max-h-[50vh] overflow-auto rounded border border-border bg-white p-2">
            {noLayers ? (
              <p className="p-6 text-center text-xs text-muted-foreground">Choose at least one layer to export.</p>
            ) : (
              // The exported SVG itself, scaled to fit: the preview is the file.
              <div className="[&>svg]:h-auto [&>svg]:max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {hasCommentary && (
              <Button
                variant="ghost"
                size="sm"
                className="mr-auto"
                title="All commentary as one web page, in time order"
                onClick={() => downloadBlob(new Blob([commentaryToHtml(doc)], { type: 'text/html' }), `${base}-commentary.html`)}
              >
                <Download size={13} aria-hidden /> Commentary (HTML)
              </Button>
            )}
            {hasCommentary && (
              <Button
                variant="ghost"
                size="sm"
                title="All commentary as Markdown, in time order"
                onClick={() =>
                  downloadBlob(new Blob([commentaryToMarkdown(doc)], { type: 'text/markdown' }), `${base}-commentary.md`)
                }
              >
                <Download size={13} aria-hidden /> Markdown
              </Button>
            )}
            <Button variant="outline" size="sm" disabled={!svg || noLayers} onClick={savePng}>
              <Download size={13} aria-hidden /> PNG
            </Button>
            <Button
              size="sm"
              disabled={!svg || noLayers}
              onClick={() => downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${base}-form-diagram.svg`)}
            >
              <Download size={13} aria-hidden /> SVG
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
