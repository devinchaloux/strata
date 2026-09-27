/**
 * SVG export for the form diagram — the widget contract's export definition.
 *
 * Renders the same pure figure the editor draws (./figure.tsx), with the print
 * theme's literal colours, for a chosen time range at a chosen width. Hidden
 * layers are left out, so the visibility toggle doubles as the "which layers"
 * control (docs/decisions.md, "Layer visibility is view-state"). The result is a
 * standalone SVG string: it opens in a browser, Illustrator or Inkscape, and
 * drops into a paper or slide.
 *
 * `react-dom/server` is imported on demand, so the editor's bundle only pays
 * for it when someone actually exports.
 */
import { FormDiagramFigure } from './figure'
import { PRINT_THEME } from './theme'
import { stackHeight } from '@/lib/formShape'
import { layoutMarkerBand } from '@/lib/markerBand'
import { getTickInterval } from '@/lib/timeline'
import type { StrataDocument, Layer } from '@/types/strata'

export interface SvgExportOptions {
  /** Range to export, in recording seconds. */
  start: number
  end: number
  /** Width of the diagram itself in px; the time scale follows from it. */
  width: number
  /** Draw the point-marker band under the layers. */
  includeMarkers: boolean
  /** Draw a time axis (m:ss) under everything. */
  includeAxis: boolean
}

/** White margin on each side of the figure (the drawing itself is clipped to the range). */
const SIDE_PAD = 16
const AXIS_HEIGHT = 22
const FONT_STACK = "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif"

/** The layers an export draws: visible form-diagram layers, macro on top. */
export function exportLayers(doc: StrataDocument): Layer[] {
  return doc.layers
    .filter((l) => l.type === 'form-diagram' && l.visibility)
    .sort((a, b) => b.displayOrder - a.displayOrder)
}

/** m:ss for axis labels (the export's audience reads minutes, not milliseconds). */
function axisLabel(t: number): string {
  const m = Math.floor(t / 60)
  const s = Math.round(t - m * 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

const escapeXml = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

export async function exportFormDiagramSvg(doc: StrataDocument, opts: SvgExportOptions): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server')

  const start = Math.max(0, Math.min(opts.start, doc.duration))
  const end = Math.max(start + 0.001, Math.min(opts.end, doc.duration))
  const pps = opts.width / (end - start)
  const layers = exportLayers(doc)

  const band = opts.includeMarkers
    ? layoutMarkerBand(doc.pointMarkers, doc.vocabulary.pointMarkerTypes, pps)
    : { placements: [], height: 0 }
  const placements = band.placements.filter((p) => p.marker.timestamp >= start && p.marker.timestamp <= end)
  const bandHeight = placements.length ? band.height : 0

  const stackH = stackHeight(layers)
  const axisTop = stackH + bandHeight
  const height = Math.ceil(axisTop + (opts.includeAxis ? AXIS_HEIGHT : 0))
  const width = Math.ceil(opts.width + SIDE_PAD * 2)
  // Content x of the range start; everything shifts left by it.
  const x0 = start * pps

  const figure = renderToStaticMarkup(
    <FormDiagramFigure
      layers={layers}
      placements={placements}
      pps={pps}
      totalWidth={doc.duration * pps}
      showCaptions={doc.showCadenceCaptions ?? true}
      theme={PRINT_THEME}
    />,
  )

  // Axis: ticks at a round interval, at least ~60px apart at this scale.
  let axis = ''
  if (opts.includeAxis) {
    const interval = getTickInterval(pps)
    const parts: string[] = [
      `<line x1="${SIDE_PAD}" x2="${SIDE_PAD + opts.width}" y1="${axisTop + 0.5}" y2="${axisTop + 0.5}" stroke="${PRINT_THEME.inkFaint}" stroke-width="1"/>`,
    ]
    for (let t = Math.ceil(start / interval) * interval; t <= end + 1e-6; t += interval) {
      const x = SIDE_PAD + (t - start) * pps
      parts.push(
        `<line x1="${x}" x2="${x}" y1="${axisTop}" y2="${axisTop + 5}" stroke="${PRINT_THEME.inkFaint}" stroke-width="1"/>`,
        `<text x="${x}" y="${axisTop + 16}" text-anchor="middle" font-size="10" fill="${PRINT_THEME.caption}">${axisLabel(t)}</text>`,
      )
    }
    axis = `<g>${parts.join('')}</g>`
  }

  const title = [doc.title, doc.artist.join(', ')].filter(Boolean).join(' — ')
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT_STACK}">`,
    `<title>${escapeXml(title)}</title>`,
    `<desc>${escapeXml(`Form diagram, ${axisLabel(start)}–${axisLabel(end)}. Made with Strata.`)}</desc>`,
    // Clip to exactly the chosen range, so no sliver of a neighbouring span
    // shows in the side margins; the margins stay as white space.
    `<defs><clipPath id="range"><rect x="${SIDE_PAD}" y="0" width="${opts.width}" height="${axisTop}"/></clipPath></defs>`,
    `<rect width="100%" height="100%" fill="${PRINT_THEME.canvas}"/>`,
    `<g clip-path="url(#range)"><g transform="translate(${SIDE_PAD - x0}, 0)">${figure}</g></g>`,
    axis,
    '</svg>',
  ].join('')
}
