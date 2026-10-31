# Form Diagram Widget

*Widget type: `"form-diagram"` | v1.0 | June 2026*

The form diagram is the v1 widget and the proof of concept for the Strata widget system. It is the data spine of the analysis: the layer all other widgets reference for span boundaries and section identity.

**Data model reference:** `schema/strata-schema-reference.md` — field-by-field documentation of `FormDiagramData` and `Span`.

**Contract reference:** `widgets/_contract.md` — the `WidgetDefinition` interface this document implements.

**Design rationale:** `docs/decisions.md`, sections "Form Diagram Editor — Interaction Model" and "Merge".

**Status (2026-10-03):** §2 onwards describes the widget as built. §1 describes
it in terms of the widget contract (`widgets/_contract.md`), which is the
design: the app doesn't load widgets through a registry yet, so these functions
are the intended shape rather than code you'll find under these names.

---

## 1. Contract Implementation

### 1.1 Identity

```typescript
type: "form-diagram"
label: "Form Diagram"
description: "Layered section-level formal analysis synchronized to the timeline."
```

### 1.2 Data Type

`FormDiagramData` from `src/types/strata.ts`:

```typescript
interface FormDiagramData {
  spans: Span[];
}
```

### 1.3 createDefaultData

```typescript
createDefaultData: (): FormDiagramData => ({
  spans: [],
})
```

### 1.4 contributeTimePoints

The form diagram offers every span's `startTime` and `endTime` as snap targets, once each (adjacent spans share a boundary). Computed from the spans when needed; never stored in the file (see `_contract.md` §1.3).

```typescript
contributeTimePoints: (data: FormDiagramData): number[] =>
  [...new Set(data.spans.flatMap((s) => [s.startTime, s.endTime]))]
```

Until the widget registry exists, point markers snap to these boundaries directly (`markerSnapCandidates` in `components/FormLayers.tsx`).

---

## 2. Timeline Presence

`TimelinePresenceComponent` renders tick marks on the shared ruler at each span boundary.

**Visual specification:**
- `<line>` elements at the pixel x-position of each boundary, spanning the full ruler height
- Selected boundary: 2px, accent color
- Unselected boundaries: 1px, muted color at 40% opacity
- Span start and end boundaries within a single span use the same tick style — there is no visual distinction between "this is a start" and "this is an end" on the ruler (that distinction is visible in the span block below)

**Pixel position formula** (from `_contract.md`, `ViewState`):
```
pps = BASE_PPS * viewState.zoom            // BASE_PPS = 10 px/s, see lib/timeline.ts
x   = timestamp * pps - viewState.scrollOffset   // scrollOffset is in pixels
```

Ticks outside the visible viewport (`x < 0` or `x > viewportWidth`) are not rendered.

---

## 3. Export Formats

The Export dialog offers two formats for the form diagram, plus the commentary
exports described in `widgets/written-analysis.md`:

| Format | How it's made |
|---|---|
| **SVG** | `src/widgets/form-diagram/exportSvg.tsx` renders the same pure figure the editor draws (`figure.tsx`), with the print theme, for a chosen `[startTime, endTime]` range at a chosen width. Editing-only elements are never part of that figure. |
| **PNG** | The same SVG, drawn by the browser at twice the size. If the browser can't make the image, the dialog says so and the SVG download still works. |

The dialog chooses the layers, starting from the visible ones but independent
of them. Each chosen layer is cut to the range first: a layer with no span in it
is left out, and a span crossing an edge is trimmed there with its cut end drawn
square and running off the edge, so its label sits at the centre of the part
that shows. No external library is needed for either format.

---

## 4. Rendering Rules

### 4.1 Span Shapes

Each span is a **single** SVG `<path>` (fill + stroke in one path — never decomposed
into separate fill / boundary / top passes). Position and width share the timeline
pixel contract used by the ruler:

```
x     = span.startTime * pps - viewState.scrollOffset
width = (span.endTime - span.startTime) * pps
```

where `pps = BASE_PPS * viewState.zoom`.

- **Islands, not abutments:** the drawn shape is inset within its time range so
  adjacent spans are separated by a miniscule (~2px) gap. Stored timestamps stay
  exact; only the rendered geometry insets. Adjacent tails therefore never share
  pixels — the double-stamp/collision problem is removed at the source.
- **Top line:** always flat. There is no dome/arc.
- **Fill / stroke color:** `span.fillColor ?? layer.fillColorDefault` and
  `span.strokeColor ?? layer.strokeColorDefault`. The path is open; fill closes it
  along the baseline, so a white fill reads as an open bracket and a colored fill as
  a solid block.
  With the viewer's **Colour-blind safe** switch on, a quick fill is drawn as its
  safe counterpart (lib/palette.ts `safeFill`); the file keeps the quick fill.
- **Fill pattern:** `span.fillPattern` (hatch, cross, dots, lines) draws a faint
  texture over the fill, in a darker shade of the fill as shown, under the
  outline (lib/patterns.ts).
- **Text on a fill:** an inside label or annotation keeps the ink while it reaches
  4.5:1 against the fill, else a deeper ink or white (lib/formShape.ts `textOnFill`).
- **Label:** per layer rendering config — above the shape (in the negative space of
  the layer above) by default; truncated to fit when rendered inside the body.
- **Annotation:** `span.annotation` inside the shape body; tooltip on hover for long text.
- **Notes:** `span.notes` is tooltip-only; never rendered on the diagram.

### 4.2 Spans Never Overlap Within a Layer

*Revised 2026-09-27 (Devin). This section used to specify sub-rows for spans that
overlap inside one layer; that design is retired and was never built.*

A layer's spans lie end to end, with gaps allowed. Overlap between analytical
frameworks is expressed by putting them on separate layers, which is what the
multi-layer model is for. Every editing gesture keeps a layer tiled — B
splits a span or fills a gap, a boundary drag moves a shared edge with a
hard-stop, numeric time entry moves a shared edge or stops at a gap — and the
document store refuses any write that would create an overlap. A file that
already contains one still opens, with a warning naming the layer, and the two
spans draw on top of each other until the analyst resolves them.

### 4.3 Shape Vocabulary (visual style — the analyst's choice)

The drawn shape is the analyst's explicit choice and is **decoupled from the
analytical data**. The renderer reads only the visual fields below;
`startBoundaryType` / `endBoundaryType` are queryable data and **do not affect
rendering** (see decisions log, 2026-06-27).

**Caps** — `span.startCap` / `span.endCap`, type `CapStyle`:

| value | rendering |
|---|---|
| `"rounded"` (default) | flat top meeting a vertical tail through a rounded corner |
| `"square"` | flat top meeting a vertical tail at a sharp corner |
| `"angled"` | diagonal tail (processual feel) |
| `"open"` | no tail on that side — the flat top simply ends |
| `"elision"` | the vertical tail plus a lighter inner boundary line (overlap cue) |

**Stroke** — `span.lineStyle`: `"solid"` (default) or `"dashed"`. Whole-shape uniform —
solid and dashed are never mixed within a path or at a shared edge. A standalone
dashed vertical is a separate boundary-marker construct, not a dashed bracket tail.

**Defaults & back-compat:** a cap defaults to the layer default, ultimately
`"rounded"`. When a span has no explicit cap, the renderer derives one from the
analytical boundary type (`definite`→`rounded`, `gradual`→`angled`, `elided`→`elision`)
so existing `.strata` files render with no migration; `"square"` is reachable only as
an explicit visual choice (it has no data analog). `lineStyle` defaults to `"solid"`.

### 4.4 Grouping

A grouping (e.g. a "Drop section" bracket spanning several sub-spans) is not a special
construct: it is an ordinary span on a **higher layer** whose width covers its
children, drawn as a wide bracket. It reuses the entire shape / label / color /
interaction model; cross-layer overlap is already valid in Strata's data model.

### 4.5 Selected and Hovered States

- **Selected span:** highlight ring (1.5px accent-color border, slightly elevated z-order in stacking)
- **Hovered span:** subtle background lightening; no ring until selected
- **Selected boundary handle:** visible as a draggable line at the boundary position

---

## 5. Interaction Model

Full design rationale in `docs/decisions.md`. This section is the implementation-facing summary.

### 5.1 Primary Gestures

| Gesture | Behavior |
|---|---|
| **B** | Place a boundary at `currentTime` — split the span containing `currentTime`, or mark a boundary in empty layer space. (Space until 2026-10-01; Space now plays and pauses.) |
| **Shift+B** | End the span containing `currentTime` there, leaving the rest of it empty. |
| **Delete** | Remove the selected spans (or the selected point marker), one undo step; not while typing in a field. Backspace does not delete spans. |
| **Ctrl/⌘+C, Ctrl/⌘+V** | Copy the selected spans; paste the chosen parts of them (label and type by default; annotation, commentary, lyrics, fill, pattern, shape by choice in the Inspector's Paste menu), one undo step. One copied span pastes onto every selected span; several paste onto the same number, paired in time order (at the same time, the higher layer first), and a different number is refused with a note saying how many to select. Not in a text field or over selected page text. store/spanClipboard.ts. |
| **← / →** | Select the previous / next span in the layer; `Shift` extends the selection |
| **↑ / ↓** | Select the span in the layer above / below |
| **Drag boundary handle** | Move boundary; hard-stops at adjacent span boundaries; minimum span width enforced |
| **Click span** | Select it and open it in the Inspector; when paused, also move the playhead to its start |
| **Double-click span** | Play from its start |
| **Right-click span** | Menu: split at the playhead, merge with the previous or next span, delete |

Whole-span dragging is not implemented. Span movement is always via boundary adjustment.

### 5.2 Boundary Placement (B)

1. Determine the span (if any) that contains `currentTime`: `span.startTime ≤ currentTime ≤ span.endTime`
2. If a containing span exists: split it into `[span.startTime, currentTime]` and `[currentTime, span.endTime]`. The first child inherits the original span's `label`, `type`, and metadata; the second child is created blank.
3. If no span contains `currentTime`, it falls in an empty stretch (an empty layer is one). By default the stretch fills on both sides: one span from the previous boundary (or 0) to `currentTime`, one from `currentTime` to the next boundary (or the end). With the layer's `fillGaps` set to `false` ("B fills empty space on both sides" off, in layer settings), only the second is made, so a first boundary starts a span rather than closing one. docs/decisions.md, "B in an Empty Stretch".

Shift+B ends the span containing `currentTime` there. Layer settings also offer **Fit boundaries to the grid** (Bars or Beats): every boundary moves to its nearest bar or beat in one undo step, a boundary two spans share moving once, and one that would collapse a span or sits in a free stretch staying put.

#### Quick Setup by Tempo, and Resizing by Bars

While the source is linked and no layer has spans, the open area above the diagram offers **Quick setup by tempo…**. It opens a card asking for the tempo (the document's `bpm`, editable there; a grid already covering the start supplies its own), the first downbeat (typed, or **Use playhead**), and how many bars each span lasts. **Fill** starts a beat-grid segment at the first downbeat if none covers it (at the document's tempo and meter), then tiles the active layer (or the top empty one) with a span every N bars, from the bar line nearest the start to where the grid stops: the end of the segments that follow on without a free stretch, or the track's end. The last span takes the leftover, unless it is under a tenth of a bar, when the span before absorbs it. One undo step. `fillLayerWithBars` in the document store, `barTiling` in lib/beatGrid.ts.

A selected span inside the grid shows its **Length** in bars in the Inspector: a field to type a length in ("this phrase is 2 bars", `setSpanBars`), between − and + buttons. Each changes the span's end by one bar (of the grid where it ends) and moves every later boundary in the layer by the same amount, so the spans after it keep their lengths. The layer still ends where it did: lengthening pushes the last span's start later and drops a span pushed past the end; shortening stretches the last span to fill. On the last span itself, only its end moves, within the track. `resizeSpanByBars` in the store, `rippleSpanEnd` in lib/spanEdit.ts.

**To end** (beside the End time in the Inspector, and **Extend to the end** on right-click) runs a span to the end of the track and removes the spans after it in its layer, one undo step: for an ending that stops being metered, where a quick setup laid out spans the music doesn't have. Their commentary survives, anchored to their times. `extendToEnd` in the store, `extendSpanToEnd` in lib/spanEdit.ts.

#### Group and Copy to Layer

**Group into…** (Inspector, several spans selected) lists the other form layers, the one just above first, each with what grouping there would do: "fits" an empty stretch, or replaces and cuts back the spans already there. A last row makes a new layer just above. Picking one makes a blank span over the whole selection on that layer, selected for labelling. Right-click on several offers **Group into the layer above**, a one-click action that never cuts or replaces: where the layer above already has a span in the way it is greyed out with the reason.

**Copy to layer…** (Inspector, one span; right-click opens the same picker) copies the span, taking the parts ticked under **What to copy**: label, type, annotation, key area, colours, pattern, and shape and line by default; lyrics, notes and commentary only when ticked, since they would otherwise show twice. The choice is remembered in the browser (`copyFields`, lib/groupSpans.ts `COPY_FIELDS`). Never its `mergedFrom`, since the copy wasn't made by a merge to any other form layer, listed in drawing order, each marked above or below and with what the copy would do there. A last row makes a new layer just above or just below. There is no fixed direction: a section can be copied down to start its phrases as well as a phrase copied up. All are one undo step. `groupSpans` and `groupIntoLayerAbove` in the store, lib/groupSpans.ts, components/GroupPopover.tsx.

Grouped spans become the **children** of the new span (`parentId`). Of a span and its copy, the one on the **higher layer is the parent**: a copy made up becomes the original's parent; a copy made down is the original's child. A parent and its children move their shared boundaries together: a drag, a typed time, Fit to the grid or a change of length in bars that moves a boundary where a parent and child meet moves the boundary at that moment in the other layer, neighbours included, and on through further levels. A child's inner boundaries move alone. The Inspector shows "Part of … in …" or "Groups N spans in …" with **Unlink**, which clears `parentId` (the child's own, or all the children's). lib/linkedBoundaries.ts.

When a parent goes, its children follow: merging a parent hands its children to the merged span; deleting it, deleting its layer, running a span over it with To end, or replacing it with Group or Copy to layer unlinks them (`repairParentLinks`).

**Splitting a parent** (B, the Boundary button, Split, Split at playhead): a split within half a second (`SPLIT_SNAP_SEC`) of a boundary between its children moves onto it, so no child straddles the split. Each child then belongs to the half that holds most of it, the left half on a tie; the left half keeps the parent's id. A span cut back or in two by Group or Copy to layer does the same, and a child no piece covers any more is unlinked (`splitTimeNearChildren`, `relinkToPieces`).

### 5.3 Merge

Two or more consecutive spans are selected (box-select or shift-click), then merged via an explicit action (Ctrl/Cmd+J, or the right-click menu). Non-conflicting fields are resolved automatically; conflicting fields surface in a conflict-only dialog. The rules are in `docs/decisions.md`, "Merge UX (Phase 0.5)" and "Merge".

Merged spans receive a new UUID. The source IDs are stored in `mergedFrom: string[]` (minimum 2 entries) on the result span.

### 5.4 Hierarchical Enforcement

> *Superseded 2026-06-22 (see `docs/decisions.md` → the hierarchical enforcement
> reversal entry). The per-layer definition below is no longer the design.*

Hierarchical enforcement is redefined as a **cross-layer nesting** constraint scoped to the **form-diagram widget type**: when enabled, a span must nest within the boundaries a coarser layer has established (each layer's boundary set must be a superset of the layer above it; bottom = finest, top = coarsest; coextensive spans allowed). It is therefore not a per-layer flag; the per-layer `FormDiagramData.hierarchicalEnforcement` field, never used, was removed in file format 2, and the setting will get its own home if the feature is built. The underlying data is unchanged either way — the schema always supports overlapping spans.

Activation requires user confirmation (warning about what is being given up). The warning is presented by the editor shell, not by the widget. The constraint is intentionally strict and off by default — the default is the theoretical statement.
