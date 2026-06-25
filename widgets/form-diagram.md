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

### 4.1 Span Blocks

Each span is an SVG `<rect>`. Position and width are derived from timestamps:

```
x     = ((span.startTime - viewState.scrollOffset) / viewportDuration) * viewState.viewportWidth
width = ((span.endTime - span.startTime) / viewportDuration) * viewState.viewportWidth
```

where `viewportDuration = document.duration / viewState.zoom`.

- **Color:** `span.color ?? layer.colorDefault`
- **Label:** centered horizontally and vertically in the rect; clipped (`overflow: hidden`) when the span is too narrow; hidden entirely below a minimum pixel width threshold
- **Annotation:** `span.annotation` renders as smaller text below the label inside the span block; tooltip on hover for long annotations
- **Notes:** `span.notes` is tooltip-only; never rendered on the diagram

### 4.2 Overlapping Spans

Spans within a layer that overlap in time occupy sub-rows within the layer's vertical space. Assignment uses a greedy interval sweep:

1. Sort spans by `startTime` (ascending)
2. For each span, assign it to the first sub-row whose last-assigned span ends at or before `span.startTime`
3. If no sub-row is available, open a new sub-row
4. Each sub-row renders at a fixed height; the layer panel expands vertically to accommodate all sub-rows

All sub-rows share the same horizontal coordinate system. Overlapping spans are never merged visually.

### 4.3 Confidence Visual States

| `confidence` value | Border | Opacity |
|---|---|---|
| `"definite"` (or omitted) | Solid | 1.0 |
| `"approximate"` | Dashed | 1.0 |
| `"speculative"` | Dashed | 0.6 |

### 4.4 Boundary Types

Visual rendering of `startBoundaryType` / `endBoundaryType`:

| value | Border rendering |
|---|---|
| `"definite"` (or null/omitted) | Straight vertical border |
| `"gradual"` | Angled / chevron border indicating processual transition |
| `"elided"` | Overlapping bracket; the renderer detects reciprocal `"elided"` boundaries on adjacent spans and draws the elision bracket between them |

The elision visual requires both adjacent spans to have the matching `"elided"` boundary *and* overlapping timestamps. The renderer detects this pattern; the analyst does not configure the visual directly.

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
