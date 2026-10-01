/**
 * HelpDialog — how Strata works in seven steps, and every keyboard shortcut.
 *
 * Opened from the toolbar's ? button, the empty state, or the ? key. The
 * shortcut list is written out by hand: when a shortcut changes in App or
 * PlayerDock, change it here too.
 */
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl'

const STEPS: [string, string][] = [
  ['Start', 'New analysis, then link a YouTube video or a local audio file. The video sits below the diagram; the Video button scrolls to it.'],
  ['Mark', 'Play (Space), and press B at each boundary you hear. M places a point marker, such as a cadence.'],
  ['Describe', 'Click a span to choose its Type (search, or type a letter such as B′) and fill in its details in the Inspector. Drag a boundary to adjust it.'],
  ['Grid', 'Optional: tap T along with the beat, or set a tempo in the Grid menu, to number bars and snap to beats.'],
  ['Layer', 'Add a layer (+ in the layer panel) for another level of form, or another framework.'],
  ['Write', 'A selected span’s Commentary box holds prose that appears while that passage plays.'],
  ['Keep', 'Save a .strata file. Export makes a figure (SVG or PNG) or a commentary page (HTML).'],
]

const KEYS: [string, [string, string][]][] = [
  [
    'Playback',
    [
      ['Space or K', 'Play or pause'],
      ['B', 'Place a boundary on the active layer at the playhead'],
      ['J / L', 'Back / forward 10 seconds'],
      ['Home', 'Back to the start'],
      ['M', 'Place a point marker at the playhead'],
      ['T', 'Tap along on the beat to lay the grid'],
      ['Shift+T', 'Stop the grid here (free passage)'],
    ],
  ],
  [
    'Selecting',
    [
      ['Click', 'Select a span; paused, also move the playhead to it'],
      ['Double-click', 'Play from a span or marker'],
      ['Click the ruler', 'Move the playhead there'],
      [`${MOD}-click`, 'Add or remove a span'],
      ['Shift-click', 'Select a run of spans'],
      ['Drag', 'On empty space: select every span the box touches'],
      ['← →', 'Previous / next span'],
      ['↑ ↓', 'Span in the layer above / below'],
      ['Shift+← →', 'Extend the selection'],
      ['Enter', 'Edit the selected span’s label'],
      ['1–9', 'Give the selected spans a type from the quick-type bar'],
      ['/', 'Choose from every type, with search'],
      ['Esc', 'Clear the selection'],
    ],
  ],
  [
    'Editing',
    [
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

export function HelpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>How Strata works</DialogTitle>
          <DialogDescription>
            Strata is in beta. Save often, and keep a copy of files that matter.
          </DialogDescription>
        </DialogHeader>

        <ol className="flex flex-col gap-1.5 text-sm">
          {STEPS.map(([name, text], i) => (
            <li key={name} className="flex gap-2">
              <span className="w-4 shrink-0 tabular-nums text-muted-foreground">{i + 1}</span>
              <span>
                <span className="font-medium text-foreground">{name}.</span>{' '}
                <span className="text-muted-foreground">{text}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {KEYS.map(([group, rows]) => (
            <section key={group}>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</h3>
              <dl className="flex flex-col gap-1 text-xs">
                {rows.map(([key, what]) => (
                  <div key={key} className="flex items-baseline gap-3">
                    <dt className="w-28 shrink-0">
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

        <p className="text-xs text-muted-foreground">
          Found a problem?{' '}
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
      </DialogContent>
    </Dialog>
  )
}
