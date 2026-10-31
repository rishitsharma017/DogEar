# AI Chat Bookmarks

## Goal
Chrome extension (Manifest V3) that saves answers from AI chats into user-made
project folders. One project can hold answers from multiple AIs.
Supported sites: ChatGPT (chatgpt.com), Claude (claude.ai), Gemini (gemini.google.com),
Perplexity (perplexity.ai, www.perplexity.ai), Grok (grok.com). Any other site: right-click "Save selection".

Two use cases. Every decision should serve these:
1. Bookmark inside a long chat: in a 400-message chat, star message 78 and jump
   straight back to it later without scrolling.
2. Research folders: collect important answers from different AIs into one
   project per research topic.

## Features (v1, nothing more)
1. ☆ button on every AI answer (not on user messages) → popup: pick a project or type a new one → saved, ☆ turns ★
2. Clicking ★ again → move to another project or remove
3. Panel (Alt+B): items saved from this chat, or browse one project. Click an item → scroll to that message and highlight it
4. Library page (toolbar icon): sidebar of projects, list of items, search, filter by AI, move, copy, delete, export project as .md
   - Copy = copy the answer text to the clipboard
   - Projects can be renamed and deleted. Delete asks to confirm (shows how many items),
     removes the project and its items, then shows an "Undo" bar for 8 s
   - "Recently deleted" (asked for by the user): deleted projects and items (also ★ → remove)
     go to trash for 30 days; Restore or Delete forever
   - Select several (asked for by the user): a "Select" button shows checkboxes (hidden otherwise),
     tick items → move or delete them together; "Done" hides them again.
     Every Move menu has "+ New project…". Projects stay flat (no folders inside folders)
5. Right-click selected text on any site → save to "Inbox" (user's choice: keeps web clips apart
   from chat projects; doesn't change the ☆ picker's last-used project), ✓ badge on the icon for 2 s.
   Inbox is hidden from the ☆ picker on every site (user's choice); it still shows in the Library and panel

## File structure (keep it exactly like this)
- manifest.json
- adapters.js: ONLY place with site-specific selectors
- content.js: stars, picker, panel, jump-to-message (no site-specific code)
- common.js: all storage read/write + markdown export
- background.js: toolbar icon, right-click menu, Alt+B command
- library.html / library.js / library.css
- content.css: all classes prefixed `acb-` so they never clash with the sites
- icons/: extension icons (16, 48, 128 px)
- PRODUCT.md (product record) and .impeccable/surfaces/ (design briefs): design docs for the
  /impeccable skill, not loaded by the extension. DESIGN.md joins them when the redesign is finished

Loading: in manifest content_scripts the order is common.js → adapters.js → content.js.
background.js loads common.js with `importScripts`. library.html loads it with a script tag.

## Data (chrome.storage.local)
- projects: [{ id, name, createdAt }]
- items: [{ id, projectId, ai, text, question, chatTitle, url, convId, msgId, pos, fromEnd, hash, prefix, createdAt }]
  (pos = where the answer sat in the chat when saved, 0 = top … 1 = bottom; a hint so the jump starts near it.
   fromEnd = px from the answer to the end of the chat: the main hint, because sites load older
   messages at the top, which changes pos but not fromEnd. Old items learn both after a jump)
- lastProjectId
- trash: [{ id, kind: 'project' | 'item', deletedAt, project, items }] (kept 30 days;
  for an item, project = the project it was in, so Restore can bring that back too)
- pendingJump: { itemId, url, time, panelView, panelScroll } (temporary, see "Must handle"; panelView and
  panelScroll = reopen the panel like this, scrolled to the same spot)
- panelPos: { left, top } where the user dragged the Alt+B panel (null = default top-right)
- theme: 'light' | 'dark', the look the user picked with the Library's "Dark mode" switch (default light)
- Store the actual answer text, not just a link, so saved items survive chat deletion
- text is simple markdown: code blocks, lists, headings, bold, links. Everything else becomes plain text
- hash and prefix are made from the text with whitespace collapsed and trimmed
- Right-click saves may have empty question, convId and msgId
- Use the `unlimitedStorage` permission (the default 10 MB fills up)
- All writes go through common.js, one at a time (a write queue), so quick saves don't overwrite each other

## Adapter rules
- Each site: { name, hosts, convPattern, userSelectors[], aiSelectors[], actionsSelectors[]?, textSelectors[]?, skipSelectors[]?, titleSuffix?, msgId?, isBusy?, starBefore?, starLike?, starIcon?, starHover?, starOnHover?, highlightSelectors[]?, tip? }
  (isBusy(el) = answer is still being written, so no ☆ yet)
  (actionsSelectors = the site's own button row under an answer; ☆ goes there, and its text is never part of the answer)
  (starBefore = the button in that row the ☆ goes in front of; starLike = the button whose size
   and colour the ☆ copies, so it looks built-in. Both optional: default is after the last button)
  (starIcon = { size, stroke }: draw the ☆ at this size / line width instead of starLike's icon size,
   for sites whose icons fill their box differently)
  (starHover = { background, color }: the site's own button look on hover, copied by the ☆)
  (starOnHover = true: a ☆ that copies starLike still only shows on hover for older answers, like
   the site's buttons; otherwise a starLike ☆ is always visible)
  (highlightSelectors = the part of a message the jump lights up, e.g. the question's bubble; default: all of it)
  (tip = { side: 'above' | 'below', gap, style }: the ☆ tooltip copies the site's own tooltips, measured from them)
- Several backup selectors per site, tried in order
- Prefer stable attributes (data-testid, data-message-author-role, aria-*), never generated class names
- If a site finds 0 messages, fail quietly, never break the page

## Must handle
- Sites are single-page apps: watch for chat switches (URL change) and new messages (MutationObserver, debounced)
- Don't add duplicate ☆ buttons when the page re-renders
- Finding a message again: msgId first → text hash → text prefix → retry while the chat loads
- Claude (confirmed) keeps only messages near the screen in the page and swaps them in and out
  while scrolling. So a message that isn't on the page may still exist further up or down
- Long chats: some sites only load older messages as you scroll up. If not found, scroll the chat
  up step by step and retry. Give up after ~15 s (up to 45 s while a long chat is still loading older messages) and show a small "Couldn't find this message" note
- Opening an item from another chat: save pendingJump, then open its URL. When the chat loads,
  content.js checks pendingJump (URL matches, under 60 s old), jumps to the message, then clears it
- Alt+B is a Chrome `commands` shortcut in manifest.json, not a page key listener

## Don't
- No frameworks, libraries, build step, or servers
- No innerHTML with page or saved text (use textContent)
- Don't change files unrelated to the current task
- Don't add features I didn't ask for

## How to work
1. Before coding, say in 2-3 lines what you'll change and in which files
2. Make the change
3. Tell me exactly how to test it (reload extension, which site, what to click, what I should see)
4. Explain the change in plain, simple language. I'm still learning
5. Wait for me to confirm it works before the next step
6. If something breaks on a site, ask me to paste the message HTML from DevTools instead of guessing selectors
7. After I confirm a step works, tick it in "Progress" below

## Progress
Build order. One step at a time; Claude is the first site.
- [x] 0. Update this file with decisions
- [x] 1. Skeleton: manifest.json, background.js (icon opens Library), empty library files, icons
- [x] 2. Storage layer: common.js (projects, items, write queue, hash, markdown export)
- [x] 3. Claude adapter in adapters.js (ask for pasted HTML first)
- [x] 4. ☆ buttons on AI answers: no duplicates, new messages, chat switches, ★ for saved ones
- [x] 5. Save picker (with markdown conversion) + ★ menu to move/remove
- [x] 6. Panel (Alt+B): this chat's items, browse a project
- [x] 7. Jump to message: same chat, long chats (scroll up + retry), other chats (pendingJump)
- [x] 8. Library page: projects (rename, delete + undo), search, AI filter, move, copy, delete, export .md
- [x] 9. Right-click save on any site
- [x] 10. ChatGPT adapter
- [x] 11. Gemini adapter
- [x] 12. Perplexity adapter
- [x] 13. Grok adapter (grok.com; added by the user). Grok on x.com: tried, then dropped by
      the user (grok.com is enough)
- [ ] 14. UI polish: ☆ next to each site's own buttons (copy/retry) so it looks built-in; tidy picker, panel,
      library; more visual work (the user wants it to look much better). Library list (user's picks):
      - Done (from /impeccable critique, user picked "quiet with gold accents"): saved Markdown shown
        formatted (DOM calls, no innerHTML); calmer cards (gold "Open chat", quiet Copy, Move/Delete on
        hover, "Move to…"); question as card title, softer answer, AI colour dots, relative dates
      - "+ New project" button in the sidebar
      - sort (newest / oldest / by AI) and group a project's items by chat
      - highlight search matches in the results
      - "/" focuses search, click a long question to see all of it, Copy as plain text or Markdown
      - tidy the save picker and the Alt+B panel
- [ ] 15. Final check on every site, fix what fails (no new features). Not yet confirmed by the user:
      ☆ tooltip matches each site's own; Gemini saved text (no "You said", readable maths); Gemini bubble
      glow after a jump; ☆ only after a new answer finishes (Gemini); ChatGPT "Email" card text when saved;
      the spinner ring turning; tooltips/colours in light mode (measured in dark mode only);
      Perplexity: ☆ only after a new answer finishes (not tested: free question limit was used up);
      Grok: ☆ only after a new answer finishes (isBusy guessed: answer writing was never recorded)

## Later ideas (v2, only after step 15)
In order. Not part of v1, don't build early.
1. Backup / restore: download all data as one file, load it back (data only lives in Chrome)
2. "Copy project as prompt": a project as one message to paste into any AI to continue the research
3. Notes on a bookmark: short label shown in the panel instead of the first line
4. Scrollbar markers: gold ticks on the chat's scrollbar where starred answers are; click to jump
5. Alt+↑ / Alt+↓: previous / next starred answer in this chat
Maybe: save part of an answer (jump to that paragraph), compare AIs side by side,
PDF / Notion / Google Docs export, tags. Skip: sync between computers, AI summaries (need servers / API keys).
