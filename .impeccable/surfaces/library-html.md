---
version: 1
slug: "library-html"
primary_target: "library.html"
related_targets: ["content.css","content.js"]
---

# Surface brief: Library, save picker, Alt+B panel

Scope: library.html (Library page), plus the in-chat save picker and Alt+B panel (content.js / content.css),
which carry the same world in a compact form. Mode: Operate. Redesign: new look, same features
(features fixed by CLAUDE.md). Audience, job and constraints: see PRODUCT.md.

User choices: Thumb Index (Impeccable's pick) chosen over the rolled Reading Room, steered "darker,
same colours; the white is too bright", then "the dark version is too dark: the paper vibe, slightly darker", then "darker in general", then "a darker Thumb Index with light hues, not full dark", then "the middle darker, not the sides; comfortably dark", then settled: "the original Thumb Index colours, plus a dark mode switch; make the dark mode cool, not a classic AI website". Library must make finding one answer fast and reading
comfortable, equally. Must not feel techy/dashboard, generic AI-app, or plain. In chats: our own
look, compact.


## Direction contract

THESIS: Find any saved answer the way a thumb finds a letter in a dictionary: gilt index tabs on the
list's edge jump straight to a section. Refuses the category default of identical cards on a grey
dashboard.

OWN-WORLD: Two looks behind a "Dark mode" switch (saved as theme). Light = the original Thumb Index:
white India paper, ink #1c1b18, light sidebar #f1efea with a black pill for the active project,
dictionary-red guide words #8a1f1f over a black rule, black Open chat. Dark = the same dictionary
in a warm charcoal leather cover: pages #2f2d29, paper-coloured ink #ece7dc, coral guide words
#f0927f, charcoal sidebar and strip #262420, a paper pill (user rejected navy). Neither may read as a generic AI site (near-black and glow,
or cream and serif). Gilt (#c99a2e light, #d4a640 dark) only for: the current index tab, the
page-edge strip, saved stars, and the one primary action in reach. Rows divided by hairline rules,
not cards. A small colour dot per AI.

STORY: Open the Library, see the newest answers under guide words (Today, Yesterday, This week,
months), jump with a tab or search, read the formatted answer, press Open chat to return to the
exact message.

FIRST VIEWPORT: Left rail of projects (248px) with "+ New project". Title and count, then search,
AI filter and Select. A reading column of rule-separated rows: who-column (AI dot and name, project,
time), question as title with the answer under it, Open chat at the right (gilt on the hovered or
focused row). Right edge: a 96px index strip with a gilt edge line and half-moon tabs, one per date
group present; the group in view is gilt. Signature move: the thumb tabs; clicking one scrolls to its
guide word, and the gilt tab follows your scroll.

FORM: Thumb Index (dictionary thumb-index), rank 1 of my grounded list (Impeccable's pick, user
steered darker). seed:fa64aa3b9c3b8f7d

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
