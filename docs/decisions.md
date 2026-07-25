# Strata — Architectural Decisions Log

This is a living document. Every significant architectural decision made during
design or development is recorded here with its rationale. New decisions are
added at the bottom. Decisions are never deleted — if a decision is reversed,
a new entry is added noting the reversal and why.

*Seeded from the v0.1 vision document, May 2026.*

---

## File Format

**Decision:** JSON, not XML.
**Rationale:** Web-native. Zero-friction in JavaScript/React. Human-readable. No parser library required. XML is the legacy desktop-app choice; JSON is correct for a web tool built in 2025+.

---

**Decision:** Custom file extension (`.strata`) wrapping plain JSON.
**Rationale:** Signals "this is an analysis file" rather than generic data. Contents are still plain JSON. Enables future versioning and association with the application.

---

**Decision:** Timestamps stored as seconds (float), not HH:MM:SS strings.
**Rationale:** Seconds is what the YouTube API provides and what arithmetic requires. Display formatting is a rendering concern, not a storage concern.

---

## Span Data Model

**Decision:** Span `id`, `label`, and `slug` are three separate fields.
**Rationale:** `id` is internal and stable (for references). `label` is display text (human-readable, can change). `slug` is the stable human-readable reference key (auto-generated from label, used for inter-widget imports, null until label is set).

---

**Decision:** Overlapping spans are valid data. Hierarchical constraints are a UI mode, not a data constraint.
**Rationale:** EDM and other repertoires require overlapping formal frameworks. Enforcing non-overlap in the data model would make the tool wrong for a significant scholarly use case. The "hierarchical mode" toggle applies the constraint at the editing UI level only.

---

**Decision:** `label` and `type` are separate fields on every span.
**Rationale:** `label` is free text (display). `type` is controlled vocabulary (corpus-queryable). A scholar can call a section "THE DROP" (label) while it is typed as "drop" (type). Cross-corpus comparison requires consistent types, not consistent labels.

---

## File-Level Metadata

**Decision:** `context` field (`recording` / `performance` / `remix`) drives UI progressive disclosure.
**Rationale:** A pop scholar should never see the composer field. A performance studies scholar needs it. One context choice at file creation collapses the metadata form appropriately. The underlying schema supports all contexts — the UI adapts.

---

## Architecture

**Decision:** Analysis Tool and Library are separate products. Build Analysis Tool first.
**Rationale:** Conflating them from the start will prevent v1 from shipping. The file format being open means the Library can be built later without requiring migration.

---

**Decision:** Build in React, client-side, no backend required for v1.
**Rationale:** Maximizes accessibility. No accounts, no server costs, no infrastructure to maintain. Scholars can use it immediately by opening a URL. The Library layer adds backend when ready.

---

## Widgets

**Decision:** Intensity graph is manually drawn, not computed from audio.
**Rationale:** Technically: automated waveform/spectrogram from YouTube is impossible due to browser cross-origin security. Philosophically: sonic intensity is interpretive, not purely acoustic. Manual drawing is epistemically correct for this kind of analysis.

---

**Decision:** The written analysis widget implements hierarchy through prose reference, not nested data constraints.
**Rationale:** Music theory prose *references* events and spans — it does not populate hierarchical schemas. Enforcing hierarchy in the data would be wrong for EDM analysis and unnecessarily rigid for classical analysis. Hierarchy emerges from the writing through live links to span IDs and point marker IDs. This is also the first concrete realization of inter-widget data sharing.

---

**Decision:** Multi-layer form diagrams and the written analysis widget are complementary solutions for different scholarly traditions, not competing ones.
**Rationale:** Multiple flat form diagram layers solve the EDM simultaneous-frameworks problem. The written analysis widget with prose references solves the classical hierarchy problem. Both can coexist in the same file. The architecture does not need to choose between them: an EDM file will typically have two or three form layers; a sonata form file will typically have one form layer plus a written analysis widget.

---

**Decision:** The widget contract includes an export format definition. Each widget declares supported formats and provides a function returning a blob for each.
**Rationale:** The nature of the data differs fundamentally across widget types. A unified cross-widget export format would produce mediocre results for all. The app export UI calls each widget's export function without knowing implementation details, keeping export logic with the widget that owns the data.

---

**Decision:** HTML is the default export format for the written analysis widget. Markdown is a secondary option for technical users.
**Rationale:** Most users lack markdown-aware applications and will see raw syntax rather than rendered output. HTML opens correctly in any browser with no user education required. PDF (from the rendered view) is a third option for handout use cases.

---

**Decision:** Layer visibility is view-state; export respects current visibility.
**Rationale:** Cleaner abstraction than a separate layer-selection step at export time. The visibility toggle has value in-app independent of export — hide one layer, keep another, export what's visible.

---

**Decision:** Time-range export uses span-as-shortcut with adjustable handles.
**Rationale:** Clicking a span auto-populates a time-range selector with its start/end times; the analyst can drag handles to adjust for elisions, pickup bars, or surrounding context. The span is a suggestion, not a constraint. Handles formal ambiguity at boundaries gracefully.

---

**Decision:** Multi-widget export is deferred to v2. v1 encourages separate exports.
**Rationale:** Scope control. Composing outputs from multiple widgets into a single document requires a report-builder view. The value is real but not a v1 blocker — scholars can assemble outputs in other tools.

---

## Vocabulary

**Decision:** v1 ships with global built-in types only. Project-level custom types are v2. Community vocabularies are v3+.
**Rationale:** Scope control. The architecture supports all three from day one — the file stores a vocabulary reference. The UI only needs to implement the simplest level first.

---

**Decision:** Point markers use the same three-tier vocabulary system as spans (global built-in / project-level custom / community vocabularies).
**Rationale:** Theoretically precise analytical events — medial caesura, essential expositional closure — are as corpus-queryable as span types. They are *moments* rather than *durations*, which is why they belong in the point marker type vocabulary rather than the span type vocabulary. The vocabulary architecture is the same primitive; the container is different.

---

## Point Markers

**Decision:** "Expected event not present" must be representable in the data model.
**Rationale:** In frameworks like Hepokoski/Darcy, the *absence* of an expected event (e.g., a missing medial caesura) is analytically significant and triggers specific formal consequences. A data model that can only record events that occurred cannot fully support this analytical tradition. Exact implementation is TBD (boolean `absent` field on a point marker, or a layer-level list), but the concept must be present from v1.

---

## Sharing

**Decision:** The `.strata` file is the v1 sharing primitive. No URL-based encoding.
**Rationale:** URL encoding freezes the schema at the moment of implementation — any schema change or new field risks breaking all existing URLs. This is likely why BriFormer cannot evolve its format. Strata analyses will also be substantially larger than BriFormer files and will hit URL size limits quickly. URL-based sharing belongs to the Library phase, where analyses live on a server with real, stable URLs.
**Update:** This also applies to the embeddable viewer. The embed is file-referenced; no URL encoding of analysis data is used in the embed context. The Astro build system handles file resolution at build time.

---

## Timeline

**Decision:** The shared timeline axis implements DAW-style cursor following. When the playback cursor reaches ~80% of the visible area, the timeline scrolls to keep it in frame.
**Rationale:** BriFormer's primary UX failure: zoom in and the playback cursor leaves the visible area. DAW-style cursor following is standard in video editors and DAWs. This is core timeline axis behavior, not something individual widgets implement.

---

## Architecture

**Decision:** Analysis Tool and Library are separate products. Build Analysis Tool first.
**Rationale:** Conflating them from the start will prevent v1 from shipping. The file format being open means the Library can be built later without requiring migration.

**Update (session v0.3):** A third component — the Corpus Manager — sits between the Analysis Tool and the Library. The project now has three components: Analysis Tool (v1), Corpus Manager (v1 or v2), Library (may never be built). See below.

---

**Decision:** Build in React, client-side, no backend required for v1.
**Rationale:** Maximizes accessibility. No accounts, no server costs, no infrastructure to maintain. Scholars can use it immediately by opening a URL. The Library layer adds backend when ready.

---

**Decision:** The Corpus Manager is a distinct third component, sitting between the Analysis Tool and the Library.
**Rationale:** A local-first corpus management view — finding and presenting `.strata` files, grouping them into named projects, enabling lightweight filtering and counting — is architecturally distinct from the single-file Analysis Tool and from the server-backed Library. It may be implemented as a second mode of the Analysis Tool rather than a separate app, but the component boundary is clear.

---

**Decision:** The Library is explicitly deprioritized and may never be built.
**Rationale:** The Analysis Tool and Corpus Manager together constitute a complete and valuable scholarly tool. The Library requires user accounts, a backend, storage, and moderation — substantial engineering for a tool already useful without it.

---

## Schema

**Decision:** Widget extensibility uses a typed envelope pattern. The core schema enforces structure around every layer entry (id, type identifier, label, visibility, display order). The `data` field inside each layer entry is defined by the widget type, not the core schema.
**Rationale:** The core schema says "there is a data field and it is an object." The widget contract says "here is what that object contains." New widget types can be added without modifying the core schema, keeping the core stable while widget definitions evolve independently.
**Update:** The widget contract's render component is the shared primitive between the editor and the embeddable viewer. The viewer instantiates render components only. The editor wraps render components with edit components. This distinction must be maintained as a first-class architectural boundary in implementation.

---

## Launch

**Decision:** A demo corpus ships with the official Strata release.
**Rationale:** Adoption requires a lived demonstration of the corpus query value proposition — describing the feature is insufficient. The epistemic leap from "interesting tool" to "this changes what scholarship can do" happens through working examples on real music scholars recognize, not through feature descriptions. The demo corpus also positions the creator as the first scholar publishing with Strata, not just building it. The Anthemics EDM corpus is the natural seed for the EDM portion.

---

## Corpus Builder

**Decision:** The Corpus Builder is a separate companion application, not a mode of the Analysis Tool.
**Rationale:** Its scope — MEI support, Supabase backend, extensibility surface for external analysis tools — is architecturally distinct from the single-file Analysis Tool. A shared codebase is an open question, but the product boundary is clear.

---

**Decision (provisional — under debate):** The Corpus Builder uses Supabase as a personal backend. Each scholar's data lives in their own Supabase project, under their own keys.
**Rationale:** Scholars own their data. Technical collaborators can query the Supabase database directly. The extensibility surface is Supabase itself — external tools access it via API. No backend infrastructure cost for the tool's developer.
**Counter-argument:** A local-only approach (SQLite, no accounts, no internet dependency) is more consistent with the Analysis Tool's no-backend philosophy and imposes zero onboarding friction. A local-first with optional sync model may be the right resolution. See vision.md Section 9.3 for full tradeoff analysis. **Resolve before Corpus Builder development begins.**

---

**Decision:** Linking between `.strata` and MEI files is manual, declared by the scholar, using the existing `work` field.
**Rationale:** Automatic span-level linking between clock-time (.strata) and score-time (MEI) requires a performance alignment map — technically hard and out of scope. Work-identity linking is sufficient for corpus grouping: a `.strata` file and an MEI file that both reference the same `work` value are associated. Human-declared, not computed.

---

*Add new decisions below this line as they are made during development.*

---

## v1 Feature Scope (Phase 0.6)

*Decisions made during the Phase 0.6 v1 feature scope session, conducted collaboratively with Devin Chaloux. Output: v1 Scope section of `_private/build-plan.md`.*

---

**Decision:** `Span.color` is replaced by two independent fields: `Span.fillColor: string | null` and `Span.strokeColor: string | null`. `Layer.colorDefault` is similarly replaced by `Layer.fillColorDefault: string` and `Layer.strokeColorDefault: string`.
**Rationale:** Form diagram spans are arcs and brackets — the fill (interior of the shape) and the stroke (the arc/bracket line) are visually and analytically independent. An analyst may want a light fill with a dark stroke, or a colored stroke with no fill. BriFormer exposes both controls; Strata must as well. Storing them as a single `color` field would force a coupled value that cannot represent this distinction. The change propagates to `src/types/strata.ts` and `schema/strata.schema.json` in Phase 2.

---

**Decision:** The color picker UI shows two labeled rows (Fill / Stroke), each with a curated swatch palette of 8–10 preset colors and a hex input fallback. A "layer default" option sets the field to null, restoring inheritance from the layer's default colors.
**Rationale:** BriFormer's color picker (a large named-color grid) was identified by Devin as poor UX. A small curated swatch palette covers the common cases with one click; the hex input handles custom colors. The "layer default" option makes it easy to clear a per-span override without knowing the layer's exact color value.

---

**Decision:** Per-span fill + stroke color override UI ships in v1. Layer reordering ships in v1 (dnd-kit sortable). `parentId` picker UI is v1.5 — the field is in the schema and displayed read-only in the Advanced section, but no span reference picker is built in v1.
**Rationale:** Color override and layer reordering are both low implementation cost relative to their workflow value. `parentId` picker requires a searchable span reference dropdown that is non-trivial to implement well; the field exists in the schema and can be set programmatically or via future UI without migration. Deferring the picker does not block any core analytical workflow.

---

**Decision:** Custom span type creation and custom point marker type creation are v1 requirements. The UI is a "Add type" flow in the vocabulary type picker, creating a project-level `VocabTerm` stored in `StrataDocument.vocabulary`.
**Rationale:** Classical and common-practice scholars require H&D-framework point marker types (MC, EEC, ESC) and custom formal section labels. Deferring custom types to v2 would make the tool unusable for this audience at launch. This was flagged in a prior session; Phase 0.6 confirms and extends it to span types as well.

---

**Decision:** The built-in vocabulary type picker groups terms by analytical tradition: General, Pop/Rock, EDM, Common Practice, Jazz, Form Letters. A document-level tradition preference controls which group expands by default.
**Rationale:** A flat list of 45+ terms is overwhelming when an analyst needs only 8. Grouping by tradition makes the picker navigable and surfaces the most relevant terms first. The tradition preference is set at document creation and can be changed in document settings; it affects the picker's default state only, never restricts which terms are available.

---

**Decision:** Form-letter span types (A, B, A', B'', etc.) are generated dynamically via a "Letter…" generator in the type picker rather than pre-defined in the built-in vocabulary.
**Rationale:** The number of possible letter-prime combinations is unbounded across analytical traditions and works. Pre-defining even A–F with double-prime variants would require 18+ entries, most of which any given analyst would never use. The dynamic generator lets the analyst specify the letter and prime count on demand; the resulting term is stored as a project-level custom type. `rotation` is the one pre-defined form-letter type because it is a named analytical concept (Hepokoski rotational analysis), not a positional label.

---

**Decision:** Letter-form labels (A-section, B-section, A', Rotation) are vocabulary span *types*, not annotation text. They are corpus-queryable.
**Rationale:** "How often does the B section of a ternary form contain a modulation?" and "How many rotations does this corpus average?" are real corpus questions. If these labels live only in the free-text annotation field, they are not queryable without string matching. Making them vocabulary types gives them the same corpus-query status as `chorus` or `exposition`. This is distinct from phrase-level letter labels (A, B, C for individual phrases within a period or sentence), which are work-specific annotations that go in `Span.annotation` as free text and are not corpus-queryable in a meaningful cross-work sense.

---

**Decision:** Vocabulary pack import (`.vocab.json`) is a v1 feature. Terms from an imported pack merge into `StrataDocument.vocabulary` with a `source` field recording pack provenance. The `.strata` file remains self-contained — no external dependency at open time.
**Rationale:** The vocabulary system is inherently community-driven; no single maintainer can anticipate every analytical tradition's term requirements. Making pack import available at v1 ensures the tool is not a dead end for traditions not covered by the starter set. File-based import requires no server, no accounts, and no infrastructure — it is as simple as opening a `.strata` file. In-app pack discovery (browsing, ratings, versioning) is the v3+ infrastructure layer; file import is the v1 foundation that makes community sharing possible immediately.

---

**Decision:** `PointMarker` gains an optional `harmonicContext: string | null` field. When set, the display format is `{harmonicContext}:{typeAbbreviation}` (e.g., `V:HC`, `I:PAC`, `bVI:IAC`).
**Rationale:** Key context for cadences — "this is a half cadence in the key of the dominant" — is analytically significant and corpus-queryable independently of the cadence type. Storing it as free-text in the label field (e.g., labeling the marker "V:HC") makes it display-only and not queryable. A dedicated `harmonicContext` field enables corpus queries like "all half cadences in the dominant" across a corpus. The field is optional and available on all point marker types, not only cadences, since key context may be relevant to other events (key changes, theme entries, etc.).

---

**Decision:** The built-in vocabulary starter set ships with 45 terms: 32 span types across General, EDM, Common Practice, and Jazz traditions; 13 point marker types across General, Cadences, and H&D groups. Full list in `_private/build-plan.md` under "v1 Scope."
**Rationale:** 45 terms is enough to cover immediate use cases across EDM, common-practice, and jazz scholarship without overwhelming the picker. Terms missing from the starter set are addressed via the "Add custom type" flow (v1) or vocabulary pack import (v1). The list will expand through stress-testing on real analyses; it is not intended to be comprehensive at launch.

---

## Merge UX (Phase 0.5)

*Decisions made during the Phase 0.5 merge UX design session, conducted collaboratively with Devin Chaloux. Output: `_private/merge-ux-spec.md`.*

---

**Decision:** Multi-select uses three gestures: Shift+click for range selection (auto-fill), Ctrl+click for toggling individual spans, and context-sensitive box-drag on empty layer space for rectangle selection.
**Rationale:** Shift+click-to-range is the universal convention for contiguous selection (Finder, text editors, spreadsheets). Auto-filling spans between the first and last selected span is correct behavior — requiring the analyst to manually Ctrl+click every span in a run would be tedious and error-prone. Ctrl+click for non-contiguous multi-select is equally universal. Box-drag on empty space is context-sensitive: drag on a span body or boundary handle has its own meaning; drag on empty space unambiguously means "select what I'm drawing a rectangle around."

---

**Decision:** Cross-layer merge is not supported. Merge is always within a single layer.
**Rationale:** A merged span must live in exactly one layer. If two spans from different layers are merged, there is no unambiguous answer for which layer the result belongs to — a "choose layer" dialog would add friction without a compelling use case. Analysts wanting to consolidate across layers have the option of duplicating a span into one layer and then merging. Cross-layer merge may be reconsidered if a concrete user need emerges.

---

**Decision:** Merge is accessed via three points: a toolbar button in the primary app chrome, the Ctrl+J keyboard shortcut, and the right-click context menu. The metadata panel action strip also provides "Merge ←" and "→ Merge" buttons for single-span 2-span merge (mobile and discoverability path).
**Rationale:** The context menu alone is insufficient — it is not accessible on mobile and is not discoverable for new users. A persistent toolbar button is always visible; its disabled/enabled state communicates merge eligibility at a glance. The metadata panel action strip mirrors the context menu for single-span operations (per the Phase 0.4 principle that all structural operations must be reachable from both surfaces). Ctrl+J ("Join") is the keyboard shortcut: mnemonic, unused in the existing key map, and unambiguous on both platforms (Ctrl+M minimizes windows on Mac; M is taken by point marker placement).

---

**Decision:** Merge is only enabled when all selected spans are consecutive within the same layer. Non-consecutive Ctrl+click selections are valid multi-selections but merge is disabled for them.
**Rationale:** Merging non-consecutive spans would silently consume the spans between them — a destructive side effect not implied by the selection. The analyst who wants to merge a non-consecutive set must explicitly include the intermediate spans. This is enforced at the UI level (disabled button + tooltip); the merge logic itself only ever operates on a consecutive range.

---

**Decision:** The conflict dialog shows a read-only "Auto-resolved" section alongside the interactive conflict resolution fields.
**Rationale:** The analyst should see the full picture of what the merged span will contain — not just the fields they need to decide, but also the fields that were decided automatically and why. Hiding auto-resolved fields from the dialog would require a secondary "show more" step to audit. The read-only section is visually distinct (lower priority, lighter weight) so it does not compete with the interactive resolution fields.

---

**Decision:** The "Merge spans →" confirm button in the conflict dialog is disabled until all conflicting fields have a selection.
**Rationale:** Partial resolution would produce a span with null values in fields that had competing entries — silently discarding data. Requiring all radio groups to be resolved before confirming ensures the analyst has explicitly handled every conflict. The cost is that the analyst cannot "confirm and come back" — but the conflict dialog is scoped to only the fields with genuine conflicts, so the number of required choices is minimal.

---

**Decision:** Notes from all selected spans are concatenated with a `\n\n---\n\n` separator. No conflict dialog for notes regardless of content.
**Rationale:** Notes are additive records — both entries represent things the analyst observed and wrote down. There is no analytical basis for choosing one over the other. Concatenation preserves all information. The separator makes the boundary between the original notes legible in the merged record.

---

## Shared Time Point Pool

**Decision:** Time points are a document-level shared resource (the "shared time point pool"), not owned by any individual widget.
**Rationale:** If time points are widget-owned, every widget that needs to reference the same timestamp must either copy it (creating sync problems when boundaries move) or implement an inter-widget import mechanism (creating directional dependencies). A document-level pool that any widget can contribute to and read from eliminates both problems. It also makes the workflow order-agnostic: whether the analyst starts in the form diagram or the energy contour widget, all time points are immediately available everywhere. Informed by BriFormer's siloed architecture as a negative model — siloing is the failure mode this decision explicitly inverts.

---

## Energy Contour Widget

**Decision:** The energy contour widget is named "Energy Contour." Previous references to "Intensity Graph" or "Sonic Density Graph" are superseded.
**Rationale:** "Energy contour" has precedent in music theory discourse (melodic contour is a well-established concept; energy contour is its functional analog). It accurately describes what the widget tracks — the shape of energy over time — without implying acoustic measurement ("density") or conflating with loudness ("intensity"). "Sonic energy contour" is an acceptable long form.

---

**Decision:** The energy contour widget uses discretized control points, not a free-drawn continuous curve.
**Rationale:** A free-drawn curve is always unique — no two analysts will produce the same curve for the same track, and there is no basis for saying two curves are "the same" for corpus comparison purposes. A discretized profile built from control points at analyst-assigned intensity levels can be identical across two analyses, making cross-track comparison possible. Discretization forces the analyst to make interpretive claims ("this section is level 3") rather than impressionistic traces. This is the epistemological point of the widget: producing comparable, arguable, queryable analytical data rather than a visual impression.

---

**Decision:** Intensity is stored as a continuous float (0.0–1.0). Display divisions are a layer-level preference, not a data constraint.
**Rationale:** Storing intensity as a float means two analyses using different division counts (5 vs. 7) are still comparable at the data level — both map to the same underlying numeric space. Division count is a display and workflow preference. An analyst working with highly dynamic repertoire may need 7 divisions; a coarser analysis may only need 3. The data model does not change between these cases.

---

**Decision:** Transition type (gradual vs. step) between energy contour control points is analytical data, stored in the segment between control points, not a rendering preference.
**Rationale:** The distinction between a gradual energy increase (buildup) and an instantaneous energy change (drop hit, breakdown cutoff) is analytically significant and corpus-queryable. A corpus question like "in what percentage of tracks does the first peak arrive via a gradual transition?" requires this field to be stored as data. Treating it as a rendering choice (smooth curve vs. stepped line) would discard analytical information. This parallels the `confidence` field on spans — both encode interpretive claims as structured data rather than visual decoration.

---

**Decision:** The energy contour widget tracks function, not mechanism. Mechanism detail belongs in the instrumentation widget.
**Rationale:** The energy contour answers: what is energy doing? (Up, down, by how much, how fast.) The instrumentation widget answers: what specific elements and techniques produce that energy change? These are orthogonal questions. Smith's (2021, MTO 27.2) continuous process framework — tracking filter sweeps, pitch slides, snare rolls — is mechanism-level analysis and is more naturally captured in the instrumentation widget or in the `notes` field of a control point. The energy contour deliberately does not encode mechanism because doing so would couple the two layers unnecessarily and reduce the generalizability of the energy contour to non-EDM repertoires where the mechanisms differ.

---

**Decision:** The three core planned widgets — form diagram, energy contour, instrumentation/layer — are orthogonal analytical views, not redundant ones.
**Rationale:** Each answers a genuinely different question at a different level of abstraction. Form diagram: what are the formal sections and their types? Energy contour: what is the functional energy trajectory across those sections? Instrumentation layer: what specific elements and mechanisms produce that trajectory? These map to the scholarly lineage: Peres/Barna work at the form diagram level; the energy contour operationalizes functional energy analysis; Smith's continuous process framework works at the instrumentation level. A complete analysis file can use all three simultaneously without any layer's data being redundant with another's.

---

## Hierarchical Enforcement

**Decision:** The hierarchical enforcement toggle is opt-in, per-layer, buried in settings, and accompanied by a warning on activation.
**Rationale:** Strata's default — overlapping spans allowed — is itself a theoretical statement about the nature of musical form. Making hierarchy an opt-in constraint rather than the default makes that theoretical posture visible rather than silent. Analysts whose frameworks require hierarchical constraint (e.g., Schenkerian analysis) can enable it per layer. The warning on activation serves two purposes: it informs the analyst of what they are giving up, and it makes the tool's theoretical position legible as a design choice rather than a technical limitation. The toggle applies at the editing UI level only; the underlying data model does not change.

---

## EDM as Origin — Product Claim Reframe

**Decision:** EDM is the origin and stress test of Strata's architecture; layered time span analysis producing structured comparable data is the actual product.
**Rationale:** EDM's formal complexity — overlapping frameworks, energy-driven structure, non-hierarchical organization — pushed every design decision toward generality. The decision to allow overlapping spans, for example, was driven by EDM analysis but benefits classical scholars who want simultaneous Schenkerian and phrase-rhythm layers, jazz scholars tracking soloists and harmony simultaneously, and film music scholars mapping musical texture to narrative. If Strata had been designed primarily for common-practice repertoire, it would likely have shipped with hierarchical constraints baked in and been wrong for half the use cases. EDM forced the architecture to be correct. The broader music theory community is the actual audience.

---

## Embeddable Viewer

**Decision:** The `StrataViewer` render component is designed as a first-class artifact from day one, not a derivative of the editor.
**Rationale:** The editor and the embeddable viewer share the same render components for each widget — the editor adds an editing layer on top. Treating the viewer as primary keeps the render path clean and makes the embed a natural output rather than an afterthought. The widget contract's render component is the shared primitive.

---

**Decision:** The embeddable viewer is file-referenced, not inline-JSON. The `.strata` file is co-located with content and imported at build time.
**Rationale:** Three options were considered: inline JSON in MDX (ugly, diffs badly), runtime URL fetch (adds network dependency), and co-located file imported at build time (Astro-idiomatic, enables static generation, clean git history). The third is correct for a scholarly writing workflow. Also means updating an analysis updates all embeds referencing it automatically on next build — no per-embed maintenance.

---

**Decision:** Widget filtering in the embed is an allowlist prop. The embed renders only the specified widget types from the file, ignoring all others.
**Rationale:** A full `.strata` file may contain many widget layers. An embed in a prose argument typically wants to surface one — e.g., only the form diagram. The allowlist approach is the minimal correct filter: no data is altered, just the render scope is narrowed.

---

**Decision:** Span focus in the embed is slug-based, not timestamp-based.
**Rationale:** The slug is already designed as the stable human-readable reference key for inter-widget linking. It is the right mechanism for content authoring — readable in MDX, stable unless explicitly changed, and tied to a meaningful analytical unit rather than an arbitrary time offset. The embed resolves the slug to the span's `startTime` and `endTime` at render time.

---

**Decision:** Span focus triggers four simultaneous behaviors: seek to `startTime`, zoom timeline to show the span with contextual padding, loop playback between `startTime` and `endTime` (default on), and visually highlight the focused span with surroundings dimmed.
**Rationale:** Each behavior serves the analytical argument: seek puts the reader at the right place; zoom shows the span in legible detail; loop enables repeated listening while reading; highlight directs visual attention. All four together make the embed feel like a live object in conversation with the prose, not a static figure.

---

**Decision:** Span-aware context is preferred over fixed-second context windows. When context is toggled on, the embed expands to show adjacent spans in the same layer rather than an arbitrary number of seconds.
**Rationale:** Adjacent spans are analytically meaningful — what comes before and after a span in the formal structure is part of the argument. A fixed-second window is arbitrary and may cut mid-span. Span-aware context is computable from `.strata` data already present: find the focused span, find its neighbors in the same layer, render those. A `contextWindow` measured in seconds is a fallback for edge cases only.

---

**Decision:** Loop and context are author-set defaults in the embed API. Reader-accessible toggles are deferred to v2.
**Rationale:** Author defaults let the embed serve the specific analytical argument being made — loop on for "listen to this section repeatedly," loop off for "hear how this transitions into the next section." Reader toggles are a quality-of-life improvement that adds UI complexity; valuable but not required for the core scholarly writing use case.

---

**Decision:** Inline span definition (defining a span entirely in the embed without a backing `.strata` file) is explicitly deferred to v2 and may never be built.
**Rationale:** Inline spans are not backed by structured scholarly data — they would be illustrative rather than analytical. The embed's value proposition is that it surfaces real analysis from a real file. Allowing inline spans blurs that line. If needed for illustrative purposes, a static SVG export is the correct tool.

---

## Form Diagram Editor — Interaction Model

**Decision:** Whole-span dragging is not implemented. Boundary dragging only.
**Rationale:** The correction use case — "I was a beat late hitting spacebar" — is served entirely by boundary dragging between adjacent spans. Whole-span dragging introduces cascade complexity (what happens to neighboring spans?) without a compelling correction use case that boundary drag doesn't cover. If an analyst needs to move a section, deleting and re-placing is the explicit action.

---

**Decision:** Boundary dragging hard-stops at adjacent boundaries. Spans have a minimum enforced width.
**Rationale:** Allowing a boundary to be dragged through an adjacent span would silently consume it, which could destroy work. Hard stop is the safe default. Span collapse is an explicit action (merge or delete), not a consequence of dragging. Minimum span width prevents accidental collapse to zero.

---

**Decision:** Spacebar places a boundary at current playback time. Arrow keys nudge the selected boundary by small increments. Both operate on the same selected boundary object.
**Rationale:** Spacebar-to-place is BriFormer's correct insight and is worth keeping. Arrow key nudge addresses the most common correction case (slightly mistimed placement) without drag complexity. Drag handles coarser correction. The interaction model is: place with spacebar, nudge with arrows, drag for larger adjustments. All three are available on a selected boundary.

---

## Merge

**Decision:** Merge is a v1 requirement, not a v1.5 deferral.
**Rationale:** Merge exists in comparable tools. Its absence will feel like a regression to analysts familiar with the space. The scholarly workflow genuinely requires it — analysts frequently place boundaries speculatively and then consolidate. Shipping v1 without merge sets a lower bar than the tools being replaced.

---

**Decision:** Merge uses a conflict-only dialog. Non-conflicting fields are resolved automatically before the dialog opens. The dialog surfaces only fields with genuinely competing values.
**Rationale:** A dialog for every merge regardless of conflict trains analysts to click through without reading. The correct design surfaces exactly the decisions that cannot be made automatically — no more, no less. This matches how the analyst thinks: "merge these two, and tell me if there's something I need to decide."

---

**Decision:** Merge field resolution rules (pre-dialog automatic resolutions):
- **Label:** one span has a label, the other does not → take the one that exists, no dialog. Both have different labels → dialog required.
- **Type:** both the same → take it, no dialog. Both different → dialog required.
- **Notes:** concatenate both with a separator, no dialog. Neither value is lost.
- **Confidence:** take the lower confidence of the two. A merged span inherits the uncertainty of its least certain component.
- **Color:** one has a per-span color override, the other does not → take the override, no dialog. Both have different color overrides → dialog required.
- **Time points of interest / point markers:** union of both sets, no dialog. Presence of a point marker is additive, not competing.
- **parentId:** if both point to the same parent → keep it. If different or conflicting → dialog required.
**Rationale:** These rules reflect the semantics of each field. Notes are additive; confidence is pessimistic; time points are additive; structural fields with genuine competing values require human judgment.

---

**Decision:** Multi-span merge (three or more consecutive spans) is supported via box-select or shift-click, applying the same conflict-only dialog logic.
**Rationale:** The analytical need exists — analysts may want to consolidate a run of provisional spans into a single confirmed section. The resolution logic is the same as two-span merge; the only difference is UI selection model. Design the selection model to support multi-select from the start.

---

**Decision:** A merged span receives a new auto-generated ID. The old IDs are recorded in a deprecation record on the merged span: `mergedFrom: [idA, idB]`.
**Rationale:** In v1, inter-widget references to span IDs are not yet built, so broken references are not yet a live problem. However, the deprecation record costs nothing to store now and makes future reference resolution possible without archaeology. When inter-widget data sharing is built, a reference to a deprecated ID can be resolved to the merge successor.

---

**Decision:** Merge UX requires a dedicated design session before implementation begins.
**Rationale:** The conflict-only dialog design, the multi-select UX, the deprecation record format, and edge cases (merging spans with different parents, merging across layers) have enough surface area to affect the span editor design generally. Resolve in a focused session before building the form diagram editor.

---

## Source References

**Decision:** `sourceOffset` is a field on the source reference object, not on the analysis document. It stores the offset in seconds between the recording's true start and the YouTube video's audio start.
**Rationale:** The offset is a property of a specific source reference (a YouTube video), not of the analysis. Span timestamps always store truth relative to the recording. When seeking to a span at 94.0s from a source with a 3.0s offset, the player seeks to 97.0s. Negative offsets are supported for cases where the YouTube video begins after the track's true start. Updating the offset corrects all seeking behavior without touching any span data.

---

**Decision:** YouTube link health is verified via the oEmbed endpoint (`https://www.youtube.com/oembed?url={videoUrl}`), no API key required. Verification is implemented as a scheduled GitHub Action.
**Rationale:** The oEmbed endpoint returns a failure for both deleted and private videos — the correct behavior, since both represent a broken embed regardless of cause. A weekly scheduled Action scanning all `.strata` files in the repo and opening an issue on failure provides passive monitoring with zero maintenance cost. The analyst is notified before a reader encounters a broken embed.

---

## Tech Stack

**Decision:** Vite + React 18 + TypeScript is the application stack.
**Rationale:** React is the right choice for a widget-based, timeline-driven UI. Vite over Next.js or CRA because the tool is a pure client-side SPA with no backend or SSR needs — no framework overhead. TypeScript is essential: the schema is the core invention, and TypeScript types are the living schema documentation. The widget contract is a TypeScript interface. AI-assisted development with typed code is significantly more reliable.

---

**Decision:** Zustand + zundo for state management, with undo/redo as a v1 requirement.
**Rationale:** Zustand handles the "whole document is the state" editing model cleanly without Redux boilerplate. zundo middleware wraps the document store to provide undo/redo via a history stack. UI state (selected span, zoom level, playback cursor) is in a separate store not subject to undo. This separation is critical: undoing a span placement should not undo a zoom or panel state change.

---

**Decision:** Tailwind CSS for styling; shadcn/ui for component primitives.
**Rationale:** Tailwind's utility approach is fast for prototyping and well-supported by AI tooling. shadcn/ui (built on Radix UI) provides accessible, unstyled primitives (dialogs, dropdowns, sheets) that the merge conflict dialog, layer settings panel, and metadata panels require. Components are copied into the repo rather than imported — no version lock-in, full customization.

---

**Decision:** pdf-lib for PDF export.
**Rationale:** Better TypeScript support than jsPDF. Sufficient for the form diagram export use case.

---

**Decision:** File I/O uses the File System Access API with a download fallback.
**Rationale:** File System Access API allows true "save in place" (overwriting the original file without a download prompt) in Chrome and Edge — the primary target browsers. Safari and Firefox, which lack reliable support, fall back to download-based save. Opening files uses `<input type="file">` everywhere as the universal fallback. The `.strata` file is the primary artifact; download-based save is a workable fallback for non-Chrome browsers. localStorage provides silent crash recovery (auto-save every 30 seconds) separate from the primary save mechanism.

---

**Decision:** Vercel for hosting; Vitest for testing.
**Rationale:** Vercel provides zero-config deployment for Vite/React with GitHub integration. Vitest pairs naturally with Vite and provides Jest-compatible syntax. Core test targets: schema validation, merge field resolution rules, slug generation, and file I/O roundtrip.

---

## v1 Scope

**Decision:** Classical scholars are in v1 scope. Custom project-level point marker types are a v1 requirement.
**Rationale:** Classical and common-practice scholarship is a first-class use case, not a later addition. Hepokoski/Darcy analysis requires custom point marker type terms (medial-caesura, EEC) that are not in the global built-in set. Deferring custom types to v2 would make the tool unusable for this audience at launch.

---

**Decision:** Global built-in types ship as a minimal starter set and expand through stress-testing. The list does not need to be finalized before coding begins.
**Rationale:** v1 is for the developer's own analytical use across multiple repertoires. The schema mechanism (vocabulary reference + type field) is what needs to be correct from day one. The actual built-in list is a content decision that improves iteratively through use. Locking it in upfront would be premature.

---

**Decision:** The `absent: boolean` field on point markers is included in the schema from day one. No v1 UI is built for it.
**Rationale:** Recording "this expected event was explicitly determined to be absent" is analytically important (Hepokoski/Darcy and similar frameworks). However, the UI complexity of surfacing this at v1 — and the risk of premature design — outweighs the benefit. The field in the schema costs nothing and prevents a migration when v2 adds it. The v1 proxy: query the corpus for layers with no point marker of the expected type. This covers the practical need without dedicated UI.

---

**Decision:** Energy contour widget is a fast follow after v1, not a v1 scope item.
**Rationale:** The form diagram is the data spine of the system — the widget all others reference. Getting it right and stress-tested first is the correct priority. The energy contour data model is fully designed (see decisions above) and can be implemented cleanly once the form diagram foundation is solid.

---

## Schema Finalization (Phase 0.1)

*Decisions made during the Phase 0.1 schema drafting session. Outputs: `schema/strata.schema.json`, `schema/strata.types.ts`, `schema/example.strata`.*

---

**Decision:** ~~Point markers are per-layer (stored inside `FormDiagramData`).~~ **Reversed — see below.**

**Decision:** Point markers are document-level (stored in `StrataDocument.pointMarkers`), not per-layer.
**Rationale:** A point marker like the medial caesura is an event in the recording — it happens at a specific timestamp in the music. It is not a property of any particular analytical layer. Making markers per-layer would require duplicating the same MC marker across any layer that "cares about" it, which creates sync problems and is semantically wrong: the MC doesn't belong to the form-diagram layer, it belongs to the piece. The `type` field already provides analytical framework context — a marker typed `"medial-caesura"` is unambiguously an H/D-framework event without needing layer ownership. The timeline ruler is a document-level element and naturally hosts document-level events. Frameworks are identified by vocabulary type, not by layer membership.

---

**Decision:** The `source` field is a structured `SourceReference` object, not top-level `youtubeUrl` and `localAudioRef` fields.
**Rationale:** The `sourceOffset` is a property of a specific source reference, not of the document (already decided). Making source a structured object rather than top-level fields makes that coupling unambiguous — the offset is always co-located with the URL or filename it modifies. A document with multiple sources in the future (e.g. YouTube primary + local fallback) can extend this structure naturally. The object also makes the type discriminant (`type: "youtube" | "local"`) explicit rather than implicit from which field is non-null.

---

**Decision:** `Span.label` is `string` (empty string allowed for new unlabeled spans). `Span.slug` is `string | null` (null until a label is set).
**Rationale:** Newly placed spans have no label. Storing an empty string is cleaner than null for a display field — it means "no label yet" without making every label read-site handle null. Slug is nullable because it is only generated from a label; a span with no label has no stable slug, and null is the honest representation of that state.

---

**Decision:** `VocabTerm.id` is constrained to lowercase alphanumeric and hyphens, starting with alphanumeric (`^[a-z0-9][a-z0-9-]*$`).
**Rationale:** Term IDs are stored as the `type` value in spans and point markers across many files. They must be stable, URI-safe, and filesystem-safe. The pattern enforces this at the schema level and prevents terms that would be difficult to use as keys in corpus queries or future community vocabulary filenames.

---

**Decision:** `SharedTimePoint` schema carries four fields: `id`, `timestamp`, `label?`, `sourceLayerId?`. No `type` field on the time point itself.
**Rationale:** The shared pool is a coordination layer, not an analytical layer. Time points in the pool are positional anchors — their analytical significance comes from the widget data that references them, not from metadata on the point itself. Adding a `type` field to time points would duplicate analytical meaning that already lives in the span or energy contour control point that generated the time point. Minimum viable pool entry: position and provenance. A `label` is allowed for human-readable context; `sourceLayerId` for provenance.

---

**Decision:** The layer type identifier for the form diagram widget is `"form-diagram"` (not `"form"`).
**Rationale:** `"form"` is ambiguous as a string value — it could plausibly mean the HTML form element type to a reader unfamiliar with the project, and it gives no indication of the display format. `"form-diagram"` is self-describing, matches the widget's name throughout the codebase, and follows the same pattern future types will use: `"energy-contour"`, `"instrumentation"`, `"written-analysis"`.

---

**Decision:** `Span.mergedFrom` has `minItems: 2` in the JSON Schema.
**Rationale:** A merge by definition requires at least two source spans. A `mergedFrom` array with one item would be either an error or a degenerate case (copying a span, not merging). Enforcing the minimum at the schema level makes the constraint explicit and catches bugs in the merge logic during validation.

---

## Schema Revision (Phase 0.1 — Session 2)

*Decisions made during an extended review of the initial schema draft. Applied across `schema/strata.schema.json`, `schema/strata.types.ts`, `schema/example.strata`, and `schema/strata-schema-reference.md`.*

---

**Decision:** `artist` is `string[]` (array), not `string`.
**Rationale:** Multi-artist tracks (`["The Chainsmokers", "Halsey"]`) cannot be cleanly represented as a single string without choosing an arbitrary delimiter. A comma-separated string is not queryable or filterable. An array is the correct type for a field with 1..N values, even when most tracks have exactly one.

---

**Decision:** `context` is optional (not required). `"remix"` removed from the `context` enum. Valid values: `"recording"`, `"performance"`, `null`.
**Rationale:** `"remix"` describes a *relationship to another work*, not the *nature of the artifact itself*. Recording/performance is the artifact dimension; derivative relationship is a separate dimension now captured by `derivativeOf`. Making `context` optional reduces friction for new file creation — analysts are encouraged but not required to set it before cross-corpus comparison.

---

**Decision:** `sourceTrack: string | null` replaced by `derivativeOf: { sourceTrack: string, relationship: string } | null`.
**Rationale:** A bare filename provides no information about *how* this track relates to the source. `derivativeOf` pairs the filename with a `relationship` field, making the connection queryable. Suggested relationship values: `"remix"`, `"cover"`, `"rerecording"`, `"arrangement"`. Free text is accepted — the list is not exhaustive. Null for original recordings.

---

**Decision:** `StrataDocument.notes: string | null` added.
**Rationale:** Analysts need a place for document-level overview text — methodological notes, analytical caveats, summary of findings — that is not timestamped or structured. Distinct from the Written Analysis widget (which is timestamped, structured prose tied to specific moments). The `notes` field is a simple free text field for orientation notes that apply to the file as a whole.

---

**Decision:** `bpm: number | null` and `timeSignature: { numerator: number, denominator: number } | null` added to `StrataDocument`.
**Rationale:** The BPM grid utility — which generates bar-level time points in the shared pool for span boundary snapping — requires BPM and time signature data. Storing these at the document level makes them available to all widgets and to the shared pool generation logic. Both are optional (null for tracks where not applicable or not set). The grid must also support manual correction at elision points (e.g., where bar numbering resets) — noted as a Phase 0.3/1.6 UX decision.

---

**Decision:** `Layer.description: string | null` added (optional).
**Rationale:** When a file contains multiple simultaneous analytical layers, the layer `label` (a short tab name) is insufficient to convey the analytical framework or purpose of each layer. `description` provides space for that context — e.g., `"Hepokoski/Darcy exposition analysis"` or `"Phrase-level hypermeter, 4-bar units"`. Distinct from `label`. Togglable visibility in the UI so it doesn't clutter the editing view.

---

**Decision:** `Span.label` is now optional (`string | null`), not required.
**Rationale:** Bar-level hypermeter spans (1, 2, 3, 4, repeating) and other structural spans where the `type` field carries all the analytical meaning do not need a label. Requiring a label forces analysts to enter meaningless text for these spans. Null is the honest representation of "this span has no name." The `type` field continues to carry the corpus-queryable meaning.

---

**Decision:** `Span.annotation: string | null` added (optional).
**Rationale:** Two kinds of text need to be associated with a span: (1) tooltip-only working notes (`notes`) and (2) analytical observations that should appear *on the diagram itself* (`annotation`). Without a separate field, analysts have no way to indicate diagram-level claims vs. working notes. `annotation` is displayed on the span body alongside the label; `notes` is tooltip-only. `annotation` also feeds into the Written Analysis widget when built, serving as the machine-readable bridge between diagram and prose.

---

**Decision:** `Span.lyrics: string | null` added (optional).
**Rationale:** Lyric text is analytically significant across multiple scholarly traditions (text-music relationships, prosody, syntax-form alignment). Storing lyrics on the span that contains them makes the field corpus-queryable and available to the Written Analysis widget. Not displayed on the form diagram by default. Distinct from `annotation` (which is analytical prose about the span) and `notes` (which is the analyst's working observation).

---

**Decision:** `Span.confidence` made optional (not required). Default implied: `"definite"`.
**Rationale:** Requiring the analyst to explicitly set `confidence = "definite"` on every span adds friction for rapid boundary placement without analytical benefit. The default is always `"definite"` — only `"approximate"` and `"speculative"` convey non-obvious information. Analysts should only set this field when they are consciously departing from the confident default.

---

**Decision:** `Span.startBoundaryType` and `Span.endBoundaryType` added. Type: `"definite" | "gradual" | "elided" | null` (optional).
**Rationale:** The *character* of a formal transition at a span boundary is analytically significant and corpus-queryable, and is distinct from the analyst's *confidence* about where the boundary falls. `"definite"` = hard, precise cut. `"gradual"` = processual transition (a buildup that gradually becomes the section). `"elided"` = the boundary is formally simultaneous with the adjacent span's boundary. Elision is encoded by two adjacent spans both marking their shared boundary as `"elided"` combined with overlapping timestamps; the renderer draws the elision visual when it detects this pattern. BriFormer conflates transition character with placement confidence into a single visual style — Strata separates them into orthogonal, independently queryable data fields.

---

**Decision:** `PointMarker.flagged`, `PointMarker.absent`, and `PointMarker.confidence` made optional (not required). Defaults: `false`, `false`, `"definite"`.
**Rationale:** Same reasoning as `Span.confidence` above. Requiring all three fields on every point marker creates friction for rapid placement (the most common point marker use case — "flag this moment, come back later"). Omitting the field is equivalent to the unambiguous default: not flagged, not absent, confident placement.

---

**Open notes (carry forward to Phase 0.6):**

- **Slug uniqueness:** Slugs are generated from labels and de-duplicated by chronological `startTime` order, not creation order. The embed API supports targeting spans by slug, UUID, or `startTime` — so unlabeled spans (no slug) are still navigable by timestamp.
- **BPM grid correction:** The BPM grid utility must support correction points where bar numbering resets (e.g., at formal elisions where bars 3|4 become bars 1|2 in the next hypermeter unit). This is a Phase 0.3/1.6 UX decision.
- **Built-in vocabulary starter set:** The global built-in type list (span types and point marker types) will be defined in Phase 0.6 after stress-testing across multiple analytical traditions. The schema mechanism is fixed; the content is a Phase 0.6 deliverable.

---

## Widget Contract (Phase 0.2)

*Decisions made during the Phase 0.2 widget contract design session. Output: `widgets/_contract.md` (new), `widgets/form-diagram.md` (new).*

---

**Decision:** The widget contract is expressed as a `WidgetDefinition<TData>` object, not a class interface.
**Rationale:** A plain object with typed fields is more idiomatic in React/TypeScript, simpler to tree-shake, and easier for future community widget authors to implement. The object is registered in a `Map<LayerType, WidgetDefinition<any>>` at application startup.

---

**Decision:** `WidgetRenderProps` and `WidgetEditProps` are distinct prop interfaces. `WidgetEditProps` extends `WidgetRenderProps` and adds mutation callbacks.
**Rationale:** The render component must be safe to use in the embeddable viewer, which means it cannot accept mutation callbacks or have side effects beyond rendering. Keeping the two prop sets distinct makes this constraint enforced by type rather than convention. The edit component inherits all render props and adds only what the editing layer needs.

---

**Decision:** Widgets wire to the document store through callbacks (`onDataChange`, `onSpanSelect`, `onSpanHover`, `onSeek`), not by importing the Zustand store directly.
**Rationale:** Store-agnostic widgets are independently testable and can be reused in contexts where the store is replaced or mocked. The editor shell provides the callbacks; the widget treats them as opaque function references. This also keeps third-party widgets decoupled from the internal state architecture.

---

**Decision:** `ViewState` is a dedicated interface carrying `zoom`, `scrollOffset`, and `viewportWidth`. The pixel position formula is documented on the interface.
**Rationale:** Three widgets in the planned roadmap all need to convert timestamps to pixel positions. Centralizing the formula in a documented interface — and passing `ViewState` uniformly to all widget components — prevents each widget from independently deriving (and potentially diverging on) the position calculation.

---

**Decision:** `contributeTimePoints` is a pure function on `WidgetDefinition`, not a callback from the edit component.
**Rationale:** A callback-based design would require the widget to explicitly notify the store every time a time point is added, moved, or removed — spreading pool-management logic throughout the widget's interaction code. A pure function that declares "given this data, here are my time points" lets the store compute and sync the pool on any data change, without the widget needing to know when or how synchronization happens. The pool always reflects the widget's current state.

---

**Decision:** BPM grid time points carry `sourceLayerId: null`. No widget's `contributeTimePoints` should return entries with `sourceLayerId: null`.
**Rationale:** The BPM grid utility is not a widget layer — it has no `id` in the layers array. Using `null` as a sentinel for "contributed by the BPM utility" keeps the ownership model unambiguous. The rule that widget `contributeTimePoints` functions must not return `null`-sourced entries prevents accidental clobbering of BPM grid entries.

---

**Decision:** `TimelinePresenceComponent` is a separate optional component (null if unused) that renders SVG elements directly onto the shared ruler.
**Rationale:** Timeline ruler content (span boundary ticks, energy control point markers) is contextually different from the widget's main panel content — it needs to render within the ruler's SVG coordinate system and respond to the same zoom/scroll state as the ruler itself. Separating it from the main widget panel keeps each component's rendering context clean.

---

**Decision:** Unknown widget types encountered in a loaded document render a labeled placeholder, not a crash.
**Rationale:** A document authored with a future widget type (e.g., an `"energy-contour"` layer in a file opened in a v1 build) should still load. The unknown layer's data is preserved in the document store unchanged; the UI shows a "widget type not supported in this version" placeholder. This is a forward-compatibility guarantee that costs almost nothing to implement and protects scholars' files across version boundaries.

---

**Decision:** `WidgetExporter.export` receives the full `StrataDocument` as a context argument alongside the specific `layer` and `data`.
**Rationale:** Exporting often requires document-level context: vocabulary terms (to display type labels in SVG), metadata (for PDF headers), and `duration` (to compute viewBox). Passing the full document keeps the export function signature simple and avoids threading individual fields through separately as the needs expand.

---

**Decision:** Form diagram `contributeTimePoints` IDs use the format `layerId:timestamp` (e.g., `"abc123:94.5"`).
**Rationale:** Point IDs must be stable across repeated calls for the same boundary so the store can correctly detect no-change vs. updated vs. new entries. Deriving the ID from the content (layer + timestamp) is deterministic and requires no additional state. When a boundary moves, the old ID disappears and the new one appears — the store treats this as a deletion and addition, which is correct.

---

**Decision:** The form diagram's `contributeTimePoints` deduplicates timestamps before returning — adjacent spans sharing a boundary contribute only one pool entry per timestamp, not two.
**Rationale:** A boundary shared between two consecutive spans is one moment in the music, not two. Contributing duplicate timestamps would create two pool entries for the same point, confusing snap logic (which would need to deduplicate on read) and inflating the pool unnecessarily. Deduplication at the source keeps the pool clean.

---

## Player Chrome (Phase 0.3)

*Decisions made during the Phase 0.3 player chrome design session. Output: `_private/player-chrome-spec.md`.*

---

**Decision:** The rewind button seeks to track start (0:00), not to the last-placed boundary.
**Rationale:** The correction use cases for slightly mistimed boundary placement are served by arrow-key nudge and boundary drag — not by rewind. A rewind that remembers the last placed boundary would be stateful and unpredictable, especially after the analyst has been navigating the timeline. Track-start rewind is universally expected behavior in any media player and is always the correct target.

---

**Decision:** Time display format is `M:SS.mmm` for tracks under one hour, `H:MM:SS.mmm` for tracks one hour or longer. Three decimal places of milliseconds are always shown.
**Rationale:** Arrow-key nudge moves a selected boundary by approximately one video frame (~0.033s). The analyst must be able to see that change reflected in the time display to confirm the nudge registered. Three decimal places provide that precision. `M:SS.mmm` is human-readable and maps to how analysts think about music time (minutes and seconds, not raw seconds). Tracks over one hour (operas, long film scores) require the hours field.

---

**Decision:** Playback rate selector offers four rates: 0.5×, 0.75×, 1×, 1.25×.
**Rationale:** The primary use case is slowing down for careful listening and precise boundary placement. 0.75× is the most-used slow speed — still intelligible, meaningfully slower. 0.5× handles very rapid passages. 1.25× supports quick review of familiar material without distortion. Rates above 1.25× introduce pitch artifacts that compromise analytical listening. 0.25× is rarely needed and distorts badly. The YouTube IFrame API supports all four of these rates for all videos.

---

**Decision:** The seek bar does not snap to shared time point pool entries during drag. Named pool entries (those with a `label` field) are shown as tick marks on the seek bar; BPM grid entries (sourceLayerId: null) are not shown on the seek bar.
**Rationale:** Drag-snapping on the seek bar fights the analyst when they want to land at an arbitrary position between pool entries — the most common seek target during initial listening. Tick marks provide navigation landmarks without imposing constraint. BPM grid entries are excluded from the seek bar because they are too dense at most zoom levels and would produce visual noise; they remain visible on the shared timeline axis where their density is managed by zoom.

---

**Decision:** `Space` places a form diagram boundary at the current playback time. `Space` is NOT a play/pause shortcut. `K` is play/pause.
**Rationale:** Space-to-place is BriFormer's correct insight — it is the primary capture gesture during a listening pass and must not be intercepted by the player chrome. `K` is consistent with YouTube's own keyboard shortcuts, which many analysts will already have internalized from years of using YouTube for music study.

---

**Decision:** The `requestAnimationFrame` polling loop runs continuously while the YouTube player is ready, regardless of whether playback is active.
**Rationale:** Pausing the rAF loop when paused would require a separate event path to handle externally-triggered seeks (e.g., clicking on the shared timeline axis). Running the loop continuously at one `getCurrentTime()` call per frame is negligible overhead and keeps the time display and playback cursor accurate from a single, simple code path.

---

**Decision:** YouTube's native player controls are disabled entirely (`playerVars.controls: 0`). The custom React chrome replaces all YouTube controls.
**Rationale:** Native YouTube controls and custom controls would duplicate functionality and conflict visually. The custom chrome gives full control over layout, styling, and interaction model — including the ability to suppress YouTube's default `Space` key handling, which would otherwise conflict with boundary placement.

---

**Decision:** When the video panel is "collapsed," the YouTube iframe remains in the DOM at its rendered size, clipped by a zero-height container with `overflow: hidden`. The iframe is never removed from the DOM or set to `display: none`.
**Rationale:** The YouTube IFrame API requires the iframe to be mounted and accessible to function. Removing it or hiding it via `display: none` would suspend the API, break the rAF polling loop, and require re-initialization on expand. CSS overflow clipping hides the video visually while keeping the API alive.

---

**Decision:** When the analyst changes the YouTube URL on an existing document, the player calls `player.cueVideoById(newVideoId)` (not `loadVideoById`).
**Rationale:** `loadVideoById` autoplays immediately. `cueVideoById` loads the video metadata without starting playback — consistent with the analyst's expectation that changing a URL is a document editing action, not a play action. Autoplay on URL change would be surprising and disruptive mid-session.

---

**Decision:** The video panel renders only when a YouTube URL is set on the document. When no URL is set, no video panel or iframe is rendered.
**Rationale:** Rendering an empty player state (placeholder iframe, disabled controls) when no URL is set adds visual weight without function. The transport bar is always visible but all controls are disabled when no URL is set. The video panel appears only when there is actually a video to show.

---

## Form Diagram Editor (Phase 0.4)

*Decisions made during the Phase 0.4 form diagram editor UX design session, conducted collaboratively with Devin Chaloux. An initial unilateral draft was produced and then superseded in full by a collaborative revision session on 2026-06-13. All decisions below reflect the collaborative session. Output: `_private/form-diagram-ux-spec.md` (revised), schema updates to `src/types/strata.ts` and `schema/strata.schema.json`.*

---

**Decision:** Form diagram spans are arcs and brackets, not rectangular bars. The shape model is composable: end cap geometry is driven by the existing `startBoundaryType`/`endBoundaryType` fields; top line style is a new per-span field `lineType: 'arc' | 'flat'` (default: `'arc'`).
**Rationale:** BriFormer's shape gallery offers pre-baked combinations with no semantic structure — picking "arc with diagonal start" conflates two independent analytical claims into an arbitrary visual choice. The composable model keeps each dimension semantically meaningful: `lineType` encodes the display style of the arch; `startBoundaryType`/`endBoundaryType` encode the analytical character of the formal transition (definite, gradual, elided). Both are independently corpus-queryable. Rectangular bars belong to the future instrumentation widget (DAW-style track visualization), not the form diagram. Confirmed during design session by reference to BriFormer screenshots showing bracket/arc notation on real analyses.

---

**Decision:** Shape type assignment is driven by layer-level defaults. New spans inherit the layer's default `lineType`. Post-hoc bulk adjustment (multi-select + apply in the metadata panel) is the primary shape refinement model. No per-span shape picker appears during the primary annotation workflow.
**Rationale:** Requiring analysts to select a shape for every span during placement is a BriFormer-class UX failure — it interrupts the live listening and annotation workflow. The fast path (Spacebar, Spacebar, Spacebar) must produce correctly shaped spans with zero configuration. Per-span shape deviation is an edge case handled in a second pass. Multi-select + bulk apply must be implemented in Phase 2 for this model to work; it is a load-bearing UX requirement.

---

**Decision:** Three semantic text zones exist for each span shape — above the shape (maps to `Span.label`), inside the shape (maps to `Span.annotation`), and below (maps to point marker labels; no span field in v1). Zone membership is determined by field semantics, not by shape type, span width, or available space.
**Rationale:** BriFormer conflates text position with text content — analysts choose a text zone the same way they choose a shape, with no structural meaning to the positioning choice. Strata's model makes position semantically mandatory: `label` (the section name) always renders above the arc peak; `annotation` (analytical detail — thematic IDs, bar numbers, brief observations such as "Anthem gradually emerges") always renders inside the shape body. Different scholarly traditions may use the zones differently, which is why layer-level rendering config overrides exist — but the field-to-zone mapping is the stable semantic layer that makes these choices corpus-queryable.

---

**Decision:** Text rendering within a layer is configurable via four layer-level fields added to a new `LayerRenderingConfig` object on `Layer`: `labelPosition` (`'above'` | `'inside'`), `labelJustification` (`'left'` | `'center'` | `'right'`), `annotationPosition` (`'above'` | `'inside'`), `annotationJustification` (`'left'` | `'center'` | `'right'`). Defaults: label above and centered; annotation inside and left-aligned. There are no per-span text rendering overrides in v1.
**Rationale:** Devin's workflow — section names centered above brackets, analytical text left-aligned inside the shape body — is the default, but it is not universal. Analysts using thematic letter labeling ("A", "B", "C") inside domes may want `labelPosition: 'inside'` and `labelJustification: 'center'`. A Schenkerian analyst may want annotations above the bracket. Layer-level config accommodates different scholarly practices without per-span configuration (which would produce inconsistent diagrams). The rendering config lives on the layer so every span inherits it with zero additional effort — the analyst configures the layer once, not each span.

---

**Decision:** Font size is a layer-level setting, not a per-span attribute. Per-span font size is not supported in v1. The exact API (enum vs. numeric scale) is deferred to Phase 0.7 visual design.
**Rationale:** BriFormer's central text UX failure is per-span manual font sizing, producing inconsistent sizes across the diagram — Devin reports "5 clicks in some cases" to resize a single span's text. Locking font size to the layer level prevents this class of inconsistency at the architectural level. The Phase 0.7 visual design session will define the exact mechanism; the constraint is that font size is uniform within a layer and set once, not per span.

---

**Decision:** The app shell layout is (top to bottom): above-ruler widget layers [track headers + span areas] → full-width timeline ruler → transport bar → optional below-ruler widget layers → video panel (collapsible).
**Rationale:** Form diagram arcs and brackets arch above the timeline ruler — their labels float above and their annotation text appears inside the shape body. The ruler is the temporal reference below the diagrams, not above them. This matches the orientation confirmed by Devin with reference to BriFormer (which he described as having the editing layer on top, ruler below). The transport bar sits between the ruler and the video panel. The video panel is at the bottom. The initial unilateral draft had this layout wrong (video top, ruler second, widget area below) and was corrected during collaborative review.

---

**Decision:** Each layer has a DAW-style track header cell to the left of its span content area. Headers form a left column that scrolls vertically with the layer stack. They are not a unified sidebar panel. A global collapse toggle collapses all headers simultaneously to a condensed state (~28px wide: color swatch + visibility toggle only). Per-row expand/collapse is not supported in v1.
**Rationale:** The standard DAW layout (Pro Tools, Logic, Ableton) places track headers to the left of track content with the same row height. This maintains spatial correspondence between header and content without separate scroll synchronization. Expanded headers show layer name, visibility toggle, and settings access. Condensed state provides the minimum needed to identify and toggle a layer when screen real estate is at a premium. Global collapse rather than per-row is simpler and sufficient — the use case for having some rows expanded and others condensed simultaneously is weak in v1.

---

**Decision:** The timeline ruler starts at the same horizontal position as the left edge of the span content area. The header column has a blank offset cell in the ruler row equal to the header width. This is a hard alignment invariant, not a stylistic choice.
**Rationale:** If the ruler started at the window's left edge (behind the track headers), a span beginning at 0:00 would appear shifted rightward from the ruler's 0:00 mark — the coordinate systems would be misaligned. Correct time reading from the diagram requires that span positions above the ruler align exactly with ruler tick marks below. The blank offset cell enforces this. Devin explicitly called this out during the design session when reviewing the initial mockup.

---

**Decision:** Widget position relative to the timeline ruler is a two-level setting: `defaultPosition: 'above' | 'below'` on the `WidgetDefinition` (widget contract, set by the widget type); optional `position: 'above' | 'below'` override on each `Layer` (set by the analyst per-layer in the layer settings popover). Absent a layer override, the widget's `defaultPosition` applies. Absent a widget default, `'above'` is assumed.
**Rationale:** Different widget types belong on different sides of the ruler by default. The form diagram belongs above (arcs arch above the time axis). A written analysis widget might belong below. The analyst should also be able to override per-layer for specialized workflows. Two-level configuration captures both the common case and the exception with minimal schema complexity. Adding `defaultPosition` to the widget contract and `position` to `Layer` both cost nothing now and prevent a migration later.

---

**Decision:** The metadata panel is a right sidebar (~280px) that appears when a span is selected. Architecturally it is a "detail panel with a position slot" — on wide viewports it mounts to the right; on narrow viewports (tablet/mobile) the same component renders as a bottom sheet. No redesign required for mobile adaptation, only a different mounting slot.
**Rationale:** Option A (right sidebar) was selected for sustained editing. Selecting a span and filling in label, type, annotation, boundary types, and lyrics is a multi-field workflow that benefits from a stable, predictable surface. Inline popovers compete visually with the diagram; a bottom drawer wastes vertical space on desktop. Mobile usability is a requirement (BriFormer works on mobile) and the "position slot" framing ensures mobile adaptation does not require a component rewrite.

---

**Decision:** Spacebar while playing places a span boundary at `currentTime` on the active layer, without pausing playback. Spacebar while paused starts playback. Both behaviors coexist on the same key without a mode switch. A small persistent context indicator in the transport bar shows the current Spacebar action.
**Rationale:** Spacebar-to-place (while playing, without pausing) is the correct capture gesture for live annotation: the analyst listens through the track and taps when a new section begins. Audio Timeliner's two-step workflow (Spacebar to mark → then draw bubble) was explicitly rejected by Devin. BriFormer improved this with direct placement; Strata improves further with no separate placement step. The dual behavior (place while playing, start-play while paused) requires UI acknowledgment: the context indicator ensures analysts always know what Space will do.

---

**Decision:** All structural span operations (Split at playhead, Merge with previous/next, Duplicate, Delete) are available in both the right-click context menu and the metadata panel action strip. Neither location is optional in v1.
**Rationale:** Right-click-only is a discoverability problem on desktop and a complete blocker on mobile. The metadata panel action strip provides click/tap access to all structural operations, making them reachable on touch screens and for analysts who do not use right-click. Both surfaces must exist. Context menu = keyboard-free desktop shortcut. Action strip = the primary surface for mobile and for new users who haven't memorized right-click availability.

---

**Decision:** `M` places a point marker at the current playback time. A dedicated button in the transport bar provides the click/tap equivalent for mobile and discoverability.
**Rationale:** `M` is mnemonic (Marker), parallel to Spacebar for span boundaries, and unused in the player chrome keyboard map. The transport bar button follows BriFormer's pattern (which Devin confirmed has both `M` shortcut and a button) and is necessary for mobile usability. Placement in the transport bar is natural because point marker placement is a playback-time action — done while listening, like Spacebar for boundaries.

---

**Decision:** Inline label editing (double-click on span body) is implemented for desktop only. Mobile uses the metadata panel as the exclusive editing surface for labels in v1.
**Rationale:** Double-click on desktop is an unambiguous shortcut for the most common metadata edit. Single-click (select) and double-click (inline edit) are distinct with no ambiguity on a pointing device. Touch has no clean double-tap equivalent — it can trigger zoom or other system gestures. Long-press inline edit adds complexity for a convenience shortcut that is already handled by the metadata panel on touch. Mobile v1 uses the panel; inline editing on touch can be revisited in v2.

---

**Decision:** Layer drag-reorder is conditionally included in v1. Include if a lightweight implementation (e.g. dnd-kit sortable) is straightforward in Phase 2; defer to v1.5 if not. This is not a Phase 2 blocker.
**Rationale:** Layer reorder is quality-of-life, not core analytical requirement. The `displayOrder` field is in the schema from day one; adding reorder UI later requires no data migration. Forcing it into v1 risks delaying the form diagram widget for a non-essential feature.

---

**Decision:** Per-span color override UI, parent span picker, and custom span type creation are deferred to Phase 0.6 for final v1 scope decision. Fields are present in the schema and in the metadata panel's "Advanced" section but may ship without active UI interaction in v1.
**Rationale:** These are scope decisions that affect implementation time without affecting the core analytical workflow. The schema and panel layout accommodate them regardless of the scope decision. Phase 0.6 explicitly enumerates what ships in v1 vs. v1.5.

---

## Shared Timeline Axis (Phase 1.6)

*Decisions made during Phase 1.6 implementation. Output: `src/lib/timeline.ts`, `src/hooks/useTimeline.ts`, `src/components/TimelineAxis.tsx`.*

---

**Decision:** The SVG ruler pans via `position: absolute; left: -scrollOffset` CSS rather than the browser's native scroll mechanism. The container has `overflow: hidden`.
**Rationale:** Using `overflow: hidden` + CSS transform (or `left`) keeps scroll state entirely in the Zustand store (`scrollOffset`), which is the single source of truth. Using `overflow-x: auto` with `scrollLeft` would require synchronizing DOM scroll state with React state — two sources of truth that diverge under programmatic updates (DAW following, zoom re-centering). The CSS approach also prevents scroll events from propagating to the page, avoiding conflicts with the non-passive wheel handler.

---

**Decision:** The wheel event handler is attached via `addEventListener({ passive: false })` directly on the container ref, not via React's `onWheel` prop.
**Rationale:** React 17+ treats `onWheel` as a passive event listener by default. Passive listeners cannot call `preventDefault()`, which means the browser would still scroll the page on wheel events over the timeline. The non-passive direct attachment gives full control over scroll behavior. React's synthetic event system is bypassed for this specific case.

---

**Decision:** The `snap.current` ref pattern is used in both the wheel handler and the DAW cursor following effect. A mutable ref is updated synchronously on every render; event handlers and effects read from it rather than declaring reactive dependencies.
**Rationale:** Both callbacks need access to the latest `zoom`, `scrollOffset`, `pps`, `viewportWidth`, `duration`, and `totalWidth` without these values appearing as `useEffect` or `useCallback` dependencies. Declaring them as dependencies would either (a) re-attach the non-passive wheel listener on every store update, or (b) cause the DAW following to trigger on `scrollOffset` changes it just initiated, creating a render loop. The ref pattern gives correct behavior: always reads current values, never re-registers event handlers unnecessarily.

---

**Decision:** `MIN_ZOOM = 1`. At minimum zoom the entire track fits within the viewport width exactly, with `scrollOffset = 0`.
**Rationale:** Zoom-out below 1× would shrink the track to a fraction of the viewport, wasting space and making tick marks illegible. The track fitting the viewport exactly at 1× is a natural "overview" mode. Analysts zoom in for precision work and zoom out to return to the full-track view.

---

**Decision:** Tick interval is selected from a predefined table of 16 nice values (0.01s, 0.025s, 0.05s, 0.1s, 0.25s, 0.5s, 1s, 2s, 5s, 10s, 15s, 30s, 60s, 120s, 300s, 600s) with a minimum of 64px between ticks.
**Rationale:** Mathematical rounding to "nice" intervals (powers of 10 × [1, 2, 5]) would skip musically meaningful values like 15s (a common formal phrase length) and 0.25s (close to a quarter note at typical tempos). The explicit table covers the musically relevant density range. 64px minimum gives enough horizontal space for the widest label at 9px monospace font.

---

**Decision:** Tick label precision matches the active interval: M:SS for ≥1s intervals, M:SS.d for 0.1s intervals, M:SS.dd for 0.01s intervals, M:SS.ddd for sub-10ms. Integer arithmetic (via `Math.round(seconds * 1000)`) is used throughout to avoid floating-point label artifacts.
**Rationale:** Labels must reflect the precision the analyst is working at. Showing "0:30" at a 0.5s interval would be ambiguous (is the tick at exactly 30.0 or 30.5?). Showing "0:30.0" makes the precision explicit. Integer-millisecond arithmetic prevents labels like "0:29.999" from floating-point accumulation in the tick index multiplication.

---

**Decision:** The playback cursor renders as a DOM `<div>` element positioned on top of the SVG, not as an SVG element within the ruler.
**Rationale:** The SVG is translated via `left: -scrollOffset`, which would require the cursor to be positioned at `cursorPx + scrollOffset` in SVG coordinates to appear correctly. A DOM element positioned at `left: cursorPx` in the container's coordinate system is simpler and immune to the SVG transform. It also avoids re-rendering the SVG on every rAF frame (which only the cursor needs).

---

**Decision:** Cursor following only fires during active playback (`playbackState === 'playing'`). Off-screen left during playback snaps to 20%. Approaching or past the right edge during playback follows at 80%. No auto-scroll when paused.
**Rationale:** The YouTube IFrame API's `getCurrentTime()` returns the hover-preview position when the user mouses over the in-player seek bar, even when paused. Since the rAF loop calls `getCurrentTime()` on every frame, this produces spurious `currentTime` changes that would snap the ruler. Restricting following to `playbackState === 'playing'` eliminates the spurious snaps. The left-correction (20%) handles backward seek during active playback. When paused, the analyst pans the timeline manually.

---

## Schema Changes (Phase 2 prep, 2026-06-20)

**Decision:** Split `Span.color` → `Span.fillColor` + `Span.strokeColor`, and `Layer.colorDefault` → `Layer.fillColorDefault` + `Layer.strokeColorDefault`.
**Rationale:** Form-diagram shapes need independent fill and outline control. A bracket may be an unfilled outline (stroke only) or a filled bubble; per-span overrides must address each independently. Confirmed required by the visual-design work (open brackets = stroke, no fill).

---

**Decision:** Added `PointMarker.harmonicContext: string | null`.
**Rationale:** Cadence/point markers need Roman-numeral key context (`V:HC`, `I:PAC`) corpus-queryable independently of the cadence type. Surfaced directly by the "Parto parto" harmony layer during design.

---

**Decision:** Added `VocabTerm.kind: 'span' | 'point-marker'` and `VocabTerm.source?: string`.
**Rationale:** Vocabulary pack import (Phase 0.6) must route terms to the correct picker and record pack provenance. `kind` disambiguates; `source` records origin.

---

## Visual Design (Phase 0.7, 2026-06-20)

*Full spec: `_private/visual-design-spec.md`. Converged with Devin via live mockup
iteration. Supersedes the dark-mode assumption and amends the Phase 0.4 layout.*

**Decision:** Light mode only. White "paper" canvas; no dark mode, no theme toggle.
**Rationale:** Light-on-white is correct for printable analytical graphics — the export is the product. Dark backgrounds produce poor exports. Reverses earlier dark-theme scaffolding. The first Phase 2.1 build was rejected partly for being dark.

---

**Decision:** Typeface is Inter. Sentence case everywhere. Two weights only (400/500).
**Rationale:** Inter has excellent small-size legibility and clean numerals (timestamps, dense labels). Mono (the earlier choice) was wrong for labels.

---

**Decision:** Layers pack flush — they do not reserve exclusive horizontal bands. Labels render into the negative space (open interior) of the layer above; only ink-collision is constrained, handled locally. A **spacer** is the opt-in element that forces visible separation between independent (non-nested) layers.
**Rationale:** The DAW track-row model (implied by Phase 0.4) wasted vertical space and broke the dense, legible look. Brackets are open outlines with empty interiors, so labels can overlap a neighbor's *space* without overlapping its *ink*. Amends Phase 0.4's reserved-band assumption.

---

**Decision:** Hierarchy reads through stacking order + boundary alignment, never through bracket size or enclosure. Bracket height is uniform across all layers (default; per-layer height override available).
**Rationale:** Uniform height is the BriFormer quality cue. Depth is positional. Variable/enclosing heights (an interim mockup) were rejected on sight.

---

**Decision:** Layers are semantically homogeneous — each measures one analytical level (large-scale form / phrase grouping / material / harmony …).
**Rationale:** Strata's advantage over BriFormer's single-diagram model: a section can be top-level in one layer and have its own phrase reading in another without contradiction, and transitions/connectives live in the layer where they belong rather than being stranded.

---

**Decision:** Collision strategy is content-separation-across-widgets first, then local label handling.
**Rationale:** Most BriFormer collisions come from cramming non-form data (instrumentation) into the form diagram. In Strata that data is its own widget/layer, removing most collision pressure before any rendering logic runs.

---

**Decision:** Transport bar relocated to the bottom of the shell; the zoomable timeline ruler is the sole authoritative timeline. Form layers sit above the ruler. Amends Phase 0.4 (which placed transport between ruler and video).
**Rationale:** The transport's seek bar has its own scale that does not match the zoomable ruler; separating analytical timeline (top) from playback controls (bottom) removes the mismatch.

---

**Decision:** Font-size API is a layer-level `fontScale` enum (`sm`/`md`/`lg`); uniform within a layer, no per-span font size in v1.
**Rationale:** Resolves the Phase 0.4 deferral. Inverts BriFormer's per-element manual resizing (which produces inconsistent sizes).

---

**Decision:** Color is the analyst's choice (`fillColor`/`strokeColor`), not a fixed level convention; default rendering is neutral open brackets. The swatch is organized by hue family, each surfacing curated print-safe **deep/bright** shade pairs (so "similar but not the same" — A vs A′ — is expressible). Arbitrary hex remains available as the deliberate power-user path, not the default.
**Rationale:** Analysts assign color analytically (e.g. by phrase material). Constraining the surfaced swatches to vetted shades keeps exports printing well while still allowing related-but-distinct material to be shaded.

---

**Decision:** The canonical test/demo analysis is "Alive" by Krewella (`schema/alive.strata`).
**Rationale:** Devin's pick — clear enough to analyze and exercises the features he cares about (128-BPM grid, rotational form, an unquantized break where the grid drifts). Serves as the working fixture for the component rebuild.

---

## Phase 2 Implementation (Form Diagram — Milestone A)

*Decisions made while building the static render foundation, reviewed live with Devin against the BriFormer reference.*

---

**Decision:** The form-layer stack is **bottom-anchored on the timeline ruler** — the lowest layer sits flush against the ruler with no gap, and empty room for additional layers accumulates *above*. Widgets stack upward on the timeline (the ruler is the fixed reference line); the timestamped written-analysis widget is the exception and may render *below* the ruler since it does not track the timeline spatially.
**Rationale:** The earlier layout left dead space between the layers and the ruler. Anchoring the stack to the ruler makes the timeline the spatial anchor that everything else stacks against, which is the correct mental model for a reorderable widget system and matches how analysts read a diagram (detail nearest the time axis, broader frames above).

---

**Decision:** Confirmed model A for vertical packing (uniform-height, truly flush, hierarchy from aligned boundary tails forming continuous vertical lines) over model B (nested variable-height enclosure). BriFormer's apparent "enclosure" is model A with flush-aligned tails, not variable bracket heights.
**Rationale:** Reaffirms the Phase 0.7 uniform-height decision after a live comparison. Enclosure (variable heights) breaks down when frameworks overlap rather than nest cleanly — the EDM case — whereas aligned-tail flush stacking reads as hierarchy in the nesting case and stays correct under overlap.

---

**Decision:** Phrase / letter-material spans default to a **rounded bracket** (flat top, rounded corners, filled), not a dome. The dome (`lineType: 'arc'`) remains an opt-in shape the analyst can choose per span.
**Rationale:** Devin's call against the BriFormer reference — the workhorse phrase shape is a rounded bracket; the dome is a deliberate, occasional choice. Label placement (above / inside / none) likewise stays the analyst's choice via layer rendering config; the renderer imposes nothing.

---

**Decision (follow-ups, not yet implemented):** Two layer-level fields are implied by the specs but not yet in the schema types — a `fontScale` (`sm`/`md`/`lg`, Phase 0.7 §5) and a default `lineType` (Phase 0.4 "the layer's default line type"). Both are hard-defaulted in the renderer for now (`md`, `arc`) pending a small schema addition.
**Rationale:** Logged so the schema gap is tracked rather than silently carried; deferred to avoid a schema change mid-iteration.

---

**Decision:** Boundary-drag uses a **zoom-aware minimum width** — a neighbor span cannot be squeezed below a fixed on-screen pixel width (`MIN_BOUNDARY_DRAG_PX`, ~8px), converted to seconds at the current zoom. An absolute 0.25s data floor (`MIN_SPAN_WIDTH`) sits underneath.
**Rationale:** A fixed *time* floor (0.25s) is sub-pixel at low zoom, so a drag could shrink a span into something invisible and unselectable with no obvious recovery. Tying the floor to on-screen pixels means "you can only make a span as small as you can currently resolve" — to make a genuinely narrow span you must zoom in, where you can also see and grab it. This removes the unrecoverable-sliver trap at its root.

---

**Decision:** The metadata panel's time range is **numerically editable** (typed start/end timecodes, parsed and clamped) — the precise, by-value correction path. It edits the selected span's own times only (does not move neighbors).
**Rationale:** Pairs with drag (by-feel) as the exact-value complement, and is the always-available way to fix any selected span regardless of how it renders. Independent (non-rippling) editing is honest to the data model, where span start/end are independent and overlaps are valid.

---

**Decision:** **Arrow-key boundary nudge is deferred** (cut from v1 for now), and with it the "selected boundary" model it required.
**Rationale:** The correction space is already covered three ways — drag (coarse by-feel), zoom+drag (fine by-feel), and numeric entry (exact by-value). Nudge's only unique contribution was frame-precise by-feel adjustment without zooming or typing — a convenience, not a missing capability. Cutting it keeps the interaction model simpler (no second, boundary-level selection concept alongside span selection). Revisit only if real use reveals a gap.

---

## Phase 2 Implementation (Layer Management — 2.4 part 1)

*Decisions made while building the header column / layer management, reviewed live with Devin.*

---

**Decision:** Span **selection** renders as a light grey box fill on the span's own rectangle plus a blue outline (BriFormer convention), not a full-height time band and not an extra bracket-like outline.
**Rationale:** Reviewed against BriFormer directly. The grey fill is what makes it read as a selected *box* (an outline alone read as a competing bracket); the blue outline keeps it legible when the span already has a grey/colored fill. Hover is the same grey wash without the outline, so previewing reads differently from selecting.

---

**Decision:** The form diagram is a **bounded widget with a defined upper edge** (a widget top bar holding the collapse toggle and hidden-layer chips). The empty space above the widget belongs to *other* widgets that stack on the timeline — the form diagram does not claim it. The widget bottom-anchors as a compact block on the shared ruler. Extends the earlier bottom-anchored-stacking decision.
**Rationale:** Devin's correction — treating all the whitespace above the layers as "form-diagram space" was wrong; widgets stack on the timeline and each is bounded. Defining the widget's top edge makes the multi-widget layout legible and gives the collapse toggle / hidden-layer controls a natural home.

---

**Decision:** The layer-header column **collapses to a ~34px icon rail** (Phase 0.4 §2 condensed state) via a chevron toggle on the widget top bar. The rail shows one eye (visibility) per row; clicking the row sets the active layer; the accent bar marks active. **No color swatch in the rail** — color lives only in the Advanced section of the metadata panel.
**Rationale:** Reclaims horizontal working space. A color swatch in the header read as a stray "fill-color symbol" duplicating the Advanced control, so it was removed.

---

**Decision:** The collapsed rail reveals a layer's full name via a **hover-intent tooltip** (~400ms delay, dismiss on leave), popping out to the right — the icon-rail convention (VS Code / Slack). Not the native control title.
**Rationale:** The narrow rail truncates names; a deliberate hover reveal shows the full label without expanding, and the delay prevents it flashing as the cursor passes over.

---

**Decision:** Hiding a layer **reclaims its vertical slot entirely** (the diagram reads as a complete graphic, important for export); hidden layers surface as "show" chips in the widget top bar so they can be brought back.
**Rationale:** Devin's call — a hidden layer leaving an empty band would make an exported graphic look like it is missing something. The header column and canvas stay row-aligned because both iterate the visible layers; hidden layers move to the top bar rather than holding a slot.

---

## Phase 2 Implementation (Layer Management — 2.4 part 2)

*Decisions made while finishing layer management (rename, settings popover, add, reorder), reviewed live with Devin.*

---

**Decision:** **shadcn/ui (on Radix UI) is now the realized component foundation.** The first primitives were pulled in as editable `src/components/ui/` files (`button`, `popover`, `alert-dialog`, `switch`) styled to the Phase 0.7 light theme. Hand-rolling accessible popovers/dialogs is not the path.
**Rationale:** The Tech Stack decision always named shadcn/Radix; the project was scaffolded for it (the `cn` helper, the HSL token mappings, `tailwindcss-animate`) but components were never added. Devin's build philosophy — *do it correctly, not the quickest happy path* — settled it: Radix handles focus, Escape, click-outside, collision-aware positioning, and portal rendering (so popovers aren't clipped by `overflow:hidden`) far more correctly than a hand-rolled one-off, and every future dialog/dropdown/sheet reuses this foundation. Subsequent primitives are added per-feature.

---

**Decision (reversal):** ~~The hierarchical enforcement toggle prevents overlapping spans *within a single layer*~~ — **superseded.** Hierarchical enforcement means **cross-layer nesting**: a span must nest within the boundaries another layer has already established (it cannot cross a coarser layer's boundary). Layers order by size — **bottom = finest subdivisions, top = coarsest** (matching the macro-on-top render order). Formally, each layer's boundary set must be a **superset** of the layer above it; finer layers may subdivide further but must keep every boundary the coarser layer has. **Same-size spans are allowed** at every layer (nesting is inclusive — a child may equal its parent, e.g. the Alive breakdown coextensive across all three layers).
**Rationale:** Devin clarified the original spec wording (`vision.md` §4.6, the earlier Hierarchical Enforcement entry, and the `FormDiagramData.hierarchicalEnforcement` field comment) described a different, weaker constraint than intended. Cross-layer nesting is the standard "hierarchical" meaning and the one Devin wants. He also wants the strictness to *dissuade* use — off by default is the theoretical statement; the constraint, when on, is deliberately demanding.
**Consequences:** (1) The flag is **not per-layer** — a relationship between layers can't live on one layer's data. It is **scoped to the form-diagram widget type** (NOT document-level: the planned instrumentation widget is inherently non-hierarchical, so a document-wide flag would be wrong). Exact schema location is deferred to the dedicated build session. (2) The per-layer toggle built in 2.4 was **pulled** from the settings popover (it was misplaced and a no-op); the stale `FormDiagramData.hierarchicalEnforcement` field is left unused pending the rebuild. (3) `vision.md` §4.6 still carries the old wording and needs a reconciliation pass (flagged, not yet rewritten). Enforcement logic (boundary-superset validation on placement/drag) is its own future work item.

---

**Decision:** There is **no layer-level color default as a user feature.** Fill colors come *only* from per-span choices in the metadata panel's Advanced section. Unstyled spans render as **open brackets with no visible fill**; new layers default to white fill (reads as no-fill on the white canvas) with a neutral ink stroke — never a grey box.
**Rationale:** Devin's call, overriding the Phase 0.6 implication that a layer-wide color default would be a surfaced control. Analysts color per-bracket, not per-layer; a layer-paint control is a DAW affordance that doesn't fit this tool. The `fillColorDefault`/`strokeColorDefault` schema fields remain as the renderer's fallback, but are not exposed as an editable layer setting. The curated color **swatch picker** (Phase 0.6) lives in the per-span Advanced panel and is its own future session.

---

**Decision:** Layer **reorder** uses dnd-kit sortable on the expanded header rows (drag handle per row; collapsed rail is not draggable). The `reorderLayers` store action **permutes the existing `displayOrder` values** among the reordered layers (top gets the highest), leaving any layers not in the list — e.g. hidden ones — at their current `displayOrder`. New layers are created on top (max `displayOrder` + 1) and become the active layer.
**Rationale:** Reassigning the existing value set rather than renumbering from scratch keeps hidden layers anchored in the numeric order and makes the operation a single undoable store mutation. The header column and span canvas both sort by `displayOrder`, so reordering the headers moves the spans in lockstep automatically. Per Phase 0.4 §2, reorder was conditional on being lightweight — dnd-kit made it so.

---

## Merge Implementation (Phase 2.5)

*Decisions made during the Phase 2.5 merge build, conducted with Devin. Output:
`src/lib/mergeSpans.ts` (pure logic), `src/hooks/useMerge.ts`, `MergeConflictDialog`,
multi-select in `uiStore`, `updateSpans` bulk action, multi-mode `MetadataPanel`.
These extend the Phase 0.5 Merge UX spec and the Merge field rules above.*

---

**Decision:** Multi-select is a set of span ids (`uiStore.selectedSpanIds`), with
`selectSpan` (single/replace), `toggleSpan` (Ctrl/Cmd-click), `setSelection`
(shift-range / future box-drag), and `clearSelection`. Shift-range is computed in
the span click handler against the layer's startTime-sorted spans and **preserves
the original anchor** (`selectionAnchorId`) so successive shift-clicks extend from
the same pivot.
**Rationale:** A set is the minimal structure that serves both merge (consecutive
same-layer subset) and bulk edit (any subset, possibly cross-layer). Keeping the
pivot stable matches the universal range-select convention (Finder, spreadsheets).
Selection lives in the UI store, not the undo history — undoing a merge restores
the source spans but does not restore the prior selection (the merged id it held no
longer resolves, so the panel simply closes). This is consistent with the existing
selection/undo separation.

---

**Decision:** The single logged "color" merge rule applies **independently** to the
split `fillColor` and `strokeColor` fields: a lone override wins; two or more
distinct overrides conflict, with "layer default" (null) offered as an option when
any selected span has no override.
**Rationale:** The Phase 0.5 rule predates the Phase 0.6 color split. Each field is
visually and analytically independent (decisions.md, "Span Data Model"), so each
resolves on its own. No new rule — just the existing one applied twice.

---

**Decision:** `annotation` conflicts (dialog) when spans differ; `lyrics` and
`notes` concatenate with the `\n\n---\n\n` separator. `confidence` takes the lowest
of the selection. `startBoundaryType` = the first span's start face,
`endBoundaryType` = the last span's end face, `lineType` = the first span's. `slug`
is regenerated from the resolved label. `startTime`/`endTime` = min/max of the
selection; `mergedFrom` = all source ids in startTime order.
**Rationale:** Annotation renders on the diagram, so silently concatenating it could
clutter the figure — surfacing it for a deliberate choice is correct (Devin's call).
Lyrics and notes are additive records with no diagram footprint, so concatenation
loses nothing. Boundary faces and lineType take the outermost/first span's values
because the merged span's edges ARE the outer edges of the range. The "time points /
point markers union" rule from the Phase 0.5 spec is a **no-op in v1**: point markers
are document-level and spans carry no time-point field, so there is nothing to union.

---

**Decision:** Unlike color, a lone non-null `parentId` against a `null` **is** a
conflict (options: the parent, or "None"); only an all-equal set (including all-null)
auto-resolves.
**Rationale:** Matches the Phase 0.5 edge-case table. A parent reference is a
structural claim, not a style override — dropping or keeping it is a human decision,
not an automatic "the one that exists wins."

---

**Decision:** When 2+ spans are selected the metadata panel becomes a **bulk-edit**
panel: fields that sensibly apply across a selection stay editable and write to ALL
selected spans in one undo step (`label`, `type`, `confidence`, `fillColor`,
`strokeColor`, `startBoundaryType`, `endBoundaryType`, `lineType`, `annotation`,
`lyrics`). Per-span / positional fields are omitted (`startTime`, `endTime`, `slug`,
`notes`, `parentId`). A field whose value differs across the selection reads as
"Mixed" until set.
**Rationale:** Devin's workflow ask — quickly label a run of spans "Chorus", mark
them all approximate, or apply a boundary type — rather than a passive merge
launcher. `lyrics` is included because repeating sections (a recurring chorus) often
share lyric text. `notes` is excluded because it holds distinct per-span working
observations that a bulk overwrite would clobber. The bulk write is a single
`updateSpans` store mutation = one undo step.

---

**Decision:** Merge entry points shipped in this slice: the toolbar **Merge** button
(enabled by eligibility, tooltip carries the reason), **Ctrl+J**, and the
metadata-panel **Merge ← / → Merge** (single-span, merge with previous/next neighbor)
plus the **Merge N spans** button in the multi-select panel. **Box-drag
rectangle-select** and the **right-click context menu** from the Phase 0.5 spec are
deferred to a fast follow.
**Rationale:** Devin chose a core-first slice. Toolbar + Ctrl+J + panel buttons make
merge fully reachable (including a mobile/touch path via the panel) with a reviewable
diff; the two deferred items are net-new gesture/menu surfaces that, like the dnd-kit
drag, can't be verified in the headless preview and are better landed on their own.

---

**Decision:** The merge conflict dialog uses a new shadcn `Dialog` primitive over
`@radix-ui/react-dialog` (the plain, overlay-dismissible modal counterpart to the
existing `AlertDialog`). Conflict-only: it opens only when `resolveMerge` returns
conflicts; a clean merge commits immediately with no dialog. Confirm is disabled
until every conflict has a choice; Cancel/Escape/overlay/X all abandon with source
spans untouched.
**Rationale:** Matches the Phase 0.5 conflict-only design. AlertDialog is for
consequential confirms (delete); a merge the analyst initiated is a normal modal that
should be cheaply dismissible. `@radix-ui/react-dialog` was the one Radix primitive
not yet vendored.

---

## Timeline Zoom & Scroll (Phase 2 polish)

*Decisions made during the Phase 2 polish/zoom session (2026-06-25). Outputs:
`src/lib/timeline.ts`, `src/hooks/useTimeline.ts`, `src/components/TimelineAxis.tsx`,
`src/components/TimelineScrollbar.tsx` (new), `src/lib/formShape.ts`.*

---

**Decision:** "100%" is a fixed standard scale (`BASE_PPS` = 10 px/s), decoupled
from viewport width and track duration. "Fit to window" is a separate, explicit
control — no longer the meaning of 100%.
**Rationale:** Previously `zoom = 1` was defined as `pps = viewportWidth*zoom/duration`,
so 100% literally *was* fit-to-window — a long track and a short track both read as
"100%" at wildly different physical scales, and the same analysis looked different on
different screens. Making 100% a fixed px/second makes the scale meaningful and
stable across tracks and screens (the BriFormer-style working scale), and frees
fit-to-window to be its own action. `BASE_PPS` is the single lever for "how big is
100%". Pixel formula is now `px = timestamp * BASE_PPS * zoom - scrollOffset`.

---

**Decision:** On document load, the timeline auto-fits to the window once (keyed on
duration); window resizes do **not** re-fit (the analyst's zoom is preserved).
**Rationale:** Opening a file should show the whole track (the old load behavior),
but with 100% now a fixed scale the store's default zoom would open a long track
partway in. A one-time fit-on-load preserves the "see everything first" default while
keeping 100% reachable as a distinct, standard scale. *Open for Devin: whether the
persistent default working view should be fit or 100% — currently fit-on-load.*

---

**Decision:** Zoom is bounded dynamically: minimum = `min(fitZoom, 1)` (clamped to an
absolute 5% floor), maximum = 5000% (`ABS_MAX_ZOOM`).
**Rationale:** There is no point zooming out past "the whole track fits" (only dead
space), so a long track's floor is its fit zoom; a short track (fit > 100%) floors at
100% since zooming below that just shrinks a track that already fits. 5000% gives
frame-level headroom for boundary editing. All bounds live in `lib/timeline.ts` as
pure, unit-tested functions.

---

**Decision:** The timeline gets a custom horizontal scrollbar (thin draggable thumb
under the ruler), shown only when content overflows the viewport; its gutter is
always reserved so the ruler doesn't jump when overflow toggles.
**Rationale:** The timeline pans by writing `scrollOffset` (the SVG is translated
inside an overflow-hidden column), so there is no native scrollbar to inherit. Before
this, panning was wheel/trackpad-only with no visible affordance that more track
existed off-screen. The scrollbar geometry (`scrollbarMetrics`, `scrollOffsetFromThumbX`)
is pure and unit-tested; the component is a thin view over it. Clicking the track
pages by ~one viewport; the thumb has a minimum width so it stays grabbable when
deeply zoomed.

---

**Decision:** Form-layer row height bumped — `SHAPE_HEIGHT` 20→26, `LAYER_GAP` 2→3,
`STACK_TOP_PAD` 16→18.
**Rationale:** Closes the pending row-height task (open-questions.md): rows felt
condensed, and the taller pitch also gives the collapsed-rail hover bubble room to
clear the ruler. Proportions are preserved (uniform bracket height across layers);
this only increases the per-row drawing height — the documented lever.

---

## Correctness Pass (post-Phase 2 polish)

*Session 2026-06-25 (second). A targeted correctness/contract-accuracy pass over the
existing work — no new features. Outputs: `src/store/uiStore.ts`,
`widgets/_contract.md`, `widgets/form-diagram.md`, `src/store/documentStore.ts`,
`src/hooks/useTimeline.ts`, `src/test/documentStore.test.ts`.*

---

**Decision:** The documented `ViewState` pixel-position formula is corrected to match
the Phase 2 zoom rework everywhere it appears: `pps = BASE_PPS * zoom`,
`px = timestamp * pps - scrollOffset`, with `scrollOffset` in **pixels** (not seconds)
and `zoom = 1.0` the fixed standard scale (not "the whole track fits").
**Rationale:** The zoom rework (above) changed the formula to `px = timestamp *
BASE_PPS * zoom - scrollOffset`, but three docs still carried the pre-rework
`px = (timestamp / duration) * viewportWidth * zoom - scrollOffset` and mislabeled
`scrollOffset` as seconds: the `ViewState` JSDoc in `uiStore.ts`, the `ViewState`
block + prose in `widgets/_contract.md`, and the pixel-formula block in
`widgets/form-diagram.md`. `ViewState` exists precisely so every widget converts
timestamps the same way (see "ViewState is a dedicated interface…" above); a wrong
formula there would make any future widget author mis-place every element and
misread the units of `scrollOffset`. The runtime code was already correct — this is
a documentation/contract reconciliation only.

---

**Decision:** Auto-fit-on-load re-fits once per *document load* (keyed on a new
`DocumentState.loadId` counter), not once per distinct *duration*. This amends the
"auto-fits… once (keyed on duration)" decision above.
**Rationale:** Keying the fit on duration meant reloading the same document — the
Demo button, re-opening a file, restoring a crash session — or loading a different
track of identical length did **not** re-fit; the analyst's prior zoom/scroll stuck
on a freshly loaded document. The decision's intent was always "fit on load," and
duration was an incidental proxy that collides. `loadId` is a monotonic counter
bumped only by `loadDocument` (every load path funnels through it). It lives on the
store next to `document` but is excluded from undo history (`partialize` tracks
`document` only) and from dirty/save comparisons (`selectIsDirty` and `savedSnapshot`
are document-only), so it never pollutes the file or the undo stack. Verified
in-browser on the Alive fixture: set zoom to 100%, reload Demo → re-fits to 28%
(would have stayed 100% under the duration keying).

---

## Form Diagram Shape Model — Adjoin Rework (2026-06-27)

*Session 2026-06-27. An attempted "adjoin renderer" — decomposing each bracket into
separate fill / shared-vertical-boundary / top passes to stop adjacent dashed tails
double-stamping — was built and rejected on sight ("this looks awful"). A design pass
then re-examined BriFormer's bracket palette (Brian Jarvis's tool, the quality north
star) and reset the shape model. Outputs: this section; `widgets/form-diagram.md` §4;
pending implementation in `src/types/strata.ts`, `schema/strata.schema.json`,
`schema/alive.strata`, `src/lib/formShape.ts`, `src/components/FormLayers.tsx`.*

---

**Decision:** A span renders as ONE path (fill + stroke in a single path). The
decomposition into separate fill / shared-boundary-tail / top passes is rejected.
**Rationale:** Splitting the bracket created seams (corner-meets-vertical joins),
z-order juggling, and independent dash phases — fragile and ugly. Brian draws each
bracket as one path; the decomposition specifically manufactured the solid-corner-
meets-dashed-vertical seam he deliberately avoids. Reverses the in-progress adjoin-
decomposition approach (never merged).

---

**Decision:** Spans are drawn as discrete islands separated by a *miniscule* (~2px)
gap, not pixel-abutted at shared boundaries. Stored `startTime`/`endTime` remain
exact; the drawn shape insets within its time range.
**Rationale:** The gap is what makes BriFormer read clean — adjacent tails never
occupy the same pixels, so the double-stamp/collision problem disappears at the
source (it was the collision, not the data, that looked bad). This decouples the
*render* from pixel-exactness while keeping the *data* exact, so corpus queryability
is untouched. Amends the Phase 0.7 "hierarchy reads through boundary alignment /
continuous vertical lines" decisions (above): islands break those lines — hierarchy
now reads from the shapes themselves plus explicit grouping (below).

---

**Decision:** No domes / arcs, ever. The top line is always flat. `lineType:
'arc' | 'flat'` is retired (top is always flat).
**Rationale:** Devin's call — domes "look bad." The flat bracket with varied corner
styles is the workhorse and reads cleanest. Reverses the "spans are arcs and
brackets… `lineType` default `'arc'`" decision (Phase 0.4) and the "phrase spans
default to a rounded bracket; the dome remains opt-in" decision (Phase 2 Milestone A).

---

**Decision:** Visual style is an explicit analyst choice, decoupled from analytical
data. New presentation fields: `Span.startCap` / `Span.endCap` of type `CapStyle =
'rounded' | 'square' | 'angled' | 'open' | 'elision'` (default `'rounded'`, layer-
overridable), and `Span.lineStyle: 'solid' | 'dashed'` (default `'solid'`).
`confidence` and `startBoundaryType` / `endBoundaryType` remain as pure, queryable
DATA and NO LONGER drive rendering.
**Rationale:** The visual choice is itself an analytical act — the analyst is
communicating with it — and it is impossible to enumerate every case where a visual
decision equals a data decision. Decoupling lets them draw freely while we *nudge*
(ambiently — never an interrupting dialog) toward also recording the queryable data.
Reverses confidence→stroke (Phase 0.7 §6.1) and boundaryType→geometry (Phase 0.4).
**Back-compat:** when a visual field is absent the renderer derives a sensible default
from the data field (`definite`→`rounded`, `gradual`→`angled`, `elided`→`elision`),
so existing `.strata` files render correctly with no migration; `square` is reachable
only as an explicit visual choice (it has no data analog).

---

**Decision:** Stroke (solid / dashed) is whole-shape uniform; solid and dashed are
never mixed at a shared or adjoining edge. The dashed *vertical* is a standalone
boundary marker — its own construct — not a modifier on a bracket tail.
**Rationale:** Brian offers a standalone dashed vertical but never a bracket-with-
dashed-tail, because solid meeting dashed at a shared edge looks broken. One uniform-
stroke path per shape avoids it; "combining" spans into one visual unit is done by
adjacent shapes connecting end-to-end or by a grouping bracket, never by a colliding
mixed stroke.

---

**Decision:** Grouping ("additional groupings") is stored as an ordinary span on a
higher layer — a wide bracket spanning its children — not a new construct.
**Rationale:** Reuses the entire shape / label / color / interaction stack; cross-
layer overlap is already legal in Strata's model. A dedicated construct would only
buy auto-resize-to-children, which is not a v1 need.

---

**Decision:** The nudge toward recording analytical data is ambient, never an
interrupting dialog.
**Rationale:** A popup ("tag this approximate so it's queryable?") interrupts the
listening/annotation flow. The push to data is delivered through good defaults and by
making the queryable payoff visible where the analyst already looks, not via a prompt.

---

## App Shell & Inspector (2026-06-27)

*Session 2026-06-27 (same session as the shape rework). Triggered by the metadata
panel overlapping the media player after the content-sized shell landed. Outputs:
`src/App.tsx`, `src/components/Inspector.tsx` (new), `src/components/FormDiagram.tsx`,
`src/components/MetadataPanel.tsx`.*

---

**Decision:** The app uses a full-height shell with an app-level **Inspector** — a
persistent, collapsible right-hand column that pushes the diagram, transport, and
video to its left. This reverses the Phase-2 "content-sized shell, no dead space"
decision.
**Rationale:** The metadata panel had no height bound, so under the content-sized
shell it grew past the diagram and the media player overlapped it. A persistent
full-height inspector column gives the panel a real height to scroll within — the
overlap is fixed structurally rather than patched. It is also the conventional,
scalable layout as more widgets/panels arrive. Cost accepted: a short diagram now
leaves some empty space in the left column (see the bottom-anchor decision, which
turns that space into something purposeful).

**Decision:** The Inspector is a **context-dependent host slot**, not wired to the
form diagram. It owns the chrome (width, border, full height, internal scroll, a
single header with collapse + contextual title + deselect); the active widget
supplies only field content. v1 mounts the form-diagram's span `MetadataPanel`;
future widgets (energy contour, written analysis) mount their own edit UI here.
**Rationale:** Matches the widget-contract render/edit split already in the log — the
inspector is host chrome that hosts a widget's contextual editor. Keeping content
components header-less (chrome lives on the Inspector) is what removed the redundant
double-header. `MetadataPanel`'s two `<aside>` wrappers became plain content blocks.

**Decision:** The form diagram is **bottom-anchored** in the left work area; extra
vertical space accumulates **above** it (between the toolbar and the widgets), and
that space is reserved for additional widgets stacking upward.
**Rationale:** Keeps the widgets glued to the timeline ruler at any window height
(the concern with going full-height), and gives the blank space a purpose — it is the
multi-widget future, not dead space. Reaffirms the earlier "form-layer stack is
bottom-anchored on the ruler; empty room accumulates above" decision, now load-
bearing under the full-height shell. Vertical order of the left column, bottom→top:
transport + video, timeline ruler, widgets, blank.

**Decision:** Layout is designed as flex regions with relative behavior + internal
scroll, not pixel-pinned positions.
**Rationale:** Full-height means viewport height is a variable; the layout must adapt
across heights rather than assume a fixed frame.

---

## Label Collision Strategy (2026-06-27)

*Session 2026-06-27. The §7 "residual collision" pass for adjacent above-shape
labels. Outputs: `src/lib/formShape.ts` (new `layoutLayerLabels` + moved
justification helpers), `src/components/FormLayers.tsx`, `src/test/formShape.test.ts`.*

---

**Decision:** Residual label collisions are resolved by **neighbour-aware
truncation**, not vertical staggering or hover-only reveal. Each layer runs one
left-to-right layout pass (`layoutLayerLabels`); a label's horizontal "lane" is
bounded by the **midpoints between its own span center and its neighbours' centers**
(clamped to the track edges), and the label truncates with an ellipsis to fit that
lane. Where there is room the label is left whole — truncation engages only under
genuine pressure.
**Rationale:** The flush stack leaves almost no vertical room (a label sits in the
shallow negative space of the layer above), so vertical staggering would collide
with the layer above's ink. Horizontal is the only safe axis to give on. Truncation
is deterministic and reuses the existing pure `estimateTextWidth`/`truncateToWidth`
helpers. Because adjacent spans share an edge, a centered label always clears at
least its own span before reaching a neighbour's half of the shared midpoint, so two
centered labels can never overlap. Full text always survives in the `<title>`
tooltip and the Inspector, so abbreviation loses no information. This realizes the
§7 spec lever "abbreviation" over "stagger" / "hover-to-reveal."

**Decision:** Adjacent labels are separated by a fixed per-side `LABEL_GUTTER`
(4px), pulled inward from each shared lane midpoint.
**Rationale:** The text-width *estimate* is slightly under the *rendered* width for
heavily-truncated stubs (the ellipsis glyph runs wider than the average glyph
advance), so two labels meeting exactly at a midpoint kissed by ~4px in practice.
The gutter absorbs that estimate error and also reads better — neighbouring labels
should not touch. The own-span-width "guarantee" yields to the gutter for very
narrow spans (intended: those are exactly the labels that should abbreviate).

**Decision:** This pass is scoped to **within-layer** adjacent-label collisions.
Cross-layer label-on-label overlap is left for a follow-up.
**Rationale:** Within-layer adjacency is the dominant collision visible at fit (the
`Beat-match intr·Intro`, `Bui·Build` cases). Cross-layer overlap is rarer and is
partly intended by the negative-space model (a label overhangs *up* into the open
interior of the layer above, overlapping in space but not necessarily in ink).
Widening scope now would over-engineer; revisit if cross-layer ink collisions prove
to be a real problem on live data.

**Decision:** The pure justification helpers (`textX`, `edgeAwareJustification`, the
anchor map, `TEXT_PAD`) moved from `FormLayers.tsx` into `formShape.ts`.
**Rationale:** They are pure geometry/text helpers — the stated purpose of
`formShape.ts` — and relocating them lets the collision layout be a single pure,
unit-tested function rather than logic embedded in the React component. The component
now consumes a resolved `{text, justification}` per span and does no label fitting of
its own (for above-labels); inside-shape labels still fit to their own body.

---

## Phase 2.5 Merge — Interaction Completion (2026-06-30)

*Session 2026-06-30. Completed the three missing interaction pieces for the merge
feature (core logic, hooks, and dialog were already built). Outputs:
`src/App.tsx`, `src/components/FormLayers.tsx`,
`src/components/ui/context-menu.tsx` (new).*

---

**Decision:** Right-click context menu covers **all span operations** — Split at
playhead, Merge with previous, Merge with next, Duplicate, and Delete — not just
merge-related operations.
**Rationale:** Merge was the immediate need, but a context menu that appears only
for merge-related items creates an inconsistent surface: why does right-click
sometimes show merge options but never show delete or duplicate? Ripping off the
band-aid and putting all structural span operations in the menu makes right-click
a complete, predictable affordance. Mobile users are covered by the metadata
panel action strip (already built), so there is no mobile regression. Future span
operations have a natural home. The cost is implementing Duplicate early, but
that's a design discussion deferred to the next session.

---

**Decision:** `@radix-ui/react-context-menu` (Radix UI) is used for the context
menu, wrapped in a shadcn-style primitive (`src/components/ui/context-menu.tsx`).
**Rationale:** Consistent with the codebase's existing pattern — every interactive
primitive (dialog, popover, dropdown) uses Radix UI via shadcn wrappers. A
hand-rolled positioned-div context menu would bypass Radix's portal rendering,
positioning engine, Escape-to-close, focus management, and ARIA roles — trading
short-term convenience for long-term fragility. The correct primitive for
context menus is `@radix-ui/react-context-menu`; using it matches the
"do it correctly, not quickly" principle already established in the project.

---

**Decision:** `ContextMenuTrigger asChild` renders the trigger as the SVG `<g>`
element directly (no extra DOM wrapper in the SVG tree).
**Rationale:** SVG does not allow arbitrary HTML elements as children of `<g>`.
A wrapper `<div>` inside SVG would be invalid and would break the SVG layout.
Radix's `asChild` prop delegates the trigger's event handling to the child
element — here the span's `<g>` — so Radix correctly intercepts `contextmenu`
events on SVG elements without polluting the SVG tree.

---

**Decision:** Box-drag selection can be initiated by pressing down on a span body
and dragging (not just on empty space).
**Rationale:** Form diagram rows are typically fully covered by consecutive spans
with no empty space between them. A box-drag feature that requires empty space to
start is nearly unusable in practice — the primary use case (selecting two
adjacent spans to merge) requires dragging across spans. The fix: remove the
`stopPropagation` from the span's `onPointerDown`, pass `dragCommittedRef` to
`SpanShape`, and bail early in `handleClick` when a drag was committed (without
calling `stopPropagation` so the click bubbles to the container to reset the
ref). Short click → selects the span as before; drag past 4px threshold →
box-drag selection ignoring the span click.

---

**Decision:** Duplicate is removed from the context menu and metadata panel action strip. Not implemented in v1.
**Rationale:** The feature was added speculatively. The realistic use cases require design that isn't in place yet: cross-layer copy requires a layer picker; same-layer copy is invalid (overlapping spans within a single layer are not allowed); multi-span "copy the selection to the space immediately after" would require whole-span dragging, which is explicitly not implemented (boundary-only drag). The right design will emerge from real use of v1. Revisit in v1.5 or v2 with concrete use cases in hand.
**Deferred ideas:** (1) Cross-layer copy — select a span, copy it to a chosen layer as a starting point for a second analytical reading. Useful for e.g. the break/silence layer in EDM. (2) Multi-span duplicate-and-place — select a run of spans, duplicate the entire selection into the space immediately following it; requires whole-span drag or a snap-to-end placement mechanism not currently designed.

---

## Color Picker & Layer Defaults (Phase 2.x, 2026-06-30)

*Session 2026-06-30. Outputs: `src/components/ui/color-picker.tsx` (new),
`src/components/MetadataPanel.tsx`, `src/components/LayerSettingsPopover.tsx`.*

---

**Decision (reversal):** ~~Layer-level color defaults are not a user-facing feature~~ — **superseded.** `fillColorDefault` and `strokeColorDefault` are now editable in the layer settings popover (⋯ menu), under a "Default colors" section. Factory defaults: white fill (`#ffffff`), slate stroke (`#475569`).
**Rationale:** The 2026-06-22 rejection was motivated by not wanting a "paint the whole layer one color" command — that concern stands. What changed: the introduction of `"none"` as an explicit no-color per-span sentinel made the null-vs-none model require the layer default to be visible and editable. When a span's fill is `null` (inherit layer default), the analyst needs to know what they are inheriting and be able to change it. Without an editable layer default, the layer's floor color is invisible to the user. The distinction is still per-bracket control (per-span overrides), not per-layer painting.

---

**Decision:** `"none"` is the per-span sentinel for "explicitly no color," distinct from `null` ("inherit layer default").
**Rationale:** An analyst may want a span that shows no fill (just the bracket outline) without reverting to the layer default — for example, using "no fill" as a deliberate contrast against adjacent filled spans. `null` cannot serve this purpose because it already means "inherit the layer default," which may itself be a color. SVG natively understands `fill="none"` and `stroke="none"`, so no renderer changes were needed. `textOnFill("none", ink)` already returns the ink color (treats unparseable values as light), so label contrast also requires no changes.

---

**Decision:** The curated color picker shows 11 hue families × 2 shades = 22 swatches in a `grid-cols-11` grid. The 11th family ("neutral") is black (#000000) deep / white (#ffffff) bright. An inset `box-shadow` on all swatches makes white legible against the white popover background.
**Rationale:** Black and white are needed for high-contrast analysis choices (e.g., white fill on a busy score; black text-on-white spans). Adding them as a natural 11th family keeps the palette structure consistent rather than requiring a separate special-case row. The box-shadow approach avoids adding a visible border element that would create visual noise on dark swatches; the inset shadow is only perceptible on very light colors.

---

**Decision:** The `ColorPicker` component accepts a `nullLabel` prop that controls the label of the "reset to null" action button. Default: "Use layer default." Layer settings context uses "Reset to default."
**Rationale:** The per-span Advanced panel resets to `null` meaning "inherit from the layer" — "Use layer default" is the honest description. The layer settings popover resets to the factory default color — "Reset to default" is correct there. One component, two labels, no duplication.

---

## Global Settings & Toolbar Cleanup (2026-06-30)

*Session 2026-06-30. Outputs: `src/components/DocumentSettingsDialog.tsx` (new),
`src/App.tsx`, `src/components/Inspector.tsx`.*

---

**Decision:** Top-level `StrataDocument` metadata (title, artist, context, composer,
work, BPM, time signature, notes, project, analysis author, source sync offset) is
edited through a new `DocumentSettingsDialog`, opened from a "Document settings"
icon button in the main toolbar. Built on the existing `Dialog` primitive
(`src/components/ui/dialog.tsx`), not a new `Sheet`/panel primitive.
**Rationale:** This metadata had no editor at all. A modal dialog is the correct
weight for an occasional, whole-document settings action (vs. a persistent panel,
which would compete with the Inspector for screen real estate). Reusing the
existing shadcn `Dialog` over Radix matches the "use the proper primitive, don't
hand-roll" rule and required no new component. Read-only identity fields
(duration, source, created/updated, file format version) are shown in a quiet
footer rather than omitted, since they're useful context even though they aren't
edited here.

---

**Decision:** Main toolbar gets Undo/Redo icon buttons (new); the Merge button is
removed from the toolbar entirely; zoom controls stay where they already were
(`FormDiagram`'s widget-local top bar), not promoted to the main toolbar.
**Rationale:** Undo/redo previously existed only as keyboard shortcuts (Ctrl+Z /
Ctrl+Shift+Z) with no discoverable UI — that's a real gap for a primitive this
fundamental. Merge is span-specific, not document-global, and is already fully
covered by three other surfaces (Ctrl+J, the span right-click context menu, and
the metadata-panel action strip) — keeping it in the main toolbar was redundant
chrome that didn't belong at the document level. Zoom is inherently a property of
the form-diagram widget's timeline view, not the document, so it correctly stays
widget-local; promoting it to the main toolbar would misrepresent it as a
document-level setting and wouldn't generalize to other widgets with their own
zoom/view needs.

---

**Decision:** Selecting a span automatically expands the Inspector if it's
collapsed. The Inspector's deselect (X) button now both clears the selection and
collapses the panel, instead of leaving an empty, blank panel open.
**Rationale:** Restores prior behavior that had silently regressed — clicking a
span is supposed to surface its details without a separate manual expand step.
For the X button: a panel with nothing selected and nothing to show has no reason
to stay open: the prior behavior (deselect only) left a blank, purposeless panel
on screen, which is a clear UX defect under any standard "don't show empty state
chrome the user didn't ask for" heuristic. No global setting gates either
behavior — both are unconditional defaults.

---

**Investigation note:** A recurring dev-console warning (`Cannot update a
component (YouTubePlayer) while rendering a different component (FormLayers)`,
confirmed pre-existing and unrelated to this session's changes via a git
stash/pop A-B test) was investigated but not fixed. No synchronous
render-phase `setState` call was found anywhere in `FormLayers.tsx`,
`FormDiagram.tsx`, or `useYouTubePlayer.ts` — every store-setter call in the
YouTube player integration runs inside a `useEffect`, an async `.then()`, an
IFrame API callback (`postMessage`-driven, genuinely async), or a `rAF` loop.
The warning also did not reproduce across several fresh attempts with
`console.error` directly hooked. Most likely cause: `StrictMode` (enabled in
`src/main.tsx`) double-invoking renders/effects around the YouTube IFrame API's
async, imperative callback integration — a known class of dev-only false
positive for third-party API integrations, not expected in production builds.
Left as a known, non-blocking dev-mode artifact rather than chased further
without a reliable repro.

---

## Source Linking (2026-07-02)

*Session 2026-07-02. Outputs: `src/components/LinkSourceDialog.tsx` (new),
`src/components/PlayerDock.tsx` (new, replaces `YouTubePlayer.tsx`),
`src/hooks/useAudioPlayer.ts` (new), `src/hooks/useYouTubePlayer.ts`,
`src/lib/youtube.ts`, `src/components/DocumentSettingsDialog.tsx`,
`src/App.tsx`, `src/store/uiStore.ts`. This closes the MVP hard blocker: a
first-time user previously had no UI path to connect a video or audio source
without hand-editing the `.strata` JSON.*

---

**Decision:** Source linking lives in a reusable `SourceLinkForm`, hosted in two
places: a standalone `LinkSourceDialog` opened from the transport bar (a
prominent "Link video or audio…" button when the document has no playable
source; a compact link icon for swap once linked), and embedded as an editable
"Source" section inside `DocumentSettingsDialog`. The "New" action now creates
the blank document AND immediately opens the settings dialog in a "New
analysis" framing (same fields, setup copy) so naming the track and linking
media happen in one step.
**Rationale:** The transport bar is where the player lives — the natural place
to notice and fix a missing source. The settings dialog is the natural place to
audit and change document-level facts. One form, two hosts avoids divergence.
The new-analysis modal exists because dropping a first-time user into a dead
editor with a disabled transport was the discoverability failure at the heart
of the MVP gap (per Devin's direction this session).

---

**Decision:** YouTube linking is paste-to-detect — one input accepts any
YouTube URL shape (watch, shorts, embed, live, youtu.be, music/m subdomains,
protocol-less) or a bare 11-character video ID, validated live
(`parseYouTubeInput` in `lib/youtube.ts`, unit-tested). The stored URL is
normalized to the canonical `https://www.youtube.com/watch?v=<id>` form. No
explicit source-type selector is needed for detection; the YouTube/Audio choice
is a two-option segmented control, not a type dropdown.
**Rationale:** Analysts paste whatever share link they have. Making them
identify the URL shape is machine work. Canonical normalization keeps `.strata`
files consistent and diff-friendly regardless of what was pasted. Video IDs are
validated to the 11-char `[A-Za-z0-9_-]` shape so a malformed paste fails
visibly at link time, not silently at playback time.

---

**Decision:** Local audio file sources ship now (v1), not deferred. A second
playback engine (`useAudioPlayer`, HTML5 audio) mirrors the YouTube engine's
command surface (`play/pause/seek/setRate`); `PlayerDock` (replacing
`YouTubePlayer.tsx`) selects the engine from `doc.source.type` and is otherwise
source-agnostic, including engine-level keyboard shortcuts (K/J/L/Home) which
moved up from the YouTube hook to the dock. The picked `File` lives in the UI
store (runtime-only); the document stores only `source.filename` per schema.
Opening a `.strata` with a local source shows a "Locate {filename}…" transport
affordance to re-pick the file (browsers cannot reopen paths); the stored
filename follows whatever file the analyst explicitly picks.
**Rationale:** Devin's scope call this session — YouTube-only would have left
the second half of the source story (already in the schema as
`type: "local"`) unusable. The two-engine/one-command-surface architecture is
the same render/edit separation discipline as the widget contract: the
transport doesn't know what's playing.

---

**Decision:** Duration adoption: when media metadata reports a duration and
`doc.duration === 0` (a fresh analysis), the media's duration (in recording
time, offset-corrected) is adopted into the document, outside undo history
(zundo `pause()`/`resume()`). Swapping the source on a document whose duration
is already set never touches it.
**Rationale:** The timeline is driven by `doc.duration`; before this, a new
document had duration 0 and a permanently dead timeline — nothing ever wrote
the player's duration back to the document. Adoption is a system act, not an
analyst edit, so it doesn't belong on the undo stack. On swap, span timestamps
are recording-time truth and the recording's duration is a property of the
recording, not of whichever video currently represents it.

---

**Decision:** `sourceOffset` is now actually applied, at the engine boundary:
`seek(recording_time)` → player seeks to `recording_time + offset`; the
time-poll loop and duration reports subtract the offset on the way out. All
times crossing either engine's API are recording time; span data and the UI
store never see player time.
**Rationale:** Bug fix — the offset was editable in document settings but
applied nowhere, so editing it did nothing (found during this session's survey;
the schema comment `player_time = recording_time + sourceOffset` was the
documented intent all along). Converting at the engine boundary means exactly
two call sites per engine instead of offset-awareness spread through every
consumer.

---

**Decision:** Offset reset rule: relinking the SAME media (same video ID or
same filename) keeps the current `sourceOffset`; linking different media resets
it to 0. Unlink resets the source to the empty shape
(`{ type: "youtube", url: "", sourceOffset: 0 }`, matching
`createEmptyDocument`).
**Rationale:** The offset is a property of a specific source (existing
decision). Pasting a differently-shaped URL for the same video is a no-op on
the media, so the calibrated offset survives; a different video/file has its
own alignment and inheriting a stale offset would silently mis-seek every span.

---

**Decision (bug fixes surfaced by this feature):** (1) The YouTube player is
destroyed when the video is unlinked — previously the `YT.Player` instance
survived its container's unmount, so a re-link would have cued into a dead
iframe (unreachable before source linking existed; live the moment swap/unlink
shipped). (2) The J/K/L/Home shortcut handler now ignores modifier-key
combinations — previously Ctrl+J triggered both merge AND a 10-second
seek-back, since the player hook's handler never checked modifiers.
**Rationale:** Both found during the session survey; both in the blast radius
of this feature. Fixed at the source rather than worked around.

---

## Improvement Backlog Batch 1 (2026-07-03)

*Decisions made shipping improvement-backlog.md items #1, #2, #17.*

---

**Decision:** Video panel modal curtain — whenever a modal dialog is open
(document settings / new-analysis setup, link-source, the unsaved-changes
discard confirm, or the crash-recovery prompt) and a YouTube source is linked,
`PlayerDock` renders an opaque `bg-card` div over its video panel for the
duration.
**Rationale:** A linked YouTube iframe renders in its own GPU compositing
layer in most browsers, and that layer ignores a `Dialog` overlay's
`bg-black/50` dimming — the video visibly punches through on top of the
overlay instead of sitting behind it like the rest of the app, which reads as
broken and is distracting mid-setup. The iframe can't be unmounted to fix this
(it would kill the live `YT.Player` instance), so the fix covers it with a
normal DOM element local to the same stacking context as the iframe's
container — that curtain isn't subject to the compositing quirk, so it
reliably paints on top. Each dialog's open/closed boolean lives in `uiStore`
(`documentSettingsOpen`, `linkSourceOpen`, `unsavedGuardOpen`,
`recoveryModalOpen`) rather than as component-local state, specifically so
`PlayerDock` — which has no other reason to know about any of these dialogs —
can subscribe and react. Any future modal that can coexist with a linked video
should register itself the same way. Originally flagged in the backlog as
minor polish ("video appears behind the New modal"); investigation found it
was a real rendering bug, not a framing/copy issue.

---

**Decision:** New / Open / Demo route through a `guardDiscard` wrapper that
checks `isDirty` before running. When dirty, the action and a short label are
held in state and only executed if the analyst confirms an `AlertDialog`
("Discard unsaved changes?"). Clean documents — including the empty-state
case, where `isDirty` is always `false` — run immediately with no dialog.
**Rationale:** A single misclick previously discarded unsaved work with no
confirmation; the 30s localStorage crash-recovery autosave softens the cost
but doesn't prevent the surprise. Closes improvement-backlog #2.

---

**Decision:** The spacebar context indicator ("Space: boundary" while
playing, "Space: play" while paused) is shown in the transport bar whenever
the player is ready, per the Phase 0.4 §8 spec. The play/pause button also
shows the spinner (previously buffering-only) while `playerStatus === 'loading'`,
so a loading source reads as active rather than merely disabled, and the
playback-error indicator is now a proper icon+text chip instead of plain text.
**Rationale:** Closes improvement-backlog #1 and the remaining #17 items not
covered by the modal-curtain fix above.

---

## Improvement Backlog Batch 2 (2026-07-03)

*Decisions made shipping improvement-backlog.md items #3, #7, #8, #12, #14, #16.*

---

**Decision:** Inline span label editing (double-click on span body) and the
duplicate-span action are dropped from scope — not deferred, dropped.
**Rationale:** Devin's call. Inline editing: analysts are guided to the
metadata panel instead of a second edit surface. Duplicate: no concrete use
case has emerged to justify the design cost. Both should be removed from
`_private/form-diagram-ux-spec.md` (§6, §7) on the next spec-maintenance pass.

---

**Decision:** The active-layer indicator gets a full-row background tint
(`hsl(var(--primary) / 0.07)`) in addition to the existing 2.5px left accent
bar, in both the expanded header and the collapsed rail.
**Rationale:** Phase 0.4 §2 called the active-layer indicator "load-bearing,
not decorative" and specified "left accent bar, background tint, or similar"
— only the bar half of that was ever built. A 2.5px edge bar reads as
decorative in peripheral vision during fast spacebar-driven annotation; a
full-row tint is what actually answers "which layer am I about to place a
boundary in?" without requiring focused attention on the header column.

---

**Decision:** The zoom-control toggle button (bottom-right of the widget top
bar) is labeled with the state a click would switch TO, not the current
state: "100%" when the timeline is already at the fit-to-window zoom, "Fit"
otherwise. Fit-on-load remains the default (confirmed, unchanged).
**Rationale:** The button previously always read "Fit" regardless of state,
so clicking it while already fit was a no-op with no indication why. Standard
toggle-button convention (mute/unmute, play/pause) is to label the target
state, not the current one.

---

**Decision:** A quiet centered hint ("More analytical layers will stack here
as they're added") fills the leftover vertical space above the bottom-anchored
form-diagram widget, implemented as a `flex-1` sibling so it naturally
vanishes once a tall layer stack claims that room.
**Rationale:** With only one widget built, the ~60% of blank canvas above the
bounded widget read as unfinished rather than intentional. The hint is
disposable by construction — no visibility logic to maintain as more widgets
ship; it simply stops rendering when there's no space left for it to occupy.

---

**Decision:** Fixed a lane-bound geometry bug in `layoutLayerLabels`
(`lib/formShape.ts`) — a span's above-label lane is now floored to the span's
own physical footprint on each side, never narrower, regardless of how narrow
an adjacent neighbor is.
**Rationale:** The lane formula bounded each side by the midpoint to a
neighbor's *center*. When a neighbor span was abnormally narrow relative to
its siblings (e.g. a short "Break" span sitting between normal-width phrase
spans), that midpoint fell *inside* the surviving span's own boundary —
stealing lane space from a label that was never at risk of colliding with
anything (the narrow neighbor's own label was already guaranteed not to reach
that far, being too long to fit its own narrower span). Confirmed and fixed by
clamping: `leftBound = min(midpointBound, ownLeftEdge)`,
`rightBound = max(midpointBound, ownRightEdge)` — the midpoint can still
*grant* extra room when a neighbor is wider (that borrowing behavior, the
whole point of the neighbor-aware pass, is unchanged); it can no longer *take*
room away. Verified against the "Alive" fixture's Phrases layer, where two
single-character labels ("D", "E") were being silently suppressed next to the
narrow "Break" span — both now render correctly.

---

**Decision:** Above-shape labels are never algorithmically ellipsis-truncated.
Resolution order is: full `label` if it fits the lane → whole `shortLabel` if
it fits (a new optional `Span` field, analyst-authored, never itself
abbreviated further) → a small marker dot indicating a label exists but has no
room. `truncateToWidth`'s `MIN_STUB_WIDTH_PX` floor (added earlier this
session) is retained for the separate inside-shape truncation path only.
**Rationale:** Supersedes the initial improvement-backlog #12 approach (a
pixel-width floor on algorithmic truncation). That floor eliminated junk stubs
("Dr…", "Ver…") but couldn't fix the deeper problem: in a dense layer with
mixed label lengths, some spans show a letter and others show nothing, and the
pattern reads as arbitrary/broken regardless of where the truncation floor
sits — because it *is* arbitrary, being a function of neighbor geometry the
analyst has no control over. Handing abbreviation to the analyst (`shortLabel`)
turns an algorithmic guess into a deliberate authorial choice, which is more
consistent with how `label`/`type`/`slug` are already three deliberately
separate, analyst-controlled fields. The marker dot (rather than a silent gap)
signals "there's a label here, it just doesn't fit" instead of looking like a
rendering bug — chosen over a document-wide "whole labels only, nothing else"
policy because it preserves per-span nuance (a genuinely unlabeled span and a
label-that-doesn't-fit span now look different, which is real information).
`Span.shortLabel` participates in merge resolution the same way `annotation`
does: lone value wins, competing non-null values conflict.

---

**Decision:** The hidden-label marker dot's horizontal position is always the
span's base-justified position (`labelJust`, the layer's configured
justification before edge correction) — never the edge-re-anchored
justification (`effLabelJust`) used for actual label/shortLabel text.
**Rationale:** Bug found by Devin immediately after #12 shipped: edge
re-anchoring exists to keep long TEXT from overhanging past the first/last
span's track boundary, by flipping a centered label to left/right
justification near the edges. A 1.5px dot never overhangs regardless of
justification, so inheriting that correction just shifted it off-center for
no reason — it was reusing the text's computed x position wholesale instead
of computing its own.

---

## Point Markers — Implementation (2026-07-03)

*Build-plan 3.2. Backlog item #5. First widget-independent, document-level
timeline feature to ship — no layer/active-layer dependency, unlike spans.*

---

**Decision:** Point markers live in a dedicated **marker lane** — a distinct
14px strip on the shared ruler, directly below the time-tick row and above the
horizontal scrollbar. Clicking empty space in the lane places a marker at that
time; clicking an existing marker selects it instead of placing a new one.
**Rationale:** This answers the open design question from `docs/vision.md` §10
("which zone on the timeline triggers placement, vs. span boundary
placement?"). Point markers are document-level (not per-layer), so they can't
live in the form-diagram widget's per-layer rows — they need their own
always-visible zone on the shared ruler, parallel to how span boundary ticks
render in the ruler's tick row. A dedicated lane makes the distinction between
"placing a marker" and "placing a span boundary" spatially unambiguous: the
marker lane is a strip the analyst clicks directly; span boundaries are placed
via Spacebar, never by clicking the ruler.

---

**Decision:** `M` places a point marker at the current playhead, mirroring how
`Spacebar` places a span boundary. A transport-bar button ("Place a point
marker at the playhead") provides the same action for discoverability and
mobile/no-keyboard paths.
**Rationale:** Consistent with the existing capture-gesture model (Spacebar for
spans, `K`/`J`/`L`/`Home` for transport). Unlike Spacebar, `M` needs no active
layer — point markers are document-level, so the gesture works regardless of
which (or whether any) layer is active. The transport button exists for the
same reason the spacebar-context indicator and merge toolbar button exist:
keyboard-only affordances undercut discoverability and mobile use.

---

**Decision:** A newly placed marker is immediately selected, opening the
Inspector to its fields — same pattern as clicking a span.
**Rationale:** The placement gesture (click lane, or `M`) is a capture
action during active listening; the analyst's very next likely action is to
name or type the marker they just heard. Selecting immediately removes a step.

---

**Decision:** Point marker selection and span selection are **mutually
exclusive** — selecting one clears the other. The Inspector shows exactly one
contextual panel at a time (`Span` / `N spans` / `Marker`), never both.
**Rationale:** The Inspector's chrome (title, deselect button) assumes a
single selection concept. Two independent selections with no combined UI would
either require the Inspector to arbitrarily pick one to display (confusing —
which one?) or grow a tabbed/split interface disproportionate to two selection
kinds that are never edited together. Mutual exclusivity keeps the existing
single-panel Inspector correct with no new chrome.

---

**Decision:** The point marker Inspector panel ships the full build-plan 3.2
field set (timestamp, label, type, notes, flagged, confidence) plus
`harmonicContext` — brought forward from its "v1 feature, no dedicated UI yet"
status rather than deferred to a later pass.
**Rationale:** `harmonicContext` was already a confirmed v1 schema field (see
the Phase 0.6 "v1 Feature Scope" decision above) with no open design question
attached — it's a single optional text input, identical in weight to any other
field already in the panel. Deferring it would have meant a second edit to the
same panel for no scoping reason.

---

**Decision:** The point marker `type` field reuses the same minimal picker
pattern as the span `type` field: a plain `<select>` reading
`document.vocabulary.pointMarkerTypes`, with an escape hatch that preserves
and displays a `type` value not present in the current vocabulary list.
**Rationale:** Full vocabulary UI (tradition grouping, "Add custom type",
Letter… generator, pack import — backlog #6) is explicitly staged as its own,
larger task. `pointMarkerTypes` ships empty by default in v1 (same as
`spanTypes`), so today this picker mainly preserves whatever `type` value is
already on a loaded document. Building the full picker now would mean solving
#6 as a side effect of #5; reusing the existing span-type pattern keeps the
two tasks decoupled and gives point markers the same forward-compatible
escape hatch spans already have.

---

**Decision:** Marker visual treatment: a small rotated-square (diamond) glyph
in the marker lane — accent color by default, destructive/red when
`flagged: true`, with an accent ring when selected. No distinct glyph per
marker `type` in this pass.
**Rationale:** Flagged status ("come back to this") is the one binary,
at-a-glance-useful distinction available today without vocabulary-driven
iconography — most markers will have no `type` set until #6 ships a real
picker. Per-type glyphs are better designed once the vocabulary system (and
its icon/tradition metadata, if any) exists; adding ad hoc icons now would
need reworking once #6 lands.

---

## Point Markers — Redesign (2026-07-04)

*Revises "Point Markers — Implementation (2026-07-03)" the session after
Devin's first look at the shipped feature (screenshot comparison against a
BriFormer analysis graphic). Three things changed: marker placement UX, the
harmonic-context/key-area data model, and discoverability. Reached
collaboratively — see the session's design debate before any of this was
built. Schema grew substantially as a result.*

---

**Decision:** The marker lane moves to sit **above** the ruler's time-tick
row (still part of the ruler bar), not below it.
**Rationale:** Devin's direct correction on first look. "Above the timeline"
in the BriFormer reference reads as above the numeric ruler; the original
placement (below ticks, above the scrollbar) buried markers beneath the part
of the ruler analysts actually orient by.

---

**Decision (reverses part of the "v1 Scope" harmonicContext decision,
`docs/decisions.md` Phase 0.6):** `PointMarker.harmonicContext` is no longer
forced into the `{harmonicContext}:{typeAbbreviation}` concatenated display
string. It renders as its own free-standing text near the marker, independent
of `type`.
**Rationale:** The forced concatenation was the actual bug behind Devin's
"harmonic context is a complete miss" feedback — it assumed harmonic context
only ever accompanies a cadence type, and baked in one specific string
format. In practice an analyst may want a cadence type alone, a cadence type
plus context, or free-standing key/harmony text with no cadence type at all.
Decoupling the fields and their display serves all three without forcing a
format.

---

**Decision:** Introduce a document-level `homeKey: { tonic: string; mode:
string | null } | null`. `tonic` is free text (spelling is the analyst's
call); `mode` is a `VocabTerm` id resolved against a **new third vocabulary
tier**, `vocabulary.modes`, plus a built-in starter list shipped in code
(Major, Minor, Dorian, Phrygian, Lydian, Mixolydian, Locrian, Ionian,
Aeolian).
**Rationale:** Devin's ask was specifically for the *relationship* to the
home key (e.g. "vi") to be corpus-queryable, not necessarily the absolute key
name — but interpreting a Roman numeral at all requires knowing the tonic
and mode it's relative to, so `homeKey` has to exist. Reusing the vocabulary
mechanism already built for `spanTypes`/`pointMarkerTypes` — rather than a
hardcoded mode enum — is what makes this open-ended enough for Renaissance
modal scholarship (Dorian, Phrygian, ...) and the 8-mode/12-mode systems
Devin named, without hardcoding an exhaustive taxonomy the schema can't
anticipate. Same extensibility argument that justified project-level custom
span/point-marker types in the first place.

---

**Decision:** The mode picker leads with two large buttons, **Major** and
**Minor**, plus a quiet "More modes…" link that expands to the full list
(built-ins + `vocabulary.modes`, with the same preserve-unknown-value escape
hatch as the span/marker type pickers). Auto-expands if the current mode is
already something else.
**Rationale:** Devin's estimate — 90%+ of analyses will be major/minor —
argues for a one-click default path, with the long tail reachable but not
in the way. Mirrors the existing `Segmented` control pattern already used for
`context`/`confidence` elsewhere in the app.

---

**Decision:** `Span.keyArea: string | null` — free text, conventionally a
Roman numeral relative to `homeKey` (e.g. `vi`, `V/V`), corpus-queryable
independently of `label`/`type`/`annotation`.
**Rationale:** The BriFormer reference image Devin pointed to shows key text
("A major (I)", "F♯ minor (iii)") spanning an *entire formal section*, not
attached to a single instant — that's structurally a span-level property, not
a point marker. Putting it on `Span` (rather than trying to force it through
`PointMarker.harmonicContext`, the original — wrong — implementation) fixes
the root modeling error, not just the display bug. Follows the project's
established pattern of splitting queryable data from display text (label vs.
type vs. slug) rather than overloading an existing field.

---

**Decision:** `Layer.spanShape?: 'bracket' | 'bar'` — a per-layer rendering
style, not a new `LayerType`/widget. `'bar'` draws a thin flat rect (10px,
vs. 28px for brackets) instead of a bracket/arc shape; no caps, no tails.
Buried in the Layer Settings popover (not offered when first creating a
layer). The underlying data, and every existing interaction (spacebar
placement, boundary drag, merge, undo), is identical either way.
**Rationale:** Devin's proposal — key areas as "a separate kind of layer...
but a layer among the other span layers" — is still exactly `FormDiagramData`
/ `Span[]`; only the *rendering* differs. Modeling it as a whole second
widget type would have meant a second data payload, a second contract entry,
and duplicated interaction logic for no benefit, since the data underneath is
unchanged. A rendering-style flag on the existing layer type is the correct
level of abstraction, and reuses the layer's *existing* `visibility` toggle
for show/hide — no new visibility field needed (an earlier draft of this
plan proposed a `keyAreaVisible` `LayerRenderingConfig` field; superseded by
this, since a bar layer's visibility is already exactly `Layer.visibility`).
Bar height is a rendering choice only — "thinner shape," per Devin's
clarification, not a smaller layer-panel row *slot* (the header row height
still matches the body row height 1:1 for alignment; both simply consume
less space when the layer is bar-styled).

---

**Decision:** `stackHeight`/`shapeTopY` (formShape.ts) take the actual
`Layer[]` array and sum each layer's own `layerPitch` (bracket = 28+3px, bar
= 10+3px), rather than a layer count × one uniform pitch constant.
`layerIndexAtY` replaces the old fixed-pitch division for hit-testing which
layer row a y-coordinate falls in (box-drag start, boundary handle sizing).
**Rationale:** Necessary consequence of allowing per-layer variable height —
`LAYER_PITCH` as a single constant no longer describes every row. Header rows
(`SortableLayerHeaderRow`) now size from the same `layerPitch(layer)` call so
the header column and the canvas column stay row-aligned regardless of which
layers are bar-styled.

---

**Decision:** `PointMarker.kind?: 'cadence' | 'key-change' | 'tempo-change' |
'flag' | 'other'` — a soft UI preset. Picks which of [`type`,
`harmonicContext`, `flagged`, `confidence`] the Inspector panel leads with;
everything not led-with is still reachable under a "more fields" expander.
Never restricts what a marker can actually store.
**Rationale:** Devin proposed a "dropdown with options like key area,
cadence, flag/note" specifically so a marker could still "carry multiple
pieces of information if needed" — i.e. he explicitly did not want a hard
per-kind schema restriction. A soft preset satisfies both the tighter-UI want
and the multi-purpose-marker want simultaneously. `kind` is deliberately
independent of `type` (the vocabulary term) rather than derived from it,
since the vocabulary system has no tradition/grouping metadata yet (#6) to
derive a reliable mapping from — keeping `kind` a separate field decouples
this from that unbuilt system. `key-change` is a marker kind (an instant —
"the modulation happens here") distinct from `Span.keyArea` (a duration —
"this section is in vi"); both are useful and answer different questions.
`tempo-change` was added to the initially-proposed minimal set (cadence/
flag/other) at Devin's request, useful for pop-EDM tempo-shift analysis.

---

**Decision:** Placing a marker (lane click or `M` key) snaps to the nearest
existing span boundary or point marker within a small screen-pixel threshold
(`snapTime`, `lib/timeline.ts`, default 6px). Existing markers can also be
**dragged** along the lane to a new time, snapping the same way during the
drag. A pointerdown that doesn't move past a threshold is treated as a
click-to-select, not a drag.
**Rationale:** Devin's ask — placement should "allow for snapping to
timepoints already existing" — plus his choice (offered as an explicit
either/or) of doing *both* snap-on-placement and drag-to-reposition rather
than just one. Drag-to-reposition didn't exist before this session (markers
could only be moved via the numeric Timestamp field); it's new scope this
decision adds, not a fix to prior behavior.

---

**Decision:** `StrataDocument.showCadenceCaptions?: boolean` (omit/absent =
`true`) — a single document-wide switch for whether cadence-related marker
detail renders on the diagram, set in Document Settings.
**Rationale:** Devin: "whether or not to surface that information visibly
should be a choice too" — recording data and displaying it on the diagram
are separate decisions. Document-level rather than per-layer because point
markers are already a document-level concept (not owned by any layer) — see
the original point-marker schema decision. There is no per-layer surface a
marker-display toggle could sensibly live on.

---

## UI Copy Pass & Point Marker Vocabulary (2026-07-24)

*Two threads that turned out to be one. The copy audit (backlog #23) reached
the point-marker panel and found that its worst copy was describing a feature
that was never fully built — which is why the wording was unfixable in place.*

---

**Decision:** Six house rules govern user-facing copy.
1. Never explain the schema or the UI's own mechanics.
2. Examples belong in the placeholder.
3. Non-obvious domain facts and reassurance belong in a tooltip.
4. Inline helper text survives only when it carries an instruction that
   prevents an error.
5. One concept, one string.
6. Write sentences, not dash-spliced fragments ("X — Y").

**Rationale:** Devin's framing was "written like a technical writer would
write (not an AI)." The diagnosable pattern behind the verbose strings was
that they carried *rationale from this document* rather than *instructions for
the task* — e.g. "Point markers are document-level, not per-layer, so this is
a single switch for the whole file" on a toggle. Naming the pattern made most
of the audit mechanical rather than sixty separate debates. Rule 6 is Devin's
addition, and it invalidated several of the first-pass rewrites: the
appositive-dash splice is itself a strong AI tell.

---

**Decision:** `Field` (label + control + helper row) is one shared component
at `src/components/Field.tsx`, with an optional `tooltip` rendering an info
affordance beside the label. `inputClass` moves with it.

**Rationale:** It had been copy-pasted identically into `MetadataPanel`,
`PointMarkerPanel`, and `DocumentSettingsDialog` — the last of which carried
the comment "local copies of MetadataPanel's — small, not worth sharing." The
copies then drifted: `Span.keyArea` had three different helper strings in one
file. Rule 5 is unenforceable while the component that renders helper text
exists in triplicate. Tooltip support also had to be written once rather than
three times.

---

**Decision:** Tooltips are hover/focus only and may never be the sole route to
information needed to complete a task.

**Rationale:** Radix deliberately does not open tooltips on touch, and mobile
is on the roadmap (backlog #20). The trap in a verbosity pass is converting a
verbosity problem into a hidden-verbosity problem — the same prose, now behind
a hover. Most audited strings should be deleted, not relocated.

---

**Decision:** A built-in point marker type vocabulary ships in code
(`src/lib/pointMarkerTypes.ts`), mirroring `lib/modes.ts`: seven cadences
(PAC, IAC, HC, DC, EC, Phrygian half, Plagal), the three Hepokoski/Darcy
terms, and four general events. `label` is the form written on a diagram
("PAC"); `description` is the full name, and the picker composes "Perfect
authentic cadence (PAC)".

**Rationale:** Devin: "Cadence needs work — there are a bunch of different
cadences." The `kind: 'cadence'` preset existed with no cadence types behind
it, because no built-in point-marker vocabulary shipped anywhere and the
fixtures' `pointMarkerTypes` were empty. The full tradition-grouped picker
with custom types and pack import is still backlog #6; shipping the starter
set in code follows the precedent already set for modes and unblocks the
workflow without building #6. Grouping lives in the built-in list rather than
on `VocabTerm`, so the schema does not have to anticipate #6's final shape.
Phrygian and Plagal are additions to the Phase 0.6 starter set, from Devin.
The `flag` type ("!") from that set was dropped: `PointMarker.flagged` is
already a boolean field, so a `flag` *type* duplicates it.

---

**Decision (refines the 2026-07-04 harmonicContext reversal):** The
conventional `{key}:{type}` notation is restored, but **conditionally** — both
present renders `V:PAC`, a type alone renders `PAC`, a key alone renders `V`,
neither renders nothing. `formatMarkerCaption` (`lib/pointMarkerTypes.ts`) is
the only place the two are joined.

**Rationale:** Devin, revisiting his own "harmonic context is a complete miss"
feedback: "I was thinking V:PAC — like it is a PAC in the dominant key, but
it's written that way and not below it." Both earlier positions were half
right. The 07-04 fix correctly identified that the *unconditional* format was
the bug — it assumed a cadence type always accompanies a key — but it
over-corrected by removing the notation entirely, when the notation is simply
how theorists write it. Storing two queryable fields and rendering the
conventional string is the project's established split (label vs. type vs.
slug) applied to this case.

---

**Decision:** The UI label for `PointMarker.harmonicContext` is **"In key"**.
The schema field name is unchanged.

**Rationale:** Devin: "I'm not sure what I meant by 'harmonic context'." If
the author of the field cannot recall its meaning, the label has failed. What
it holds is the key an event lands in, as a Roman numeral relative to
`homeKey`. Renaming the schema field would break existing `.strata` files for
a cosmetic gain; the divergence is logged for a future migration.

---

**Decision:** Accidentals are transliterated to Unicode on input in the
Roman-numeral and tonic fields (`Span.keyArea`, `PointMarker.harmonicContext`,
`homeKey.tonic`): `bVI` becomes `♭VI`, `F#` becomes `F♯`. The **canonical
Unicode form is what gets stored.**

**Rationale:** Devin: "there's probably something that needs to be done about
making 'bVI' into '♭VI'." Storing one canonical form means a corpus query
never has to match two spellings of the same analytical claim, which is the
whole point of these fields being separate from free text. Accepting ASCII on
input keeps typing fast. The cost is marginally less typeable raw JSON, which
is the right trade for a format whose purpose is queryability. Deliberately
scoped to fields whose contents are known to be note names or Roman numerals —
it must never run over free text, where `b` is a letter. A symbol palette for
free-text fields is tracked separately (backlog #27).

---

**Decision:** Point markers move out of the timeline ruler and into the form
diagram as a bottom-anchored annotation band. This reverses the 2026-07-04
decision that placed the marker lane above the ruler's tick row.

**Rationale:** Devin asked for it on visual grounds ("I wanted it to be part
of the form diagram"), but the deciding argument is architectural: the ruler
is editor chrome, and `_private/open-questions.md` already requires that
export serialize the render path only. Markers in the ruler therefore sit
outside the export boundary and could never appear in an exported graphic —
while the whole point of a `V:PAC` caption is that it is part of the figure.
The 07-04 placement was not wrong for the reasons it was decided; the export
requirement simply outranks them. Implementation tracked as backlog #25.

---

**Decision:** Label *placement* is the application's job; label *content* is
the analyst's. No manual placement controls in v1.

**Rationale:** BriFormer offers a 3x3 grid of text boxes per marker plus
cardinal nudge arrows; Devin: "I freaking hate this setup... a pain in the
butt to actually work with." That grid exists because BriFormer has no layout
engine and outsources layout to the human — in the Mendelssohn reference, one
label ("marked diversion") is manually split across two cells purely to dodge
a neighbouring bracket. Strata already runs a neighbour-aware layout pass
(`layoutLayerLabels`), so importing that workaround would mean adopting a
manual solution to a solved problem. The precedent is `shortLabel`
(2026-07-03): when a label would not fit, the escape hatch was different
*content*, never analyst-supplied coordinates. Manual nudging returns in copy
mode (v2), where presentation is the explicit purpose.

---

**Fix:** Clicking an existing point marker created a duplicate at the same
timestamp. `beginMarkerDrag` called `stopPropagation()` on `pointerdown`,
which does not stop the subsequent `click` from reaching the lane's
place-marker handler, so selecting a marker also placed one. The lane now
defers to a pointerdown that landed on a marker.

**Rationale:** Recorded because the failure was invisible in the obvious way —
placement snaps to nearby markers, so the duplicate landed exactly on top of
the original, and the only symptom was an unexplained dirty-document flag.
