# Strata
## A Modular Music Analysis Tool

*Project Vision & Architectural Guiding Document*
*Working Title — v0.5 Draft — June 2026*

> **Status (2026-10-03):** this vision was written in May–June 2026, before the code, and is kept as the statement of intent. For what Strata does today, see the README, `schema/` and `widgets/`. Where this document and `docs/decisions.md` disagree, the decisions log is binding.

---

## 1. Project Vision

> **What Strata actually is:** a tool for layered time span analysis that produces structured, queryable, comparable data — enabling scholars to build corpora and interrogate interpretive analytical observations across tracks, performances, and repertoires. This capability does not currently exist in the field. Existing tools produce display artifacts. Strata produces data.

Strata is a web-based, open-source music analysis tool built around a unified analysis document. At its core, it lets an analyst link a YouTube video (or upload a local audio file), then build layered analytical views — called widgets — that are all synchronized to the same playback timeline and saved into a single portable file.

The name Strata reflects the central design metaphor: analysis is not a single flat view but a set of interpretive layers, each illuminating something different about the same piece of music. A form diagram, an intensity curve, an instrumentation map, a written timestamped commentary — these are all strata of the same analytical object.

Existing tools in this space produce form diagram visualizations synced to audio. Strata is inspired by this work but departs significantly in architecture: where existing tools are single-purpose and siloed, Strata is a modular container. Where existing tools enforce hierarchical or non-overlapping formal constraints, Strata is flexible. Where existing tools produce display artifacts, Strata produces queryable scholarly data.

EDM scholarship is the origin and the stress test for this architecture — its formal complexity, overlapping frameworks, and energy-driven structures pushed every design decision toward generality. But the underlying capability — layered time span analysis producing structured comparable data — applies to any repertoire that benefits from timestamp-anchored interpretive analysis. EDM made the tool correct. Music theory at large is the actual audience.

> **The central insight:** the analysis IS the data. When a scholar marks a section boundary, names it, and assigns it a formal type, they are not just annotating a diagram — they are creating a structured, queryable record. Strata is built to make that record first-class.

### 1.1 The Problem Being Solved

Music theory scholarship currently has no good tool for building structured, queryable corpora of interpretive formal analysis. Field research with a cohort of music theorists and scholars confirms the gap: corpus tracking lives overwhelmingly in spreadsheets, with some scholars maintaining massive multi-tab spreadsheets tracking listening history, recording notes, and observations across hundreds of analyses. The need is real and unmet.

> **Strata is a vertical tool, not a horizontal one.** General-purpose tools — Airtable, Notion, even well-structured spreadsheets — can capture the "I want to track everything about my listening" use case. Strata's differentiator is that it knows what a span is, what a section boundary means, what a confidence level is. It is a replacement for the pile of timestamped notes and form diagrams a scholar produces *during* close analytical listening, not a replacement for a personal music library tracker.

The existing landscape:

- **Desktop form diagram tools** — do not run well on modern computers, no web access, no YouTube integration, single-layer diagrams only.
- **Web-based form diagram tools** — good UX for traditional form analysis, but siloed from each other, no overlapping sections, limited customization, no cross-widget data sharing, no corpus analysis capability.
- **Symbolic notation corpus tools** — powerful but require symbolically encoded notation (MusicXML, MEI, etc.). Cannot capture interpretive observations. Not accessible to non-technical scholars.
- **Spreadsheets and Word documents** — where most corpus tracking actually lives. Queryable only by manual re-interrogation. Cannot capture nuance or relationships between observations.

Strata addresses the gap between these extremes: a tool accessible to non-technical scholars that produces data structured enough for genuine corpus analysis.

### 1.2 The Motivating User Story

> A Bach scholar posts on Bluesky about a new feature he wants to track across his binary form corpus. He is annoyed that he has to go back through every analysis manually to check whether this feature exists — and then, once he knows it exists, go back through again under different conditions. His corpus probably lives in a spreadsheet or a Word document. The tool that would help him does not exist yet.
>
> Strata is that tool. When he marks a formal section, assigns it a type from a controlled vocabulary, and records its metadata, he is building a queryable record. The question "does this cadential pattern only appear in major-key sections?" becomes answerable without re-reading every analysis. The question "in what percentage of my corpus does this feature appear in the first reprise vs. the second?" becomes answerable from a single query. The payoff is not just saving time — it is enabling observations that are currently too taxing to make at all.

### 1.3 Open Source Philosophy

Strata is intended to be open source from the beginning, with a permissive license (MIT). The minimum viable posture is: publish the code on GitHub, document the file format, and let people fork it. No formal governance structure is required for v1.

The longer-term vision is to invite collaboration from the music theory community — ideally with institutional support from the Society for Music Theory or similar bodies — but this is a goal, not a precondition. The tool should be useful and publishable as a solo scholarly contribution before any community infrastructure exists.

Because the tool will be largely AI-assisted (vibe-coded), the codebase will not be architecturally pristine. This is acceptable. The scholarly value is in what the tool enables, not in code elegance. The file format being open and documented means the data can survive a future rewrite even if the initial code does not.

> **On AI-assisted development:** AI isn't doing the thinking — it's lowering the barrier to build niche tools that let you do the thinking. Historically, building a tool like this required either knowing enough to code, getting a grant, or funding a developer out of pocket. AI-assisted development is a structural change to that barrier, and that is a good thing for scholarship.

### 1.4 Strata as Commons Infrastructure

Strata is better understood as **commons infrastructure** than as a platform or an app. The analogy is civic infrastructure — a road, a public library — rather than a commercial platform. The goal is something useful enough that the community maintains it collectively because it's genuinely theirs.

> **The real invention** is the `.strata` file format and the widget contract. The form diagram widget is the proof of concept. The corpus manager is the feature that makes scholars realize what they've been missing. But the format and the contract are what could make Strata something future music analysis tools build *on* rather than *around*.

**Anti-enshittification by design.** The architecture is structurally resistant to platform capture almost by accident:
- Open JSON format, documented, human-readable
- No server dependency for the core tool
- No accounts required
- Data is always already the scholar's — no export tax, no lock-in mechanism
- Anyone can build an alternative Library because the file format is open

The ethical concern about platform capture is addressed not through policy or promises but through technical reality baked into the architecture. Platform enshittification requires control over the pipes. Strata deliberately does not control the pipes.

**Stewardship over ownership.** The right relationship to this project is steward, not owner: build it, document it, open source it under a GitHub organization not tied to a personal account, and find the right community home. Success is the community adopting and maintaining it — not growth metrics.

### 1.5 Launch Strategy — Demo Corpus

Strata ships its official release with a pre-built demo corpus of ten to fifteen fully annotated analyses. Ideally covering tracks meaningful to both target communities (EDM and common-practice). The demo corpus serves multiple purposes:

- Shows corpus querying working live on real musical data scholars recognize
- Demonstrates the vocabulary system and span types in practice, not in the abstract
- Solves the cold-start problem for community adoption — the tool arrives with content
- Positions the creator as the first scholar publishing with Strata, not just building it

The Anthemics EDM corpus is the natural seed for the EDM portion of the demo.

> The epistemic leap — from "interesting tool" to "this changes what scholarship can do" — happens not through feature descriptions but through a working demonstration on real music.

---

## 2. Core Architecture

### 2.1 The Analysis Document

The fundamental unit of Strata is the analysis document — a single JSON file (with a custom extension, `.strata`) that contains all analytical data for one track or recording. The file format is the core invention. Everything else — the editor UI, the widget system, the library — is downstream of getting this right.

The file is portable, self-contained, and human-readable. A scholar can open it in a text editor and understand roughly what it contains. It can be shared as a standalone artifact without requiring the Strata application to be installed — though the application is needed to edit or render it interactively.

### 2.2 Three Components

The project has three distinct components with different backends, timelines, and priorities:

| Component | What It Is | Backend | Timeline |
|---|---|---|---|
| **Analysis Tool** | Web app, client-side, produces `.strata` files | None | v1 |
| **Corpus Builder** | Companion app, organizes `.strata` + MEI files, personal Supabase backend | Supabase (personal) | v2 |
| **Library** | Server-backed, community sharing, collective corpus queries | Yes | Pie in the sky — may never be built |

> **Critical rule:** do not conflate these. Build the Analysis Tool first. The Corpus Builder is a second product, not a second mode.

The **Analysis Tool** is a single-file editor. It runs entirely client-side in a browser. No accounts, no server, no database. You open a YouTube URL, build your layers, save and export a `.strata` file. Save/load is a v1 requirement — serialize the full document to JSON and download as `.strata`; load via file picker. This is the core tool.

The **Corpus Builder** is a separate companion application that consumes `.strata` files (and MEI files) and provides organization, querying, and extensibility for corpus-scale scholarly work. It spins up a personal Supabase project for the scholar — their data lives in their own database, under their own keys. See Section 8 for full description.

The **Library** is where analyses are shared publicly, browsed, voted on, and commented on. It is explicitly deprioritized — the Analysis Tool and Corpus Builder together constitute a complete scholarly tool without it. May never be built.

### 2.3 The Widget System

Widgets are the modular analytical views that plug into the shared timeline. Each widget renders its own panel but all widgets share the same playback axis and respond to the same current-time signal from the YouTube player.

Each widget type defines a contract:

- A **data schema** — what does its layer data look like in the file?
- A **render component** — given layer data and current playback time, what gets drawn?
- An **edit component** — how does the user create and modify entries in this layer?
- A **timeline presence** — does it draw anything on the shared horizontal axis?
- An **export definition** — what formats does this widget support, and what function produces each blob?

Built-in widget types for v1: Form Diagram and Written Analysis (added 2026-09-27; see 6.4). Additional types (Energy Contour, Instrumentation/Layer Map) are planned but not required for v1. See Section 6 for the full widget roadmap and the analytical rationale for the three-widget stack. Third-party widgets can be implemented by anyone as long as they conform to the widget contract.

### 2.4 The Shared Timeline Axis

The horizontal ruler showing full track duration with a playback cursor is the glue of the entire system. Every widget subscribes to the current playback time. The YouTube IFrame API provides current time continuously. This signal is passed to all mounted widgets.

Widgets can both display their data aligned to the timeline and optionally respond when the cursor moves (e.g., highlighting the section the cursor is currently inside, surfacing the relevant written analysis block).

**DAW-style cursor following** is a core behavior of the shared timeline axis, not something individual widgets implement. When the playback cursor reaches approximately 80% of the visible area, the timeline scrolls to keep it in frame. This is standard in video editors and DAWs, and it directly fixes BriFormer's primary UX failure (zoom in, lose the cursor).

### 2.5 Inter-Widget Data

A key design goal — not for v1 but designed in from the start — is that widgets can read data from other widgets. The form diagram is the most important source widget: it defines time spans that other widgets can reference. A written analysis block can say "I belong to the span with id X" and surface itself when the playback cursor enters that span.

The data model must support this from day one even if the UI for it is not built until later. Span IDs (see Section 3) are the mechanism.

> **Design principle:** seed the architecture for inter-widget data, but do not build the vines in v1. The file format supports relationships between layers. The reactive cross-widget behavior is a v2+ feature.

### 2.6 The Shared Time Point Pool

Time points are a **document-level resource**, not owned by any individual widget. A shared pool of timestamps lives at the top level of the analysis document. Any widget can contribute time points to that pool, and any widget can snap to or reference any point in the pool regardless of what created it.

This resolves three problems simultaneously:

- **Workflow-agnostic entry**: it doesn't matter which widget the analyst opens first. Time points created in the form diagram are immediately available in the energy contour widget, and vice versa. No import step, no rebuild.
- **Granularity mismatch**: if a form diagram uses coarse section boundaries (verse, chorus, drop), the analyst can add finer time points directly from the energy contour widget without touching the form diagram. Those points are still available to the form diagram if the analyst later wants to subdivide.
- **BPM grid generation**: a BPM-aware grid utility writes bar-level time points into the shared pool. Both the form diagram and the energy contour widget immediately have access to that grid as snap targets. This is more useful than a metronomic grid computed per-widget because it survives tempo changes and added measures — the analyst corrects the pool, and all widgets benefit.

**v1 implementation:** a flat array of timestamps at the document level that widgets read from. Live reactivity (moving a point in one widget updates it everywhere) is v2 complexity, but the data architecture supports it from day one.

> **Architectural note:** this decision was informed by painful experience with BriFormer's siloed widget architecture, in which each layer is temporally independent and there is no mechanism for cross-widget time point sharing. The shared pool is the explicit inversion of that pattern.

---

## 3. Data Model

> **Authoritative source:** the formal schema in `schema/` (`strata.schema.json`, mirrored by the TypeScript types in `src/types/strata.ts`) is the source of truth for the data model, and `schema/strata-schema-reference.md` explains it field by field. This section was reconciled with the schema on 2026-11-23, for file format 2. It lists the fields at the level of intent. For every field and its exact rules, read the schema.

### 3.1 File-Level Metadata

Every analysis document stores the following at the top level. Optional fields may be null or left out. The schema includes them so that a file never needs to be migrated to gain them.

| Field | Required | Notes |
|---|---|---|
| `strataVersion` | Yes | Version of the app that wrote this file. Used to diagnose compatibility problems. |
| `fileFormatVersion` | Yes | Integer, 2 at present. It goes up only when the meaning of existing data changes. Strata upgrades an older file when you open it, one step at a time. |
| `createdAt` | Yes | ISO timestamp, set on the first save. |
| `updatedAt` | Yes | ISO timestamp, updated on every save. |
| `title` | Yes | Display title of the track or recording. |
| `artist` | Yes | A list of names, so that a collaboration needs no special case. It may be empty while an analysis is in progress. |
| `duration` | Yes | Track length in seconds (float). Stored explicitly, so that span times can be checked against it. |
| `source` | Yes | The audio or video: `type` (`youtube` or `local`), the YouTube `url` or the local `filename`, and `sourceOffset`. See §3.6. |
| `vocabulary` | Yes | The types this file defines beyond the built-in ones: `spanTypes`, `pointMarkerTypes`, and `modes`. See §3.5. |
| `layers` | Yes | The analytical layers. See §3.2. |
| `pointMarkers` | Yes | The document's single-moment events. See §3.4. |
| `context` | Optional | `recording` (studio) or `performance` (live). Null if unspecified. A performance shows the composer field. |
| `composer` | Optional | Shown when context is `performance`. |
| `work` | Optional | The composition (e.g. "Piano Sonata Op. 13"). Lets you compare performances of the same work across files. It is also the only link between a `.strata` file and an MEI score. |
| `derivativeOf` | Optional | For a remix, cover, re-recording, or arrangement: the source track's analysis file and the relationship. |
| `notes` | Optional | Document-level text: method, caveats, a summary of findings. Commentary tied to the timeline lives in a written-analysis layer instead. |
| `bpm`, `timeSignature` | Optional | The starting tempo and meter, used to set up a beat grid. |
| `beatGrid` | Optional | Bars and beats, as segments with one tempo and meter each. Beats are computed from the segments, never stored. |
| `homeKey` | Optional | The tonic and mode. Key areas and harmonic contexts are written relative to it, as Roman numerals. |
| `project` | Optional | A corpus or collection tag. Strata stores it and does nothing else with it. |
| `analysisAuthor` | Optional | Who made the analysis. |
| `showCadenceCaptions` | Optional | Whether cadence captions show on the diagram. Absent means shown. |

### 3.2 The Layer

The file holds a list of layers. Each layer is one widget instance. A file can have several layers of the same type, such as two form-diagram layers that apply different analytical frameworks to the same passage.

| Field | Required | Notes |
|---|---|---|
| `id` | Yes | UUID, generated once. Never changes. |
| `type` | Yes | The widget type: `form-diagram` or `written-analysis` today. A reader that meets a type it doesn't know keeps the layer unchanged. |
| `label` | Yes | The layer's name, set by the analyst. |
| `description` | Optional | A longer statement of the layer's framework, e.g. "Hepokoski/Darcy exposition analysis". |
| `visibility` | Yes | Shown or hidden. Hidden layers are left out of exports. |
| `locked` | Yes | A locked layer can be viewed and exported, but not edited. |
| `fillColorDefault`, `strokeColorDefault` | Yes | The fill and outline for spans that set no color of their own: a hex color, or `none`. |
| `displayOrder` | Yes | Drawing order, lowest first. Gaps are allowed. |
| `data` | Yes | The widget's own payload. Its shape depends on `type`. |
| `library` | Optional | The vocabulary library the layer draws its types from. The Type picker leads with it, but it restricts nothing. |
| `rendering`, `fontScale`, `spanShape` | Optional | How the layer's text and spans are drawn: label and annotation placement, text size (S, M, L), and brackets or thin bars. Visual only. |
| `fillGaps` | Optional | Whether a boundary placed in an empty stretch fills it on both sides. Absent means yes. |
| `position` | Optional | Reserved for drawing a layer below the ruler. |

A form-diagram layer's `data` holds its `spans`. A written-analysis layer's `data` holds `blocks` of Markdown commentary. Each block is anchored to a span by its id, or to a stretch of time. If you delete the span, its commentary becomes anchored to a stretch of time, so you never lose the text.

> **Typed envelope pattern:** the core schema fixes the frame around every layer (the fields above). The `data` field is a payload whose shape the widget type defines. This keeps the core schema stable: a new widget type can define its own data without a change to the core.

### 3.3 The Span: Core Primitive

Time spans are the universal primitive of the system. Every widget either defines spans, decorates them, or both.

> **DECISION: Timestamps are stored as seconds (float), not HH:MM:SS strings.**
> Rationale: seconds are what the YouTube API provides, what arithmetic requires, and what is unambiguous. Display formatting (turning 94.3 into 1:34) is a rendering concern, not a storage concern. Times are stored in recording time; the source's `sourceOffset` converts them to player time (§3.6).

Spans may overlap across layers, never within one. Gaps within a layer are allowed. A span records:

| Field | Required | Notes |
|---|---|---|
| `id` | Yes | UUID, generated on creation. Never changes and is never shown to the analyst. Every reference between spans, commentary, and merges uses it. |
| `startTime`, `endTime` | Yes | Seconds, in recording time. The end must come after the start. |
| `label` | Optional | What the analyst calls the section. Null for unlabeled spans, such as bar-level hypermeter spans whose type carries the meaning. |
| `shortLabel` | Optional | An abbreviation the analyst writes ("Verse 1" → "V1"), shown when the full label doesn't fit. |
| `slug` | Optional | Generated from the label ("Drop 1" → `drop-1`). Commentary links (`[[drop-1]]`) and embeds use it. Unique across the document, shared with point-marker slugs, and fixed once the file is saved. |
| `type` | Optional | A vocabulary term id (e.g. `drop`, `medial-caesura`): the field a corpus query reads. Separate from the label. |
| `annotation` | Optional | Text drawn on the span beside the label, e.g. "filter sweep → snare roll". |
| `notes` | Optional | The analyst's working note. Shown only in the Inspector, never on the diagram or in exports. |
| `lyrics` | Optional | Lyric text sung during the span. Shown with the span's commentary, not on the diagram. |
| `keyArea` | Optional | Conventionally a Roman numeral relative to the home key (e.g. `vi`, `V/V`). Drawn as a caption across the span. |
| `startBoundaryType`, `endBoundaryType` | Optional | The character of each boundary: `definite` (a clean cut, and the default), `gradual` (a processual transition), or `elided` (formally simultaneous with the neighboring boundary). An analytical claim, marked per side. |
| `parentId` | Optional | The span on another layer that this one belongs to, e.g. this phrase belongs to that section. Group and Copy to layer set it. Nothing enforces that a child lies inside its parent. |
| `mergedFrom` | Optional | The ids of the spans a merge made this one from, in time order. |
| `fillColor`, `strokeColor` | Optional | Per-span fill and outline: a hex color, `none`, or null for the layer's default. |
| `startCap`, `endCap`, `lineStyle`, `fillPattern`, `endOnTop` | Optional | How the bracket is drawn: each end's cap, a solid or dashed line, a faint fill texture, and which bracket sits on top at an elision. A drawing choice, separate from the boundary types. |

> **Label, type, and slug:** the label is for people (display). The type is for queries (corpus analysis). The slug is the stable, readable name that links use. These are three distinct fields, and they must stay separate.

> **Boundaries, not confidence:** the first drafts gave each span a `confidence` field (`definite`, `approximate`, or `speculative`). Format 2 removed it: nothing drew or queried it. The boundary types, which describe the music rather than the analyst's certainty, stay.

### 3.4 Point Markers

Besides spans, the timeline holds point markers: single-moment events. They are not sections; they are moments. They belong to the document, not to a layer, so they show across all layers.

There are two meaningfully different kinds of point markers, and the data model serves both:

**Type A: observational or personal flags.**
"This is interesting." "Come back to this." "Something weird happens here." Low structure, high capture speed. Queryable only loosely (e.g., "show me all flagged moments"). Closer to a research breadcrumb than a formal analytical observation.

**Type B: theoretically precise analytical events.**
The medial caesura (MC) and essential expositional closure (EEC) in Hepokoski/Darcy sonata-form analysis. These are not casual observations. They are theoretically loaded, analytically precise, and *queryable in the same rigorous sense as span types*. The presence or absence of these events is analytically significant.

Point-marker types draw from the same vocabulary system as span types (§3.5). A cadence, a Sonata Theory event, or a key change is a built-in point-marker type.

> **Recording an absence:** in Hepokoski/Darcy analysis, a *missing* medial caesura is itself analytically significant: it has specific formal consequences. A marker's `absent` field records "this event was expected here and did not occur", and its caption is drawn struck through.

| Field | Required | Notes |
|---|---|---|
| `id` | Yes | UUID. Never shown to the analyst. |
| `timestamp` | Yes | Seconds, in recording time. |
| `label` | Optional | Display text. |
| `slug` | Optional | The name commentary links use. Shares one namespace with span slugs. |
| `type` | Optional | A vocabulary term id. Queryable, and separate from the label. |
| `harmonicContext` | Optional | Conventionally a Roman numeral relative to the home key. A caption joins it to the type as `V:PAC`. |
| `notes` | Optional | A longer observation. |
| `flagged` | Optional | "Come back to this." Absent means false. |
| `absent` | Optional | "This event was expected and did not occur." Absent means false. |
| `kind` | Optional | A preset that picks which fields the marker's panel leads with: `cadence`, `key-change`, `tempo-change`, `flag`, or `other`. It never restricts what a marker holds. |

### 3.5 The Vocabulary System

A span's or marker's `type` draws from a controlled vocabulary. A file stores only term ids. A query therefore never depends on which list the analyst picked a term from. The vocabulary has three levels:

- **Built-in terms** ship with the app, grouped into libraries (General, Pop/Rock, Song form, EDM, Common practice, Jazz, and Form letters) and optional packs you switch on, such as Caplin formal functions or Sonata Theory. A term has one id and one meaning wherever it is listed. Its `broader` terms let a query roll it up: a search for all transitions also finds a Caplin transition.
- **A file's own terms** are defined by the analyst and stored in the file's `vocabulary`, as span types, point-marker types, or modes. Form letters are made on demand (`a-section`, `a-prime`, `a-double-prime`), not listed.
- **Shared vocabularies** are named, versioned packs anyone can adopt: "Common Practice Sonata Form v1", "EDM Club Track v1". When you adopt one, your corpus becomes comparable with anyone else's who uses it. Packs are `.vocab.json` files, imported and exported with no central server. Imported terms are copied into the file with their `source`, so the file never depends on the pack to open.

> **DECISION: v1 ships all three levels.** The first draft deferred a file's own types to v2 and community vocabularies to v3. Phase 0.6 brought both into v1: classical and common-practice analysts need terms such as `medial-caesura` and `EEC` at launch, and without them the tool is unusable for that audience (`docs/decisions.md`, "v1 Feature Scope").

### 3.6 Source and Time

`source` names the audio or video and carries its `sourceOffset`, the gap in seconds between the start of the source and the true start of the recording: player time = recording time + `sourceOffset`. Every time in the file is stored in recording time. If you correct the offset, every seek corrects with it, and no span changes. A YouTube source can be shared. A local file is named only by its filename, so it must be present on the viewer's machine.

---

## 4. The Form Diagram Widget (v1 Scope)

The form diagram widget is widget v1.0 and the proof of concept for the entire system. It is the most immediately useful for the analyst's own scholarship, the most direct replacement for BriFormer, and — critically — the data spine of the system that other widgets will reference.

### 4.1 Key Differences from Existing Tools

| Feature | Existing Tools | Strata |
|---|---|---|
| Overlapping sections | Not allowed | Supported — toggle between hierarchical and non-hierarchical mode |
| Multiple frameworks | One form layer | Multiple form layers simultaneously — each its own analytical lens |
| Section types | Built-in list | Controlled vocabulary, user-extensible |
| Text customization | Limited | Global font size settings, per-span label positioning |
| Confidence flag | No | Yes — definite / approximate / speculative |
| Cross-widget data | Not applicable | Span IDs support import by other widgets |
| File format | Proprietary | Open JSON with documented schema |

### 4.2 Rendering Approach

SVG or canvas with draggable, resizable section blocks. React is the framework. The data model stores spans as start/end timestamps with no positional constraints — whether spans overlap is a data fact, not a data integrity violation. The renderer handles layout: overlapping spans within a layer stack vertically. The user can choose rendering mode (hierarchical display vs. free overlap display) without changing the underlying data.

### 4.3 Overlapping Sections: The Design Rationale

> The non-overlapping constraint common in existing tools was almost certainly made to reduce rendering complexity and enforce clean hierarchical thinking. It is the right choice for traditional Western common-practice analysis. It is the wrong choice for EDM analysis, where multiple formal frameworks apply simultaneously and section boundaries are often genuinely ambiguous or overlapping.
>
> Strata's solution: the data model allows overlapping spans from day one. The UI offers a "hierarchical mode" toggle that enforces non-overlapping constraints at the editing level for analysts who prefer that constraint. The underlying data is the same either way.

### 4.4 Two Solutions for Two Scholarly Traditions

Strata serves both EDM scholars (who need simultaneous non-hierarchical frameworks) and classical/common-practice scholars (who expect and sometimes require hierarchical analytical depth). These are not competing demands; they are served by different widgets.

| Scholarly tradition | Strata solution |
|---|---|
| EDM — simultaneous, overlapping formal frameworks | Multiple independent form diagram layers, each its own analytical lens |
| Classical — hierarchical analysis with nested observations | One form diagram layer + written analysis widget with prose references to span and point marker IDs |

An EDM analysis file will typically have two or three form layers and no written analysis widget. A sonata form analysis file will typically have one form layer plus a written analysis widget that creates analytical depth through reference. Both coexist in the same architecture without compromise.

### 4.5 Form Diagram Editor — Interaction Model

Span boundaries are placed and adjusted through a layered interaction model designed around the correction workflow:

- **B** — places a boundary at the current playback timestamp. This is the primary capture gesture during a listening pass. (Spacebar until 2026-10-01; Space now plays and pauses.)
- **Arrow keys** — nudge the selected boundary by small increments (approximately one video frame). This addresses the most common correction case: a boundary placed slightly early or late.
- **Boundary drag** — drag a boundary handle for larger adjustments. Hard-stops at adjacent boundaries; a boundary cannot be dragged through a neighboring span. Spans have a minimum enforced width to prevent accidental collapse.
- **Merge** — an explicit action (not a drag consequence) that combines two or more consecutive spans. See merge design below.

All three correction mechanisms — nudge, drag, merge — operate on a *selected boundary*, not on a whole span. Whole-span dragging is not implemented.

### 4.6 The Hierarchical Enforcement Toggle

> *Redefined 2026-06-22 (see `docs/decisions.md` → the hierarchical enforcement
> reversal entry). An earlier version of this section described a weaker,
> per-layer constraint (preventing overlap within a single layer); that
> definition is superseded.*

Strata's default is non-hierarchical: overlapping spans are valid data, and no constraint is enforced at the editing level. This is itself a theoretical statement — made transparently, not silently. BriFormer's non-overlapping constraint is also a theoretical statement, but it presents itself as a neutral default. Strata inverts the assumption and names it.

For analysts whose theoretical commitments require hierarchical thinking — Schenkerian analysis being the clearest example — a **hierarchical enforcement toggle** is available as an opt-in setting. When enabled, it constrains the relationship *between* layers: **cross-layer nesting**. A span must nest within the boundaries a coarser layer has already established — it cannot cross a coarser layer's boundary.

**The formal rule:** layers order by analytical grain — bottom = finest subdivisions, top = coarsest (matching the macro-on-top render order). Each layer's boundary set must be a **superset** of the layer above it: finer layers may add boundaries (subdivide) but must keep every boundary the coarser layer has. Nesting is inclusive — a child span may be coextensive with its parent (the same span appearing at every level is valid).

**Design requirements for this toggle:**
- Opt-in only. Never the default.
- Scoped to the **form-diagram widget type** — not per-layer (a relationship between layers cannot live on one layer's data) and not per-document (the planned instrumentation widget is inherently non-hierarchical, so a document-wide flag would be wrong).
- Activating it presents a warning that explains what functionality is being given up and asks for confirmation. The warning is not punitive — it is informational. The analyst may have excellent reasons to want this constraint.
- Intentionally strict. The demandingness of the constraint is part of the design: off-by-default is the theoretical statement, and the strictness dissuades casual use.
- The underlying data model does not change. Hierarchical enforcement is a UI editing constraint, not a schema constraint. A file authored under the constraint is identical in format to one authored without it.

**The design philosophy:** analysts who believe deeply that music is hierarchical are welcome to enforce that constraint on themselves. The tool makes the cost of that constraint explicit rather than hiding it. If a scholar turns on hierarchical enforcement and finds they can represent everything they need to represent — the tool has served them. If they find themselves unable to represent something analytically true — the tool has made an argument more effectively than any paper could.

---

## 5. User Stories by Audience

### 5.1 EDM Scholar / Analyst (Primary)

- I want to apply multiple simultaneous formal frameworks to a track — one layer for large-scale sectional form, one for phrase-level form, one tracking anthem emergence — and see all of them at once on the same timeline.
- I want to mark section boundaries that are genuinely ambiguous and flag them as approximate rather than definite.
- I want to draw sections that overlap because the formal reality of this music is not cleanly hierarchical.
- I want to link a YouTube video so my analysis is shareable with anyone regardless of whether they own the track.
- I want an intensity graph layer I can draw manually — not computed from a waveform, but painted by hand as I listen — that sits below my form diagram.
- I want my analysis file to be queryable so I can build a corpus and track features like "beat-match intro" across 45 tracks.

### 5.2 Classical / Common Practice Scholar

- I want a clean hierarchical form diagram with enforced non-overlapping sections for analyzing sonata form movements.
- I want a controlled vocabulary that includes terms like medial-caesura, EEC, P-zone, TR — and I want that vocabulary to be shareable so my corpus is comparable with other scholars using the same framework.
- I want to query my corpus: how many tracks in my collection contain a medial-caesura? In how many does it occur in the first reprise vs. the second? Under what key conditions does it appear?
- I want to analyze ten performances of the same composition and compare how performers distribute time across formal sections — not just whether a section exists, but how long each performer dwells in it relative to the whole.

**Hepokoski/Darcy Sonata Form Analyst (extends above):**
- I want to apply a Hepokoski/Darcy analytical framework across a corpus of sonata form movements. I need to mark the presence of specific theoretically precise events — medial caesura (MC), essential expositional closure (EEC) — as point markers at specific timestamps.
- I also need to record when these events are *expected but absent*, because that absence is itself analytically significant in the Hepokoski/Darcy framework.
- I want a vocabulary set that maps to the Hepokoski/Darcy framework so my corpus is comparable with colleagues using the same terms.

### 5.3 Remix / Performance Studies Scholar

- I want to analyze a source track and multiple remixes as a set — all tagged as performances of the same underlying work — and compare how producers handle formally ambiguous sections.
- The insight: a remix is a performance, and performance is a kind of analysis. Strata supports this by treating remixes as instances of a source track, the same way multiple recordings are instances of a composition.

### 5.4 Classical Analyst — Phrase Rhythm / Schenkerian

- I want to apply multiple simultaneous analytical frameworks to a movement — one layer for large-scale formal sections, one for phrase rhythm, one for a Schenkerian reduction — and see all of them on the same timeline without any layer constraining another.
- I want the option to enforce non-overlapping spans within a single layer when my analytical framework requires it, while leaving other layers unconstrained.
- I want to query my corpus: how many movements in my collection resolve their Schenkerian Urlinie in the recapitulation vs. the coda? How does phrase rhythm correlate with formal section type across my corpus?
- I do not want to be forced into a single analytical lens. Different layers should be able to represent different theoretical commitments simultaneously.

### 5.5 Jazz Scholar

- I want to track multiple simultaneous layers: large-scale form (head/solos/head), soloist presence, harmonic rhythm, and energy contour — all on the same timeline for a single performance.
- I want to compare multiple performances of the same standard and see how different performers distribute time across formal sections, enter solos, and manage energy across the form.
- I want my analyses to be queryable: which soloists in my corpus consistently build energy across the full chorus form? Where does harmonic rhythm typically accelerate relative to the solo peak?

### 5.6 Film Music Scholar

- I want to map musical texture and formal sections onto narrative structure — marking cue boundaries, thematic material, orchestration shifts, and their relationship to scene changes and dramatic beats.
- I want to query across a corpus of cues: how often does the composer thin the texture at a scene transition? Does energy contour correlate with narrative tension in this composer's style?
- Point markers are essential for me: musical events like a leitmotif entry or a harmonic arrival are moments, not durations, and I need them queryable.

### 5.7 Hip-Hop Scholar

- I want to track formal sections (verse, hook, bridge, outro), energy contour, and flow density as separate but simultaneous layers on the same timeline.
- I want to mark when a producer drops elements, introduces samples, or shifts the beat — as a DAW-style instrumentation layer — and correlate those choices with formal section changes.
- I want to query across a corpus: do producers in this sub-genre consistently reduce energy at the hook, or is it the opposite? How long do verses run in this period relative to the hook?

### 5.8 Amateur Analyst / Enthusiast

- I want to make a form diagram for a song I love without needing to download software or create an account.
- I want it to be shareable so I can post it in a music theory community online.
- I do not need corpus analysis features. I just want a clean, functional diagram.

### 5.9 Music Video Staging Scholar

- I am tracking staging events in music videos — when specific performers enter, when visual motifs recur, when choreographic sections begin and end.
- My corpus currently lives in a spreadsheet. If the videos are on YouTube, I could use Strata to mark events and spans directly on the video timeline, making my observations timestamp-anchored and queryable across my corpus.
- A mix of point markers (for discrete staging events) and spans (for choreographic sections) covers most of what I need. A dedicated staging widget with richer visual affordances would be a future improvement.

### 5.10 Widget Developer / Community Contributor

- I want to build a new widget type — maybe a harmonic rhythm tracker, or a lyrics synchronization layer — and plug it into the Strata ecosystem without forking the core codebase.
- I want the widget contract to be documented clearly enough that I can implement it independently.
- I want to share my vocabulary file with the community so other scholars analyzing the same repertoire can use the same type terms.

---

## 6. Planned Widget Roadmap

### 6.1 v1: Form Diagram

The proof-of-concept widget and the data spine of the system. Draggable, resizable section blocks on a timeline. Multiple layers. Optional overlap. Controlled vocabulary types. Span IDs that other widgets can reference. This is the minimum viable Strata.

### 6.2 v2: Energy Contour Widget

The energy contour widget tracks the **functional energy trajectory** of a track over time — how sonic energy rises, falls, and plateaus across the listening experience. It is analyst-drawn and interpretive, not computed from audio.

**Why this widget exists:** EDM producers and scholars have long described the characteristic shape of tracks in terms of energy cycles — buildups, peaks, breakdowns, releases. Butler (2006) includes a prototypical form diagram from a producer that uses triangles and rectangles to describe energy shape. Peres (2016) formalizes setup, buildup, and peak as sonic functions. Smith (2021, MTO 27.2) tracks the continuous processes (filter sweeps, pitch slides, snare rolls) that produce energy change. The energy contour widget sits between these frameworks: it tracks *what energy is doing* (function), not *how a producer achieves it* (mechanism). Mechanism detail belongs in the instrumentation widget.

**Why discretized, not free-drawn:** a smooth hand-drawn curve is always unique. A discretized profile — built from control points at analyst-chosen intensity levels — can be *the same* across two tracks in a corpus-queryable sense. Forcing the analyst to assign a level (rather than sketch a shape) produces an interpretive claim rather than an impressionistic trace. That claim is arguable, comparable, and aggregable. This is not a limitation of the widget — it is the epistemological point of the widget.

#### Data Model

The core data primitive is a **control point**: `{ time: float (seconds), intensity: float (0.0–1.0) }`.

The analyst places control points wherever they want. Two points at the same intensity with nothing between them = flat. Two points at different intensities = a transition.

**Transition type** is a field on each segment between two adjacent control points, not on the control point itself. Values: `gradual` (energy changes continuously across the segment — a buildup, a fade) or `step` (energy changes instantaneously — a drop hit, a breakdown cutoff). This field is analytical data, not a rendering choice. A corpus question like "in what percentage of tracks does the first peak arrive via a gradual transition vs. a step?" is answerable because of this field.

**Intensity as float, divisions as display preference:** intensity is stored as a continuous float (0.0–1.0). The number of display divisions — the snap levels the analyst sees and works with — is a layer-level setting, defaulting to 5. An analyst who needs finer distinctions can set it to 7 or 10. Two analyses using different division counts are still comparable at the data level because the underlying float is the same primitive.

#### BPM Grid (Optional Scaffolding)

> **Status (2026-09-29):** built as a document-level beat grid of segments rather than time points in the shared pool; see `docs/decisions.md`, "Beat Grid", and the Beat Grid section of the schema reference.

If the analyst sets a BPM at the layer level, the widget displays faint gridlines at bar or four-bar intervals and offers snapping. This is scaffolding only — it never constrains the data. Time points contributed to the shared pool by this scaffold are available to the form diagram and other widgets. Tempo changes and added measures are handled by correcting the pool directly; they do not break the data model.

#### Relationship to the Form Diagram

The most natural workflow is: draw a form diagram first, establish section boundaries, then open the energy contour widget and import those boundaries as starting control points. The import populates the shared time point pool with the form diagram's boundary timestamps. The analyst then assigns intensity levels and transition types.

**v1:** this import is a hard copy of timestamps from the form diagram layer into the shared pool. If the analyst later moves a form diagram boundary, the energy contour control points do not automatically update.

**v2:** control points imported from the form diagram become live references via span ID. Moving a boundary in the form diagram updates the corresponding control point in the energy contour widget automatically.

The reverse also holds: control points added in the energy contour widget are available as snap targets in the form diagram, enabling analysts who prefer to start with energy analysis to build their formal sections around it.

#### Relationship to the Instrumentation Widget

The energy contour tracks function. The instrumentation widget tracks mechanism. An analyst who wants to note that a particular gradual transition is produced by a filter sweep, snare diminution, and element layering simultaneously records that in the instrumentation widget — or in the `notes` field of the relevant control point or segment. The energy contour does not need to know the mechanism; the instrumentation widget does not need to track the functional trajectory. They are complementary views of the same music.

> **Name:** this widget is called the **Energy Contour** widget throughout the codebase and documentation. Earlier references to "Intensity Graph" or "Sonic Density Graph" are superseded by this name.

### 6.3 v2/v3: Instrumentation / Layer Widget

A DAW-style view showing which instruments, voices, or elements are present at any given point. Each "track" in the layer is a named element with presence blocks on the timeline. Integrated into the same file and timeline as all other widgets.

> **Relationship to the energy contour:** the instrumentation widget is the natural home for mechanism-level detail. Where the energy contour records that energy increased gradually over sixteen bars, the instrumentation widget can show which elements were added, which automation curves were running, and what production techniques produced that increase. Smith's (2021) continuous process framework — tracking filter sweeps, pitch slides, and snare rolls as formal mechanisms — is most naturally captured at this layer. The two widgets answer different questions and are designed to coexist in the same analysis file.

### 6.4 v2/v3+: Timestamped Written Analysis

> **Status (2026-09-27):** a first version shipped in v1: commentary anchored to spans or time ranges, surfacing during playback (or, while paused, for the selected span), with `[[slug]]` links to spans and point markers, and HTML and Markdown export. See `widgets/written-analysis.md`.

Text blocks anchored to specific spans or timestamps. When the playback cursor enters a span, the relevant text block surfaces. Clicking a section in the form diagram opens a deeper written commentary. This is the "flowering" feature — the point where Strata becomes not just a diagram tool but an interactive analytical document.

**Architecture:** This widget does not enforce a hierarchical data structure. Each span can have a written analysis block attached. Inside the prose, the analyst can reference spans and point markers as *live links* — clicking a mention of "medial caesura" jumps to the MC point marker at its timestamp. Hierarchy *emerges from the writing itself*, not from nested data constraints. This is more honest to how music theory writing actually works.

This widget is the first concrete realization of inter-widget data sharing (Section 2.5): the form diagram defines spans with IDs, the point marker layer defines events with IDs, and the written analysis widget imports those IDs to create live, playback-linked references.

> **Roadmap note:** This widget was originally scoped at v3+. Given how concretely it has been designed, and given its importance to classical/common-practice scholars, whether it belongs at v2 is an open question. The data model already accommodates it from day one via span IDs.

### 6.5 Future / Community

- Harmonic rhythm tracker
- Melodic contour sketch layer
- Lyrics synchronization
- Custom annotation layer (free-draw or text stamps on timeline)
- Any widget a community contributor builds that conforms to the widget contract

### 6.6 v3+ Possibility: MEI Score Widget

MEI files (XML-based score encoding) encode *score-time* spans (measures, beats), while `.strata` files encode *clock-time* spans (seconds). These are complementary, not competing, ontologies of musical time.

A future Strata widget could allow analysts to annotate a score rendered from an MEI file — placing interpretive spans on score time rather than playback time. This would require a parallel mode of the Strata interface: score renderer instead of YouTube player, measure-based timeline instead of seconds-based.

Linking score-time spans to clock-time spans would require a performance alignment map — a known musicological concept but technically hard. **Deferred: v3+ at earliest.** The two-ontology insight is important context for long-term architecture but must not complicate v1 or v2 scope.

---

## 7. Export System

### 7.1 Core Principle

Export is widget-specific. Each widget defines its own export formats because the nature of the data differs fundamentally across widget types. The widget contract's export definition declares supported formats and provides a function that returns a downloadable blob. The app export UI calls those functions without knowing implementation details.

**How browser export works:** generate content in memory → create a downloadable blob → trigger a programmatic link click → user receives a file download. There is no native "Save As" dialog in a web app. This mechanism is identical for all file types (SVG, PDF, HTML, `.strata`).

### 7.2 Form Diagram Widget — SVG Export

SVG is the correct and easiest export format for the form diagram widget. Because React renders the diagram as SVG elements in the DOM already, export is largely: serialize the SVG to a string, apply the viewBox for the selected time range, wrap as a blob, download. Minimal or no external library required.

> This is notably easier than it might appear. BriFormer's broken SVG export is likely a fixable bug rather than a fundamental difficulty.

### 7.3 PDF Export

PDF requires a library (jsPDF or pdf-lib are standard). The workflow is: describe the document to the library programmatically, generate a PDF blob. Well-trodden ground. Libraries load at the app level, not per-widget.

> **As built (2026-11-23):** Strata saves a PDF with no library. The exported SVG goes alone onto a print page, and the browser's print dialog saves it as a vector PDF (`docs/decisions.md`, "Save as PDF Through the Print Dialog").

### 7.4 Written Analysis Widget — Export Formats

HTML is the default export. Rendered HTML opens correctly in any browser, requires no explanation, and is universally accessible. Most users lack markdown-aware applications and would see raw syntax (hashtags, asterisks) rather than rendered output if markdown were the default.

| Format | Default | Notes |
|---|---|---|
| HTML | Yes | Universally accessible, renders in any browser |
| Markdown | Secondary | For technical users; raw syntax visible in most apps |
| PDF | Third option | From rendered view; useful for handout/print use cases |

### 7.5 Time-Range Selection

The export selection primitive is **time-range with span shortcut**:

1. The analyst clicks a span (e.g., "Exposition") — this auto-populates a time-range selector with that span's start and end times
2. The analyst can then drag the handles to adjust — bumping out to capture elisions, pickup bars, or contextual context
3. The span is a suggestion, not a constraint

This handles formal ambiguity at boundaries elegantly without requiring a separate selection primitive.

**Layer selection:** the visibility toggle is the mechanism. Hide layers you don't want exported before exporting. This is cleaner than a separate layer-selection step at export time, and the visibility toggle has value in-app independent of export.

### 7.6 Multi-Widget Export

Producing a single document from multiple widgets (e.g., form diagram SVG with written analysis text below it) is a v2 consideration. v1 encourages separate exports — each widget exports independently, and the analyst assembles in another tool if needed.

---

## 8. The Embeddable Viewer

> **2026-10-03:** the embed is now Strata itself in an iframe (`/?embed&src=…&focus=…`), not a component imported at build time. `docs/decisions.md`, "Embedding an Analysis", has the current design; this section is the original plan.

### 8.1 Concept

The embeddable viewer is a read-only render of a `.strata` file, designed for embedding in web-based scholarly writing — specifically in Astro/Keystatic content. It is not a separate product; it is the render path of the widget system, instantiated without the editing layer.

The scholarly use case: an analyst writes a prose argument, and embeds a live form diagram — synced to audio, focused on a specific formal span — directly in the text. The reader can listen to the section being discussed while reading the argument about it. The embed and the prose make different but complementary analytical claims simultaneously; neither is a caption for the other.

> **On the relationship between embed and prose:** the form diagram shows structure; the prose says why it matters. A reader engaging only with the diagram gets something real. A reader engaging only with the prose gets something real. Together they produce an analytical experience neither delivers alone. The embed should feel like a live object the prose is in conversation with — not a figure with a caption.

### 8.2 The Viewer Component

`<StrataViewer>` is a React component that takes a parsed `.strata` object and renders it read-only. The editor wraps this same component and adds the editing layer on top. The viewer is the shared primitive.

In Astro, the viewer is instantiated as an island with `client:load` or `client:visible`. The `.strata` file is co-located with content and imported at build time. Updating the analysis file updates all embeds referencing it on the next build.

### 8.3 The Embed API

```jsx
<StrataEmbed
  file="track-analysis.strata"   // path to co-located .strata file
  widgets={["form"]}             // allowlist of widget types to render
  focus="drop-1"                 // slug of the span to focus
  defaultLoop={true}             // loop playback within focused span
  defaultContext={false}         // show adjacent spans for context
/>
```

`widgets` is an allowlist filter. The embed renders only the specified widget types from the file; all other layers are ignored. This allows a single rich analysis file to power multiple targeted embeds across multiple content pieces.

`focus` resolves the slug to the span's `startTime` and `endTime`. Focus triggers: seek to `startTime`, zoom timeline to the span, loop playback, highlight the span visually.

### 8.4 Context Mode

When `defaultContext` is true, the embed expands to show adjacent spans in the same layer rather than the focused span in isolation. Context is span-aware, not time-based — the embed shows the formal neighbors of the focused span, giving the reader a sense of where it falls in the larger structure. This is analytically more meaningful than an arbitrary fixed-second window.

### 8.5 Source Offset

Each source reference in a `.strata` file carries a `sourceOffset` field — the difference in seconds between the recording's true start and the YouTube video's audio start. Seeking behavior applies the offset automatically. Span timestamps always represent recording time, never YouTube video time. If a YouTube video is replaced (due to takedown, re-upload, or quality upgrade), only the URL and offset need updating; span data is untouched.

### 8.6 Link Health Monitoring

YouTube link health is monitored via the oEmbed endpoint, implemented as a scheduled GitHub Action. The Action scans all `.strata` files in the repo weekly, checks each YouTube URL, and opens an issue for any that return a failure. This provides passive monitoring without requiring the analyst to manually check links across a growing corpus.

### 8.7 Update Propagation

Because embeds are file-referenced (not inline JSON) and the viewer component is shared across all embeds, there are two kinds of updates, both free:

- **Viewer component updates** (new features, bug fixes, reader toggles in v2): rebuild the site, all embeds get the new version.
- **Analysis data updates** (revised span boundaries, corrected timestamps, new layers): update the `.strata` file, rebuild, all embeds referencing that file reflect the change.

Reader-accessible toggles (loop on/off, context on/off) are a v2 quality-of-life feature. In v1, defaults are author-set and fixed for the reader.

---

## 9. Corpus Analysis, Corpus Builder & The Library

### 9.1 Corpus Analysis Philosophy

Strata's stance: the tool produces good data. What scholars do with that data is up to them. A basic corpus view may be built into the tool eventually, but the primary commitment is to a file format clean enough that a Python script, a custom app, or a simple spreadsheet import can extract meaningful information without requiring the Strata application.

> The file format is a scholarly data standard disguised as a tool interface. Any scholar with basic technical literacy — or a technically-minded collaborator — should be able to query a folder of `.strata` files using nothing but Python's json module and a loop.

### 9.2 What Makes Corpus Analysis Possible

Three things must be designed in from day one, even if nullable in v1:

- The `type` field on spans — controlled vocabulary terms that are consistent across files. Two analysts using the same vocabulary can compare corpora.
- The `vocabulary` reference on the document — which vocabulary this file uses. Enables filtering a corpus to only files using compatible vocabulary.
- The `project` tag on the document — which collection this file belongs to. Enables grouping.

### 9.3 The Corpus Builder

The Corpus Builder is a separate companion application that consumes `.strata` files (and MEI files) and provides organization, querying, and extensibility for corpus-scale scholarly work. It is not a future phase of Strata — it is a second product.

**The psychological design goal:** the UX is designed to produce the moment where a scholar looks at their screen and thinks *I am building a corpus* rather than *I am managing files*. A table view with metadata columns drawn from file-level data makes scholarly accumulation legible in a way a folder of files never does.

**Backend architecture — open question:** two approaches are under active debate. See the tradeoff analysis below before treating either as settled.

#### Backend Tradeoff: Local-Only vs. Supabase Personal Instance

The Corpus Builder needs a database layer to power filtering and queries across many files. The architectural question is where that database lives.

**Option A — Local-only (SQLite or equivalent)**

The Corpus Builder maintains a local database file on the scholar's machine — similar to how Obsidian maintains a local vault index. No accounts, no internet dependency, no third-party service.

| Advantage | Notes |
|---|---|
| Zero setup friction | Open the app, start importing files |
| Consistent philosophy | No-backend ethos matches the Analysis Tool exactly |
| True offline operation | Works anywhere, always |
| No service dependency | Not subject to Supabase pricing changes, downtime, or deprecation |
| Data truly local | No data ever leaves the scholar's machine unless they choose |

| Limitation | Notes |
|---|---|
| No cross-device sync | Corpus lives on one machine unless manually transferred |
| External tool access is harder | Tools must read the local SQLite file directly, not a web API |
| No built-in collaboration | No way to invite a collaborator to query your corpus |

**Option B — Supabase personal instance**

The Corpus Builder provisions a personal Supabase project during onboarding. Their data lives in their own database, under their own Supabase keys. The Corpus Builder UI is a skin on top of their Supabase instance.

| Advantage | Notes |
|---|---|
| External tool access via API | Technical collaborators and external analysis scripts can hit the Supabase API directly |
| Cross-device sync | Log in anywhere, corpus is current |
| Collaboration-ready | Can grant a colleague read access to the database |
| Extensibility story is cleaner | "Your data is in Postgres, point your tools at it" |

| Limitation | Notes |
|---|---|
| Setup friction | Requires creating a Supabase account and project during onboarding |
| Service dependency | Supabase must remain available, affordable, and compatible |
| Philosophical inconsistency | Introduces a cloud service into a tool otherwise designed to need none |
| Onboarding complexity | Asking a non-technical scholar to set up a personal database instance is a real barrier |

**Option C — Local-first with optional cloud sync**

Start with a local SQLite database. Add an optional "sync to Supabase" path for scholars who want cross-device access or external API access. Best of both architectures — but more to build, and adds UI complexity around the sync state.

**The core tension:** the Supabase approach's strongest argument is the extensibility story — "your data is in Postgres, point your analysis tools at it." But that argument primarily benefits technically sophisticated scholars, who could work with a local SQLite file just as well. For the non-technical majority, Supabase adds friction without adding perceived value. The local-only approach is more consistent with the tool's philosophy and lower barrier to entry, but limits the extensibility story to "export from the Corpus Builder and import into your analysis tool."

> **This decision is not final.** The Supabase approach was proposed in an early design session and has since been flagged for debate. Resolve before Corpus Builder development begins.

#### Three Concentric Circles of Value

**Circle 1 — The Core: `.strata` as Primary Citizen**
Import `.strata` files; surface their structured data — spans, types, vocabulary terms, metadata — as queryable fields automatically. No manual entry. The file is the data entry. A scholar with fifty `.strata` files can immediately filter, sort, and query across all of them on any field in the format. This alone is the minimum viable Corpus Builder — already better than any spreadsheet workflow.

**Circle 2 — The Middle Ring: MEI as Secondary Citizen**
MEI files (XML-based score encoding) are recognized and parseable. Terminology — exposition, medial caesura, EEC, drop — can be surfaced and queried alongside `.strata` data. The key insight: this is about *shared vocabulary across formats*, not linked timelines. If a `.strata` file and an MEI file both use the term `medial-caesura`, the Corpus Builder surfaces that as a queryable fact without needing to resolve the clock-time/score-time difference.

MuseScore's native MEI export (a recent development) significantly lowers the adoption barrier — scholars already in MuseScore can now produce queryable encoded scores without coding knowledge.

Linking between `.strata` and MEI files about the same piece is manual: the scholar declares the association using the existing `work` field. A `.strata` file and an MEI file that both reference the same work identity are associated. Human-declared, not computed.

**Circle 3 — The Outer Ring: Extensibility**
Other file types (PDFs, links, notation files) can be referenced and cataloged — but for non-`.strata`, non-MEI files, the Corpus Builder can only store metadata about them manually. It cannot peer inside them to surface structured data. This distinction is made clear in the UI.

External analysis packages (Python scripts, community-built tools) can plug into the Corpus Builder's data layer via Supabase's API. The builder is not trying to be SPSS or R — it is trying to be the thing that makes it possible to *point* SPSS or R at a corpus without wrangling files manually.

**What the Corpus Builder is not:**
- Not a full database design tool — scholars cannot build arbitrary relational schemas
- Not a data analysis engine — basic filtering built in, sophisticated analysis is for external tools
- Not a replacement for Zotero, Notion, or Airtable for general reference management
- Not the Library — community sharing and social features remain a separate, low-priority future product

**The file discovery problem:** a significant portion of the target audience lacks fluent familiarity with folder structures. File import must be guided, visual, and search-assisted rather than path-based. Users should be able to find and import `.strata` files through a UI flow that does not assume knowledge of where files live on their computer. (See Section 9 for the open question on implementation approach.)

### 9.4 The Library (Pie in the Sky — May Never Be Built)

The Library is where analyses are shared publicly, browsed, voted on, and commented on. It requires user accounts, a backend, storage, and moderation. It is explicitly deprioritized — the Analysis Tool and Corpus Builder together constitute a complete scholarly tool without it.

Build only if the community demands it and the resources exist.

---

## 10. Open Questions & Deferred Decisions

### Questions to Answer Before or During v1 Build

- What is the exact JSON schema for a `.strata` file? This needs to be written out formally before coding begins. It is the most important document the project will produce.
- What built-in global types ship with the tool at launch? Needs a curated starter list that covers common use cases without being overwhelming.
- What is the widget contract specification? The interface that all widget types must implement needs to be written out formally before any second widget is built.
- What does the form diagram editor UI look like in detail? Key decisions: how are span boundaries set (click to place, drag to resize?), how is the playback cursor shown, how are labels positioned?
- **"Expected event not present" — exact implementation.** Document-level field? Layer-level list? Boolean `absent` on a point marker? Needs a design decision before v1 schema is finalized.
- **Point marker vocabulary at v1.** Does the Hepokoski/Darcy use case require project-level custom point marker types at v1? Or can it wait for v2? Depends on whether classical scholars are in the primary v1 audience.
- **What is the exact boundary between core schema and widget-defined data payload?** The typed envelope pattern is decided; the formal spec of the boundary needs to be written out. This is part of the schema drafting work.
- **Shared time point pool — exact schema.** What fields does a time point in the pool carry beyond `timestamp`? Does it store a `sourceWidgetId`? A `label`? A `type`? The minimum viable pool entry is just a timestamp, but the schema should be written out formally before coding begins.
- **Energy contour — segment data model.** A segment exists between two control points and carries a `transitionType` field. Does the segment have its own `id`? Its own `notes` field? This needs to be formally specified as part of the energy contour widget contract.
- **Energy contour — v1 scope decision.** The energy contour widget is currently listed as v2. Given how fully its data model has been designed, the question of whether it belongs in v1 alongside the form diagram is worth revisiting before build begins.
- **Merge UX — dedicated design session required before implementation.** The conflict-only dialog design, multi-select interaction model, deprecation record format, and edge cases (merging spans with different parents, merging across layers) need resolution before the form diagram editor is built. Merge is a v1 requirement.

### Questions That Can Wait

- **Corpus Builder — file import UX.** Guided visual flow vs. path-based picker for users without folder structure fluency. Must be resolved before Corpus Builder UX is designed.
- **Corpus Builder — exact Supabase schema.** What tables, columns, and relationships does the Corpus Builder write? Analogous in importance to the `.strata` schema for the Analysis Tool. Design before coding begins.
- **Corpus Builder — built-in query types at v1.** Curated list of the most common corpus questions the UI supports out of the box. Needs scoping.
- **Corpus Builder — MEI parser queryable fields.** What terminology actually lives in MEI files, and how to extract it cleanly. Needs a review of MEI spec and common authoring tools (especially MuseScore's MEI export).
- **Corpus Builder — extensibility API surface.** Even if nothing plugs in at v1, the contract needs to be defined: is it Supabase directly, an export format, or something else?
- **Corpus Builder — shared codebase or separate repository from Analysis Tool?** Both are viable; decision affects development workflow.
- How does the Library work technically? — Deferred indefinitely; may never be built.
- How are community vocabularies distributed and versioned? — Deferred until community exists.
- What does the inter-widget data API look like in practice? — Deferred until at least two widgets exist.
- Is there a native Anthemics integration? — Deferred. Keep tools separate until both are stable.
- **Written analysis widget — v2 or v3+?** See roadmap note in 6.4.
- **Music video staging — dedicated widget?** Standard form diagram + point marker likely covers this. Revisit if that user community arrives.
- **Hierarchical enforcement toggle — exact UX of the warning dialog.** Content of the warning, confirmation flow, and how the toggle state is surfaced in the layer UI. Resolve before form diagram widget UI is finalized.
- **Energy contour — live reference import (v2).** When control points become live references to span IDs rather than hard-copied timestamps, what happens to a control point whose source span is deleted? Needs a conflict resolution design.
- **BPM grid utility — scope.** Is the BPM grid generator a utility built into the energy contour widget, a standalone utility that writes to the shared pool, or a layer-level setting? The shared pool architecture suggests standalone, but the UX is unresolved. *Resolved 2026-09-29: a document-level beat grid of segments, laid down by ear; see "Beat Grid" in `docs/decisions.md`.*

---

*Strata — Working Title*
*Project Vision & Architectural Guiding Document v0.5*
*Generated May 2026 — Updated with session notes v0.2, v0.3, v0.4 (Corpus Builder, demo corpus, MEI), and v0.5 (energy contour widget, shared time point pool, three-widget analytical stack, hierarchical enforcement toggle, core product claim reframe).*
