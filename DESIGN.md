---
name: AI Chat Bookmarks
description: Saved AI answers, found the way a thumb finds a letter in a dictionary.
colors:
  india-paper: "#ffffff"
  paper-raised: "#f6f4ef"
  ink: "#1c1b18"
  ink-soft: "#4a4740"
  ink-muted: "#6d6a62"
  hairline: "#e6e2d8"
  dictionary-red: "#8a1f1f"
  gilt: "#c99a2e"
  gilt-text: "#7a5a12"
  gilt-soft: "#f3e6c4"
  danger-red: "#a3271e"
  sidebar-paper: "#f1efea"
  leather-charcoal: "#2f2d29"
  leather-raised: "#3a3832"
  leather-spine: "#262420"
  paper-ink: "#ece7dc"
  paper-ink-soft: "#d0cabd"
  paper-ink-muted: "#aea79a"
  leather-hairline: "#45423c"
  leather-rule: "#7d776c"
  coral-guide: "#f0927f"
  gilt-dark: "#d4a640"
  ai-claude: "#d97757"
  ai-chatgpt: "#10a37f"
  ai-gemini: "#4c8df6"
  ai-perplexity: "#20b8cd"
  ai-grok: "#a1a1aa"
typography:
  display:
    fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "28px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  title:
    fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "16px"
    fontWeight: 620
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  body:
    fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    letterSpacing: "0.02em"
  mono:
    fontFamily: "ui-monospace, Cascadia Mono, Consolas, SF Mono, Menlo, monospace"
    fontSize: "12.5px"
    lineHeight: 1.55
rounded:
  row: "4px"
  control: "6px"
  popup: "8px"
  tab: "27px 0 0 27px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "24px"
  lg: "32px"
  xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.india-paper}"
    rounded: "{rounded.control}"
    padding: "5px 11px"
  button-primary-hover:
    backgroundColor: "{colors.gilt}"
    textColor: "{colors.ink}"
  button-quiet:
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "5px 11px"
  input-search:
    backgroundColor: "{colors.paper-raised}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  nav-item-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.india-paper}"
    rounded: "{rounded.control}"
    padding: "6px 10px"
  index-tab:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.india-paper}"
    rounded: "{rounded.tab}"
    width: "78px"
  index-tab-current:
    backgroundColor: "{colors.gilt}"
    textColor: "{colors.ink}"
  popup:
    backgroundColor: "{colors.india-paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.popup}"
    padding: "12px"
---

# Design System: AI Chat Bookmarks

## Overview

**Creative North Star: "The Thumb Index"**

A dictionary for saved AI answers. The Library is a reading column of answers divided by hairline rules, grouped under dictionary-red guide words (Today, Yesterday, This week, months), with half-moon thumb-index tabs on the right edge that jump straight to a section. A gilt strip runs down the page edge like the gilded edge of a printed book. Finding one answer fast and reading it comfortably matter equally.

There are two looks behind a "Dark mode" switch. Light is white India paper with black ink. Dark is the same dictionary bound in warm charcoal leather: soft charcoal pages, paper-coloured ink, coral guide words. Gilt is the same accent in both. The in-chat save picker and Alt+B panel carry the same world in compact form and follow the same switch, so they always look like this extension, never like the host site.

The user explicitly rejected navy, pure black and mid-tone darks, and anything that reads as a generic AI site (near-black with glow, or cream with a serif), as well as flashy effects.

**Key Characteristics:**
- Rows divided by hairline rules, not cards
- Red (or coral) guide words over a strong rule mark every section
- Gilt is rationed: current tab, page edge, saved stars, the one primary action in reach
- A small colour dot names each AI
- Flat surfaces; only floating popups cast a shadow

## Colors

Ink on paper (or paper on leather), with one red voice for sections and gilt held back for what matters.

### Primary
- **Gilt** (light #c99a2e, dark #d4a640): the current index tab, the page-edge strip, saved ★, focus rings, and Open chat on the hovered or focused row. As text it darkens to Gilt Text in light mode for contrast.
- **Dictionary Red** (light) / **Coral Guide** (dark): guide words and the picker's "Save to project" title only.

### Neutral
- **India Paper** / **Leather Charcoal**: the reading surface.
- **Paper Raised** / **Leather Raised**: inputs, the row under the pointer.
- **Ink** / **Paper Ink**: titles and body; **Ink Soft** for answer text, a step quieter than the question; **Ink Muted** for meta (chat, project, time).
- **Hairline** / **Leather Hairline**: rules between rows and control borders.
- **Ink** / **Leather Rule**: the 2px rule under a guide word.
- **Sidebar Paper** / **Leather Spine**: the projects rail and the index strip.

### Tertiary
- **AI dots** (Claude #d97757, ChatGPT #10a37f, Gemini #4c8df6, Perplexity #20b8cd, Grok #a1a1aa): a 7px dot before the AI's name. Never used for anything else.

### Named Rules
**The Rationed Gilt Rule.** Gilt appears only on the current tab, the page edge, saved stars, focus rings and the one primary action in reach. If two gilt things compete on a screen, one is wrong.

**The One Red Voice Rule.** Red (coral in dark) belongs to guide words. Danger actions use their own muted red text, never a filled red block.

## Typography

**Display Font:** system-ui (Segoe UI on Windows)
**Body Font:** system-ui
**Label/Mono Font:** ui-monospace (Cascadia Mono, Consolas) for code in saved answers

**Character:** Plain and legible. The dictionary feeling comes from structure (guide words, rules, tabs), not from a display face.

### Hierarchy
- **Display** (650, 28px, 1.2): the project title at the top of the Library.
- **Title** (620, 16px, 1.35): a saved answer's question, clamped, balanced wrapping.
- **Body** (400, 14px, 1.55): the formatted answer and everything else.
- **Label** (700, 13px, +0.02em): guide words; 12.5px in the picker title, 11px on index tabs.
- **Meta** (600, 13px): AI name and kind in the who-column; muted 12px for counts and times.

### Named Rules
**The Structure-Not-Typeface Rule.** Hierarchy comes from weight, colour and rules. Adding a bundled display font was tried and dropped because the difference wasn't visible to the user.

## Layout

The Library is three columns: a 248px projects rail on the left, a reading column (max 1040px, padding 32px 132px 96px 48px), and a fixed 96px index strip on the right with a 6px gilt edge. Each row is a two-column grid: a 168px who-column (AI dot and name, chat and project, relative time) and the question with its answer, 24px apart, padded 18px 12px 14px. Guide words sit 32px above their section.

Below 900px the index strip hides (guide words still mark sections). Below 720px the rail moves to the top and each row stacks its who-column above the question.

In chats, the save picker is 248px wide with 12px padding; the Alt+B panel is 340px wide, at most 560px tall, draggable by its grip.

## Elevation & Depth

Flat by default. Depth comes from tonal layers (paper, raised, sidebar) and rules, not shadows. Only things that float above another page carry a shadow: the in-chat picker and panel, and the Library's undo bar.

### Shadow Vocabulary
- **Popup, light** (`box-shadow: 0 12px 32px rgba(28,27,24,0.18), 0 2px 6px rgba(28,27,24,0.08)`): picker and panel over a chat.
- **Popup, dark** (`box-shadow: 0 14px 36px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.25)`): the same in dark mode.
- **Undo bar** (`box-shadow: 0 8px 28px rgba(28,27,24,0.3)`).

### Named Rules
**The Flat Page Rule.** Nothing on the Library page itself casts a shadow. A selected row is shown with a gilt-soft fill and a 1px gilt inset line, not a lift.

## Shapes

Small, quiet corners: 4px on rows, 6px on buttons, inputs and the active project pill, 8px on floating popups. The one bold shape is the index tab: a half-moon (27px radius on the left, square on the right), like a cut thumb-index notch. AI dots are circles. Rules between rows stop where the guide rule above them stops.

## Components

### Buttons
- **Shape:** gently rounded (6px), 1px hairline border, transparent fill, padding 5px 11px.
- **Primary (Open chat):** ink fill with paper text in light; outlined paper text in dark. Turns gilt on the hovered or focused row.
- **Hover / Focus:** hover adds a faint ink wash and darkens the border; focus is a 2px gilt outline, 2px offset. Transitions 0.12s ease-out.
- **Danger:** muted red text, no fill.

### Inputs / Fields
- **Style:** raised paper fill, 1px hairline, 6px radius, 8px 12px padding.
- **Focus:** 2px gilt outline.

### Navigation
- **Projects rail:** plain rows (6px 10px, 6px radius); hover fills sidebar-raised; the active project is an ink pill with paper text in light and a paper pill with charcoal text in dark. "+ New project" sits in the rail.

### Index Tabs (signature)
Half-moon tabs (78px wide, at least 54px tall, 11px bold label) stacked on the right edge strip, one per date group present. Ink tabs in light, charcoal in dark; the group in view turns gilt and follows the scroll. Clicking a tab scrolls to its guide word.

### Rows
Hairline-divided, no card. Who-column on the left, question as the title, answer two lines in Ink Soft. Copy is quiet; Move and Delete appear on hover (always on touch screens).

### Save picker and Alt+B panel
A compact copy of the Library: paper or charcoal popup, guide-word title over a strong rule, hairline rows, gilt only for "last used" and saved items. Icons (star, close, grip, check) are drawn SVG, never text characters. Thin scrollbars.

## Do's and Don'ts

### Do:
- **Do** divide lists with 1px hairlines that align with the 2px guide rule above them.
- **Do** keep gilt for the current tab, page edge, saved stars, focus rings and the one primary action.
- **Do** build every new surface in both looks, light (#ffffff paper) and dark (#2f2d29 charcoal), from the same tokens.
- **Do** draw icons as SVG with DOM calls, never typed characters and never innerHTML.
- **Do** use `el.animate` for motion in chats (some sites switch off CSS animations).

### Don't:
- **Don't** wrap rows in cards or put them on a grey dashboard.
- **Don't** use navy, pure black, or near-black with glow for dark mode.
- **Don't** use cream paper with a serif face; it reads as a generic AI look.
- **Don't** add flashy effects; motion is short and quiet.
