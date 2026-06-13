/**
 * Companion TypeScript types for the Strata .strata file format.
 *
 * These types mirror strata.schema.json exactly. When the schema changes,
 * update both files together and increment fileFormatVersion.
 *
 * These types become the Phase 1.2 deliverable: port to
 * src/types/strata.ts in the Vite project, where they are the living
 * schema specification for the entire application.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export type ConfidenceLevel = "definite" | "approximate" | "speculative";

export type AnalysisContext = "recording" | "performance";

export type SourceType = "youtube" | "local";

export type BoundaryType = "definite" | "gradual" | "elided";

// ---------------------------------------------------------------------------
// Source Reference
// ---------------------------------------------------------------------------

export interface SourceReference {
  type: SourceType;
  url?: string;      // Required when type = "youtube"
  filename?: string; // Required when type = "local"; not shareable
  /**
   * Offset in seconds between the source file's start and the recording's
   * true start.
   *
   * player_time = recording_time + sourceOffset
   *
   * Span timestamps always store recording time, never player time.
   * Updating this field corrects all seek behavior without touching span data.
   */
  sourceOffset: number;
}

// ---------------------------------------------------------------------------
// Derivative Reference
// ---------------------------------------------------------------------------

/**
 * Describes this track's relationship to a source track when it is a
 * derivative work (remix, cover, re-recording, arrangement, etc.).
 * Null on the parent field for original recordings.
 *
 * Suggested relationship values: "remix" | "cover" | "rerecording" | "arrangement"
 * Free text accepted — the list is not exhaustive.
 */
export interface DerivativeReference {
  sourceTrack: string;  // Filename of the source analysis, e.g. "heroes-original.strata"
  relationship: string;
}

// ---------------------------------------------------------------------------
// Time Signature
// ---------------------------------------------------------------------------

export interface TimeSignature {
  numerator: number;   // Beats per measure, e.g. 4 in common time
  denominator: number; // Note value per beat as power of 2, e.g. 4 = quarter note
}

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/**
 * A custom vocabulary term defined at the project level.
 * The id is used as the corpus-queryable value in span.type / pointMarker.type.
 * The label is the human-readable display name.
 */
export interface VocabTerm {
  /**
   * Stable identifier. Lowercase alphanumeric and hyphens; starts with
   * alphanumeric. Choose carefully — changing this ID breaks corpus queries
   * against existing files.
   */
  id: string;
  label: string;
  description?: string;
  color?: string | null; // Hex, e.g. "#4A90D9", or null for no type-level default
}

/**
 * Project-level custom vocabulary terms for a document.
 *
 * v1 UI support:
 * - pointMarkerTypes: full creation UI in v1 (required for classical scholars)
 * - spanTypes: schema present from v1; creation UI deferred to v2
 */
export interface Vocabulary {
  spanTypes: VocabTerm[];
  pointMarkerTypes: VocabTerm[];
}

// ---------------------------------------------------------------------------
// Shared Time Point Pool
// ---------------------------------------------------------------------------

/**
 * A timestamp in the document-level shared time point pool.
 *
 * Any widget layer can contribute timestamps to the pool; any widget can
 * snap to or reference any point in the pool regardless of what created it.
 * This is the explicit inversion of BriFormer's siloed-timeline architecture.
 */
export interface SharedTimePoint {
  id: string;        // UUID
  timestamp: number; // Recording time, seconds (float)
  label?: string | null;
  sourceLayerId?: string | null; // ID of the layer that contributed this point, for provenance
}

// ---------------------------------------------------------------------------
// Span
// ---------------------------------------------------------------------------

/**
 * A time span representing a formal section in a form-diagram layer.
 * The universal primitive of the Strata system.
 *
 * id / label / slug / type are four deliberately separate fields:
 * - id:    internal, stable, never shown
 * - label: free text, human display, can change; optional (null for unlabeled)
 * - slug:  auto-generated, stable human-readable reference key for inter-widget links
 * - type:  controlled vocabulary, corpus-queryable
 */
export interface Span {
  id: string;                             // UUID; never changes; used for all inter-widget references
  label?: string | null;                  // Optional display name; null for unlabeled spans (e.g. bar-level hypermeter)
  slug?: string | null;                   // Auto-generated from label; null until label is set; unique by startTime order
  startTime: number;                      // Recording time, seconds (float)
  endTime: number;                        // Recording time, seconds (float); must exceed startTime
  type?: string | null;                   // Vocabulary term ID; corpus-queryable
  color?: string | null;                  // Hex per-span override; null = use layer colorDefault
  annotation?: string | null;            // Diagram-visible text; analytical observations shown on span body
  notes?: string | null;                  // Tooltip-only; not rendered on the diagram
  lyrics?: string | null;                 // Lyric text; corpus-queryable; feeds Written Analysis widget
  confidence?: ConfidenceLevel;           // Omit for "definite" (default)
  startBoundaryType?: BoundaryType | null; // Omit or null for "definite" (default)
  endBoundaryType?: BoundaryType | null;  // Omit or null for "definite" (default)
  parentId?: string | null;              // UUID of parent span; hierarchical reference without enforcement
  mergedFrom?: string[] | null;          // Always >= 2 UUIDs when present
}

// ---------------------------------------------------------------------------
// Point Marker
// ---------------------------------------------------------------------------

/**
 * A single-timestamp analytical event. Document-level — not per-layer.
 *
 * Two distinct use cases share this type:
 * - Type A: observational flags ("come back to this", "something interesting here")
 * - Type B: theoretically precise events (medial caesura, EEC in H/D analysis)
 *
 * The type field handles the distinction: Type A markers often have type = null
 * or type = "note"; Type B markers carry a precise vocabulary term ID.
 */
export interface PointMarker {
  id: string;                   // UUID
  timestamp: number;            // Recording time, seconds (float)
  label?: string | null;
  type?: string | null;         // Vocabulary term ID; corpus-queryable
  notes?: string | null;
  flagged?: boolean;            // "Come back to this." Omit for false (default)
  absent?: boolean;             // "Expected event explicitly absent." No v1 UI. Omit for false (default)
  confidence?: ConfidenceLevel; // Omit for "definite" (default)
}

// ---------------------------------------------------------------------------
// Form Diagram Data (Widget Payload)
// ---------------------------------------------------------------------------

/**
 * Data payload for a form-diagram layer.
 * Contains only the spans that define formal sections.
 * Point markers are document-level (StrataDocument.pointMarkers) because they
 * are events in the recording — not properties of any particular analytical layer.
 */
export interface FormDiagramData {
  /**
   * Opt-in, per-layer toggle that prevents overlapping spans during editing.
   * NEVER the default — Strata's theoretical posture is that overlapping
   * frameworks are valid. Applied at the UI level only; the schema allows
   * overlapping spans regardless of this flag.
   */
  hierarchicalEnforcement: boolean;
  spans: Span[];
}

// ---------------------------------------------------------------------------
// Layer (Typed Envelope Pattern)
// ---------------------------------------------------------------------------

/**
 * v1 widget type. Future additions:
 * "energy-contour" | "instrumentation" | "written-analysis"
 *
 * When new types are added, extend this union AND add the corresponding
 * data interface to LayerData, then increment fileFormatVersion.
 */
export type LayerType = "form-diagram";

/**
 * Union of all widget data payload types.
 * The core schema says: "data is an object." The widget contract says:
 * "here is what that object contains for this layer type."
 */
export type LayerData = FormDiagramData;
// Future: | EnergyContourData | InstrumentationData | WrittenAnalysisData

/**
 * A widget layer instance.
 *
 * The typed envelope pattern: the core schema enforces the layer envelope
 * (all fields except data). The data field is defined by the widget type.
 * New widget types can be added without modifying the core schema.
 */
export interface Layer {
  id: string;                   // UUID; never changes
  type: LayerType;
  label: string;                // Short human-readable layer name
  description?: string | null;  // Optional analytical purpose or framework context for this layer
  visibility: boolean;          // Hidden layers are excluded from exports
  locked: boolean;              // When true, layer is read-only in the editor
  colorDefault: string;         // Hex fallback for spans with no per-span color override
  displayOrder: number;         // Render order; lower = renders first (bottom); gaps allowed
  data: LayerData;
}

// ---------------------------------------------------------------------------
// Top-Level Document
// ---------------------------------------------------------------------------

/**
 * A Strata music analysis document.
 *
 * The file format is the core invention of the Strata project.
 * This interface is the living specification — when it changes,
 * fileFormatVersion increments and a migration path is documented.
 */
export interface StrataDocument {
  strataVersion: string;     // Semver of the Strata app that wrote this file
  fileFormatVersion: number; // Schema version integer; starts at 1

  createdAt: string; // ISO 8601 timestamp; set once on first save
  updatedAt: string; // ISO 8601 timestamp; updated on every save

  // Track / recording identity
  title: string;
  artist: string[];                         // Array; single-artist: ["Avicii"]
  context?: AnalysisContext | null;         // Optional; encourage before cross-corpus use
  duration: number;                         // Track duration, seconds (float)

  // Context-conditional fields (surfaced in UI based on context)
  composer?: string | null;                 // Shown when context = "performance"
  work?: string | null;                     // E.g. "Op. 13"; enables cross-file corpus comparison
  derivativeOf?: DerivativeReference | null; // Replaces sourceTrack; null for originals

  // Document-level overview and grid utility
  notes?: string | null;                    // Methodological notes, analytical caveats, summary
  bpm?: number | null;
  timeSignature?: TimeSignature | null;

  // Audio/video source
  source: SourceReference;

  // Corpus / collection
  project?: string | null;
  analysisAuthor?: string | null;

  // Vocabulary — project-level custom terms
  vocabulary: Vocabulary;

  // Document-level shared time point pool
  sharedTimePoints: SharedTimePoint[];

  // Widget layer instances
  layers: Layer[];

  /**
   * Document-level point markers.
   *
   * Point markers are events in the recording — a medial caesura, an energy
   * peak, a flagged observation. They exist independently of any analytical
   * layer: an MC happens once in the music and is visible across all layers
   * and widgets without duplication. The timeline ruler renders all point
   * markers regardless of layer visibility.
   */
  pointMarkers: PointMarker[];
}
