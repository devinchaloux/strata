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
**Counter-argument:** A local-only approach (SQLite, no accounts, no internet dependency) is more consistent with the Analysis Tool's no-backend philosophy and imposes zero onboarding friction. A local-first with optional sync model may be the right resolution. See vision.md Section 8.3 for full tradeoff analysis. **Resolve before Corpus Builder development begins.**

---

**Decision:** Linking between `.strata` and MEI files is manual, declared by the scholar, using the existing `work` field.
**Rationale:** Automatic span-level linking between clock-time (.strata) and score-time (MEI) requires a performance alignment map — technically hard and out of scope. Work-identity linking is sufficient for corpus grouping: a `.strata` file and an MEI file that both reference the same `work` value are associated. Human-declared, not computed.

---

*Add new decisions below this line as they are made during development.*
