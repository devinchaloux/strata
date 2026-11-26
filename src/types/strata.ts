/**
 * TypeScript types for the Strata .strata file format.
 *
 * These are the living schema specification for the entire application.
 * They mirror schema/strata.schema.json, which is the published contract; a test
 * (src/test/schemaConformance.test.ts) checks what the app writes against it.
 * A format change updates both, plus schema/strata-schema-reference.md. Whether
 * it also bumps the file format version: see src/lib/migrations.ts.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export type AnalysisContext = 'recording' | 'performance' // Studio recording, or live performance

export type SourceType = 'youtube' | 'local'

export type BoundaryType = 'definite' | 'gradual' | 'elided'

/**
 * A span's place in a hypermetric group: the span as one hyperbeat (a bar, or
 * any span, after Lerdahl and Jackendoff's higher metrical levels). Drawn
 * centered inside the span, apart from its annotation, which it never replaces
 * (lib/hypermeter.ts; docs/decisions.md, "The Hypermeter Is Its Own Field").
 */
export interface Hypermeter {
  count: number                  // Integer >= 1: the place in its group ("4")
  becomes?: number               // Integer >= 1, for an elided hyperbeat: the place it
                                  // starts in the next group ("4=1" is count 4, becomes 1)
}

/**
 * Visual cap (end-tail) style of a segment bracket — the analyst's drawing
 * choice, decoupled from the analytical `BoundaryType`. The top line is always
 * flat (domes/arcs are retired). See docs/decisions.md "Form Diagram Shape Model".
 */
export type CapStyle = 'rounded' | 'square' | 'angled' | 'open' | 'elision'

/** Visual stroke style of a bracket; whole-shape uniform. */
export type LineStyle = 'solid' | 'dashed'
/** A faint texture over a span's fill, in a darker shade of it (lib/patterns.ts). */
export type FillPattern = 'hatch' | 'cross' | 'dots' | 'lines'

// ---------------------------------------------------------------------------
// Source Reference
// ---------------------------------------------------------------------------

export interface SourceReference {
  type: SourceType
  url?: string      // Required when type = "youtube"
  filename?: string // Required when type = "local"; not shareable
  /**
   * Offset in seconds between the source file's start and the recording's true start.
   * player_time = recording_time + sourceOffset
   * Span timestamps always store recording time. Updating this corrects all
   * seek behavior without touching span data.
   */
  sourceOffset: number
}

// ---------------------------------------------------------------------------
// Derivative Reference
// ---------------------------------------------------------------------------

export interface DerivativeReference {
  sourceTrack: string  // Filename of the source analysis, e.g. "heroes-original.strata"
  relationship: string // "remix" | "cover" | "rerecording" | "arrangement" or free text
}

// ---------------------------------------------------------------------------
// Time Signature
// ---------------------------------------------------------------------------

/**
 * One stretch of the beat grid: starts on a downbeat and keeps one tempo and
 * meter until `end`, the next segment, or the end of the track. The time
 * between segments has no grid.
 */
export interface GridSegment {
  id: string
  start: number              // Recording time of the first downbeat, seconds
  end?: number | null        // Where the grid stops (a free stretch follows). Absent/null = runs on
  bpm: number
  beatsPerBar: number        // Beats in a bar (the time signature's numerator)
  beatUnit?: number          // Note value of a beat (the denominator); display only. Omit for 4
  firstBar?: number | null   // Bar number at `start`. Absent/null = continue from the previous segment
}

export interface TimeSignature {
  numerator: number   // Beats per measure
  denominator: number // Note value per beat as power of 2 (e.g. 4 = quarter note)
}

// ---------------------------------------------------------------------------
// Home Key
// ---------------------------------------------------------------------------

/**
 * The document's tonic and mode. Lets Span.keyArea and PointMarker.harmonicContext
 * store a Roman-numeral RELATIONSHIP (e.g. "vi", "V/V") rather than an absolute
 * key name — the relationship is what's corpus-queryable across a corpus of
 * different pieces in different keys.
 */
export interface HomeKey {
  tonic: string        // Free text — "A", "F#", "Bb" — spelling is the analyst's call
  mode: string | null  // VocabTerm id, resolved against vocabulary.modes (+ built-in modes list)
}

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

export interface VocabTerm {
  /** Stable identifier. Lowercase alphanumeric and hyphens; starts with alphanumeric. */
  id: string
  label: string
  description?: string
  color?: string | null
  /** Whether this term applies to spans, point markers, or modes. Required for vocab pack import. */
  kind?: 'span' | 'point-marker' | 'mode'
  /** Pack provenance string, e.g. "My Pack v1.0.0". Set on import; absent for built-ins. */
  source?: string
  /** Ids of more general terms this one counts as in a query (SKOS "broader"). See lib/vocabulary.ts. */
  broader?: string[]
}

export interface Vocabulary {
  spanTypes: VocabTerm[]
  pointMarkerTypes: VocabTerm[]
  /** Project-level custom modes (e.g. Renaissance 8-mode/12-mode systems). See lib/modes.ts for the built-in starter list, which ships in code rather than here. */
  modes: VocabTerm[]
}

// ---------------------------------------------------------------------------
// Span
// ---------------------------------------------------------------------------

/**
 * A time span representing a formal section.
 * The universal primitive of the Strata system.
 *
 * id / label / slug / type are four deliberately separate fields:
 * - id:    internal, stable, never shown
 * - label: free text, human display, can change; optional (null for unlabeled)
 * - slug:  auto-generated, stable human-readable key for inter-widget links
 * - type:  controlled vocabulary, corpus-queryable
 */
export interface Span {
  id: string
  label?: string | null          // Optional; null for unlabeled (e.g. bar-level hypermeter)
  shortLabel?: string | null     // Optional analyst-authored abbreviation (e.g. "Verse 1" → "V1").
                                  // Shown above-shape in place of the full label when the full
                                  // label doesn't fit; never itself truncated. No algorithmic
                                  // abbreviation is attempted — if neither fits, nothing renders
                                  // (a small marker indicates a hidden label; see SegmentLayers).
  slug?: string | null           // From the label; unique per document, frozen once saved (lib/slug.ts)
  startTime: number              // Recording time, seconds (float)
  endTime: number                // Must exceed startTime
  type?: string | null           // Vocabulary term ID; corpus-queryable
  fillColor?: string | null      // Hex fill override, or 'none' for no fill; null = use layer fillColorDefault
  strokeColor?: string | null    // Hex stroke override, or 'none' for no outline; null = use layer strokeColorDefault
  annotation?: string | null     // Diagram-visible analytical text (on span body)
  hypermeter?: Hypermeter | null // Its place in a hypermetric group; null or absent for none
  showHypermeter?: boolean       // Drawing choice for this span's hypermeter; absent = the layer's
  notes?: string | null          // The analyst's working note; shown only in the Inspector
  lyrics?: string | null         // Lyric text; corpus-queryable
  keyArea?: string | null        // A Roman numeral relative to StrataDocument.homeKey
                                  // (e.g. "vi", "V/V"); accidentals stored as ♭/♯. Corpus-queryable.
                                  // Renders as a caption spanning the span (see Layer.spanShape).
  startBoundaryType?: BoundaryType | null // Queryable data. Choosing one in the UI resets that
  endBoundaryType?: BoundaryType | null   // side's cap to match; the drawing reads the cap.
  parentId?: string | null       // Id of the span this one belongs to, on another layer (Group, Copy to layer).
                                  // A parent and its children move their shared boundaries together (lib/linkedBoundaries.ts)
  mergedFrom?: string[] | null   // The spans a merge made this from (>= 2 ids); a record of origin only
  // Visual style — the analyst's drawing choice (decoupled from the data above).
  startCap?: CapStyle            // Default 'rounded' (falls back from startBoundaryType for old files)
  endCap?: CapStyle              // Default 'rounded' (falls back from endBoundaryType for old files)
  lineStyle?: LineStyle          // Default 'solid'
  fillPattern?: FillPattern      // Texture over the fill, a darker shade of it. Omit for none.
  endOnTop?: boolean             // Where an elision makes this bracket overlap the next one:
                                  // true = this span draws on top. Omit for false (next on top).
}

// ---------------------------------------------------------------------------
// Point Marker
// ---------------------------------------------------------------------------

/**
 * A single-timestamp analytical event. Document-level — not per-layer.
 *
 * Type A: observational flags ("come back to this", "something interesting")
 * Type B: theoretically precise events (medial caesura, EEC in H/D analysis)
 */
export interface PointMarker {
  id: string
  timestamp: number            // Recording time, seconds (float)
  label?: string | null
  /**
   * Reference name for commentary links ([[slug]]), derived from the label. One
   * namespace with span slugs, so a name is unique across the document; frozen
   * once saved, like a span's (lib/slug.ts).
   */
  slug?: string | null
  type?: string | null         // Vocabulary term ID; corpus-queryable
  notes?: string | null
  flagged?: boolean            // "Come back to this." Omit for false (default)
  absent?: boolean             // "Expected event explicitly absent." Caption renders struck through. Omit for false.
  harmonicContext?: string | null // A Roman numeral relative to StrataDocument.homeKey (e.g. "V"
                                   // for a half cadence in the dominant). UI label "In key".
                                   // Captioned as `V:PAC` with the type, or alone without one.
  /**
   * Soft UI preset — picks which fields the Inspector panel leads with. Never
   * restricts what data a marker can carry; every field remains reachable via
   * "more fields" regardless of kind. Omit/undefined behaves like 'other'.
   */
  kind?: 'cadence' | 'key-change' | 'tempo-change' | 'flag' | 'other'
}

// ---------------------------------------------------------------------------
// Segmentation Data (Widget Payload)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Layer Rendering Config
// ---------------------------------------------------------------------------

/**
 * Layer-level defaults for text rendering within span shapes.
 * All spans in the layer inherit these settings; there are no per-span
 * overrides. The renderer reads them all; the app has a control only for
 * underneath (the layer's ⋯ menu).
 *
 * Defaults:
 *   labelPosition:           'above'   — section names float above the arc peak
 *   labelJustification:      'center'  — centered above the bracket
 *   annotationPosition:      'inside'  — analytical detail inside the shape body
 *   annotationJustification: 'left'    — left-aligned inside the shape
 *   underneath:              (absent)  — no strip under the layer; the
 *                                        hypermeter, centered, shares the inside
 *                                        annotation's line. 'hypermeter' or
 *                                        'annotation' opens a thin strip under
 *                                        the layer and draws that there
 *
 * Text size is a separate layer setting, LayerBase.fontScale.
 */
export interface LayerRenderingConfig {
  labelPosition?: 'above' | 'inside'
  labelJustification?: 'left' | 'center' | 'right'
  annotationPosition?: 'above' | 'inside'
  annotationJustification?: 'left' | 'center' | 'right'
  underneath?: 'hypermeter' | 'annotation'
}

// ---------------------------------------------------------------------------
// Segmentation Data (Widget Payload)
// ---------------------------------------------------------------------------

export interface SegmentationData {
  spans: Span[]
}

// ---------------------------------------------------------------------------
// Layer (Typed Envelope Pattern)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Written Analysis Data (Widget Payload)
// ---------------------------------------------------------------------------

/**
 * What a piece of commentary is about: a span, by its id (which never changes,
 * unlike its slug), or a time range in recording seconds. Deleting a span turns
 * its commentary's anchor into the span's former time range, so no text is lost.
 */
export type BlockAnchor = { spanId: string } | { start: number; end: number }

/** One piece of commentary; it surfaces while its anchor plays. */
export interface AnalysisBlock {
  id: string
  anchor: BlockAnchor
  /** Markdown (paragraphs, emphasis, code, headings, lists, quotes, web links) plus [[slug]] links to spans and markers. */
  text: string
}

export interface WrittenAnalysisData {
  blocks: AnalysisBlock[]
}

/** Widget types. Extend this union when adding a widget. */
export type LayerType = 'segmentation' | 'written-analysis'

/** Union of all widget data payload types. */
export type LayerData = SegmentationData | WrittenAnalysisData
// Future: | EnergyContourData | InstrumentationData

/** Fields every layer carries, whatever its widget type (the typed envelope). */
export interface LayerBase {
  id: string
  label: string
  description?: string | null
  visibility: boolean
  locked: boolean
  fillColorDefault: string   // Fill for spans with no fillColor of their own: hex, or 'none'
  strokeColorDefault: string // Outline for spans with no strokeColor of their own: hex, or 'none'
  displayOrder: number   // Lower = renders first (bottom); gaps allowed
  /**
   * Position relative to the timeline ruler. Reserved: the app always draws
   * layers above the ruler and has no control for this yet.
   */
  position?: 'above' | 'below'
  /** Text rendering defaults for spans in this layer. */
  rendering?: LayerRenderingConfig
  /**
   * Visual style for this layer's spans. Absent/'bracket' = today's rendering
   * (the analytical bracket/arc shapes). 'bar' draws thin flat rects instead —
   * intended for key-area layers (Span.keyArea captions), but the field is
   * generic, not key-area-specific. A layer setting, buried in Layer Settings,
   * not surfaced in the main "add layer" flow. Purely visual — no data-model
   * implication; the same Span/boundary-key/drag/merge interactions apply either way.
   */
  spanShape?: 'bracket' | 'bar'
  /**
   * The vocabulary library this layer draws its types from (lib/vocabulary.ts
   * library id, or 'letters'). The Type picker and quick entry lead with it;
   * it never restricts which types the layer may use. Absent = guessed from
   * the types already in the layer.
   */
  library?: string | null
  /**
   * Whether a boundary placed in an empty stretch fills it on both sides
   * (the default, absent = true) or starts a span there and leaves the
   * stretch before it empty (false), for a layer that begins mid-track.
   */
  fillGaps?: boolean
  /**
   * What the layer is for, where Strata offers tools for it. 'bars' marks the
   * bar layer: one span per bar, its label the bar number and its hypermeter
   * its place in a group (lib/hypermeter.ts). At most one layer in a document
   * has it. Absent = an ordinary layer. Not to be confused with spanShape
   * 'bar', which is only a way of drawing.
   */
  role?: 'bars'
  /**
   * Whether this layer's spans draw their hypermeter (Span.hypermeter).
   * Absent = true. A span's own showHypermeter overrides it.
   */
  showHypermeter?: boolean
  /**
   * Text size for this layer's labels and annotations: sm (9.5 / 8.5 px),
   * md (11 / 9, the default when absent) or lg (13 / 11). Uniform within a
   * layer; there is no per-span font size.
   */
  fontScale?: 'sm' | 'md' | 'lg'
}

/**
 * A tempo layer (widgets/tempo.md): the tempo of a source layer of bars (or,
 * later, beats), read from its spans' lengths and never stored. Only what to
 * read and how to show it is kept.
 */
export interface TempoData {
  /** The layer whose spans are the units, and what they are. */
  source: { layerId: string; unit: 'bar' | 'beat' }
  display?: {
    /** Display-only smoothing for the smoothed and deviation views, log10 of lambda (lib/normalize.ts); null or absent = automatic. Moves no boundary. */
    smoothing?: number | null
    /** Which views to draw; 'map' is the tempo map (lib/tempoMap.ts). Absent = ['marked']. */
    show?: Array<'marked' | 'smoothed' | 'deviation' | 'map'>
    /** A fixed BPM range, for comparing recordings; absent = from the data. */
    scale?: { min: number; max: number } | null
  }
}

export type SegmentationLayer = LayerBase & { type: 'segmentation'; data: SegmentationData }
export type WrittenAnalysisLayer = LayerBase & { type: 'written-analysis'; data: WrittenAnalysisData }
export type TempoLayer = LayerBase & { type: 'tempo'; data: TempoData }

/**
 * A layer is tagged by its widget type, so checking `layer.type` tells
 * TypeScript which `data` shape it holds.
 */
export type Layer = SegmentationLayer | WrittenAnalysisLayer | TempoLayer

/** The widget types that draw as a block on the timeline (WidgetBlock). */
export type BlockType = 'segmentation' | 'tempo'

/**
 * One widget in the work area, drawn as a block: one framed card on the shared
 * timeline, holding every layer of its type. StrataDocument.widgets lists them
 * top to bottom.
 */
export interface WidgetBlock {
  type: BlockType
  /** Hidden by the analyst: not drawn, and left out of exports. Absent = shown. */
  hidden?: boolean
}

// ---------------------------------------------------------------------------
// Top-Level Document
// ---------------------------------------------------------------------------

export interface StrataDocument {
  strataVersion: string     // Semver of the Strata app that wrote this file
  fileFormatVersion: number // Schema version integer; starts at 1

  createdAt: string // ISO 8601; set once on first save
  updatedAt: string // ISO 8601; updated on every save

  title: string
  artist: string[]                         // Array; single-artist: ["Avicii"]; may be empty while in progress
  context?: AnalysisContext | null
  duration: number                         // Track duration, seconds (float)

  composer?: string | null                 // Shown when context = "performance"
  work?: string | null                     // E.g. "Op. 13"; enables cross-file corpus comparison
  derivativeOf?: DerivativeReference | null

  notes?: string | null
  bpm?: number | null                  // Starting tempo: what a new beat-grid segment starts from.
                                       // Once there is a grid, its segments hold the tempo; this isn't kept in step
  timeSignature?: TimeSignature | null // Starting meter, in the same way
  /** Bars and beats, laid down by ear in segments; gaps are freeform (lib/beatGrid.ts). */
  beatGrid?: GridSegment[]
  homeKey?: HomeKey | null

  source: SourceReference

  project?: string | null
  analysisAuthor?: string | null

  vocabulary: Vocabulary
  layers: Layer[]
  pointMarkers: PointMarker[]

  /**
   * Whether cadence-related point marker detail (type abbreviation, harmonic
   * context) renders on the diagram. Point markers aren't layer-owned, so this
   * is document-level rather than per-layer. Omit/absent = true (shown).
   */
  showCadenceCaptions?: boolean

  /**
   * The widgets of the work area, top to bottom, each drawn as a block above
   * the shared ruler: one per widget type, holding that type's layers
   * (docs/decisions.md, "Widgets as Blocks"). Absent = the Segments block alone,
   * plus a tempo block if there are tempo layers. The reader adds any block a
   * layer needs and drops duplicates.
   */
  widgets?: WidgetBlock[]
}
