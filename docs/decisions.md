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
