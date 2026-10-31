# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(A Chrome extension, Manifest V3. Its interface lives in three places: inside other sites' chat
pages (the ☆ button, the save picker, the Alt+B panel, the search overlay), and on its own
extension page (the Library).)

## Users

Public users from the start: people who use several AI chat assistants and want to keep and find
the answers that matter. A stranger should understand it on first open. The builder is also a
primary user.

Confirmed situations, all in scope:
- Studying and exam revision: collecting explanations and worked solutions per subject, then
  revising from them.
- Research across AIs: asking the same topic of several AIs and keeping the best answers together.
- Long working chats: coding or writing in one very long chat and jumping back to key answers.
- Everyday use: messages, quick questions, things to remember.

## Product Purpose

Save answers from AI chats into user-made projects, and get back to them. Two jobs, and every
decision serves them:
1. Bookmark inside a long chat: in a 400-message chat, star message 78 and jump straight back to
   it later without scrolling.
2. Research folders: collect important answers from different AIs into one project per topic.

Success: finding and returning to a saved answer takes seconds, however long the chat or however
many answers are saved.

## Positioning

It works across AIs (Claude, ChatGPT, Gemini, Perplexity, Grok) in one place, with project
folders, and it stores the answer text itself, so saved answers survive the chat being deleted.
Clicking a saved answer reopens its chat and jumps to that exact message. Some AI apps have their
own bookmarks, but only within themselves.

## Operating Context

- Saving happens inside the AI sites' own pages: a ☆ sits in each answer's button row, made to
  look like that site's own buttons (size, colour, tooltip, hover), so it feels built in.
- The Alt+B panel floats over the chat page: this chat's saved answers, or one project.
- The Library is a full extension page (toolbar icon): projects sidebar, search, AI filter,
  move, copy, delete, rename, export, Recently deleted, multi-select.
- Right-click "Save selection" on any website saves into an "Inbox" project.

## Capabilities and Constraints

- Plain JavaScript, Manifest V3; no frameworks, libraries, build step, or servers.
- All data stays in the browser (chrome.storage.local); nothing is sent anywhere, no tracking.
- Saved text is simple Markdown; it is never put into a page with innerHTML.
- UI inside chat pages must never clash with or break the host site (all classes prefixed acb-).
- Sites can switch off CSS animations (Claude does); motion there runs as Web Animations.
- Light and dark mode both matter (follows the system setting).
- Features are fixed for v1 (listed in CLAUDE.md); the redesign changes the look, not features.

## Brand Commitments

- Gold is the signature colour (binding).
- The name "AI Chat Bookmarks" and the ★ symbol are current, not binding.

## Evidence on Hand

- README.md, LICENSE (MIT), icons/ (16, 48, 128 px).
- No Chrome Web Store listing, user counts, reviews, or testimonials exist. Do not invent any.

## Product Principles

1. Getting back to an answer beats everything: jumping to the message is the core moment.
2. Inside a chat, be a good guest: look native to the host site, never get in its way.
3. Every AI is equal: no site is the default; answers from different AIs sit side by side.
4. Safe by default: anything removed can be restored for 30 days.
5. Understandable to a stranger on first open, fast for someone with hundreds of saves.
