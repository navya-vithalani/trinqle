# Trinqle: Design (v1)

Mood: calm, soft, playful, uncluttered. One thing per screen section. Delight comes from motion on user action, not from decoration. **No emojis anywhere** in UI or copy: icons come from the theme's icon set, stickers are images.

## 1. Token system (the contract)
Every component reads tokens only. A theme is a set of values for these; changing theme must never need component changes (except optional override slots).

```
color:   bg, surface, ink, inkSoft, line, accent, accent2, accent3, accent4, success, warn, danger, chart1..chart8
shape:   radiusS, radiusM, radiusL, radiusPill, borderW, buttonShape
depth:   shadowCard, shadowButton, shadowPressed
type:    fontBody, fontDisplay, sizeS/M/L/XL, weightNormal/Medium/Bold
space:   2,4,8,12,16,24,32
motion:  easeBounce, easeSoft, durFast(150), durMed(300), durSlow(600), entranceStyle
assets:  iconSet, stickerStyle, chartStyle
```
Modifiers: `dark` (follow system), `archive` (each theme defines its own monochrome variant), `reducedMotion`. A theme controls everything visual except layout.

## 2. Theme 1: "Cutesy" (default; derived from the prototype)
- Colors (light): bg `#fff3f6`, surface `#ffffff`, ink `#5b4350`, inkSoft `#a58b98`, line `#f6dfe7`, accent (pink) `#ff8fb1`, accent2 (mint) `#9fe3c8`, accent3 (lavender) `#c9b3f5`, accent4 (peach) `#ffd2b0`, star `#ffb84d`.
- Dark: bg `#2a2032`, surface `#382b43`, ink `#f7e8f0`, inkSoft `#b9a0b0`, line `#4a3a57`.
- Font: **Fredoka** (400/500/600), bundled locally. Sentence case everywhere. Radius: cards 24, inputs 14, buttons pill.
- Depth: cards have a flat "sticker" shadow `0 6px 0 line`; primary buttons have a darker bottom edge (`0 4px 0 #e0678f`) and press down 3 px.
- Motion: bouncy pop on card appear (`cubic-bezier(.3,1.6,.5,1)`, 350 ms), toggle thumb springs, stars scale-rotate on tap, active tab icon lifts and scales. No motion on idle except the character.
- Other themes later (royal, cyberpunk, retro): they may change colors, shapes (including button shapes), icons, depth and motion through tokens and component skins, never layout.

## 3. Archive mode
Banner at top: "Viewing: {chapter title} ({dates})" + **Back** button (always visible). Every tab except Home uses the theme's **archive variant**: monochrome, but still with that theme's own icons, shapes, depth and motion. Charts with several series keep their colours (`keepColor`). Form/edit controls hidden or disabled. Theme and character are those stored in the chapter.
**Home stays in full colour** and becomes a chapter page:
```
[ Chapter title + dates ]
[ Photo grid / carousel (0 to 10) ]
[ Summary ]
[ Reflection answers (the 5 to 10 chapter-end questions) ]
[ Metadata: days filled, quick vs full, memorable days, insights, theme, character ]
[ The chapter's character on its stage ]
```
No countdown, form card, backfill banner, heatmap or cycle card.

## 4. Navigation
Bottom bar, 5 tabs: **Home, Dashboard, Insights, Archive, Profile**. Icon + label, 44 px targets, safe-area aware. Profile hosts everything else (Edit form is a full-screen route with a back arrow).

## 5. Screens

### Home (top to bottom)
```
[ Chapter 3 · day 12 of 28 · 16 left  >  ]     (tap: change end date; in the last 2 days it expands into a thick, dismissible pop-up prompting you to finish reflections, title, summary and photos)
[ Tonight card: Locked | Open "Fill tonight" | Filled "Edit" ]   (Sundays: + "Generate insights?")
[ Backfill banner: "Tue is empty. Fill it?" ]   only if a day in the last 3 is missing
[ Greeting line ]                                  rule-based, last 3 to 4 days
[ Character stage, about 180 px tall ]             wanders/dances/sleeps, reacts to taps
[ Fill heatmap: empty / quick / full / backfilled ]
[ Cycle card: month calendar, swipe/arrows for past months, day N, prediction range ]
[ Reflections row: "4 of 9 answered"  >  ]   opens the always-open reflections sheet
```
Empty state (no form yet): one large card with **Import a form** (opens the Import dialog), **Build one**, and a small "Use sample starter pack" link. After import: "Start your first chapter today?" (yes/no) with default 28 days. The character stage has its own breathing room so the character never needs to appear elsewhere.

### Form (pop-up)
The form is a **bordered modal sheet** that rises over Home (not a full page). Frame, border, entrance and exit animation come from the theme. Close with an X (drafts autosave).
1. **Step 1, day header:** title, one-liner, sticker (opens the sticker library), overall rating, memorability (3 chips + a small star chip), **Quick / Full** segmented control, Continue.
2. **Full mode:** paged by section. A **progress bar at the top** has one segment per section, current one highlighted, section name beneath. Bottom bar: Back / Next; the last page shows **Save tonight**. Save stays disabled until required core parts are answered (missing ones are highlighted).
3. **Quick mode:** one flat scrolling list of the core questions (target 7 to 10), **no section headings and no progress bar**, one **Save tonight** button, and a **More questions** expander at the bottom that reveals extras inline.
4. Interaction patterns:
   - **Gate yesno:** big toggle row; turning on animates the details open (height + fade). Core toggles start at "No".
   - **Session card** (repeating): small cards with time track, library chips, note; "+ Add session"; swipe or trash to remove.
   - **Time range:** 24 h horizontal track with two draggable handles and a live "1h 30m" label, wraps midnight (next-day marker). Tap the label to type times (12-hour format).
   - **Library picker:** chips + search field; typing a new word shows a "Create" row; multi shows selected chips; recently used first.
   - **Scale:** stars (tap) or slider (drag, shows value to 0.1), per-part display setting.
   - **Text:** multiline, placeholder "optional"; leave room for Gboard voice typing.
   - **Period question:** "Start period" button, or while active a flow/pain/symptom block and "End period".
5. Locked state shows the opening time with a sleepy character; read-only preview allowed.

### Dashboard
Top: two filter chip rows: **Part type** (All, Yes/No, Scale, Number, Time, Text, Library) and **Section / Question** (searchable dropdown). Search box + date scope pill ("This chapter"). Body: question cards; each has its parts' graphs stacked (tap a graph to expand full screen). Text-part filter switches the body to the **Journal view**: chronological entries, date headers, one block per entry with other parts as small chips; tap-edit available in the open chapter (marked "edited").
**Libraries mode** (toggle at the top of Dashboard): a list of libraries (People, Places, ...); open one to see its items as rows (name, uses, first/last used, small weekly spark bar); tap an item for a sheet listing the days it appears on (date, title, the question it was used in), each opening that day. Read-only; rename/merge lives in Profile.
Chart look: rounded, soft, theme tokens; heatmap squares radius 6; trend lines 3.5 px with round caps; tap a point for the day card.

### Insights
Header: "{N} insights cleared the bar (6.5+), showing {M}". List of insight cards, strong first, then weaker (visually quieter). Card: sentence, small evidence strip (day dots, tap to expand into day titles), sureness and surprise meters, 5-point agree control, Discard (undo toast). Toolbar: Generate now, Runs history, Discarded list. Empty: "No runs yet. Fill a few nights and hit Generate."

### Archive
List of chapter cards (cover = first photo or sticker collage, title, dates, memorable-day count). Button: Import chapter. Segmented: **Chapters | Memorable days | Search** (Memorable = all outstanding and star days with title, sticker, date). **Search** tab: a search field (fuzzy) with a quoted-phrase hint, filter chips (Everything, Text, Library, Day header, Reflections; plus Section, Question, Chapter, Date range menus), result cards grouped by day with a source label (e.g. "Dream > What happened") and highlighted matches; a toggle for newest-first or best-match.

### Profile
Rows grouped: Form (Edit form, Libraries, Import/Export form pack), Data (Back up now, Export chapter, Import chapter, CSV, Past forms), App (Form window hours, Time format and week start, Stickers, Theme, Character, Notifications, Chapter default length), Danger (Delete all data: typed confirmation). Dev section (hidden toggle): demo data generator.

### Close Chapter (hard lock)
After the end date the app shows only this full-screen flow (no tab bar). Steps with a progress dots row: Reflections review (default prompts + chapter-only prompts, editable), Title, Summary, Photos (0 to 10 slots), Confirm ("Close chapter"). Nothing is mandatory except confirming. On T-2/T-1 a thick bordered pop-up on Home previews this and can be dismissed.

### Import dialog
A modal with a large drop zone ("Drop a file here or choose one"), file-picker button, and accepted types listed in small text. After a file is chosen: type detected, summary preview (e.g. "Form pack: 6 sections, 23 questions"), conflicts if any, **Merge / Replace** choice, Confirm. Invalid files show a plain-language error and write nothing.

### Stickers
Profile > Stickers: grid of all stickers (built-in and imported); tap to preview; **Import** button (file picker); delete only for imported ones. The day-header picker uses the same grid. Images only.

### Form editor
Excel-style: a scrollable **tab bar of sections** at the top (the last tab is **+** to add a section; long-press a tab to rename, reorder or remove it; the chapter-reflection prompts have their own tab). Below, each **question is a rounded card**; inside it, each **part is a bordered block** with an **X** (delete) and a **pencil** (edit) at its top. A part block shows its input-type icon and its label; the pencil opens an editor sheet (type, label, level core/extra, gate, config such as scale display, number unit/aggregate, library, multi). Each card also has "+ Add part" (six kinds) and "+ Add sub-question" (a nested card). **Long-press a question** to open a menu: Move to section..., Duplicate, Delete; drag handles reorder. Nothing is locked: any section, question, sub-question or part can be added, edited, moved or removed.
Light edits apply immediately. Structural edits ask **"From next chapter" (default) / "This chapter"** with a one-line explanation of each. Core/extra is a toggle chip on each part block.

## 6. Character: Piqsie (starter look: white fluffy cat)
Files: `characters/cat-white/character.svg` + `character.json`. Soft white body, pale pink-grey outline, pink inner ears and cheeks, dot eyes. Front view, so it hops/waddles/dances rather than walking across the stage. Layers: `tail body head ear-left ear-right eye-left eye-right mouth leg-left leg-right`.
Engine rules (see TRD 13): one shared animation engine for all characters; characters declare roles; **any number of limbs** (spider = `leg-1 ... leg-8` with `gait: octopod`); clips include idle loops, wave, bounce/jump, spin, dance, walk, sit, sleep, wiggle; custom clips are declarative keyframes in json.
Stage behaviour: mostly idle (blink, breathe, tail sway, ear twitch), occasional random action, sleepy when the form is locked or late. Tap = random reaction; rapid taps = excited; long-press = pet. Size about 96 to 128 px inside the stage.

## 7. Copy
Plain verbs, sentence case, no filler. Buttons say what they do ("Save tonight", "Generate insights", "Close chapter"). Errors say what happened and how to fix it. Empty states invite an action. Insight wording is casual and blunt; may be cheeky.

## 8. Accessibility
Contrast AA in every theme and in monochrome. Visible focus. Labels on all controls (stars have a text alternative; sliders announce value). Motion off when `prefers-reduced-motion`. Don't rely on colour alone (heatmap states also differ in pattern/shape).
