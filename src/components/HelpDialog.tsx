/**
 * HelpDialog — how Strata works, step by step, and every keyboard shortcut,
 * as a page of its own over the whole window (docs/decisions.md, "Help Is a
 * Page").
 *
 * Opened from Help ▾, the empty state, or the ? key. Opening it pauses
 * playback, and while it's open the app's keys do nothing but Esc, which
 * closes it, so reading the shortcuts can't start the track. While it's open
 * the YouTube player is off the page altogether, not covered: PlayerDock
 * destroys it on uiStore.helpOpen and builds it again, paused at the same
 * time, on close (useYouTubePlayer's `away`).
 *
 * The shortcut list is written out by hand: when a shortcut changes in App or
 * PlayerDock, change it here too.
 */
import { useEffect } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { versionLabel } from '@/lib/version'

const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent)
const MOD = MAC ? '⌘' : 'Ctrl'
const ALT = MAC ? 'Option' : 'Alt'

const STEPS: [string, string][] = [
  ['Start', 'Click New analysis and link a YouTube video or audio file. The video plays in the corner; ⚙ in the play bar moves it below the play bar, and holds the speed.'],
  ['Mark', 'Play (Space) and press B at each boundary you hear. Press M to place a point marker, such as a cadence. A boundary a little off? Play it again and press R on the beat: the nearest boundary moves there, and to the average of your re-taps on each pass. On Bluetooth headphones, set their delay under ⚙ › Headphone delay in the play bar first, so marks land where you hear them. If you know the tempo and phrase length, use Quick setup by tempo to fill a layer with a span every few bars.'],
  ['Describe', 'Click a span to set its type and details in the Inspector. Drag a boundary to move it. Click a section’s header in the Inspector to open or close it; double-click it to open that section alone. With Quick pick (above the diagram), a row of types, shapes, or fills appears over the spans you select: click one, or press its number key.'],
  ['Grid', 'Optional: tap T on the beat, or set a tempo in the Grid menu, to number bars and snap to beats. After four taps the grid appears; each further tap fine-tunes the tempo. Type a selected span’s length in bars, or step it with − and +: the spans after it move too. The Metronome in the play bar clicks the grid over the track. To match it, line up the first beats, then listen further in. If the click pulls ahead, lower the tempo. If it lags, raise it. For the exact tempo, pause on a downbeat far into the track and press Downbeat is here (D). To hide the grid without losing it, turn off Show in the Grid menu.'],
  ['Layers', `Add a layer (+ above the layer names) for another level of form, or another framework. Group into (several spans) builds the level above from the one below; Copy to layer (one span) copies it to any other layer, up or down. Boundaries at the same moment in different layers move together. Hold ${ALT} while dragging to move one alone. An amber mark shows a boundary just off another layer’s line. Click it to move the boundary onto that line.`],
  ['Bars', 'Optional: to work bar by bar, turn on Bar layer in the ⋯ menu of the layer that marks them. Its spans are bars, numbered above and counted inside. Use Bars, in the Segments tool row, to number and count them, elide a bar, make phrases or the beat grid from them, and even out hand-marked timing. Select some bars to work on those, or none to work on all of them. To make bars from phrases, select the phrases and choose Split into bars.'],
  ['Write', 'You write commentary above the diagram: hover a span’s level and press Edit, or press Write commentary in the Inspector. Markdown works, with a toolbar for bold, lists, headings, and links. The link button names a span or marker; type your own words over its label. Commentary appears while that passage plays.'],
  ['Keep', 'Use File to save a .strata file, or Export a figure (SVG, PNG, or PDF) or a commentary page (HTML). Click the analysis’s title for its settings.'],
  ['Read', 'Open Reading view to read or teach from the video, commentary, and diagram, with editing off. Choose what it shows from View. Zoom the diagram with − and +, or press Fit to see the whole track. Use Share to make a link to a copy you’ve put online (Dropbox, OneDrive, GitHub, or your own site). Press Esc to go back.'],
]

const KEYS: [string, [string, string][]][] = [
  [
    'Playback',
    [
      ['Space or K', 'Play or pause'],
      ['B', 'Place a boundary on the active layer at the playhead'],
      ['Shift+B', 'End the span under the playhead there'],
      ['R', 'Re-tap the nearest boundary on the beat: it moves to the average of your re-taps'],
      ['J / L', 'Back / forward 10 seconds'],
      ['Home', 'Back to the start'],
      ['M', 'Place a point marker at the playhead'],
      ['T', 'Tap along on the beat to lay the grid'],
      ['Shift+T', 'Stop the grid here (free passage)'],
    ],
  ],
  [
    'Metronome (while it’s on)',
    [
      ['[ / ]', 'Tempo down / up 0.01 BPM (with Shift, 0.1)'],
      [', / .', 'Beat earlier / later by 5 ms (with Shift, 25 ms)'],
      ['D', 'Downbeat is here: set the exact tempo'],
    ],
  ],
  [
    'Selecting',
    [
      ['Click', 'Select a span (when paused, the playhead moves to it)'],
      ['Double-click', 'Play from a span or marker (on a phone, double-tap)'],
      ['Click the ruler', 'Move the playhead there'],
      [`${MOD}-click`, 'Add or remove a span'],
      ['Shift-click', 'Select a run of spans'],
      ['Drag', 'From empty space: select every span in the box'],
      [`${ALT}-drag`, 'Move a boundary alone, not with the layers that share it'],
      ['← →', 'Previous / next span'],
      ['↑ ↓', 'Span in the layer above / below'],
      ['Shift+← →', 'Extend the selection'],
      ['Enter', 'Edit the selected span’s label'],
      ['1–9', 'Quick pick: set a type, shape or fill'],
      ['/', 'Choose from every type, with search'],
      ['Esc', 'Clear the selection'],
      ['Delete', 'Remove the selected spans or marker'],
    ],
  ],
  [
    'Editing',
    [
      [`${MOD}+C`, 'Copy the selected spans'],
      [`${MOD}+V`, 'Paste their label and type: one span onto all selected, several onto as many in time order (choose more in the Inspector’s Paste menu)'],
      [`${MOD}+J`, 'Merge the selected spans'],
      [`${MOD}+Z`, 'Undo'],
      [`${MOD}+Shift+Z`, 'Redo'],
      ['Right-click a span', 'Split, merge or delete'],
    ],
  ],
  [
    'File',
    [
      [`${MOD}+N`, 'New analysis'],
      [`${MOD}+O`, 'Open a file'],
      [`${MOD}+S`, 'Save'],
      [`${MOD}+Shift+S`, 'Save as'],
      ['?', 'This help'],
    ],
  ],
]

/**
 * While Help is open, the app's own keys (Space, B, J, the arrows …) stop at
 * the window. Esc closes Help and goes no further, so it doesn't also leave
 * the reading view or clear the selection. Tab goes on, to move focus.
 */
function useAppKeysOff(open: boolean, onOpenChange: (open: boolean) => void) {
  useEffect(() => {
    if (!open) return
    const ui = useUIStore.getState()
    if (ui.playbackState === 'playing') ui.requestPlay(false)
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Tab') return
      e.stopImmediatePropagation()
      if (e.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onOpenChange])
}

export function HelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  useAppKeysOff(open, onOpenChange)
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content className="fixed inset-0 z-50 bg-background focus:outline-hidden" aria-describedby={undefined}>
          <div className="absolute inset-0 overflow-y-auto">
            <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-2.5 backdrop-blur sm:px-8">
              <DialogPrimitive.Title className="text-sm font-semibold text-foreground">How Strata works</DialogPrimitive.Title>
              <span className="hidden text-xs text-muted-foreground sm:inline">Strata is in beta. Save often.</span>
              <DialogPrimitive.Close
                className="ml-auto flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X size={13} aria-hidden />
                Close
                <kbd className="font-sans text-[11px] text-muted-foreground">Esc</kbd>
              </DialogPrimitive.Close>
            </header>

            <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-8 sm:px-8">
              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Step by step</h2>
                <ol className="grid gap-x-10 gap-y-3 text-sm lg:grid-cols-2">
                  {STEPS.map(([name, text], i) => (
                    <li key={name} className="flex gap-2.5">
                      <span className="w-4 shrink-0 tabular-nums text-muted-foreground">{i + 1}</span>
                      <span className="leading-relaxed">
                        <span className="font-medium text-foreground">{name}.</span>{' '}
                        <span className="text-muted-foreground">{text}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </section>

              <section>
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Keyboard and mouse</h2>
                <div className="columns-1 gap-10 md:columns-2">
                  {KEYS.map(([group, rows]) => (
                    <section key={group} className="mb-6 break-inside-avoid">
                      <h3 className="mb-2 text-[13px] font-semibold text-foreground">{group}</h3>
                      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
                        {rows.map(([key, what]) => (
                          <div key={key} className="contents">
                            <dt className="whitespace-nowrap">
                              <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-sans text-xs text-foreground">
                                {key}
                              </kbd>
                            </dt>
                            <dd className="text-muted-foreground">{what}</dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                  ))}
                </div>
              </section>

              <p className="border-t border-border pt-4 text-xs text-muted-foreground">
                Strata {versionLabel()}. Found a problem?{' '}
                <a
                  className="text-primary underline underline-offset-2"
                  href="https://github.com/devinchaloux/strata/issues"
                  target="_blank"
                  rel="noreferrer"
                >
                  Report it on GitHub
                </a>
                .
              </p>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

