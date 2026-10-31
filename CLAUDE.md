# AI Chat Bookmarks

## Goal
Chrome extension (Manifest V3) that saves answers from AI chats into user-made
project folders. One project can hold answers from multiple AIs.
Supported sites: ChatGPT (chatgpt.com), Claude (claude.ai), Gemini (gemini.google.com),
Perplexity (perplexity.ai, www.perplexity.ai). Any other site: right-click "Save selection".

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
5. Right-click selected text on any site → save to "Inbox" (user's choice: keeps web clips apart
   from chat projects; doesn't change the ☆ picker's last-used project), ✓ badge on the icon for 2 s

## File structure (keep it exactly like this)
- manifest.json
- adapters.js: ONLY place with site-specific selectors
- content.js: stars, picker, panel, jump-to-message (no site-specific code)
- common.js: all storage read/write + markdown export
- background.js: toolbar icon, right-click menu, Alt+B command
- library.html / library.js / library.css
- content.css: all classes prefixed `acb-` so they never clash with the sites
- icons/: extension icons (16, 48, 128 px)

Loading: in manifest content_scripts the order is common.js → adapters.js → content.js.
background.js loads common.js with `importScripts`. library.html loads it with a script tag.

## Data (chrome.storage.local)
- projects: [{ id, name, createdAt }]
- items: [{ id, projectId, ai, text, question, chatTitle, url, convId, msgId, pos, hash, prefix, createdAt }]
  (pos = where the answer sat in the chat when saved, 0 = top … 1 = bottom; a hint so the jump starts near it)
- lastProjectId
- trash: [{ id, kind: 'project' | 'item', deletedAt, project, items }] (kept 30 days;
  for an item, project = the project it was in, so Restore can bring that back too)
- pendingJump: { itemId, url, time, panelView } (temporary, see "Must handle"; panelView = reopen the panel like this)
- panelPos: { left, top } where the user dragged the Alt+B panel (null = default top-right)
- Store the actual answer text, not just a link, so saved items survive chat deletion
- text is simple markdown: code blocks, lists, headings, bold, links. Everything else becomes plain text
- hash and prefix are made from the text with whitespace collapsed and trimmed
- Right-click saves may have empty question, convId and msgId
- Use the `unlimitedStorage` permission (the default 10 MB fills up)
- All writes go through common.js, one at a time (a write queue), so quick saves don't overwrite each other

## Adapter rules
- Each site: { name, hosts, convPattern, userSelectors[], aiSelectors[], actionsSelectors[]?, textSelectors[]?, skipSelectors[]?, titleSuffix?, msgId?, isBusy? }
  (isBusy(el) = answer is still being written, so no ☆ yet)
  (actionsSelectors = the site's own button row under an answer; ☆ goes there, and its text is never part of the answer)
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
  up step by step and retry. Give up after ~15 s and show a small "Couldn't find this message" note
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
- [ ] 10. ChatGPT adapter
- [ ] 11. Gemini adapter
- [ ] 12. Perplexity adapter
- [ ] 13. UI polish: ☆ next to each site's own buttons (copy/retry) so it looks built-in; tidy picker, panel, library
- [ ] 14. Final check on every site, fix what fails (no new features)
