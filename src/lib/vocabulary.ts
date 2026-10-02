/**
 * The built-in vocabulary: the span and point-marker types every analysis can
 * use, organised into libraries.
 *
 * Built-in terms ship in code, as the modes and the first point-marker types
 * already did; a document stores only its own custom terms
 * (`vocabulary.spanTypes`, `vocabulary.pointMarkerTypes`). A span's `type` is
 * a term id either way, so a file stays readable when the list grows.
 *
 * A **library** is a named list of term ids. A term is defined once and may be
 * listed in several libraries (`breakdown` is in EDM and Pop/Rock), so "all
 * breakdowns" is one query whichever library the analyst picked it from.
 * Built-in libraries are always offered; packs (Caplin, Sonata Theory …) are
 * switched on by the analyst, and search reaches them either way.
 *
 * `broader` links a framework's term to a general one (`caplin-transition` →
 * `transition`), as SKOS does, so a query for all transitions can include
 * Caplin's and Hepokoski and Darcy's. Which links hold is a music-theory call;
 * the ones here are proposals under review, as is the whole list. See
 * docs/decisions.md, "Vocabulary Libraries".
 */
import type { VocabTerm } from '@/types/strata'

// ── Terms and libraries ──

export type TermKind = 'span' | 'point-marker'

export interface BuiltInTerm {
  id: string
  /** The short form written on a diagram ("Trans.", "PAC"). */
  label: string
  /** The full name, where the label is an abbreviation. */
  name?: string
  definition: string
  kind: TermKind
  /** Ids of the more general terms this one counts as in a query. */
  broader?: string[]
}

export interface Library {
  id: string
  label: string
  /** Built-in libraries are always in the picker; packs only when switched on. */
  tier: 'built-in' | 'pack'
  description: string
  spanTypes: string[]
  pointMarkerTypes: string[]
}

type Extra = Pick<BuiltInTerm, 'name' | 'broader'>
const span = (id: string, label: string, definition: string, extra: Extra = {}): BuiltInTerm => ({
  id, label, definition, kind: 'span', ...extra,
})
const marker = (id: string, label: string, definition: string, extra: Extra = {}): BuiltInTerm => ({
  id, label, definition, kind: 'point-marker', ...extra,
})

const SPAN_TERMS: BuiltInTerm[] = [
  span('intro', 'Intro', 'Material before the first statement of the main form or first core section.'),
  span('outro', 'Outro', 'Closing material after the last core section, often repeating or vamping on the chorus, and often fading.'),
  span('interlude', 'Interlude', 'A composed passage outside the form that separates choruses or sections.'),
  span('bridge', 'Bridge', 'A contrasting section, usually heard once (twice in AABA), that departs from the verse and chorus material and sets up their return. It is the B of AABA, and the same thing as a "middle eight" or "release".'),
  span('coda', 'Coda', 'Ending material appended after the final statement of the form, not a repetition of its last phrase.'),
  span('tag', 'Tag', 'A repetition of the form\'s final phrase, often several times and via a deceptive or turnaround substitute, that postpones the final cadence.'),
  span('vamp', 'Vamp', 'A short progression or ostinato repeated an open number of times, often until a cue; used for intros, endings and modal solo sections.'),
  span('verse', 'Verse', 'A section whose music returns but whose lyrics change on each statement, usually carrying the narrative. The A sections of an AABA song are verses.'),
  span('prechorus', 'Prechorus', 'A section that sits between verse and chorus, returns with them, and is not stable on its own: it builds harmonic, textural or melodic tension toward the chorus arrival.'),
  span('chorus', 'Chorus', 'A self-standing section that returns with the same (or nearly the same) lyrics and music, usually carries the title or hook, and acts as the song\'s point of arrival.'),
  span('postchorus', 'Postchorus', 'An independent section that directly follows the chorus and recurs with it, closing or extending the chorus (often with hook, vocables or an instrumental "drop") before the next cycle begins.'),
  span('refrain', 'Refrain', 'A lyric-invariant line or phrase (usually the title) inside an otherwise lyric-variant section, at its end ("tail") or start ("head"). It is too short to be a section.'),
  span('instrumental', 'Instrumental', 'A section with no lead vocal that fills a slot the voice would otherwise take (e.g. an instrumental verse). It is not an intro, interlude or outro, and not a featured `solo`.'),
  span('solo', 'Solo', 'One performer\'s continuous featured passage, usually improvised, over one or more choruses or an open section; the soloist goes in the label.'),
  span('breakdown', 'Breakdown', 'A section where the kick drum, and usually the bass, drops out or is sharply thinned, so the groove is suspended. It typically follows a core or drop section and leads into a buildup.'),
  span('buildup', 'Build', 'A section that builds tension and points ahead to a structural arrival, usually a drop. It typically uses additive layering, rising pitch or filter processes, faster percussion, or removal of the bass.', { name: 'Buildup' }),
  span('verse-chorus-form', 'Verse–chorus', 'A song built on a repeating cycle of verse and chorus (with optional prechorus and postchorus), usually with a bridge after the second chorus.', { name: 'Verse–chorus form' }),
  span('aaba-form', 'AABA', 'A song built on lyric-variant A sections (verses, often closing with a refrain) with a contrasting B (bridge), in the pattern AABA or an extension of it. It is "32-bar form" when each A is 8 bars.', { name: 'AABA form' }),
  span('strophic-form', 'Strophic', 'A song made only of repeated verses (possibly with a refrain), with no chorus or bridge. Covach calls this "simple verse".', { name: 'Strophic form' }),
  span('twelve-bar-blues-form', '12-bar blues', 'A song whose sections are successive 12-bar blues choruses (sung or instrumental).', { name: '12-bar blues form' }),
  span('beat-match-intro', 'Beat-match intro', 'An opening region built for mixing: mainly kick and percussion, with little or no bass or lead, usually 16 or 32 bars, so a DJ can layer it under the outgoing track.'),
  span('beat-match-outro', 'Beat-match outro', 'The same kind of region at the end of a track: elements are removed back to a beat-led texture so the next track can be mixed in over it.'),
  span('drop', 'Drop', 'The section begun by a drop hit: the full groove, with kick and bass, returns as the payoff of the preceding buildup.'),
  span('core', 'Core', 'A section where the main groove is running with both kick and bass present, whether or not a buildup and drop hit lead into it. Typical of techno and house, where there may be no drop in the big-room sense.', { name: 'Core (EDM)' }),
  span('pre-drop', 'Pre-drop', 'A short gap at the end of a buildup, often one to four bars, where most or all elements are cut just before the drop hit. It usually holds silence, a vocal pickup or a lone effect.'),
  span('slow-introduction', 'Intro', 'Introductory section before the exposition (or first main section), usually slower and harmonically open, outside the form proper.', { name: 'Slow introduction' }),
  span('exposition', 'Expo', 'First large section of a sonata form: presents the main thematic material and moves from the tonic to a secondary key.', { name: 'Exposition' }),
  span('development', 'Dev', 'Middle section of a sonata form, tonally unstable, working over earlier material and ending on or prolonging the home dominant.', { name: 'Development' }),
  span('recapitulation', 'Recap', 'Section restating the exposition\'s material, with the secondary-key material brought into the tonic.', { name: 'Recapitulation' }),
  span('retransition', 'RT', 'Passage that prepares the return of the main theme and tonic, usually by prolonging the home dominant.', { name: 'Retransition' }),
  span('false-recapitulation', 'False recap', 'Apparent return of the main theme, usually in a non-tonic key, inside the development before the true recapitulation.', { name: 'False recapitulation' }),
  span('rondo-refrain', 'Refrain', 'Recurring tonic-key section of a rondo (the A of ABACA).', { name: 'Rondo refrain' }),
  span('rondo-episode', 'Episode', 'Contrasting section between two rondo refrains ("couplet").', { name: 'Rondo episode' }),
  span('variations-theme', 'Theme', 'The theme stated before a set of variations.', { name: 'Theme (of variations)' }),
  span('variation', 'Var.', 'One variation of a theme in a theme-and-variations set.', { name: 'Variation' }),
  span('minuet', 'Minuet', 'The minuet (or scherzo) section that frames a trio.'),
  span('trio', 'Trio', 'Contrasting middle section of a minuet/scherzo-and-trio.'),
  span('ritornello', 'Rit.', 'Recurring tutti section in a ritornello form or concerto movement.', { name: 'Ritornello' }),
  span('solo-section', 'Solo', 'Soloist-led section between ritornellos in a concerto.', { name: 'Solo section (concerto)' }),
  span('cadenza', 'Cadenza', 'Virtuosic solo passage, improvised or written out, usually suspended on a cadential ⁶₄ before the closing tutti.'),
  span('lead-in', 'Lead-in', 'Short link (Eingang), often over V, leading into a returning theme or section.'),
  span('first-theme', '1st theme', 'Theme or theme group that establishes the home key at the start of an exposition or recapitulation. Neutral term; Caplin\'s MT and H&D\'s P are its theory-specific forms.', { name: 'First theme' }),
  span('transition', 'Trans.', 'Passage between the first and second theme that destabilises the home key, usually modulating and ending on a dominant.', { name: 'Transition' }),
  span('second-theme', '2nd theme', 'Theme or theme group in the secondary key (the tonic in the recapitulation) that follows the transition.', { name: 'Second theme' }),
  span('closing-section', 'Closing', 'Material after the second theme\'s final cadence that rounds off the exposition or recapitulation.', { name: 'Closing section' }),
  span('codetta', 'Codetta', 'Short post-cadential unit that prolongs the tonic after a PAC.'),
  span('pedal-point', 'Pedal', 'Sustained or reiterated bass tone (usually 1̂ or 5̂) under changing harmonies.', { name: 'Pedal point' }),
  span('phrase', 'Phrase', 'A unit that ends with a cadence (generic, for analysts who don\'t commit to a theory).'),
  span('sentence', 'Sentence', 'Theme type: a presentation (basic idea plus its repetition) followed by a continuation that ends with a cadence.'),
  span('period', 'Period', 'Theme type: an antecedent ending with a weaker cadence, answered by a consequent that begins the same way and ends with a stronger one.'),
  span('basic-idea', 'b.i.', 'Short (typically two-bar) initiating idea, usually made of several motives, that is repeated or answered.', { name: 'Basic idea' }),
  span('contrasting-idea', 'c.i.', 'Idea that follows and contrasts with a basic idea, completing an antecedent or compound basic idea.', { name: 'Contrasting idea' }),
  span('presentation', 'Pres.', 'Initiating phrase of a sentence: a basic idea and its repetition over a tonic prolongation.', { name: 'Presentation' }),
  span('continuation', 'Cont.', 'Medial phrase that destabilises what came before through fragmentation, faster harmonic rhythm or sequence, and often leads into the cadence.', { name: 'Continuation' }),
  span('cadential', 'Cad.', 'Phrase-level function that confirms the key with a cadential progression.', { name: 'Cadential' }),
  span('antecedent', 'Ant.', 'First half of a period, ending with a weak cadence (usually HC, sometimes IAC).', { name: 'Antecedent' }),
  span('consequent', 'Cons.', 'Second half of a period: begins like the antecedent and ends with a stronger cadence.', { name: 'Consequent' }),
  span('fugal-exposition', 'Fug. expo', 'Opening section of a fugue, in which each voice enters in turn with the subject or answer.', { name: 'Fugal exposition' }),
  span('fugue-subject', 'Subj.', 'A statement of the fugue\'s subject.', { name: 'Subject' }),
  span('fugue-answer', 'Ans.', 'The subject transposed to the dominant (a real or tonal answer).', { name: 'Answer' }),
  span('countersubject', 'CS', 'Recurring counterpoint that accompanies the subject or answer.', { name: 'Countersubject' }),
  span('fugal-episode', 'Ep.', 'Passage between subject entries with no complete statement, often sequential.', { name: 'Episode (fugue)' }),
  span('middle-entry', 'Entry', 'A subject entry, or group of entries, after the exposition, often in a related key.', { name: 'Middle entry' }),
  span('stretto', 'Stretto', 'Overlapping subject entries, each beginning before the previous one ends.'),
  span('fugal-codetta', 'Codetta', 'Short link between entries inside the fugal exposition (not the post-cadential codetta).', { name: 'Codetta (fugue)' }),
  span('sonata-form', 'Sonata', 'Exposition, development and recapitulation, with a tonal resolution of the second theme.', { name: 'Sonata form' }),
  span('rondo-form', 'Rondo', 'A refrain alternating with contrasting episodes (ABACA, ABACABA).', { name: 'Rondo form' }),
  span('sonata-rondo', 'Sonata-rondo', 'Rondo whose B returns in the tonic and whose C acts as a development.'),
  span('binary-form', 'Binary', 'Two-part form, each part usually repeated.', { name: 'Binary form' }),
  span('rounded-binary', 'Rounded bin.', 'Binary form whose second part closes with a return of the opening material in the tonic.', { name: 'Rounded binary' }),
  span('ternary-form', 'Ternary', 'Three-part ABA form with a contrasting middle.', { name: 'Ternary form' }),
  span('theme-and-variations', 'Variations', 'A theme followed by a set of variations on it.', { name: 'Theme and variations' }),
  span('fugue', 'Fugue', 'Imitative contrapuntal piece built from entries of a subject.'),
  span('head-in', 'Head in', 'The first statement of the tune\'s composed melody, before the solos; may last more than one chorus (a blues head is often played twice).'),
  span('head-out', 'Head out', 'The closing restatement of the melody after the solos; may be partial (e.g. "from the bridge" or last A only).'),
  span('trading', 'Trading', 'A passage where players alternate short solo turns of a fixed length (twos, fours, eights, choruses), most often a soloist against the drummer.'),
  span('shout-chorus', 'Shout chorus', 'A climactic, fully arranged ensemble chorus, usually late in a big-band chart and before the head out.'),
  span('break', 'Break', 'A short passage (usually 1–4 bars) where the accompaniment stops and one player continues alone, often launching a solo.'),
  span('stop-time', 'Stop-time', 'A passage where the rhythm section plays only on isolated, regular accents (e.g. beat 1 of every other bar) while a soloist continues.'),
  span('intro-verse', 'Verse', 'The introductory verse of a Tin Pan Alley or Broadway standard, sung or played once (often rubato) before the chorus/refrain.', { name: 'Verse (of a standard)' }),
  span('form-chorus', 'Chorus', 'One complete pass through the tune\'s form (e.g. 32 bars of AABA, 12 of blues). Put these on their own layer, numbered in the label.', { name: 'Chorus (one pass through the form)' }),
  span('turnaround', 'Turnaround', 'The closing progression of a form or section (typically its last two bars, e.g. I–vi–ii–V) that leads back to the top.'),
  span('rotation', 'Rotation', 'One pass through an ordered series of sections or modules, as in rotational form.'),
  span('caplin-main-theme', 'MT', 'Tight-knit theme that establishes the home key; it ends with a PAC (or an HC in some cases).', { name: 'Main theme', broader: ['first-theme'] }),
  span('caplin-transition', 'TR', 'Destabilises the home key and ends on a dominant (HC or dominant arrival) that prepares the subordinate theme.', { name: 'Transition (Caplin)', broader: ['transition'] }),
  span('caplin-subordinate-theme', 'ST', 'Loose-knit theme that confirms the subordinate key with a PAC. There may be several (ST1, ST2 …).', { name: 'Subordinate theme', broader: ['second-theme'] }),
  span('caplin-closing-section', 'Closing', 'Group of codettas after a theme\'s PAC; post-cadential, so it contains no cadence of its own.', { name: 'Closing section (Caplin)' }),
  span('caplin-thematic-introduction', 'Intro', 'Brief tonic prolongation before a theme\'s initiating function ("before-the-beginning").', { name: 'Thematic introduction' }),
  span('caplin-standing-on-the-dominant', 'Standing on V', 'Post-cadential prolongation of the dominant that follows an HC.', { name: 'Standing on the dominant' }),
  span('caplin-pre-core', 'Pre-core', 'Unstable, transition-like section at the start of a development, before the core.'),
  span('caplin-core', 'Core', 'Central section of a development: a model, its sequential repetition, and fragmentation.', { name: 'Core (development)' }),
  span('caplin-model', 'Model', 'Unit in a core (or continuation) that is then repeated in sequence.'),
  span('caplin-sequence', 'Seq.', 'Sequential repetition of a model.', { name: 'Sequence' }),
  span('caplin-compound-basic-idea', 'c.b.i.', 'Basic idea plus contrasting idea that ends without a cadence; the initiating unit of a hybrid.', { name: 'Compound basic idea' }),
  span('caplin-hybrid-theme', 'Hybrid', 'Theme mixing sentence and period functions. Which hybrid it is can be read off its children\'s types.', { name: 'Hybrid theme' }),
  span('caplin-compound-sentence', 'Compound sent.', 'Sixteen-bar sentence whose presentation is built from compound basic ideas or antecedents.', { name: 'Compound sentence', broader: ['sentence'] }),
  span('caplin-compound-period', 'Compound per.', 'Period whose antecedent and consequent are each sentences or hybrids (roughly the traditional "double period").', { name: 'Compound period', broader: ['period'] }),
  span('caplin-continuation-cadential', 'Cont.⇒cad.', 'Single phrase that starts as a continuation and becomes cadential.', { name: 'Continuation ⇒ cadential' }),
  span('caplin-expanded-cadential-progression', 'ECP', 'Cadential progression stretched over enough time to form a phrase in its own right.', { name: 'Expanded cadential progression' }),
  span('caplin-contrasting-middle', 'Contr. middle', 'B section of a small ternary: destabilising, usually ends on the home dominant.', { name: 'Contrasting middle' }),
  span('caplin-interior-theme', 'Interior theme', 'Contrasting middle theme of a large ternary (or of a rondo\'s C).'),
  span('hd-p-zone', 'P', 'Primary-theme zone: the tonic-key opening module(s) of a sonata rotation (P¹·¹, P¹·² … go in the label).', { name: 'Primary-theme zone', broader: ['first-theme'] }),
  span('hd-p0', 'P⁰', 'Preparatory module before P proper.', { name: 'P⁰ module' }),
  span('hd-tr-zone', 'TR', 'Transition zone: from the end of P to the MC, gaining energy and usually modulating.', { name: 'Transition zone', broader: ['transition'] }),
  span('hd-caesura-fill', 'CF', 'Material that fills the gap of the medial caesura before S begins.', { name: 'Caesura fill' }),
  span('hd-s-zone', 'S', 'Secondary-theme zone: from after the MC to the EEC (ESC in the recapitulation).', { name: 'Secondary-theme zone', broader: ['second-theme'] }),
  span('hd-c-zone', 'C', 'Closing zone: everything after the EEC/ESC up to the end of the exposition or recapitulation; may contain themes.', { name: 'Closing zone' }),
  span('hd-dominant-lock', 'Dom. lock', 'Extended, emphatic dominant prolongation, typically driving to the MC.', { name: 'Dominant lock' }),
  span('hd-trimodular-block', 'TMB', 'Three-module stretch after an apparent MC in which a second MC follows.', { name: 'Trimodular block' }),
  span('hd-expansion-section', 'Expansion', 'Fortspinnung-like span of a continuous exposition (no MC) leading to the EEC.', { name: 'Expansion section' }),
  span('hd-rotation', 'Rotation', 'One pass through the ordered referential layout (P TR ′ S / C) or a subset of it.', { name: 'Rotation (Sonata Theory)', broader: ['rotation'] }),
  span('hd-display-episode', 'Display ep.', 'Virtuosic soloist passage in a Type 5 (concerto) sonata, usually ending with a trill cadence.', { name: 'Display episode' }),
  span('schmalfeldt-one-more-time', 'One more time', 'Repetition of cadential material after an evaded (or deceptive) cadence, en route to the cadence finally achieved.'),
  span('schenker-initial-ascent', 'Anstieg', 'Initial ascent leading up to the primary tone.', { name: 'Initial ascent' }),
  span('schenker-linear-progression', 'Zug', 'Linear progression spanning a structural interval (its interval goes in the label).', { name: 'Linear progression' }),
  span('introductory-verse', 'Intro verse', 'The Tin Pan Alley verse: a once-only, often rubato introductory section before the main AABA body (the "refrain" or "chorus" in that era\'s usage).', { name: 'Introductory verse' }),
  span('terminal-climax', 'Terminal climax', 'A thematically independent final section that surpasses the chorus as the song\'s high point and is heard only once.'),
  span('dance-chorus', 'Dance chorus', 'In pop and EDM collaborations: a heightened, usually wordless or hook-only version of the chorus that keeps its harmony, placed after the vocal chorus.'),
  span('simple-verse-chorus-form', 'Simple verse–chorus', 'A verse–chorus song in which the verse and chorus share the same progression.', { broader: ['verse-chorus-form'] }),
  span('contrasting-verse-chorus-form', 'Contrasting verse–chorus', 'A verse–chorus song in which the verse and chorus have different progressions.', { broader: ['verse-chorus-form'] }),
  span('compound-aaba-form', 'Compound AABA', 'An AABA song whose A sections are themselves verse–chorus units and whose B is a contrasting multi-section complex.', { broader: ['aaba-form'] }),
  span('through-composed-form', 'Through-composed', 'A song with little or no sectional return.'),
  span('terminally-climactic-form', 'Terminally climactic', 'A verse–chorus-based song that ends in a terminal climax. Osborn describes two-part, three-part and extended types.'),
  span('srdc-statement', 'S', 'The first phrase of an SRDC unit: states the basic idea.', { name: 'Statement (SRDC)' }),
  span('srdc-restatement', 'R', 'The second phrase: restates or answers the basic idea.', { name: 'Restatement (SRDC)' }),
  span('srdc-departure', 'D', 'The third phrase: contrasts, often moving away from tonic, fragmenting or quickening the harmonic rhythm.', { name: 'Departure (SRDC)' }),
  span('srdc-conclusion', 'C', 'The fourth phrase: closes the unit, returning to the basic idea or ending on new material.', { name: 'Conclusion (SRDC)' }),
  span('skit', 'Skit', 'A spoken or dramatised non-musical passage within or between tracks (a hip-hop album convention).'),
  span('setup', 'Setup', 'Peres\'s low point of a sonic cycle: the lower-energy passage that a buildup grows out of.'),
  span('peak', 'Peak', 'Peres\'s high point of a sonic cycle: the section of greatest sonic energy, which the buildup aims at.'),
  span('anthem', 'Anthem', 'Trance: the climactic section, usually after the main breakdown and build, where the full lead melody sounds over the full groove.'),
  span('riser', 'Riser', 'Osborn\'s name for the tension-building formal function in Top-40 EDM, used in place of "buildup".', { broader: ['buildup'] }),
  span('riserchorus', 'Riserchorus', 'Osborn\'s blended section: a chorus that also does the riser\'s job, leading into a drop.'),
  span('anthem-postchorus', 'Anthem PC', 'A separate, climactic postchorus that follows a chorus which builds.', { name: 'Anthem postchorus', broader: ['postchorus'] }),
  span('anti-drop', 'Anti-drop', 'A payoff section noticeably thinner than the buildup that led to it, which reverses the expected release.'),
  span('mix-blend', 'Blend', 'In a recorded DJ set, the stretch where outgoing and incoming tracks sound together.', { name: 'Mix blend' }),
  span('trade', 'Trade', 'One player\'s single turn inside a `trading` span; put these on a sub-layer.'),
  span('soli', 'Soli', 'A harmonised passage for one section (e.g. a sax soli), often in the style of an improvised line.'),
  span('backgrounds', 'Backgrounds', 'Written ensemble figures behind a soloist; belongs on its own layer under the `solo`.'),
  span('send-off', 'Send-off', 'An ensemble figure or break that launches a soloist into their first chorus.'),
  span('out-chorus', 'Out chorus', 'The final full-ensemble chorus of a (usually early or swing) performance, often collectively improvised or riff-based.'),
  span('collective-improvisation', 'Collective', 'Simultaneous improvisation by several melody players, as in New Orleans ensemble choruses or free passages.', { name: 'Collective improvisation' }),
  span('time-no-changes', 'Time, no changes', 'Improvisation over steady time where the tune\'s chord progression is suspended or only implied.'),
  span('open-section', 'Open', 'A section with no fixed length or form cycle (open solo, free passage), ended by cue.', { name: 'Open section' }),
  span('pedal', 'Pedal', 'A section over a sustained or repeated bass pitch.', { name: 'Pedal (jazz)' }),
  span('two-feel', 'In 2', 'Bass plays mainly on beats 1 and 3 (a two-beat feel).', { name: 'Two feel' }),
  span('four-feel', 'In 4', 'Walking bass on every beat.', { name: 'Four feel' }),
  span('double-time-feel', 'Double-time', 'Soloist or rhythm section implies twice the tempo while the form keeps its pace.', { name: 'Double-time feel' }),
  span('half-time-feel', 'Half-time', 'The feel implies half the tempo while the form keeps its pace.', { name: 'Half-time feel' }),
  span('rubato', 'Rubato', 'Out of tempo, with no steady pulse (ballad intros and verses, cadenzas).'),
]

const POINT_MARKER_TERMS: BuiltInTerm[] = [
  marker('downbeat', 'Downbeat', 'A rhythmic anchor: the first beat of a bar or hypermeasure.'),
  marker('key-change', 'Key change', 'A modulation or change of tonic.'),
  marker('tempo-change', 'Tempo change', 'A change of tempo.'),
  marker('note', 'Note', 'A general annotation.'),
  marker('truck-driver-modulation', 'Truck-driver', 'An abrupt upward shift of the tonic, usually by a semitone or whole tone and without a pivot, that re-launches repeated material (typically a late chorus). Other key changes are typed `key-change`.', { name: 'Truck-driver modulation' }),
  marker('fade-out', 'Fade', 'The moment the closing fade begins.', { name: 'Fade-out' }),
  marker('stop', 'Stop', 'A full-band cut-off: the ensemble (usually the voice too) falls silent or nearly silent for a beat or more, then re-enters.'),
  marker('drop-hit', 'Drop', 'The instant of arrival: the first downbeat of a drop, where kick and bass come back.', { name: 'Drop hit' }),
  marker('cutoff', 'Cut', 'The instant most of the texture is abruptly removed. This happens at a breakdown\'s start, at the start of a pre-drop, or in a fake-out.', { name: 'Cutoff' }),
  marker('perfect-authentic-cadence', 'PAC', 'Cadential progression ending V–I, both in root position, with the melody arriving on 1̂.', { name: 'Perfect authentic cadence' }),
  marker('imperfect-authentic-cadence', 'IAC', 'Root-position V–I cadence whose melody ends on 3̂ (rarely 5̂).', { name: 'Imperfect authentic cadence' }),
  marker('half-cadence', 'HC', 'Phrase ending on a root-position dominant, reached as the goal of a cadential progression.', { name: 'Half cadence' }),
  marker('deceptive-cadence', 'DC', 'Cadential progression that reaches V and resolves to a substitute for the expected tonic, usually VI.', { name: 'Deceptive cadence' }),
  marker('evaded-cadence', 'EC', 'Cadential progression whose expected tonic arrival is replaced by the start of a new unit, often a repeat of the cadential idea.', { name: 'Evaded cadence' }),
  marker('abandoned-cadence', 'Abandoned', 'Cadential progression that breaks off before its root-position dominant arrives (the dominant is inverted or skipped).', { name: 'Abandoned cadence' }),
  marker('phrygian-half-cadence', 'PHC', 'Half cadence in minor approached from iv⁶, with the bass falling ♭6̂–5̂.', { name: 'Phrygian half cadence' }),
  marker('plagal-cadence', 'PC', 'IV–I closing gesture. Caplin argues this is not a true cadence in classical style and is normally post-cadential.', { name: 'Plagal cadence' }),
  marker('medial-caesura', 'MC', 'Rhetorical break, usually on a dominant, that ends the TR zone and opens space for S in a two-part exposition.', { name: 'Medial caesura' }),
  marker('essential-expositional-closure', 'EEC', 'First satisfactory PAC in the secondary key that goes on to different material: the end of S.', { name: 'Essential expositional closure' }),
  marker('essential-structural-closure', 'ESC', 'The recapitulation\'s counterpart to the EEC: the first satisfactory tonic PAC that closes S.', { name: 'Essential structural closure' }),
  marker('double-return', 'Double return', 'Simultaneous return of the main theme and the home key, marking the start of the recapitulation.'),
  marker('quote', 'Quote', 'A recognisable borrowing from another melody inside an improvisation; name the source in the label.'),
  marker('caplin-dominant-arrival', 'Dom. arrival', 'Non-cadential arrival on the dominant that ends a unit without a cadential progression; not an HC.', { name: 'Dominant arrival' }),
  marker('hd-crux', 'Crux', 'Point in the recapitulation after which the material corresponds closely, transposed, to the exposition.'),
  marker('hd-declined-mc', 'MC declined', 'MC offer that isn\'t taken up: S doesn\'t follow, and TR (or the next module) carries on.', { name: 'Declined medial caesura' }),
  marker('schenker-kopfton', 'Kopfton', 'Arrival of the primary tone (3̂, 5̂ or 8̂) of the fundamental line.'),
  marker('schenker-interruption', '‖', 'Interruption: 2̂ over V divides the fundamental line before the descent is restarted.', { name: 'Interruption' }),
  marker('schenker-structural-close', '1̂/I', 'Arrival of 1̂ over I that completes the Ursatz.', { name: 'Structural close' }),
  marker('hook-entry', 'Hook', 'The first sounding of a hook: a short, memorable lyric, melodic, rhythmic or timbral figure.', { name: 'Hook entry' }),
  marker('false-ending', 'False ending', 'A point where the music seems to end (a cadence plus silence) and then resumes.'),
  marker('structural-dominant', 'Str. V', 'The arrival of the dominant that sets up the chorus\'s tonic arrival in Nobile\'s harmonic model of form.', { name: 'Structural dominant' }),
  marker('double-plagal-cadence', 'DP', 'A ♭VII–IV–I close.', { name: 'Double plagal cadence' }),
  marker('aeolian-cadence', 'Aeol.', 'A ♭VI–♭VII–I close.', { name: 'Aeolian cadence' }),
  marker('fake-drop', 'Fake drop', 'A drop hit that cuts straight back into more build or a pre-drop instead of starting a drop.'),
  marker('phrase-start', 'Phrase', 'The first downbeat of an 8-, 16- or 32-bar hypermetric unit.', { name: 'Phrase start' }),
  marker('snare-roll-onset', 'Roll', 'Start of a snare or drum roll that speeds up toward an arrival.', { name: 'Snare roll' }),
  marker('filter-release', 'Filter open', 'The instant a filter sweep reaches fully open, or a filtered element is released.', { name: 'Filter release' }),
  marker('riser-apex', 'Riser top', 'The peak of a riser or uplifter sound effect, usually just before the cut or the hit.', { name: 'Riser apex' }),
  marker('impact', 'Impact', 'A crash or impact sound effect that marks an arrival.'),
  marker('fill', 'Fill', 'A short drum (or rhythm-section) figure that marks a phrase or section boundary.'),
  marker('solo-entry', 'Solo entry', 'The soloist\'s actual first note when it comes before the top of the form (a pickup) and so doesn\'t match the `solo` span\'s start.'),
  marker('hit', 'Hit', 'An ensemble accent played together by several players (also "kick").'),
  marker('set-up', 'Set-up', 'A drum figure that prepares an ensemble hit or section entrance.'),
  marker('cue', 'Cue', 'An audible or visible signal that ends an open section or calls the next one (e.g. the head-out cue).'),
  marker('form-slip', 'Form slip', 'A player or the group loses its place in the form ("turned around") and recovers or diverges.'),
  marker('call-response', 'Response', 'One player audibly answers or imitates another\'s figure.', { name: 'Call and response' }),
]

export const LIBRARIES: Library[] = [
  {
    id: 'general',
    label: 'General',
    tier: 'built-in',
    description: 'Section names shared across traditions.',
    spanTypes: ['intro', 'outro', 'interlude', 'bridge', 'coda', 'tag', 'vamp'],
    pointMarkerTypes: ['downbeat', 'key-change', 'tempo-change', 'note'],
  },
  {
    id: 'pop-rock',
    label: 'Pop/Rock',
    tier: 'built-in',
    description: 'Section functions of popular song.',
    spanTypes: ['intro', 'verse', 'prechorus', 'chorus', 'postchorus', 'refrain', 'bridge', 'instrumental', 'interlude', 'outro', 'solo', 'tag', 'coda', 'breakdown', 'buildup'],
    pointMarkerTypes: ['truck-driver-modulation', 'fade-out', 'stop', 'key-change'],
  },
  {
    id: 'song-form',
    label: 'Song form',
    tier: 'built-in',
    description: 'Whole-song form types, as a span over the song or part of it.',
    spanTypes: ['verse-chorus-form', 'aaba-form', 'strophic-form', 'twelve-bar-blues-form'],
    pointMarkerTypes: [],
  },
  {
    id: 'edm',
    label: 'EDM',
    tier: 'built-in',
    description: 'Sections and moments of electronic dance music.',
    spanTypes: ['beat-match-intro', 'beat-match-outro', 'breakdown', 'buildup', 'drop', 'core', 'pre-drop', 'intro', 'outro', 'bridge'],
    pointMarkerTypes: ['drop-hit', 'cutoff', 'downbeat'],
  },
  {
    id: 'common-practice',
    label: 'Common practice',
    tier: 'built-in',
    description: 'Large forms, themes, phrase functions and fugue; cadences and Sonata Theory closure points.',
    spanTypes: ['slow-introduction', 'exposition', 'development', 'recapitulation', 'coda', 'retransition', 'false-recapitulation', 'rondo-refrain', 'rondo-episode', 'variations-theme', 'variation', 'minuet', 'trio', 'ritornello', 'solo-section', 'cadenza', 'lead-in', 'first-theme', 'transition', 'second-theme', 'closing-section', 'codetta', 'pedal-point', 'phrase', 'sentence', 'period', 'basic-idea', 'contrasting-idea', 'presentation', 'continuation', 'cadential', 'antecedent', 'consequent', 'fugal-exposition', 'fugue-subject', 'fugue-answer', 'countersubject', 'fugal-episode', 'middle-entry', 'stretto', 'fugal-codetta', 'sonata-form', 'rondo-form', 'sonata-rondo', 'binary-form', 'rounded-binary', 'ternary-form', 'theme-and-variations', 'fugue'],
    pointMarkerTypes: ['perfect-authentic-cadence', 'imperfect-authentic-cadence', 'half-cadence', 'deceptive-cadence', 'evaded-cadence', 'abandoned-cadence', 'phrygian-half-cadence', 'plagal-cadence', 'medial-caesura', 'essential-expositional-closure', 'essential-structural-closure', 'double-return'],
  },
  {
    id: 'jazz',
    label: 'Jazz',
    tier: 'built-in',
    description: 'The performance, chorus and tune-form levels of a jazz recording.',
    spanTypes: ['head-in', 'head-out', 'solo', 'trading', 'shout-chorus', 'break', 'stop-time', 'intro-verse', 'form-chorus', 'turnaround', 'intro', 'interlude', 'tag', 'coda', 'vamp', 'bridge'],
    pointMarkerTypes: ['quote'],
  },
  {
    id: 'letters',
    label: 'Form letters',
    tier: 'built-in',
    description: 'Rotations, and letters (A, B, A′ …) made on demand.',
    spanTypes: ['rotation'],
    pointMarkerTypes: [],
  },
  {
    id: 'caplin',
    label: 'Caplin formal functions',
    tier: 'pack',
    description: 'William Caplin, Classical Form (1998).',
    spanTypes: ['caplin-main-theme', 'caplin-transition', 'caplin-subordinate-theme', 'caplin-closing-section', 'caplin-thematic-introduction', 'caplin-standing-on-the-dominant', 'caplin-pre-core', 'caplin-core', 'caplin-model', 'caplin-sequence', 'caplin-compound-basic-idea', 'caplin-hybrid-theme', 'caplin-compound-sentence', 'caplin-compound-period', 'caplin-continuation-cadential', 'caplin-expanded-cadential-progression', 'caplin-contrasting-middle', 'caplin-interior-theme'],
    pointMarkerTypes: ['caplin-dominant-arrival'],
  },
  {
    id: 'sonata-theory',
    label: 'Sonata Theory',
    tier: 'pack',
    description: 'Hepokoski and Darcy, Elements of Sonata Theory (2006).',
    spanTypes: ['hd-p-zone', 'hd-p0', 'hd-tr-zone', 'hd-caesura-fill', 'hd-s-zone', 'hd-c-zone', 'hd-dominant-lock', 'hd-trimodular-block', 'hd-expansion-section', 'hd-rotation', 'hd-display-episode'],
    pointMarkerTypes: ['hd-crux', 'hd-declined-mc'],
  },
  {
    id: 'schmalfeldt',
    label: 'Schmalfeldt',
    tier: 'pack',
    description: 'Janet Schmalfeldt, In the Process of Becoming (2011).',
    spanTypes: ['schmalfeldt-one-more-time'],
    pointMarkerTypes: [],
  },
  {
    id: 'schenker',
    label: 'Schenkerian',
    tier: 'pack',
    description: 'Events of the fundamental structure that can be placed on a timeline.',
    spanTypes: ['schenker-initial-ascent', 'schenker-linear-progression'],
    pointMarkerTypes: ['schenker-kopfton', 'schenker-interruption', 'schenker-structural-close'],
  },
  {
    id: 'pop-extended',
    label: 'Pop/Rock extended',
    tier: 'pack',
    description: 'Song-form subtypes and terms specific to an era or scholar.',
    spanTypes: ['introductory-verse', 'vamp', 'turnaround', 'stop-time', 'terminal-climax', 'dance-chorus', 'simple-verse-chorus-form', 'contrasting-verse-chorus-form', 'compound-aaba-form', 'through-composed-form', 'terminally-climactic-form'],
    pointMarkerTypes: ['hook-entry', 'false-ending'],
  },
  {
    id: 'srdc',
    label: 'SRDC phrase functions',
    tier: 'pack',
    description: 'Statement, restatement, departure, conclusion.',
    spanTypes: ['srdc-statement', 'srdc-restatement', 'srdc-departure', 'srdc-conclusion'],
    pointMarkerTypes: [],
  },
  {
    id: 'rock-harmony',
    label: 'Rock harmony',
    tier: 'pack',
    description: 'Closes and arrivals particular to rock harmony.',
    spanTypes: [],
    pointMarkerTypes: ['structural-dominant', 'double-plagal-cadence', 'aeolian-cadence'],
  },
  {
    id: 'hip-hop',
    label: 'Hip-hop',
    tier: 'pack',
    description: 'Album conventions of hip-hop.',
    spanTypes: ['skit'],
    pointMarkerTypes: [],
  },
  {
    id: 'peres',
    label: 'Peres sonic functions',
    tier: 'pack',
    description: 'Asaf Peres\'s sonic cycle (2016).',
    spanTypes: ['setup', 'peak'],
    pointMarkerTypes: [],
  },
  {
    id: 'trance',
    label: 'Trance',
    tier: 'pack',
    description: 'Trance-specific sections.',
    spanTypes: ['anthem'],
    pointMarkerTypes: [],
  },
  {
    id: 'edm-pop',
    label: 'EDM-pop',
    tier: 'pack',
    description: 'Top-40 EDM and pop–EDM collaborations.',
    spanTypes: ['riser', 'riserchorus', 'dance-chorus', 'anthem-postchorus', 'anti-drop'],
    pointMarkerTypes: ['fake-drop'],
  },
  {
    id: 'dj-set',
    label: 'DJ set',
    tier: 'pack',
    description: 'Recorded DJ sets and phrasing.',
    spanTypes: ['mix-blend'],
    pointMarkerTypes: ['phrase-start'],
  },
  {
    id: 'mechanisms',
    label: 'Production mechanisms',
    tier: 'pack',
    description: 'Production events that mark arrivals.',
    spanTypes: [],
    pointMarkerTypes: ['snare-roll-onset', 'filter-release', 'riser-apex', 'impact', 'fill'],
  },
  {
    id: 'jazz-arranging',
    label: 'Jazz: arranging & feel',
    tier: 'pack',
    description: 'Big-band arranging, rhythm-section feel and open forms.',
    spanTypes: ['trade', 'soli', 'backgrounds', 'send-off', 'out-chorus', 'collective-improvisation', 'time-no-changes', 'open-section', 'pedal', 'two-feel', 'four-feel', 'double-time-feel', 'half-time-feel', 'rubato', 'cadenza'],
    pointMarkerTypes: [],
  },
  {
    id: 'jazz-interaction',
    label: 'Jazz: interaction & events',
    tier: 'pack',
    description: 'Moments of interaction in a jazz performance.',
    spanTypes: [],
    pointMarkerTypes: ['solo-entry', 'hit', 'set-up', 'fill', 'cue', 'form-slip', 'call-response'],
  },
]

const BUILT_IN = new Map<string, BuiltInTerm>([...SPAN_TERMS, ...POINT_MARKER_TERMS].map((t) => [t.id, t]))

export const BUILT_IN_SPAN_TERMS: readonly BuiltInTerm[] = SPAN_TERMS
export const BUILT_IN_POINT_MARKER_TERMS: readonly BuiltInTerm[] = POINT_MARKER_TERMS

export function builtInTerm(id: string | null | undefined): BuiltInTerm | undefined {
  return id ? BUILT_IN.get(id) : undefined
}

/** A term as the rest of the app sees it: a built-in, or one of the file's own. */
export interface PickerTerm {
  id: string
  label: string
  name?: string
  definition?: string
  kind: TermKind
  broader?: string[]
  /** Set for a term the document defines itself. */
  custom?: boolean
}

function fromCustom(t: VocabTerm, kind: TermKind): PickerTerm {
  return { id: t.id, label: t.label, definition: t.description, kind, broader: t.broader, custom: true }
}

/** Resolve a type id: built-ins first, then the document's own terms. */
export function findTerm(id: string | null | undefined, kind: TermKind, custom: VocabTerm[]): PickerTerm | undefined {
  if (!id) return undefined
  const b = BUILT_IN.get(id)
  if (b && b.kind === kind) return b
  const c = custom.find((t) => t.id === id)
  return c ? fromCustom(c, kind) : undefined
}

/** What the picker calls a term: its full name, with the label after it when they differ. */
export function termTitle(t: Pick<PickerTerm, 'label' | 'name'>): string {
  return t.name && t.name !== t.label ? `${t.name} (${t.label})` : t.label
}

/** The libraries a term is listed in. */
export function librariesOf(id: string): Library[] {
  return LIBRARIES.filter((l) => l.spanTypes.includes(id) || l.pointMarkerTypes.includes(id))
}

// ── Roll-up across frameworks ──

function broaderOf(id: string, custom: VocabTerm[]): string[] {
  return BUILT_IN.get(id)?.broader ?? custom.find((t) => t.id === id)?.broader ?? []
}

/** Every term `id` counts as, nearest first: caplin-transition → [transition]. */
export function ancestorsOf(id: string, custom: VocabTerm[] = []): string[] {
  const out: string[] = []
  const queue = [...broaderOf(id, custom)]
  while (queue.length) {
    const next = queue.shift()!
    if (next === id || out.includes(next)) continue // a cycle in a custom term is ignored
    out.push(next)
    queue.push(...broaderOf(next, custom))
  }
  return out
}

/**
 * The ids a query for `id` should match: the term and everything that counts
 * as it. `typesUnder('transition')` includes `caplin-transition` and
 * `hd-tr-zone`, so "all transitions" finds every framework's.
 */
export function typesUnder(id: string, custom: VocabTerm[] = []): Set<string> {
  const all = [...BUILT_IN.keys(), ...custom.map((t) => t.id)]
  return new Set([id, ...all.filter((t) => ancestorsOf(t, custom).includes(id))])
}

// ── Letters ──

const PRIME_IDS = ['section', 'prime', 'double-prime', 'triple-prime']
const PRIME_MARKS = ['', '′', '″', '‴']

/**
 * A form letter as a term: A → `a-section`, A′ → `a-prime`, A″ →
 * `a-double-prime`. Made on demand rather than listed, since letters and
 * primes are open-ended; the ids are fixed, so letters still compare across
 * files.
 */
export function letterTerm(letter: string, primes: number): VocabTerm {
  const l = letter.toLowerCase()
  const p = Math.max(0, Math.min(3, primes))
  return { id: `${l}-${PRIME_IDS[p]}`, label: `${l.toUpperCase()}${PRIME_MARKS[p]}`, kind: 'span' }
}

/** Read a typed letter: "a", "B'", "C′", "d''", "E″". Null for anything else. */
export function parseLetter(text: string): { letter: string; primes: number } | null {
  const m = /^\s*([a-z])\s*('{1,3}|′{1,3}|″|‴)?\s*$/i.exec(text)
  if (!m) return null
  const marks = m[2] ?? ''
  const primes = marks === '″' ? 2 : marks === '‴' ? 3 : marks.length
  return { letter: m[1].toUpperCase(), primes }
}

/** Whether an id is a generated letter. */
export function isLetterId(id: string): boolean {
  return /^[a-z]-(section|prime|double-prime|triple-prime)$/.test(id)
}

// ── Search ──

export interface SearchHit {
  term: PickerTerm
  /** The libraries it comes from; empty for a term only the file defines. */
  libraries: Library[]
}

/**
 * Terms matching `query`, across every library (packs included, switched on
 * or not) and the file's own terms. Exact and prefix matches on the label or
 * name come first, then matches inside the name, id or definition.
 */
export function searchTerms(query: string, kind: TermKind, custom: VocabTerm[]): SearchHit[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const pool: PickerTerm[] = [
    ...(kind === 'span' ? SPAN_TERMS : POINT_MARKER_TERMS),
    ...custom.filter((c) => !BUILT_IN.has(c.id)).map((c) => fromCustom(c, kind)),
  ]
  const score = (t: PickerTerm): number => {
    const label = t.label.toLowerCase()
    const name = (t.name ?? '').toLowerCase()
    if (label === q || name === q) return 0
    if (label.startsWith(q) || name.startsWith(q)) return 1
    if (name.includes(q) || t.id.includes(q.replace(/\s+/g, '-'))) return 2
    if ((t.definition ?? '').toLowerCase().includes(q)) return 3
    return -1
  }
  return pool
    .map((term) => ({ term, s: score(term) }))
    .filter((h) => h.s >= 0)
    .sort((a, b) => a.s - b.s)
    .map(({ term }) => ({ term, libraries: librariesOf(term.id) }))
}

/** A span type's display name: the full name, the label, or the bare id if the term is unknown. */
export function spanTypeName(id: string | null | undefined, custom: VocabTerm[]): string | null {
  if (!id) return null
  const t = findTerm(id, 'span', custom)
  return t ? (t.name ?? t.label) : id
}

/**
 * Whether a span's label should change with its type: when it is empty, or
 * still the label (or full name) its current type gave it. A label the analyst
 * wrote ("Verse 1", "THE DROP") is theirs and never follows.
 */
export function labelFollowsType(
  label: string | null | undefined,
  currentType: string | null | undefined,
  custom: VocabTerm[],
): boolean {
  const l = label?.trim()
  if (!l) return true
  const t = findTerm(currentType, 'span', custom)
  return !!t && (l === t.label || l === t.name)
}

// ── Ordering and suggestions for the picker ──

/** Type ids in the order they first sound: Intro, Verse, Prechorus, Chorus … */
export function typesInOrder(items: { type?: string | null; time: number }[]): string[] {
  const out: string[] = []
  for (const it of [...items].sort((a, b) => a.time - b.time)) if (it.type && !out.includes(it.type)) out.push(it.type)
  return out
}

/**
 * The library the given types mostly come from, as a guess at the framework a
 * layer is being analysed in: most of the types listed in it, then the
 * smaller (more specific) library on a tie. Packs count whether or not they
 * are switched on. Null when none of the types is in a library.
 */
export function likelyLibrary(typeIds: string[], kind: TermKind): Library | null {
  const key = kind === 'span' ? 'spanTypes' : 'pointMarkerTypes'
  let best: { lib: Library; hits: number } | null = null
  for (const lib of LIBRARIES) {
    if (lib.id === 'letters' || !lib[key].length) continue
    const hits = typeIds.filter((id) => lib[key].includes(id)).length
    if (!hits) continue
    if (!best || hits > best.hits || (hits === best.hits && lib[key].length < best.lib[key].length)) best = { lib, hits }
  }
  return best?.lib ?? null
}
