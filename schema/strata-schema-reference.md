# Strata File Format — Schema Reference

> This document explains what's inside a `.strata` file and what each field means.
> It is written for analysts and collaborators, not for programmers.
> The technical specification lives in `strata.schema.json` and `strata.types.ts`.

---

## What is a `.strata` file?

A `.strata` file is a plain text file in JSON format — the same format used by many web applications to store data. You can open it in any text editor and read it, though the Strata application is what makes it interactive.

Every `.strata` file contains everything needed to reproduce a complete music analysis: the link to the audio source, all formal sections (spans), all analytical events (point markers), all layer settings, and the vocabulary terms used. **The file is the analysis.** Nothing is stored on a server.

---

## File Structure Overview

A `.strata` file is organized into these main sections, in order:

```
.strata file
│
├── File metadata          (version numbers, timestamps)
├── Track identity         (title, artist, context, duration)
├── Derivative info        (when the track is a remix, cover, etc.)
├── Overview + grid        (notes, BPM, time signature)
├── Source reference       (YouTube URL or local filename + offset)
├── Corpus / author info   (project tag, analysis author)
├── Vocabulary             (custom type terms for this document)
├── Shared time points     (a shared pool of timestamps across all layers)
├── Layers                 (one or more analytical layers, each with spans)
└── Point markers          (single-moment events: flagged observations, MC, EEC, etc.)
```

---

## 1. Top-Level Document

These fields appear at the root of every `.strata` file.

### File Metadata

| Field | Type | Required | What it means |
|---|---|---|---|
| `strataVersion` | text | Yes | The version of the Strata app that created the file. Used for diagnosing compatibility issues. |
| `fileFormatVersion` | whole number | Yes | The schema version. Starts at 1. If the file format ever changes incompatibly, this number increments so the app knows how to read older files. |
| `createdAt` | timestamp | Yes | When the file was first saved. Set once; never updated. |
| `updatedAt` | timestamp | Yes | When the file was last saved. Updated on every save. |

### Track Identity

| Field | Type | Required | What it means |
|---|---|---|---|
| `title` | text | Yes | Display title of the track or recording. |
| `artist` | list of text | Yes | Performer or artist name(s). A list so that multi-artist tracks are stored cleanly — e.g. `["The Chainsmokers", "Halsey"]`. Single-artist tracks use a one-item list: `["Avicii"]`. |
| `context` | one of two values or null | No | `recording` (studio recording) or `performance` (live performance of a composed work). Optional — null if unspecified. Controls which additional fields appear in the UI: a `performance` context surfaces `composer` and `work`; a `recording` surfaces `derivativeOf` when relevant. Setting `context` before cross-corpus comparison ensures filters work correctly. |
| `duration` | decimal number | Yes | Track duration in seconds. Stored explicitly so span timestamps can be validated against the total length. |
| `composer` | text or null | No | Composer of the work. Only relevant when `context = performance`. Hidden in the UI for other contexts. |
| `work` | text or null | No | Composition identifier — e.g. `Piano Sonata Op. 13`. Enables cross-file corpus comparison of different performances of the same work. |

### Derivative Works

| Field | Type | Required | What it means |
|---|---|---|---|
| `derivativeOf` | object or null | No | When this track is derived from another (remix, cover, re-recording, arrangement), this field records the relationship. Null for original recordings. Contains two sub-fields: `sourceTrack` (the filename of the source analysis file, e.g. `heroes-original.strata`) and `relationship` (the nature of the connection). |

**`derivativeOf.relationship`** accepts any text, but suggested values are:
- `remix` — a remix of the source track
- `cover` — a cover performance of the same composition
- `rerecording` — the original artist re-recorded the same track
- `arrangement` — an arrangement for different instrumentation or context

> **Why not just a `remix` field?** Because the remix/cover/rerecording distinction belongs on a different dimension than `context`. `context` describes the nature of the artifact (studio recording, live performance). `derivativeOf` describes the relationship to another work. Separating them keeps both queryable independently.

### Overview and Grid Utility

| Field | Type | Required | What it means |
|---|---|---|---|
| `notes` | text or null | No | Document-level free text for the analyst. Methodological notes, analytical caveats, summary of findings. Not the same as the Written Analysis widget — this is a simple overview field, not timestamped prose. |
| `bpm` | decimal number or null | No | Beats per minute of the track. Used by the BPM grid utility to generate bar-level time points in the shared pool so span boundaries can snap to beats and bars. Null if not applicable or not set. For variable-tempo tracks, set the dominant BPM and adjust individual time points manually. |
| `timeSignature` | object or null | No | Time signature, used together with `bpm` to generate the BPM grid. Contains `numerator` (beats per measure, e.g. 4) and `denominator` (note value per beat, e.g. 4 for a quarter note). Null if not set. |

### Corpus / Author

| Field | Type | Required | What it means |
|---|---|---|---|
| `project` | text or null | No | A collection or corpus tag. Used by the Corpus Builder to group related files — e.g. `anthemics-edm-corpus`. |
| `analysisAuthor` | text or null | No | Who created this analysis. |

---

## 2. Source Reference

The `source` field describes where the audio comes from and how to align it with the analysis timestamps.

| Field | Type | Required | What it means |
|---|---|---|---|
| `type` | `youtube` or `local` | Yes | Whether this is a YouTube video or a local audio file. |
| `url` | text | When `type = youtube` | Full YouTube video URL. |
| `filename` | text | When `type = local` | Audio filename only (no folder path). The file must be present on the viewer's machine — local files cannot be shared. |
| `sourceOffset` | decimal number | Yes | The number of seconds between the start of the YouTube video (or audio file) and the true start of the recording. **All span timestamps are stored in recording time, not video time.** The app adds this offset automatically when seeking. Zero if the video starts exactly when the track starts. Positive if the video has a silent intro before the music begins. |

> **Example:** If a YouTube video has a 3-second intro before the track begins, `sourceOffset = 3.0`. A span at recording time 94.0s will seek the player to 97.0s. If the video is later replaced with a cleaner upload, only the URL and offset need to change — all span data is untouched.

---

## 3. Vocabulary

The `vocabulary` field stores custom type terms defined specifically for this document. All spans and point markers have a `type` field that draws from a controlled vocabulary — these custom terms extend the global built-in list.

The vocabulary is split into two lists:

| Field | What it contains | v1 UI? |
|---|---|---|
| `spanTypes` | Custom terms for span types (e.g. a custom section type used in this corpus) | Planned for v2 |
| `pointMarkerTypes` | Custom terms for point marker types (e.g. `medial-caesura`, `EEC`, `energy-peak`) | Yes — v1 |

### Vocabulary Term

Each term in either list has these fields:

| Field | Type | Required | What it means |
|---|---|---|---|
| `id` | text | Yes | The stable identifier used as the `type` value on spans and markers. Lowercase letters, numbers, and hyphens only. **Changing this ID breaks corpus queries against existing files.** |
| `label` | text | Yes | Human-readable display name shown in the type picker and UI. |
| `description` | text | No | Explanation of what this term means. Shown as a tooltip when the analyst is choosing a type. |
| `color` | hex color or null | No | Optional default color for spans or markers of this type. |

> **Example:** A Hepokoski/Darcy analyst would define `{ "id": "medial-caesura", "label": "Medial Caesura", "description": "The HC that divides the exposition..." }` in `pointMarkerTypes`. Every point marker in this document typed `medial-caesura` draws from this definition — including its display name and tooltip.

---

## 4. Shared Time Points

The `sharedTimePoints` field is a document-level pool of timestamps that all layers can contribute to and read from. It is the mechanism for cross-widget coordination.

| Field | Type | Required | What it means |
|---|---|---|---|
| `id` | UUID | Yes | Auto-generated unique identifier. |
| `timestamp` | decimal number | Yes | Position in recording time, seconds. |
| `label` | text or null | No | Optional human-readable label for this time point. |
| `sourceLayerId` | UUID or null | No | ID of the layer that contributed this time point, if any. |

> **Why this exists:** In BriFormer (the tool that most directly inspired Strata), each analytical layer is temporally independent — there is no way to share or sync timestamps across layers. Strata inverts this. When you place a span boundary in the form diagram, that timestamp goes into the shared pool. When you later open the energy contour widget, those boundaries are already available as snap targets without any manual import step.

---

## 5. Layers

The `layers` field is an ordered list of analytical layers. Each layer is one analytical view of the track — for example, one form diagram layer for large-scale form and a second for phrase-level form. A file can have multiple layers of the same type.

### Layer Envelope

Every layer, regardless of type, has these fields:

| Field | Type | Required | What it means |
|---|---|---|---|
| `id` | UUID | Yes | Auto-generated unique identifier. Never changes. |
| `type` | text | Yes | Widget type. `form-diagram` is the only type in v1. Future types: `energy-contour`, `instrumentation`, `written-analysis`. |
| `label` | text | Yes | Short human-readable name set by the analyst. Displayed in the layer panel. |
| `description` | text or null | No | Optional longer description of this layer's analytical purpose or framework — e.g. `Hepokoski/Darcy exposition analysis` or `Phrase-level hypermeter, 4-bar units`. Distinct from label: the label is the tab name; the description is the analytical context note shown on demand. |
| `visibility` | true/false | Yes | Whether this layer is shown in the editor and included in exports. |
| `locked` | true/false | Yes | When true, the layer cannot be edited — only viewed and exported. |
| `colorDefault` | hex color | Yes | Fallback color for all spans in this layer that have no individual color override. |
| `displayOrder` | whole number | Yes | Rendering order. Lower numbers render first (at the bottom of the stack). |
| `data` | object | Yes | The layer's actual analytical data. Its structure depends on the `type` field — see below. |

### Form Diagram Layer Data (`type = "form-diagram"`)

The `data` field for a form-diagram layer contains:

| Field | Type | Required | What it means |
|---|---|---|---|
| `hierarchicalEnforcement` | true/false | Yes | **Stale — unused by the app, kept for file compatibility.** Hierarchical enforcement was redefined (2026-06-22) as a cross-layer nesting constraint scoped to the form-diagram widget type, so it cannot live on one layer's data; the field will be relocated when that feature is built (see `docs/decisions.md`). Strata's default theoretical position is unchanged: overlapping analytical frameworks are valid, and the schema always allows overlapping spans. |
| `spans` | list of Span objects | Yes | All formal sections in this layer. See [Spans](#6-spans) below. |

---

## 6. Spans

A **span** is a time range that represents a formal section: a verse, a drop, a chorus, an exposition, a breakdown. Spans are the core analytical primitive of the entire system.

| Field | Type | Required | What it means |
|---|---|---|---|
| `id` | UUID | Yes | Auto-generated unique identifier. **Never changes, never shown to the user.** Used internally for merge tracking, inter-widget links, and the embeddable viewer. |
| `label` | text or null | No | Free text display name set by the analyst — what they call this section. Optional: null for unlabeled spans (e.g. bar-level hypermeter spans where the `type` field carries all the analytical meaning). Empty string is valid for a newly placed span awaiting a label. Examples: `Drop 1`, `THE DROP`, `Exposition`. |
| `shortLabel` | text or null | No | Optional analyst-authored abbreviation of `label` — e.g. `Verse 1` → `V1`, `Breakdown` → `Br`. Shown above the shape in place of the full label when the full label doesn't fit at the current zoom; never truncated further itself. There is no algorithmic abbreviation of above-shape labels — if neither `label` nor `shortLabel` fits, nothing renders (a small marker indicates a hidden label is present). |
| `slug` | text or null | No | Auto-generated from the label — e.g. `Drop 1` becomes `drop-1`. Used as a stable reference key in the embeddable viewer (`focus="drop-1"`) and in future inter-widget links. Null when no label is set. Uniqueness is determined by chronological position (startTime order), not creation order. |
| `startTime` | decimal number | Yes | Start of the span in recording time, seconds. |
| `endTime` | decimal number | Yes | End of the span in recording time, seconds. Must be greater than `startTime`. |
| `type` | vocabulary term ID or null | No | The corpus-queryable classification of this section — drawn from the global built-in list or from this document's `vocabulary.spanTypes`. Separate from `label` by design: an analyst can call a section `THE DROP` (label) while typing it as `drop` (type). The `type` field is what makes cross-corpus comparison possible. Null if no type has been assigned. |
| `color` | hex color or null | No | Per-span color override. Null means use the layer's `colorDefault`. |
| `annotation` | text or null | No | **Diagram-visible** text displayed on the span body alongside the label. For analytical observations the analyst wants to appear on the diagram itself — e.g. `filter sweep → snare roll`, `+Kick`, `Anthem gradually emerges`. Distinct from `notes` (tooltip only) and from `label` (the section name). Feeds into the Written Analysis widget when built. |
| `notes` | text or null | No | Short freetext observation about this span. **Tooltip-level only** — not rendered on the diagram. A few words to a sentence. |
| `lyrics` | text or null | No | Lyric text occurring during this span. Not displayed on the form diagram by default. Corpus-queryable. Feeds into the Written Analysis widget. |
| `confidence` | one of three values | No | The analyst's confidence in the placement of this span's **boundaries**. Optional — omit to mean `definite`. Only set explicitly when marking a span as `approximate` or `speculative`. See [Confidence Levels](#8-confidence-levels) below. |
| `startBoundaryType` | one of three values or null | No | The **character** of the formal transition at the start of this span. `definite` = hard, precise cut; `gradual` = the transition is inherently processual (a buildup that gradually becomes the section); `elided` = this span's start is formally simultaneous with the end of the preceding span. Null or omit to mean `definite`. See [Boundary Types](#9-boundary-types) below. |
| `endBoundaryType` | one of three values or null | No | The **character** of the formal transition at the end of this span. `elided` pairs with `startBoundaryType = elided` on the following span to mark a reciprocal elision. Null or omit to mean `definite`. |
| `parentId` | UUID or null | No | Optional reference to another span's ID. Expresses a hierarchical relationship — e.g. this span is a sub-section of another — without enforcing one in the data. Null if this span has no parent. |
| `mergedFrom` | list of UUIDs or null | No | When this span was created by merging two or more existing spans, this field records the IDs of the source spans. Allows future reference-resolution systems to trace a merged span back to its predecessors. Null for spans not produced by a merge. Always contains at least two IDs when present. |

### Why `id`, `label`, `slug`, and `type` are four separate fields

This is one of the most important design decisions in the schema:

| Field | Purpose | Who uses it |
|---|---|---|
| `id` | Internal, machine-readable identity | The app, internally. Never visible to the analyst. |
| `label` | Human-readable display name | The analyst sets this. Shown on the diagram. Can be anything. |
| `slug` | Stable human-readable reference key | The embeddable viewer (`focus="drop-1"`), inter-widget links. Set once from the label. |
| `type` | Corpus-queryable classification | The database, queries, and comparisons across files. Comes from a controlled vocabulary. |

An analyst can call a section `"THE DROP"` and classify it as type `drop`. Another analyst can call the same formal event `"Main Drop"` and classify it as type `drop`. Because both use the same `type`, a corpus query for `drop` sections finds both — even though the labels differ. **The `type` field is what makes Strata a corpus tool rather than a diagramming tool.**

### Why `annotation` and `notes` are two separate fields

| Field | Appears on | Appropriate for |
|---|---|---|
| `annotation` | The diagram, on the span body | Analytical observations important enough to appear in the diagram itself — process descriptions, textural notes, technique markers |
| `notes` | Tooltip (hover only) | Working notes, provisional observations, things to revisit |

The analyst controls which observations are diagram-level claims and which are working notes. Both are analytical; the difference is presentation.

---

## 7. Point Markers

A **point marker** is a single timestamp in the recording — a moment rather than a range. Point markers are stored at the document level, not inside any particular layer, because they represent events in the music itself. A medial caesura happens once in the recording and is relevant to every analytical framework that recognizes it.

| Field | Type | Required | What it means |
|---|---|---|---|
| `id` | UUID | Yes | Auto-generated unique identifier. Never shown to the user. |
| `timestamp` | decimal number | Yes | Position in recording time, seconds. |
| `label` | text or null | No | Free text display name. Shown on the timeline and in the metadata panel. |
| `type` | vocabulary term ID or null | No | Corpus-queryable classification. Drawn from global built-in point marker types or this document's `vocabulary.pointMarkerTypes`. For theoretically precise events, this is the key field — not the label. Examples: `medial-caesura`, `EEC`, `energy-peak`. Null for untyped observations. |
| `notes` | text or null | No | Longer freetext observation. Appropriate for analytical prose about a specific event. |
| `flagged` | true/false | No | `true` = "come back to this." A simple bookmark for moments the analyst wants to revisit. Separate from `confidence` — flagged means *I want to return here*, not *I am uncertain about this*. Omit for false (default). |
| `absent` | true/false | No | `true` = "this event was expected here and did not occur." Analytically significant in Hepokoski/Darcy and similar frameworks where a missing medial caesura or EEC has specific formal consequences. **No v1 UI** — the field is stored and preserved by the app but cannot be set from the interface in v1. Omit for false (default). |
| `confidence` | one of three values | No | `definite`, `approximate`, or `speculative`. Same meaning as on spans — the analyst's certainty about the identification and placement of this event. Omit for `definite` (default). |

### Two kinds of point markers

Point markers serve two distinct purposes that share a single data structure:

| Kind | Examples | How to identify |
|---|---|---|
| **Observational / personal flag** | "Something interesting happens here." "Come back to this." "Weird texture shift." | Usually has `type = null` and/or `flagged = true`. Low structure, high capture speed. |
| **Theoretically precise analytical event** | Medial caesura (MC), Essential Expositional Closure (EEC), energy peak, loop point | Has a specific `type` from the vocabulary. Corpus-queryable in the same rigorous sense as span types. The `absent` field makes these markers uniquely powerful — absence can be recorded, not just presence. |

---

## 8. Confidence Levels

Three confidence levels are used on both spans and point markers. **All three are optional — omitting the field implies `definite`.**

| Value | What it means | Rendered as |
|---|---|---|
| `definite` | The analyst is confident in this boundary or event identification. Default — no need to set this explicitly. | Solid border / solid line |
| `approximate` | The boundary is in roughly the right place but interpretively fuzzy — the analyst knows something is here but the exact location is uncertain. | Dashed border / dashed line |
| `speculative` | The analyst placed this as a hypothesis that may be revised. | Dashed + reduced opacity |

Confidence is an analytical claim, not a quality flag. A speculative span is not a mistake — it is an honest record of interpretive uncertainty.

**Important:** `confidence` is about the analyst's certainty *in where a boundary falls*, not about the character of the formal transition itself. For the latter, see [Boundary Types](#9-boundary-types) below.

---

## 9. Boundary Types

`startBoundaryType` and `endBoundaryType` on a span describe the **character of the formal transition** at that boundary — the kind of event that happens at the section edge in the music itself. This is distinct from `confidence` (which describes the analyst's certainty about where that boundary falls).

| Value | What it means | Example |
|---|---|---|
| `definite` | A hard, precise cut. The section begins or ends at a specific, unambiguous moment. Default — omit the field or set it to null to mean this. | A drop hit, a cutdown, an attack on beat 1 |
| `gradual` | The transition is inherently processual — the new section gradually emerges from the previous one. The analyst places the boundary where they judge the new section has "arrived," but the transition itself is a process. | A riser/buildup that gradually becomes the drop; a fade-in; a textural transformation |
| `elided` | This boundary is formally simultaneous with the boundary of the adjacent span. Two sections that would normally be separate are collapsed into one shared moment. | An elision in Hepokoski/Darcy analysis; an EDM drop that also functions as the start of an outro |

### How elision works

An elision is represented by **two adjacent spans both marking their shared boundary as `elided`**, combined with **overlapping timestamps**:

- Span A: `endBoundaryType = "elided"`, `endTime = 97.5`
- Span B: `startBoundaryType = "elided"`, `startTime = 96.0`

The overlapping timestamps encode the ambiguity of the shared moment. The renderer recognizes the pattern and draws the elision visual (an overlapping bracket at the boundary). This is not an error — it is the intended representation of a formal elision.

### The key distinction

| Concept | Field | Question it answers |
|---|---|---|
| **Confidence** | `confidence` | How certain am I about where this boundary falls? |
| **Boundary type** | `startBoundaryType` / `endBoundaryType` | What kind of formal transition is this in the music? |

A gradual boundary can be placed with high confidence — the analyst is sure the buildup becomes the drop at 0:54, even though the transition itself is gradual. A definite boundary can be placed with low confidence — the analyst believes there's a hard cut somewhere around 1:47 but isn't sure exactly where. These are orthogonal analytical claims.

---

## 10. Key Design Principles Encoded in the Schema

These are the theoretical commitments that shaped the schema's structure.

**Overlapping spans are valid.** The schema places no constraint on two spans occupying the same time range in the same layer. Hierarchical enforcement is an opt-in per-layer toggle, not a data model constraint. This reflects the reality of EDM and other repertoires where multiple formal frameworks apply simultaneously.

**The `type` field is the corpus key.** Labels are for humans; types are for queries. A corpus question like "in what percentage of my analyses does the first drop arrive after a build?" requires consistent `type` values across files, not consistent labels.

**Omission implies the default.** For optional fields, omitting the field is equivalent to the documented default: omitting `confidence` means `definite`; omitting `startBoundaryType` means `definite`; omitting `flagged` means `false`. This keeps files concise — analysts only write down what differs from the expected case.

**Point markers are document-level.** An MC or EEC is an event in the recording, not a property of one analytical layer. Storing them at the document level means they appear once, are visible across all layers, and don't require duplication.

**Boundary type is orthogonal to confidence.** A gradual transition can be placed with certainty; a hard cut can be placed with uncertainty. The schema encodes both as separate analytical claims rather than conflating them into a single visual style.

**Timestamps are recording time, always.** All `startTime`, `endTime`, and `timestamp` values are seconds from the true start of the recording, regardless of where that falls in the YouTube video. The `sourceOffset` in the source reference handles the translation to player time. This means span data is unchanged if the source video changes.

**The file is self-contained.** Everything needed to reconstruct the analysis — vocabulary definitions, layer settings, span data, point markers — is in the file. No server, no account, no external dependency.

---

*Schema version 1 — June 2026*
*Technical spec: `strata.schema.json` · TypeScript types: `strata.types.ts` · Example: `example.strata`*
