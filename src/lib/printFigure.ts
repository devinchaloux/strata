/**
 * Save as PDF without a PDF library: the exported SVG goes alone onto a
 * print page in a hidden frame, and the browser's own print dialog saves it.
 * The figure stays vector, and nothing is added to the bundle.
 */

// The same Inter the app loads (index.html). The exported SVG names Inter
// first in its font stack, so the PDF matches the editor when this loads.
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap'

// How long to wait for the font before printing anyway, with the fallback face.
const FONT_WAIT_MS = 2000

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** The root `<svg>`'s width and height attributes, or null when it has none. */
export function svgSize(svg: string): { width: number; height: number } | null {
  const root = /<svg\b[^>]*>/.exec(svg)?.[0]
  if (!root) return null
  const width = Number(/\swidth="([\d.]+)"/.exec(root)?.[1])
  const height = Number(/\sheight="([\d.]+)"/.exec(root)?.[1])
  return width > 0 && height > 0 ? { width, height } : null
}

/**
 * The print page: the figure alone, scaled to the page width, on a landscape
 * page unless the figure is taller than it is wide. `title` becomes the page
 * title, which browsers offer as the PDF's file name.
 */
export function figurePrintHtml(svg: string, title: string): string {
  const size = svgSize(svg)
  const orientation = size && size.height > size.width ? 'portrait' : 'landscape'
  return [
    '<!doctype html>',
    '<html><head><meta charset="utf-8">',
    `<title>${escapeHtml(title)}</title>`,
    `<link rel="stylesheet" href="${FONT_CSS}">`,
    '<style>',
    `@page { size: ${orientation}; margin: 12mm; }`,
    'html, body { margin: 0; background: #fff; }',
    // Keep the figure's own colors: browsers drop backgrounds when printing.
    '* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }',
    'svg { display: block; width: 100%; height: auto; break-inside: avoid; }',
    '</style></head>',
    `<body>${svg}</body></html>`,
  ].join('\n')
}

/**
 * Open the print dialog on the figure alone. Resolves once the dialog is up
 * (or, where print() blocks, once it closes). The frame is removed after
 * printing.
 */
export async function printFigure(svg: string, title: string): Promise<void> {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.tabIndex = -1
  // Off screen rather than display: none, which some browsers won't print.
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  const loaded = new Promise<void>((resolve) => frame.addEventListener('load', () => resolve(), { once: true }))
  frame.srcdoc = figurePrintHtml(svg, title)
  document.body.appendChild(frame)
  await loaded

  const win = frame.contentWindow
  if (!win) {
    frame.remove()
    throw new Error("The browser couldn't open a print page.")
  }
  await Promise.race([win.document.fonts.ready, new Promise((r) => setTimeout(r, FONT_WAIT_MS))])

  // Chrome names the PDF after the top page's title, not the frame's, so the
  // figure's title stands in while the dialog is open. Chrome's print() waits
  // for the dialog to close, so the app's title comes back right after it.
  const appTitle = document.title
  document.title = title
  win.addEventListener('afterprint', () => frame.remove(), { once: true })
  win.focus()
  try {
    win.print()
  } finally {
    document.title = appTitle
  }
  // Safari and Firefox don't always fire afterprint for a frame. A minute is
  // long enough for the dialog to have read the page; the frame is invisible.
  setTimeout(() => frame.remove(), 60_000)
}
