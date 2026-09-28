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

export type ConfidenceLevel = 'definite' | 'approximate' | 'speculative'

export type AnalysisContext = 'recording' | 'performance'

export type SourceType = 'youtube' | 'local'

export type BoundaryType = 'definite' | 'gradual' | 'elided'

/**
 * Visual cap (end-tail) style of a form diagram bracket — the analyst's drawing
 * choice, decoupled from the analytical `BoundaryType`. The top line is always
 * flat (domes/arcs are retired). See docs/decisions.md "Form Diagram Shape Model".
 */
export type CapStyle = 'rounded' | 'square' | 'angled' | 'open' | 'elision'

/** Visual stroke style of a bracket; whole-shape uniform. Decoupled from confidence. */
export type LineStyle = 'solid' | 'dashed'

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
}

export interface Vocabulary {
  spanTypes: VocabTerm[]
  pointMarkerTypes: VocabTerm[]
  /** Project-level custom modes (e.g. Renaissance 8-mode/12-mode systems). See lib/modes.ts for the built-in starter list, which ships in code rather than here. */
  modes: VocabTerm[]
}

// ---------------------------------------------------------------------------
// Shared Time Point Pool
// ---------------------------------------------------------------------------

export interface SharedTimePoint {
  id: string
  timestamp: number           // Recording time, seconds (float)
  label?: string | null
  sourceLayerId?: string | null // Provenance; null = contributed by BPM grid utility
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
                                  // (a small marker indicates a hidden label; see FormLayers).
  slug?: string | null           // From the label; unique per document, frozen once saved (lib/slug.ts)
  startTime: number              // Recording time, seconds (float)
  endTime: number                // Must exceed startTime
  type?: string | null           // Vocabulary term ID; corpus-queryable
  fillColor?: string | null      // Hex fill override; null = use layer fillColorDefault
  strokeColor?: string | null    // Hex stroke override; null = use layer strokeColorDefault
  annotation?: string | null     // Diagram-visible analytical text (on span body)
  notes?: string | null          // Tooltip-only; not rendered on diagram
  lyrics?: string | null         // Lyric text; corpus-queryable
  keyArea?: string | null        // A Roman numeral relative to StrataDocument.homeKey
                                  // (e.g. "vi", "V/V"); accidentals stored as ♭/♯. Corpus-queryable.
                                  // Renders as a caption spanning the span (see Layer.spanShape).
  confidence?: ConfidenceLevel   // Queryable data; omit for "definite". Does NOT affect rendering.
  startBoundaryType?: BoundaryType | null // Queryable data. Choosing one in the UI resets that
  endBoundaryType?: BoundaryType | null   // side's cap to match; the drawing reads the cap.
  parentId?: string | null       // UUID of parent span; hierarchical ref without enforcement
  mergedFrom?: string[] | null   // Always >= 2 UUIDs when present
  // Visual style — the analyst's drawing choice (decoupled from the data above).
  startCap?: CapStyle            // Default 'rounded' (falls back from startBoundaryType for old files)
  endCap?: CapStyle              // Default 'rounded' (falls back from endBoundaryType for old files)
  lineStyle?: LineStyle          // Default 'solid'
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
  confidence?: ConfidenceLevel // Omit for "definite" (default)
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
// Form Diagram Data (Widget Payload)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Layer Rendering Config
// ---------------------------------------------------------------------------

/**
 * Layer-level defaults for text rendering within span shapes.
 * All spans in the layer inherit these settings.
 * No per-span text rendering overrides in v1.
 *
 * Defaults:
 *   labelPosition:           'above'   — section names float above the arc peak
 *   labelJustification:      'center'  — centered above the bracket
 *   annotationPosition:      'inside'  — analytical detail inside the shape body
 *   annotationJustification: 'left'    — left-aligned inside the shape
 *
 * fontSize: deferred to Phase 0.7 visual design session.
 */
export interface LayerRenderingConfig {
  labelPosition?: 'above' | 'inside'
  labelJustification?: 'left' | 'center' | 'right'
  annotationPosition?: 'above' | 'inside'
  annotationJustification?: 'left' | 'center' | 'right'
}

// ---------------------------------------------------------------------------
// Form Diagram Data (Widget Payload)
// ---------------------------------------------------------------------------

export interface FormDiagramData {
  /**
   * STALE — unused by the UI, kept for file compatibility. Hierarchical
   * enforcement was redefined (2026-06-22) as a CROSS-LAYER nesting constraint
   * scoped to the form-diagram widget type, so it cannot live on one layer's
   * data. This field will be relocated when that feature is built. See
   * docs/decisions.md → the hierarchical enforcement reversal entry.
   */
  hierarchicalEnforcement: boolean
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
  /** Paragraphs separated by a blank line; **bold**, *italic*, and [[slug]] span links. */
  text: string
}

export interface WrittenAnalysisData {
  blocks: AnalysisBlock[]
}

/** Widget types. Extend this union when adding a widget. */
export type LayerType = 'form-diagram' | 'written-analysis'

/** Union of all widget data payload types. */
export type LayerData = FormDiagramData | WrittenAnalysisData
// Future: | EnergyContourData | InstrumentationData

/** Fields every layer carries, whatever its widget type (the typed envelope). */
export interface LayerBase {
  id: string
  label: string
  description?: string | null
  visibility: boolean
  locked: boolean
  fillColorDefault: string   // Hex fill fallback for spans with no per-span fillColor override
  strokeColorDefault: string // Hex stroke fallback for spans with no per-span strokeColor override
  displayOrder: number   // Lower = renders first (bottom); gaps allowed
  /**
   * Position relative to the timeline ruler.
   * Absent = use the widget's defaultPosition from the WidgetDefinition.
   * Absent widget default = 'above'.
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
   * implication; the same Span/spacebar/drag/merge interactions apply either way.
   */
  spanShape?: 'bracket' | 'bar'
  /**
   * Text size for this layer's labels and annotations: sm (9.5 / 8.5 px),
   * md (11 / 9, the default when absent) or lg (13 / 11). Uniform within a
   * layer; there is no per-span font size.
   */
  fontScale?: 'sm' | 'md' | 'lg'
}

export type FormDiagramLayer = LayerBase & { type: 'form-diagram'; data: FormDiagramData }
export type WrittenAnalysisLayer = LayerBase & { type: 'written-analysis'; data: WrittenAnalysisData }

/**
 * A layer is tagged by its widget type, so checking `layer.type` tells
 * TypeScript which `data` shape it holds.
 */
export type Layer = FormDiagramLayer | WrittenAnalysisLayer

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
  bpm?: number | null
  timeSignature?: TimeSignature | null
  homeKey?: HomeKey | null

  source: SourceReference

  project?: string | null
  analysisAuthor?: string | null

  vocabulary: Vocabulary
  sharedTimePoints: SharedTimePoint[]
  layers: Layer[]
  pointMarkers: PointMarker[]

  /**
   * Whether cadence-related point marker detail (type abbreviation, harmonic
   * context) renders on the diagram. Point markers aren't layer-owned, so this
   * is document-level rather than per-layer. Omit/absent = true (shown).
   */
  showCadenceCaptions?: boolean
}
