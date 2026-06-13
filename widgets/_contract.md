# Strata — Widget Contract Specification
*Phase 0.2 | v1.0 | June 2026*

This document is the formal specification for the Strata widget contract — the interface every widget type must implement to participate in the editor, the embeddable viewer, and the export system.

The TypeScript interfaces defined here are the source of truth until Phase 1.2, when they are ported to `src/types/widget.ts`. When the contract changes, both files update together. Data model changes that affect the file format also increment `fileFormatVersion` in `strata.types.ts`.

---

## How to Read This Document

This document has two audiences.

If you read code, the TypeScript interfaces in Section 2 are the formal specification — precise and self-contained. If you don't write code, the prose before each code block explains what each piece does and why it matters. You can read this document meaningfully either way.

The interfaces exist to eliminate ambiguity when implementation begins. The prose exists so that design decisions stay legible to everyone working on the project. Neither is decoration for the other.

---

## Key Terms

A brief glossary for non-technical readers. These terms appear throughout the document.

**Interface** — a description of what shape something must have. An interface for a widget is like a job description: here are the things you must provide. Any widget that provides all of them is a valid widget. The application uses interfaces to check that a widget is complete before it tries to use it.

**Component** — a reusable piece of the user interface. In Strata, each widget provides components — the things that actually draw the widget on screen. A component receives data as input and produces a visual representation as output.

**Props** — the inputs a component receives. When the application draws a widget, it passes the widget its props: its data, the current playback time, the zoom level, which span is selected, etc. The component uses what it needs.

**Callback** — a function passed in from outside that the recipient calls when something happens. The edit component receives a callback called `onDataChange` — when the analyst places a boundary, the widget calls this function, and the application updates the document. The widget doesn't need to know how the document gets updated; it just calls the function.

**Generic (`<TData>`)** — a placeholder for "whatever data type this specific widget uses." The form diagram substitutes `FormDiagramData` for `TData`. A future energy contour widget would substitute its own data type. The contract works the same way regardless of the substitution.

**Pure function** — a function with no side effects: given the same inputs, it always returns the same output and changes nothing outside itself. `contributeTimePoints` is a pure function. The document store can call it as many times as it needs to without consequence.

**Promise\<Blob\>** — an asynchronous file. Export functions return a Promise because generating a PDF may take a moment. Once the Promise resolves, the Blob is raw file data that the browser can offer as a download.

---

## 1. Core Concepts

### 1.1 The Typed Envelope Pattern

Every layer in a Strata file shares the same outer structure — an id, a type identifier, a label, visibility, and a few other fields. That outer structure is the *envelope*. Inside the envelope is a `data` field whose shape is determined entirely by the widget type.

The form diagram's `data` holds an array of spans. A future energy contour widget's `data` would hold an array of control points. The envelope is the same either way; only the contents differ.

This is the typed envelope pattern: the core schema enforces the envelope, and each widget defines what goes inside it. Adding a new widget type means defining a new data shape and registering it — the core `Layer` structure itself never changes. This is the extensibility guarantee: new widgets cannot break the core schema.

```typescript
interface Layer {
  id: string;
  type: LayerType;     // "form-diagram" | "energy-contour" | ...
  label: string;
  // ... shared envelope fields ...
  data: LayerData;     // Shape defined by the widget type, not the core schema
}
```

### 1.2 The Render / Edit Boundary

> **The render component is the shared primitive between the editor and the embeddable viewer. The viewer instantiates render components only. The editor wraps render components with edit components.**

This is the most important architectural rule in the widget system. Every widget provides two React components:

- **RenderComponent** — the read-only visual representation. It receives data and state, draws the widget, and does nothing else. No changes to the document, no callbacks, no side effects. This is what the embeddable viewer uses: it renders the analysis without allowing any edits.
- **EditComponent** — the editor layer. It adds editing interactions on top of the render layer. It receives mutation callbacks and calls them when the analyst does something — places a boundary, types a label, drags a span edge. It is only ever used inside the editor, never in the viewer.

A render component that triggers mutations or changes state outside itself violates the contract and breaks the viewer. The architectural boundary must be treated as a first-class constraint, not a convention to work around when it's inconvenient.

### 1.3 The Shared Time Point Pool

`StrataDocument.sharedTimePoints` is a document-level collection of timestamps that any widget can contribute to and any widget can snap to. It is the explicit inversion of siloed per-widget timelines.

When the form diagram analyst places a span boundary at 94.5 seconds, that timestamp is immediately available to the energy contour widget as a snap target — without any manual import step, without either widget knowing about the other. When the energy contour analyst adds a control point at 103.0 seconds, the form diagram can snap to that too.

Widgets do not write to the pool directly. Each widget definition exposes a pure function called `contributeTimePoints` that returns the full set of timestamps this widget layer currently owns. The document store calls this function after every data change and syncs the result into the pool — adding new entries, updating moved ones, removing deleted ones. Widgets declare what they contribute; the store handles synchronization.

---

## 2. TypeScript Interface Specification

These interfaces are defined here as the source of truth and will be ported to `src/types/widget.ts` in Phase 1.2. They reference types from `strata.types.ts` — `Layer`, `LayerData`, `LayerType`, `SharedTimePoint`, `StrataDocument`.

Each subsection below begins with a plain-English description before the code. Non-technical readers can read the descriptions and skip the code blocks; the description and the code cover the same ground.

### 2.1 Supporting Types

Three small definitions used throughout the rest of the contract.

**`ViewState`** captures where the analyst is currently looking in the timeline: how far zoomed in, where the left edge of the visible area is in seconds, and how wide the viewport is in pixels. Widgets use these three numbers to convert timestamps into screen positions — to figure out where on screen a span at 94.5 seconds should be drawn given the current zoom and scroll.

**`ExportFormat`** describes one export file type a widget can produce: an internal identifier, a human-readable label, the MIME type the browser needs to trigger a download, and the file extension.

**`ExportOptions`** carries the time range for an export: a start time and end time in seconds. The user specifies these (usually by clicking a span to pre-fill them, then adjusting); the exporter clips its output to this range.

```typescript
/**
 * Current zoom and scroll state of the shared timeline viewport.
 * Widgets use this to convert timestamps to pixel positions.
 *
 * Pixel x-position of a timestamp t:
 *   x = ((t - scrollOffset) / (duration / zoom)) * viewportWidth
 */
export interface ViewState {
  zoom: number;          // Zoom factor; 1.0 = full track duration fits the viewport
  scrollOffset: number;  // Recording time at the left edge of the viewport, seconds
  viewportWidth: number; // Pixel width of the timeline viewport
}

export interface ExportFormat {
  id: string;        // e.g. "svg", "pdf", "html", "markdown"
  label: string;     // e.g. "SVG Diagram", "PDF Document"
  mimeType: string;  // e.g. "image/svg+xml", "application/pdf"
  extension: string; // Without dot, e.g. "svg", "pdf"
}

export interface ExportOptions {
  startTime: number; // Export time range start, recording seconds
  endTime: number;   // Export time range end, recording seconds
}
```

### 2.2 WidgetRenderProps

These are the inputs every display component receives. The component uses them to draw itself. It does not call functions, change state, or reach outside what it receives here. That constraint — no side effects — is what makes the render component safe to use in read-only contexts like the embeddable viewer.

Think of this as the "read" side of a widget: everything needed to answer "what should this widget look like right now?"

- `layer` — the widget's own layer data, including its label, color default, and visibility
- `data` — the typed payload (spans for a form diagram, control points for an energy contour)
- `document` — the full analysis document, read-only, for anything the widget needs beyond its own layer (vocabulary terms, shared time points, track duration)
- `currentTime` — where playback is right now, used to highlight the active section
- `viewState` — where the analyst is looking in the timeline
- `selectedSpanId` / `hoveredSpanId` — which span is selected or hovered, for visual state

```typescript
/**
 * Props received by every widget's RenderComponent.
 *
 * The render component is read-only — it receives data and state and produces
 * a visual representation. It does not emit mutations or call any side-effecting
 * callbacks. This contract makes it safe to instantiate in the viewer.
 *
 * TData is the widget's specific data payload type (e.g. FormDiagramData).
 */
export interface WidgetRenderProps<TData> {
  // Layer identity and data
  layer: Layer;           // Full layer envelope: id, label, visibility, colorDefault, etc.
  data: TData;            // Typed widget payload; same object as layer.data

  // Document context (read-only)
  // Provides duration, vocabulary, sharedTimePoints, pointMarkers, all layers.
  // Widget accesses what it needs; the store handles memoization.
  document: StrataDocument;

  // Playback state (from UI store)
  currentTime: number;    // Current playback position, recording seconds

  // Viewport state (from UI store)
  viewState: ViewState;

  // Selection state (from UI store; read-only in render component)
  selectedSpanId: string | null;
  hoveredSpanId: string | null;
}
```

### 2.3 WidgetEditProps

The edit component receives everything the render component receives, plus four callbacks. The callbacks are the "write" side: when the analyst does something, the widget calls the right callback, and the application handles the rest.

- `onDataChange` — the analyst placed a boundary, typed a label, toggled a setting: call this with the new data. The store persists it and adds an undo snapshot.
- `onSpanSelect` / `onSpanHover` — the analyst clicked or moused over a span: call this so the rest of the UI (the metadata panel, the ruler highlight) can respond.
- `onSeek` — the analyst double-clicked a span or clicked "jump to this section": call this with the target time and the player will seek there.

The edit component receives these as ordinary function references. It does not import Zustand or know anything about how the store works.

```typescript
/**
 * Props received by every widget's EditComponent.
 *
 * Extends WidgetRenderProps with mutation callbacks. The editor shell wires
 * these callbacks to Zustand store actions. The widget does not import or
 * reference Zustand directly — it only calls the callbacks it receives.
 *
 * EditComponent is only instantiated in the editor, never in the viewer.
 */
export interface WidgetEditProps<TData> extends WidgetRenderProps<TData> {
  // Data mutation — called whenever the widget wants to change its layer data.
  // The store persists the new data and enqueues an undo/redo snapshot.
  onDataChange: (newData: TData) => void;

  // Selection — widget notifies editor of selection changes
  onSpanSelect: (spanId: string | null) => void;
  onSpanHover: (spanId: string | null) => void;

  // Playback control — widget requests a seek (e.g. "jump to this span")
  onSeek: (time: number) => void;
}
```

### 2.4 WidgetTimelinePresenceProps

The shared ruler at the top of the timeline is an SVG drawing surface. Widgets that want to mark things on the ruler — the form diagram draws faint tick marks at span boundaries, for example — provide a `TimelinePresenceComponent` that renders SVG elements directly into that surface.

This component receives a lighter version of the render props: its own layer data, the document, current time, and the viewport state. It returns SVG elements positioned within the ruler's coordinate space (x = pixel position; y = position within ruler height). Widgets that have nothing to mark on the ruler set `TimelinePresenceComponent` to `null`.

```typescript
/**
 * Props received by a widget's optional TimelinePresenceComponent.
 *
 * This component renders SVG elements directly onto the shared horizontal
 * ruler — e.g., tick marks at span boundaries. It operates within the
 * ruler's SVG coordinate system (x = pixel position, y within ruler height).
 *
 * Set TimelinePresenceComponent to null if the widget contributes nothing
 * to the ruler.
 */
export interface WidgetTimelinePresenceProps<TData> {
  layer: Layer;
  data: TData;
  document: StrataDocument;
  currentTime: number;
  viewState: ViewState;
  selectedSpanId: string | null;
}
```

### 2.5 WidgetExporter

Each widget declares what file types it can export and provides a function that produces each file. The application's export UI calls this function and handles the download; the widget handles the rendering.

`formats` is the list of supported types. `export` is the function: it takes a format identifier, the layer, its data, the full document (for context like vocabulary and metadata), and the time range — and returns a Promise that resolves to a file the browser can download.

```typescript
/**
 * Export capability for a widget type.
 *
 * Each widget declares its supported formats and provides an async export
 * function. The function receives the full document for context (vocabulary,
 * other layers, metadata) but is responsible only for exporting the given layer.
 * Multi-widget combined export is v2.
 */
export interface WidgetExporter<TData> {
  formats: ExportFormat[];

  export: (
    formatId: string,
    layer: Layer,
    data: TData,
    document: StrataDocument,
    options: ExportOptions
  ) => Promise<Blob>;
}
```

### 2.6 WidgetDefinition — The Contract

This is the complete contract object. Think of it as a widget's application packet: five sections that together tell the application everything it needs to know to work with this widget type. Registering a `WidgetDefinition` in the widget registry is how a new widget joins the system.

The five sections:

1. **Identity** — what type is this, what is it called?
2. **Components** — the three components: display (viewer-safe), edit (editor-only), ruler marks (optional)
3. **Data** — a function that returns a blank starting dataset for new layers
4. **Pool** — a function that declares which timestamps this layer contributes to the shared time point pool
5. **Export** — the `WidgetExporter` declared in 2.5

```typescript
/**
 * The widget contract. Every widget type must provide one WidgetDefinition.
 *
 * This object is registered with the widget registry at application startup.
 * The editor and viewer use the registry to instantiate the correct components
 * for any layer type they encounter in a document.
 *
 * TData is the widget's specific data payload type, constrained to LayerData.
 */
export interface WidgetDefinition<TData extends LayerData> {

  // -------------------------------------------------------------------------
  // Identity
  // -------------------------------------------------------------------------

  /** Widget type identifier. Must match a value in the LayerType union. */
  type: LayerType;

  /** Human-readable name shown in the layer creation UI, e.g. "Form Diagram". */
  label: string;

  /** Optional description for the layer creation picker. */
  description?: string;

  /**
   * Default position of this widget type relative to the timeline ruler.
   * 'above' = widget renders in the zone above the ruler (standard for form diagrams,
   *           energy contours, and most analytical widgets).
   * 'below' = widget renders in the zone below the ruler (e.g. written analysis).
   *
   * The analyst can override this per-layer via Layer.position in the layer settings
   * popover. Absent a Layer.position override, this value applies. Absent this field,
   * 'above' is assumed.
   */
  defaultPosition: 'above' | 'below';

  // -------------------------------------------------------------------------
  // Components
  // -------------------------------------------------------------------------

  /**
   * Read-only visual representation. Used in both the editor and the viewer.
   * Must not accept mutation callbacks or have side effects beyond rendering.
   */
  RenderComponent: React.ComponentType<WidgetRenderProps<TData>>;

  /**
   * Editor-only component. Adds editing interactions to the rendered view.
   * Only instantiated by the editor shell, never by the viewer.
   */
  EditComponent: React.ComponentType<WidgetEditProps<TData>>;

  /**
   * Optional SVG content rendered onto the shared timeline ruler.
   * Null if this widget contributes nothing to the ruler.
   */
  TimelinePresenceComponent: React.ComponentType<WidgetTimelinePresenceProps<TData>> | null;

  // -------------------------------------------------------------------------
  // Data
  // -------------------------------------------------------------------------

  /**
   * Returns the initial data for a new layer of this type.
   * Called when the user creates a new layer in the editor.
   */
  createDefaultData: () => TData;

  // -------------------------------------------------------------------------
  // Shared Time Point Pool
  // -------------------------------------------------------------------------

  /**
   * Returns the SharedTimePoint entries this layer instance should own in the
   * document-level shared time point pool.
   *
   * Pure function — no side effects. The document store calls this after every
   * data change and syncs the result into StrataDocument.sharedTimePoints,
   * replacing all existing entries where sourceLayerId === layerId.
   *
   * Returning an empty array removes this layer's contributions from the pool.
   */
  contributeTimePoints: (data: TData, layerId: string) => SharedTimePoint[];

  // -------------------------------------------------------------------------
  // Export
  // -------------------------------------------------------------------------

  exporter: WidgetExporter<TData>;
}
```

---

## 3. Shared Time Point Pool — Participation Rules

The document store enforces these invariants. These rules matter most to implementers, but non-technical readers may want to understand the ownership model — it explains why pool entries can't step on each other.

**Ownership by layer.** Every entry in `sharedTimePoints` carries a `sourceLayerId`. When a layer's data changes, the store calls `contributeTimePoints` for that layer and replaces all pool entries that belong to it. No layer can affect another layer's pool entries.

**Global read, owner write.** Any component anywhere in the application can read the full pool via `document.sharedTimePoints`. But pool entries are only written by the store, acting on the return value of `contributeTimePoints`. Nothing writes to the pool directly.

**Deletion propagates.** When a layer is deleted, all pool entries that belong to it — where `sourceLayerId` matches — are removed automatically.

**BPM grid entries are unowned.** Time points generated by the BPM grid utility carry `sourceLayerId: null`. They are managed by the BPM utility, not by any widget. No widget's `contributeTimePoints` function should return entries with `sourceLayerId: null` — that sentinel is reserved for the grid.

**Snapping.** Snapping to pool entries is handled inside each widget's `EditComponent`. The widget reads `document.sharedTimePoints`, finds entries within a configurable snap distance of the current cursor or boundary, and snaps to the nearest one. There is no shared snap utility at the contract level — each widget implements the snap behavior appropriate to its interaction model.

---

## 4. Export System

The single-layer export flow, step by step:

1. The analyst selects a time range — usually by clicking a span (which pre-fills start and end times) then adjusting the handles
2. The export UI looks up the correct `WidgetDefinition` by `layer.type`
3. The export UI calls `widgetDefinition.exporter.export(formatId, layer, layer.data, document, { startTime, endTime })`
4. The function returns a `Promise<Blob>` — a file being assembled
5. Once the Promise resolves, the export UI triggers a browser download

**Layer visibility as the export filter.** The `layer.visibility` field is the mechanism for controlling what appears in an export. Hide the layers you don't want exported before exporting. The export UI reads visibility from the layer object and passes it through. Single-layer export produces a file from the one target layer only.

**Content clipping.** The exporter clips to `[startTime, endTime]`. Spans or content outside this range are not rendered. The widget is responsible for this clipping — the application passes the range, the widget respects it.

**Multi-widget combined export is v2.** v1 exports one widget layer at a time. A scholar assembles multi-widget outputs (form diagram + written analysis) using other tools.

---

## 5. Widget Registry

The widget registry is a lookup table from widget type identifiers (like `"form-diagram"`) to their `WidgetDefinition` objects. It is populated once at application startup and is the single mechanism by which the editor and viewer discover how to handle any layer they encounter.

When the editor or viewer loads a document and encounters a layer, it calls `getWidgetDefinition(layer.type)`. If the type is registered, it gets the components and functions needed to render and interact with that layer. If the type is not registered — because the document was authored with a newer version of Strata that has a widget type this version doesn't know about — the layer renders as a labeled placeholder with a "widget type not supported in this version" message. The layer data is preserved in the document store unchanged. The analyst's file is not damaged.

```typescript
// src/widgetRegistry.ts  (Phase 1 artifact — not yet written)
import { formDiagramWidget } from './widgets/form-diagram/definition';

// In practice: WidgetDefinition<any> due to TypeScript generic invariance.
// Individual registrations are type-safe at the point of registration.
const registry = new Map<LayerType, WidgetDefinition<any>>();
registry.set('form-diagram', formDiagramWidget);

export function getWidgetDefinition(type: LayerType): WidgetDefinition<any> {
  const def = registry.get(type);
  if (!def) throw new Error(`Unknown widget type: "${type}"`);
  return def;
}
```

The graceful fallback for unknown types is a forward-compatibility guarantee: a document from a future version of Strata will still open in an older version, just with unrecognized widget layers shown as placeholders rather than crashing the application.

---

## 6. Implementation Checklist

For each new widget type, in order:

- [ ] Define the `TData` interface and add it to the `LayerData` union in `strata.types.ts`
- [ ] Add the type identifier to the `LayerType` union in `strata.types.ts`
- [ ] Implement `RenderComponent` — no mutation callbacks, no external side effects
- [ ] Implement `EditComponent` — extends render; wires all interactions to `onDataChange`
- [ ] Implement `TimelinePresenceComponent` or set to `null`
- [ ] Implement `createDefaultData()`
- [ ] Implement `contributeTimePoints()` — pure function; covers all temporal boundaries the layer owns
- [ ] Implement `WidgetExporter` with all supported formats
- [ ] Register the `WidgetDefinition` in the widget registry
- [ ] Add `widgets/<type>.md` with widget-specific documentation
- [ ] Increment `fileFormatVersion` in `strata.types.ts` if the file format changed

---

*Strata Widget Contract Specification — Phase 0.2 output.*
*Source of truth until Phase 1.2 ports these interfaces to `src/types/widget.ts`.*
