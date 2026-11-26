# Tempo Widget
*Widget type: `"tempo"` | v1.0 | November 2026*

> **Built** 2026-11-25. Code: `src/widgets/tempo/TempoBlock.tsx` (the block,
> its rows and settings), `lib/tempoLane.ts` (`tempoView`: the tempo of each
> bar, the smoothed curve, the deviations, the scatter), `lib/normalize.ts`
> (the smoother), `lib/widgets.ts` (blocks). `docs/decisions.md`, "Tempo
> Becomes Its Own Widget", "The Tempo Widget, Settled" and "Widgets as
> Blocks". Not yet: SVG export of the tempo block, a beat source in the app,
> and comparing recordings.

A widget that shows tempo over time, drawn as its own block on the shared
timeline, above or below the Segments block. It reads a layer of marked bars (the bar
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
  the bar tools, which belong to Segments' Bars menu;
- comparing performances (§5) needs tempo to be something a document has, not
  a way of drawing bars.

## 2. Data (as built)

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

The scatter is read robustly, as 1.4826 × the median absolute deviation, so
one odd bar (a long last bar holding a fade) can't swamp it. The deviation
band's range is at most four times the scatter (at least 20 ms), and a
deviation beyond it is drawn clipped, with a cap.

## 3a. The block

- **Adding:** Add widget, above the blocks, offers Tempo once a layer is the
  bar layer. It makes a tempo layer, "<bar layer> tempo", reading it, and a
  tempo block just below the Segments block. Adding it while it is hidden shows
  it.
- **The top bar:** "Tempo", then ↑ ↓ to move the block past another (shown
  when there is more than one block), hide, and remove (with a confirm; it
  removes the tempo layers). The Segments block's top bar has the same move and
  hide, but no remove: its layers are the analysis.
- **Hidden blocks** come back from chips beside Add widget. With the form
  diagram hidden, its zoom controls move there too.
- **A row** per tempo layer: a header cell as wide as the layer names, with
  the name and ⋯ settings (name; the layer it reads; Show: as marked,
  smoothed, deviation; the smoothing, from Auto; the scale, from the data or
  fixed), and the drawing, which scrolls and zooms with the Segments block and
  carries the playhead. The tempo band is 52 px and the deviation band 40 px.
- The marked line fades when the smoothed one is shown, so both read.

## 3b. Offering Tempo

Turning on Bar layer (or making a bar layer with Split into bars or Fill with the grid's bars) doesn't add Tempo. A note above the blocks says what the bars' tempo does: "The tempo in these bars moves from 40 to 127 BPM" with **Show Tempo** and **Not now**, or "The tempo in these bars holds steady at 120 BPM" with **Show Tempo anyway**. "Moves" means the smoothed tempo ranges more than 4 BPM (`TEMPO_MOVES_BPM`): each run of bars goes through Normalize's smoother at Auto so tapping scatter doesn't count, bars more than 25% off the running median of their neighbours are set aside first, and the range is the 5th to 95th percentile with 20 bars or more (`tempoSummary`). Add widget offers Tempo at any time.

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

1. **Placement:** tempo is its own block, a framed card on the shared
   timeline that the analyst moves above or below the Segments block, shows,
   hides, adds and removes; not a row among the Segments block's layers
   ("Widgets as Blocks" corrects the first answer).
2. **Display choices** (`display`) are saved in the file, and so are the
   order of the blocks and which are hidden (`StrataDocument.widgets`).
3. **Deviation** is in milliseconds.
4. **The scale** comes from the data by default; a fixed range is set when two
   recordings need to share one.
5. **Source only for now:** tempo is always read from a bar or beat layer. A
   tempo map of the layer's own waits until something produces one.
