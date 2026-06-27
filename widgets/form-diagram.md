# Form Diagram Widget
*Widget type: `"form-diagram"` | v1.0 | June 2026*

The form diagram is the v1 widget and the proof of concept for the Strata widget system. It is the data spine of the analysis: the layer all other widgets reference for span boundaries and section identity.

**Data model reference:** `schema/strata-schema-reference.md` — field-by-field documentation of `FormDiagramData` and `Span`.

**Contract reference:** `widgets/_contract.md` — the `WidgetDefinition` interface this document implements.

**Design rationale:** `docs/decisions.md`, sections "Form Diagram Editor — Interaction Model" and "Merge".

---

## 1. Contract Implementation

### 1.1 Identity

```typescript
type: "form-diagram"
label: "Form Diagram"
description: "Layered section-level formal analysis synchronized to the timeline."
```

### 1.2 Data Type

`FormDiagramData` from `strata.types.ts`:

```typescript
interface FormDiagramData {
  hierarchicalEnforcement: boolean; // Opt-in per-layer constraint; never the default
  spans: Span[];
}
```

### 1.3 createDefaultData

```typescript
createDefaultData: (): FormDiagramData => ({
  hierarchicalEnforcement: false,
  spans: [],
})
```

### 1.4 contributeTimePoints

The form diagram contributes one `SharedTimePoint` per unique boundary timestamp across all spans. Both `startTime` and `endTime` of every span are contributed. Duplicate timestamps (when adjacent spans share a boundary) are deduplicated — only one pool entry per timestamp.

```typescript
contributeTimePoints: (data: FormDiagramData, layerId: string): SharedTimePoint[] => {
  const seen = new Set<number>();
  const points: SharedTimePoint[] = [];

  for (const span of data.spans) {
    for (const t of [span.startTime, span.endTime]) {
      if (!seen.has(t)) {
        seen.add(t);
        points.push({
          id: `${layerId}:${t}`,
          timestamp: t,
          sourceLayerId: layerId,
        });
      }
    }
  }

  return points;
}
```

Point IDs are derived as `layerId:timestamp`. They are stable as long as the timestamp does not change. When a boundary moves, the old point is replaced by the new one on the next pool sync.

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

```typescript
exporter.formats = [
  { id: "svg",  label: "SVG Diagram",  mimeType: "image/svg+xml",  extension: "svg" },
  { id: "pdf",  label: "PDF Document", mimeType: "application/pdf", extension: "pdf" },
]
```

**SVG export:** The form diagram renders as SVG in the DOM. Export serializes the current SVG subtree, applies a `viewBox` scoped to the `[startTime, endTime]` window (converting to pixel coordinates at the current zoom), and strips editing-only elements (drag handles, selection rings). No external library required.

**PDF export:** Uses `pdf-lib`. SVG content is placed into a PDF page sized to the exported time range. The page width is proportional to the time range; the height is the rendered layer panel height. Filename: `{document.title} — Form Diagram.pdf`.

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
- **Label:** per layer rendering config — above the shape (in the negative space of
  the layer above) by default; truncated to fit when rendered inside the body.
- **Annotation:** `span.annotation` inside the shape body; tooltip on hover for long text.
- **Notes:** `span.notes` is tooltip-only; never rendered on the diagram.

### 4.2 Overlapping Spans

Spans within a layer that overlap in time occupy sub-rows within the layer's vertical space. Assignment uses a greedy interval sweep:

1. Sort spans by `startTime` (ascending)
2. For each span, assign it to the first sub-row whose last-assigned span ends at or before `span.startTime`
3. If no sub-row is available, open a new sub-row
4. Each sub-row renders at a fixed height; the layer panel expands vertically to accommodate all sub-rows

All sub-rows share the same horizontal coordinate system. Overlapping spans are never merged visually.

### 4.3 Shape Vocabulary (visual style — the analyst's choice)

The drawn shape is the analyst's explicit choice and is **decoupled from the
analytical data**. The renderer reads only the visual fields below; `confidence` and
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
an explicit visual choice (it has no data analog). `lineStyle` defaults to `"solid"`
regardless of `confidence`.

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
| **Spacebar** | Place a boundary at `currentTime` — split the span containing `currentTime`, or mark a boundary in empty layer space |
| **Arrow keys** | Nudge the selected boundary ±1 frame (~0.033s); `Shift` = ±10 frames |
| **Drag boundary handle** | Move boundary; hard-stops at adjacent span boundaries; minimum span width enforced |
| **Click span** | Select span; open metadata panel (per Phase 0.4 spec) |
| **Right-click span** | Context menu (actions specified in Phase 0.4) |

Whole-span dragging is not implemented. Span movement is always via boundary adjustment.

### 5.2 Boundary Placement (Spacebar Logic)

1. Determine the span (if any) that contains `currentTime`: `span.startTime ≤ currentTime ≤ span.endTime`
2. If a containing span exists: split it into `[span.startTime, currentTime]` and `[currentTime, span.endTime]`. The first child inherits the original span's `label`, `type`, and metadata; the second child is created blank.
3. If no span contains `currentTime`: behavior is specified in Phase 0.4 (open question: does it extend the previous span's end, or create a new isolated span?).

Placed boundaries are immediately contributed to the shared time point pool via the next `contributeTimePoints` call.

### 5.3 Merge

Merge is a v1 requirement. Two or more consecutive spans are selected (box-select or shift-click), then merged via an explicit action. Non-conflicting fields are resolved automatically; conflicting fields surface in a conflict-only dialog. Full merge UX is specified in Phase 0.5.

Merged spans receive a new UUID. The source IDs are stored in `mergedFrom: string[]` (minimum 2 entries) on the result span.

### 5.4 Hierarchical Enforcement

When `data.hierarchicalEnforcement` is true, the `EditComponent` prevents span placement or boundary dragging that would cause the new span to overlap with any existing span in the same layer. The constraint is applied at interaction time (the boundary cannot be moved to an overlapping position). The underlying data is unchanged — it still supports overlapping spans.

Activation requires user confirmation (warning about what is being given up). The warning is presented by the editor shell, not by the widget. The toggle is buried in layer settings, not surfaced prominently.

---

## 6. Open Items (Phase 0.4 / 0.5)

These are confirmed design decisions awaiting their dedicated spec sessions:

- Span metadata panel: sidebar vs. inline, trigger (click vs. double-click)
- Context menu: exact actions on right-click
- Spacebar behavior when `currentTime` is in empty layer space
- Layer panel placement and controls
- Merge conflict dialog design and multi-select interaction model

*These items are tracked in `_private/handoff.md` and `docs/decisions.md`.*
