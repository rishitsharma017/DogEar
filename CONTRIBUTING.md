# Contributing to DogEar

Thanks for helping! You don't need to code to help: requesting a site or reporting a bug is
just as useful.

- **Something broke?** [Report a bug](https://github.com/rishitsharma017/DogEar/issues/new?template=bug.yml). AI sites change their
  pages often, so "the ☆ disappeared on Gemini" is a very helpful report.
- **Want DogEar on another AI chat?** [Request a site](https://github.com/rishitsharma017/DogEar/issues/new?template=new-site.yml).
- **Want to write code?** Read on.

## The ground rules

DogEar is deliberately small and simple:

- **Plain JavaScript.** No frameworks, libraries, build step or servers. You load the folder in
  Chrome and it runs.
- **Site-specific code only lives in `adapters.js`.** `content.js` must work for every site
  without knowing which one it's on.
- **Never put page text or saved text into `innerHTML`.** Use `textContent` or build elements,
  so a saved answer can't run code in the Library.
- **All storage goes through `common.js`** (it has a write queue so quick saves don't clash).
- **Classes added to chat pages start with `acb-`** so they never clash with the site's own.
- **Fail quietly.** If a site changes and nothing is found, DogEar does nothing. It must never
  break the page.
- **Small pull requests.** One fix or one site per PR. For a new feature, open an issue first
  so we can talk about it.

## Run it from source

1. Fork and clone this repo (or **Code → Download ZIP**).
2. If you have DogEar from the Chrome Web Store, switch it **off** in `chrome://extensions`,
   otherwise every answer gets two ☆.
3. In `chrome://extensions`, turn on **Developer mode** → **Load unpacked** → pick the folder.
4. After changing a file, click the **↻ reload** button on DogEar's card, then reload the chat
   page.

## Adding a new AI site

A new site needs two changes, both small.

### 1. Add it to `manifest.json`

Add the site's address to `content_scripts` → `matches`, otherwise DogEar never runs there:

```json
"matches": [
  "https://chatgpt.com/*",
  ...
  "https://chat.example.com/*"
]
```

### 2. Add an adapter to `adapters.js`

Each site is one object in the `ADAPTERS` list. It tells DogEar where the answers, questions and
buttons are. The five existing adapters are the best examples to copy from, and every field is
commented.

```js
{
  name: 'Example AI',                                  // shown in the Library and panel
  hosts: ['chat.example.com'],
  convPattern: /\/c\/([\w-]+)/,                        // the chat's id in the URL
  userSelectors: ['[data-role="user"]'],               // the questions
  aiSelectors: ['[data-role="assistant"]'],            // the answers (☆ goes on these)
  actionsSelectors: ['[data-testid="message-actions"]'], // the site's button row under an answer
  msgId: el => el.dataset.messageId,                   // a stable id per message, if there is one
  isBusy: el => el.querySelector('.streaming') !== null // answer still being written: no ☆ yet
}
```

**Picking selectors:**

- Prefer stable attributes: `data-testid`, `data-message-author-role`, `aria-*`, `role`.
- **Never use generated class names** like `.css-1x2y3z` or `.sc-abc123`. They change every time
  the site is rebuilt.
- Give several selectors per list when you can. They're tried in order, so later ones are
  backups if the site changes.
- If the site's buttons are labelled in the user's language (`aria-label="Copy"`), add a
  fallback that doesn't depend on the text, like `button:first-of-type`.

**Optional settings** (see the existing adapters for real examples):

| Setting | What it does |
| --- | --- |
| `textSelectors` | The part of an answer that is the reply itself (skips tool steps, sources…) |
| `skipSelectors` | Hidden text that isn't part of the answer (screen-reader labels…) |
| `titleSuffix` | The site's name at the end of the tab title, removed when saving |
| `starBefore` | The button the ☆ goes in front of (default: after the last one) |
| `starLike` | The button whose size and colour the ☆ copies, so it looks built-in |
| `starIcon` | `{ size, stroke }`: draw the ☆ at this size if the site's icons fill their box differently |
| `starHover` | `{ background, color }`: the site's button look on hover |
| `starOnHover` | Only show the ☆ on hover for older answers, like the site's own buttons |
| `highlightSelectors` | The part of a message a jump lights up (default: all of it) |
| `tip` | `{ side, gap, style }`: make the ☆ tooltip match the site's own tooltips |

**Optional:** give the new AI a colour dot by adding a line next to the others in `library.css`
(`.ai[data-ai="…"]`) and `content.css` (`.acb-panel-ai[data-ai="…"]`).

### 3. Test it on the real site

Please check all of these before opening a pull request:

- [ ] A ☆ appears under every AI answer, and never under your own messages
- [ ] Only one ☆ per answer, even after scrolling, switching chats and coming back
- [ ] No ☆ while an answer is still being written; it appears when it finishes
- [ ] Saving works, and the saved text in the Library looks right (code blocks, lists, links)
- [ ] `Alt+B` lists the star; clicking it scrolls to the answer and highlights it
- [ ] Jumping works in a long chat (scroll far away first) and from a different chat
- [ ] The ☆ looks like it belongs next to the site's own buttons, in light and dark mode
- [ ] Nothing on the site itself is broken

## Fixing a site that broke

Sites redesign often. When the ☆ disappears, it's usually one selector in that site's adapter.
Find what changed on the page (right-click the answer → **Inspect**), add a new selector **at
the front** of the list, and keep the old one as a backup in case the site rolls back.

## Pull requests

- Describe what you changed and which site(s) you tested on.
- A screenshot of the ☆ on the site is very welcome.
- Don't include unrelated changes (formatting, renames) in the same PR.

By contributing, you agree your code is released under the [MIT License](LICENSE).
