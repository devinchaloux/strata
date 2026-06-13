/**
 * TypeScript types for the Strata .strata file format.
 *
 * These are the living schema specification for the entire application.
 * Source of truth: schema/strata.schema.json and schema/strata.types.ts.
 * When either changes, update both and increment fileFormatVersion.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export type ConfidenceLevel = 'definite' | 'approximate' | 'speculative'

export type AnalysisContext = 'recording' | 'performance'

export type SourceType = 'youtube' | 'local'

export type BoundaryType = 'definite' | 'gradual' | 'elided'

/** Top line style of a form diagram arc/bracket shape. */
export type LineType = 'arc' | 'flat'

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
// Vocabulary
// ---------------------------------------------------------------------------

export interface VocabTerm {
  /** Stable identifier. Lowercase alphanumeric and hyphens; starts with alphanumeric. */
  id: string
  label: string
  description?: string
  color?: string | null
}

export interface Vocabulary {
  spanTypes: VocabTerm[]
  pointMarkerTypes: VocabTerm[]
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
  slug?: string | null           // Auto-generated from label; null until label is set
  startTime: number              // Recording time, seconds (float)
  endTime: number                // Must exceed startTime
  type?: string | null           // Vocabulary term ID; corpus-queryable
  color?: string | null          // Hex per-span override; null = use layer colorDefault
  annotation?: string | null     // Diagram-visible analytical text (on span body)
  notes?: string | null          // Tooltip-only; not rendered on diagram
  lyrics?: string | null         // Lyric text; corpus-queryable
  confidence?: ConfidenceLevel   // Omit for "definite" (default)
  startBoundaryType?: BoundaryType | null
  endBoundaryType?: BoundaryType | null
  parentId?: string | null       // UUID of parent span; hierarchical ref without enforcement
  mergedFrom?: string[] | null   // Always >= 2 UUIDs when present
  lineType?: LineType            // Top line style of the arc/bracket shape; default 'arc'
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
  type?: string | null         // Vocabulary term ID; corpus-queryable
  notes?: string | null
  flagged?: boolean            // "Come back to this." Omit for false (default)
  absent?: boolean             // "Expected event explicitly absent." No v1 UI. Omit for false.
  confidence?: ConfidenceLevel // Omit for "definite" (default)
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
   * Opt-in, per-layer toggle that prevents overlapping spans during editing.
   * NEVER the default. Applied at UI level only — schema allows overlapping regardless.
   */
  hierarchicalEnforcement: boolean
  spans: Span[]
}

// ---------------------------------------------------------------------------
// Layer (Typed Envelope Pattern)
// ---------------------------------------------------------------------------

/** v1 widget type. Extend this union when adding new widget types. */
export type LayerType = 'form-diagram'

/** Union of all widget data payload types. */
export type LayerData = FormDiagramData
// Future: | EnergyContourData | InstrumentationData | WrittenAnalysisData

export interface Layer {
  id: string
  type: LayerType
  label: string
  description?: string | null
  visibility: boolean
  locked: boolean
  colorDefault: string   // Hex fallback for spans with no per-span color override
  displayOrder: number   // Lower = renders first (bottom); gaps allowed
  /**
   * Position relative to the timeline ruler.
   * Absent = use the widget's defaultPosition from the WidgetDefinition.
   * Absent widget default = 'above'.
   */
  position?: 'above' | 'below'
  /** Text rendering defaults for spans in this layer. */
  rendering?: LayerRenderingConfig
  data: LayerData
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
  artist: string[]                         // Array; single-artist: ["Avicii"]
  context?: AnalysisContext | null
  duration: number                         // Track duration, seconds (float)

  composer?: string | null                 // Shown when context = "performance"
  work?: string | null                     // E.g. "Op. 13"; enables cross-file corpus comparison
  derivativeOf?: DerivativeReference | null

  notes?: string | null
  bpm?: number | null
  timeSignature?: TimeSignature | null

  source: SourceReference

  project?: string | null
  analysisAuthor?: string | null

  vocabulary: Vocabulary
  sharedTimePoints: SharedTimePoint[]
  layers: Layer[]
  pointMarkers: PointMarker[]
}
