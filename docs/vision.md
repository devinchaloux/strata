# Strata
## A Modular Music Analysis Tool

*Project Vision & Architectural Guiding Document*
*Working Title — v0.3 Draft — May 2026*

> This is a living document. It is updated after each major ideation session as design decisions accumulate. No code has been written yet.

---

## 1. Project Vision

Strata is a web-based, open-source music analysis tool built around a unified analysis document. At its core, it lets an analyst link a YouTube video (or upload a local audio file), then build layered analytical views — called widgets — that are all synchronized to the same playback timeline and saved into a single portable file.

The name Strata reflects the central design metaphor: analysis is not a single flat view but a set of interpretive layers, each illuminating something different about the same piece of music. A form diagram, an intensity curve, an instrumentation map, a written timestamped commentary — these are all strata of the same analytical object.

Existing tools in this space produce form diagram visualizations synced to audio. Strata is inspired by this work but departs significantly in architecture: where existing tools are single-purpose and siloed, Strata is a modular container. Where existing tools enforce hierarchical or non-overlapping formal constraints, Strata is flexible. Where existing tools produce display artifacts, Strata produces queryable scholarly data.

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

Built-in widget types for v1: Form Diagram. Additional types (Intensity Graph, Instrumentation Map, Timestamped Written Analysis) are planned but not required for v1. Third-party widgets can be implemented by anyone as long as they conform to the widget contract.

### 2.4 The Shared Timeline Axis

The horizontal ruler showing full track duration with a playback cursor is the glue of the entire system. Every widget subscribes to the current playback time. The YouTube IFrame API provides current time continuously. This signal is passed to all mounted widgets.

Widgets can both display their data aligned to the timeline and optionally respond when the cursor moves (e.g., highlighting the section the cursor is currently inside, surfacing the relevant written analysis block).

**DAW-style cursor following** is a core behavior of the shared timeline axis, not something individual widgets implement. When the playback cursor reaches approximately 80% of the visible area, the timeline scrolls to keep it in frame. This is standard in video editors and DAWs, and it directly fixes BriFormer's primary UX failure (zoom in, lose the cursor).

### 2.5 Inter-Widget Data

A key design goal — not for v1 but designed in from the start — is that widgets can read data from other widgets. The form diagram is the most important source widget: it defines time spans that other widgets can reference. A written analysis block can say "I belong to the span with id X" and surface itself when the playback cursor enters that span.

The data model must support this from day one even if the UI for it is not built until later. Span IDs (see Section 3) are the mechanism.

> **Design principle:** seed the architecture for inter-widget data, but do not build the vines in v1. The file format supports relationships between layers. The reactive cross-widget behavior is a v2+ feature.

---

## 3. Data Model

### 3.1 File-Level Metadata

Every analysis document stores the following at the top level. Fields marked optional can be null in v1 but the schema must include them so they never need to be migrated in.

| Field | Required | Notes |
|---|---|---|
| `title` | Yes | Display title of the track or recording |
| `artist` / `performer` | Yes | Separate from composer — see context field |
| `youtubeUrl` | Situational | Required if no localAudioRef; canonical sharing reference |
| `localAudioRef` | Situational | Filename only — not embeddable in shared context |
| `duration` | Yes | Track duration in seconds (float). Store explicitly. |
| `context` | Yes | Enum: `recording` \| `performance` \| `remix`. Drives which fields appear in UI. |
| `composer` | Optional | Only surfaced when context = performance |
| `work` | Optional | The composition being performed (e.g. Op. 13). Enables cross-file corpus comparison of the same work. |
| `sourceTrack` | Optional | Reference to another analysis file. Only surfaced when context = remix. |
| `vocabulary` | Optional | Which controlled vocabulary this file uses for span types. Null = global built-in types only. |
| `project` | Optional | Corpus/collection tag. Enables grouping files for corpus analysis. |
| `analysisAuthor` | Optional | Who created this analysis |
| `createdAt` | Yes | ISO timestamp, auto-generated |
| `updatedAt` | Yes | ISO timestamp, auto-updated |
| `strataVersion` | Yes | Version of the app that created this file. Critical for forward compatibility. |
| `fileFormatVersion` | Yes | Integer. Increment when schema changes. Start at 1. |

### 3.2 The Layer

The file contains an array of layers. Each layer corresponds to one widget instance. A file can have multiple layers of the same type (e.g., two form diagram layers representing different analytical frameworks applied simultaneously).

- `id` — auto-generated, never changes
- `type` — widget type identifier (e.g. `form`, `intensity`, `instrumentation`, `custom`)
- `label` — human-readable layer name set by the analyst
- `visibility` — shown or hidden
- `locked` — editable or read-only
- `colorDefault` — fallback color for spans in this layer
- `displayOrder` — rendering order when stacked
- `data` — widget-specific data payload; structure defined by the widget type, not the core schema

> **Typed envelope pattern:** The core schema enforces structure around every layer entry (the fields above). The `data` field is a free payload — the core schema says "there is a data field and it is an object"; the widget contract says "here is what that object contains." This keeps the core schema stable while new widget types can define their own data structures without requiring core schema changes.

### 3.3 The Span — Core Primitive

Time spans are the universal primitive of the entire system. Every widget is either defining spans, decorating spans, or both. Getting the span data model right is the most important early decision in the project.

> **DECISION — Timestamps stored as seconds (float), not HH:MM:SS strings.**
> Rationale: Seconds is what the YouTube API provides, what arithmetic requires, and what is unambiguous. Display formatting (turning 94.3 into 1:34) is a rendering concern, not a storage concern.

Each span contains:

| Field | Notes |
|---|---|
| `id` | Auto-generated UUID on creation. Never changes. Never shown to user. Used for all inter-widget references. |
| `label` | Free text. What the analyst calls this section. Display value in the UI. |
| `slug` | Auto-generated from label (e.g. "Drop 1" → "drop-1"). Human-readable reference key. Stable unless explicitly changed. Used when another widget imports this span. Null until label is set. |
| `startTime` | Float, seconds |
| `endTime` | Float, seconds |
| `type` | Controlled vocabulary term (e.g. "drop", "medial-caesura"). The corpus-queryable field. Separate from label. |
| `color` | Hex. Per-span override of layer default. |
| `notes` | Short freetext annotation. Tooltip-level observation, not a full written analysis. |
| `confidence` | Enum: `definite` \| `approximate` \| `speculative`. Visually distinguishes certain boundaries from interpretive ones. |
| `parentId` | Optional reference to another span's id. Hierarchical relationships can be expressed without being enforced. |

> **Label vs. Type vs. Slug:** Label is for humans (display). Type is for queries (corpus analysis). Slug is the stable human-readable reference key for inter-widget links. These are three distinct fields and must remain separate.

### 3.4 Point Markers

In addition to spans, the timeline supports point markers — single-timestamp events. They are not sections; they are moments.

There are two meaningfully different kinds of point markers, and the data model must serve both:

**Type A — Observational / personal flags**
"This is interesting." "Come back to this." "Something weird happens here." Low-structure, high capture speed. Corpus-queryable only loosely (e.g., "show me all flagged moments"). Closer to a research breadcrumb than a formal analytical observation.

**Type B — Theoretically precise analytical events**
Medial caesura (MC) and essential expositional closure (EEC) in Hepokoski/Darcy sonata form analysis. These are not casual observations — they are theoretically loaded, analytically precise, and *corpus-queryable in the same rigorous sense as span types*. The presence OR ABSENCE of these events is analytically significant.

Point marker `type` fields draw from the same three-tier vocabulary system as span types. The Hepokoski/Darcy vocabulary would define `medial-caesura` and `EEC` as *point marker* types — moments, not durations.

> **Critical design requirement:** In Hepokoski/Darcy analysis, a *missing* medial caesura is itself analytically significant — it triggers specific formal consequences. The data model must be able to record "this event was expected here and did not occur." Exact implementation TBD (a boolean `absent` field on a point marker is the leading candidate), but this capability must be present from v1.

**Point marker field spec:**

| Field | Notes |
|---|---|
| `id` | Auto-generated UUID. Never shown to user. |
| `timestamp` | Float, seconds. |
| `label` | Free text. Display value. |
| `type` | Controlled vocabulary term. Corpus-queryable. Separate from label. |
| `notes` | Longer freetext observation. |
| `flagged` | Boolean. "Come back to this." Simple filter-level corpus query. |
| `absent` | Boolean. "This event was expected and did not occur." Analytically significant. |
| `confidence` | Enum: `definite` \| `approximate` \| `speculative`. Parallel to span confidence. |

### 3.5 The Vocabulary System

The `type` field on a span draws from a controlled vocabulary. Three levels are planned:

- **Global built-in types** — ship with the tool. Basic common terms: intro, verse, chorus, bridge, outro, drop, breakdown, build, etc. Available to all files with no setup.
- **Project-level custom types** — defined by the analyst for their corpus. EDM project might add: beat-match-intro, rise, anthem-entry, peak. Binary form project might add: P-zone, TR, S-zone, medial-caesura, EEC.
- **Community vocabularies** — named, versioned, shareable vocabulary files that anyone can adopt. "Common Practice Sonata Form v1." "EDM Club Track v1." Adopting one makes your corpus comparable with anyone else using the same vocabulary. Distributed as JSON files, no central server required.

> **DECISION — v1 ships with global built-in types only. Project-level custom types are v2. Community vocabularies are v3+.**
> Rationale: Scope control. The architecture supports all three from day one — the file stores a vocabulary reference. The UI only needs to implement the simplest level first.

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

### 5.4 Amateur Analyst / Enthusiast

- I want to make a form diagram for a song I love without needing to download software or create an account.
- I want it to be shareable so I can post it in a music theory community online.
- I do not need corpus analysis features. I just want a clean, functional diagram.

### 5.5 Music Video Staging Scholar (new)

- I am tracking staging events in music videos — when specific performers enter, when visual motifs recur, when choreographic sections begin and end.
- My corpus currently lives in a spreadsheet. If the videos are on YouTube, I could use Strata to mark events and spans directly on the video timeline, making my observations timestamp-anchored and queryable across my corpus.
- A mix of point markers (for discrete staging events) and spans (for choreographic sections) covers most of what I need. A dedicated staging widget with richer visual affordances would be a future improvement.

### 5.6 Widget Developer / Community Contributor

- I want to build a new widget type — maybe a harmonic rhythm tracker, or a lyrics synchronization layer — and plug it into the Strata ecosystem without forking the core codebase.
- I want the widget contract to be documented clearly enough that I can implement it independently.
- I want to share my vocabulary file with the community so other scholars analyzing the same repertoire can use the same type terms.

---

## 6. Planned Widget Roadmap

### 6.1 v1: Form Diagram

The proof-of-concept widget and the data spine of the system. Draggable, resizable section blocks on a timeline. Multiple layers. Optional overlap. Controlled vocabulary types. Span IDs that other widgets can reference. This is the minimum viable Strata.

### 6.2 v2: Intensity / Sonic Density Graph

A manually drawn intensity curve synced to the timeline. The analyst paints intensity as the video plays — dragging up and down to record their interpretive sense of sonic density, energy level, or textural complexity. The curve sits below the form diagram, visually aligned to section boundaries.

> **Why manual, not computed?** Sonic intensity in music is interpretive, not purely acoustic. A spectrogram or waveform gives partial information. The analyst's ear and judgment are irreplaceable. Manual drawing is not a limitation — it is the right epistemology for this kind of analysis.
>
> Note: automated waveform/spectrogram extraction from YouTube is technically impossible due to browser cross-origin security constraints. The YouTube IFrame API provides playback controls but does not expose the audio stream.

### 6.3 v2/v3: Instrumentation Layer

A DAW-style view showing which instruments, voices, or elements are present at any given point. Each "track" in the layer is a named element with presence blocks on the timeline. Integrated into the same file and timeline as all other widgets.

### 6.4 v2/v3+: Timestamped Written Analysis

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

## 8. Corpus Analysis, Corpus Builder & The Library

### 8.1 Corpus Analysis Philosophy

Strata's stance: the tool produces good data. What scholars do with that data is up to them. A basic corpus view may be built into the tool eventually, but the primary commitment is to a file format clean enough that a Python script, a custom app, or a simple spreadsheet import can extract meaningful information without requiring the Strata application.

> The file format is a scholarly data standard disguised as a tool interface. Any scholar with basic technical literacy — or a technically-minded collaborator — should be able to query a folder of `.strata` files using nothing but Python's json module and a loop.

### 8.2 What Makes Corpus Analysis Possible

Three things must be designed in from day one, even if nullable in v1:

- The `type` field on spans — controlled vocabulary terms that are consistent across files. Two analysts using the same vocabulary can compare corpora.
- The `vocabulary` reference on the document — which vocabulary this file uses. Enables filtering a corpus to only files using compatible vocabulary.
- The `project` tag on the document — which collection this file belongs to. Enables grouping.

### 8.3 The Corpus Builder

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

### 8.4 The Library (Pie in the Sky — May Never Be Built)

The Library is where analyses are shared publicly, browsed, voted on, and commented on. It requires user accounts, a backend, storage, and moderation. It is explicitly deprioritized — the Analysis Tool and Corpus Builder together constitute a complete scholarly tool without it.

Build only if the community demands it and the resources exist.

---

## 9. Open Questions & Deferred Decisions

### Questions to Answer Before or During v1 Build

- What is the exact JSON schema for a `.strata` file? This needs to be written out formally before coding begins. It is the most important document the project will produce.
- What built-in global types ship with the tool at launch? Needs a curated starter list that covers common use cases without being overwhelming.
- What is the widget contract specification? The interface that all widget types must implement needs to be written out formally before any second widget is built.
- What does the form diagram editor UI look like in detail? Key decisions: how are span boundaries set (click to place, drag to resize?), how is the playback cursor shown, how are labels positioned?
- **"Expected event not present" — exact implementation.** Document-level field? Layer-level list? Boolean `absent` on a point marker? Needs a design decision before v1 schema is finalized.
- **Point marker vocabulary at v1.** Does the Hepokoski/Darcy use case require project-level custom point marker types at v1? Or can it wait for v2? Depends on whether classical scholars are in the primary v1 audience.
- **What is the exact boundary between core schema and widget-defined data payload?** The typed envelope pattern is decided; the formal spec of the boundary needs to be written out. This is part of the schema drafting work.

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

---

*Strata — Working Title*
*Project Vision & Architectural Guiding Document v0.4*
*Generated May 2026 — Updated with session notes v0.2, v0.3, and v0.4 (Corpus Builder, demo corpus, MEI).*
