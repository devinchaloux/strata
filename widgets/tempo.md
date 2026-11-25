# Tempo Widget
*Widget type: `"tempo"` (planned) | design agreed, not built | November 2026*

> **Status:** planned, not built. Its design questions were settled with the
> maintainer on 2026-11-25 (§7). Groundwork in the code:
> `lib/tempoLane.ts` (each bar's tempo from its length, the scale),
> `TempoLaneFigure` in `widgets/form-diagram/figure.tsx` (the step line), and
> `lib/normalize.ts` (the smoothing). `docs/decisions.md`, "Tempo Becomes Its
> Own Widget" and "Normalize".

A layer that shows tempo over time. It reads a layer of marked bars (the bar
layer) or, later, of beats, and draws each one's tempo. An analyst who marks
every bar is usually showing something about time: an accelerando that locks
in, a ritardando, a performer's rubato. The tempo widget states it with
numbers instead of leaving it to narrowing brackets.

---

## 1. Why a widget, not a switch on the bar layer

The first version was a switch on the bar layer that drew a lane under the
diagram. It worked, but tempo is analysis in its own right:

- a performance analyst may care more about the tempo than the brackets;
- it should hide, reorder and export like any layer;
- it has views of its own (marked, smoothed, deviation, §3) that would crowd
  the bar layer's settings;
- comparing performances (§5) needs tempo to be something a document has, not
  a way of drawing bars.

## 2. Data

Tempo is derived, never stored: it follows from the boundaries of the source
layer, so it can't go stale when a boundary moves or disagree with the bars.
The layer stores only what to read and how to show it. The display choices
are saved in the file, so a reader, an embed and an export show what the
analyst chose, as with other layer settings. A tempo map of the layer's own
(imported, or detected from audio) is left for later; it can come as an
optional field without breaking files.

```ts
interface TempoData {
  /** The layer whose spans are the units: the bar layer, or a beat layer. */
  source: { layerId: string; unit: 'bar' | 'beat' }
  display?: {
    /** Display-only smoothing (log10 of lambda, lib/normalize.ts); null or absent = as marked. Moves no boundary. */
    smoothing?: number | null
    /** Which views to draw. Absent = ['marked']. */
    show?: Array<'marked' | 'smoothed' | 'deviation'>
    /** A fixed scale in BPM, for comparing recordings; absent = from the data (lowest to highest, out to the nearest 10). */
    scale?: { min: number; max: number } | null
  }
}
```

A bar's tempo is 60 × its beats ÷ its length in seconds. The beats come from
the beat grid's meter at the bar, else the document's meter, else 4. For a
beat source, each span is one beat.

## 3. Views

- **Marked:** a step line, one level per bar, exactly as marked.
- **Smoothed:** the same tempo through the smoother Normalize uses, drawn
  over or instead of the marked line. This is the "normalization draw": it
  changes how the tempo is shown, never the bars. The automatic setting is the
  smoothest at which what's left still looks like tapping scatter.
- **Deviation:** marked minus smoothed, per boundary, in milliseconds, the
  same unit as the tapping scatter. A shaded band shows the tapping scatter (the
  noise floor): deviations inside it can't be told apart from tapping, and
  those outside it are probably the music, such as rubato, agogic accents, or
  a push into a cadence.

Hovering a step shows "Bar 37: 103 BPM". Clicking it selects that bar on the
source layer. The tempo isn't edited here; the bars are.

## 4. Normalize and display smoothing

Two different acts, sharing one smoother:

| | Normalize (built) | Display smoothing (this widget) |
| --- | --- | --- |
| Changes the bars | Yes, or copies them to a new layer | No |
| Use | Cleaning up hand-marked bars | Showing the shape of a tempo without losing the marks |
| Undo | One step | A display setting |

An analyst who wants to show micro-timing keeps the bars as marked and turns
on the smoothed and deviation views.

## 5. Performances

- **Comparing recordings:** two recordings of the same work, aligned by bar
  number rather than by seconds, their tempo curves overlaid. Across a corpus,
  "where does every performer slow down in bar 32?" becomes a query. Needs the
  Corpus Manager, or two documents open at once.
- **Tempo with loudness:** with the planned energy contour, a tempo–loudness
  view of how a performer shapes a phrase.
- **Beat-level tempo,** for slow movements where a bar is too coarse.
- **Finer than tapping:** below about 30 ms, hand marks can't resolve timing.
  Onsets detected from the audio could, for local audio files (YouTube gives
  no access to the audio). A separate decision, with a dependency.

## 6. Related: playback speed

Marking bars precisely is easier slowed down. The player offers 0.5×, 0.75×,
1× and 1.25× today. The maintainer would like a custom rate, without it
needing to be prominent or to look like YouTube's control. Local audio can
play at any rate; what YouTube's embedded player accepts needs checking
before a custom rate is designed.

## 7. Settled (2026-11-25)

1. **Placement:** a row of its own in the layer stack, taller than a bracket
   row, that hides, reorders and exports like any layer and can sit right
   under the bars it reads.
2. **Display choices** (`display`) are saved in the file.
3. **Deviation** is in milliseconds.
4. **The scale** comes from the data by default; a fixed range is set when two
   recordings need to share one.
5. **Source only for now:** tempo is always read from a bar or beat layer. A
   tempo map of the layer's own waits until something produces one.
