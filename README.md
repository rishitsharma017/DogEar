# AI Chat Bookmarks

A Chrome extension for bookmarking answers in AI chats. Star an answer, then jump straight
back to it later, even in a chat with hundreds of messages. Saved answers go into project
folders, so one research topic can collect answers from several AIs.

> **Work in progress.** It currently works on **Claude (claude.ai)**, **ChatGPT (chatgpt.com)**,
> **Gemini (gemini.google.com)**, **Perplexity (perplexity.ai)** and **Grok (grok.com)**.

## What works now (Claude, ChatGPT, Gemini, Perplexity and Grok)

- **☆ on every answer.** Click it, pick a project or type a new one, and the answer is saved (☆ turns ★).
- **★ to change it.** Move the answer to another project, or remove it.
- **Panel (Alt+B).** Shows the answers saved from the current chat, or browse one project.
  You can drag it anywhere, and it remembers where you put it.
- **Jump back.** Click a saved answer in the panel. The chat scrolls to it and highlights the
  question that was asked, even when the chat is long or it's a different chat.
- **Saves the text itself**, not just a link, so saved answers survive if the chat is deleted.
- **Library page** (click the toolbar icon): all your projects, search, filter by AI, copy,
  move, rename, export a project as Markdown, and **Recently deleted** to restore anything
  deleted in the last 30 days.
- **Right-click "Save selection"** on any website: the selected text goes into **Inbox**.
- **Light and dark look.** A "Dark mode" switch in the Library changes the Library, the save
  picker and the panel together.

## Planned

- A final check on every supported site

## Install (developer mode)

The extension isn't in the Chrome Web Store yet. To try it:

1. Download this repo (**Code → Download ZIP**) and unzip it, or `git clone` it.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and choose the unzipped folder.
5. Open a chat on [claude.ai](https://claude.ai), [chatgpt.com](https://chatgpt.com),
   [gemini.google.com](https://gemini.google.com), [perplexity.ai](https://www.perplexity.ai) or
   [grok.com](https://grok.com) and look for the ☆ in the buttons under an answer.

## Privacy

Everything is stored locally in your browser (`chrome.storage.local`).
Nothing is sent to any server, and there's no tracking.

## How it's built

Plain JavaScript, Manifest V3, no frameworks and no build step.

| File | What it does |
| --- | --- |
| `manifest.json` | Extension setup: permissions, sites, Alt+B shortcut |
| `adapters.js` | The only place with site-specific code (how to find answers on each AI site) |
| `content.js` | Stars, save picker, panel and jump-to-message |
| `common.js` | All storage reads and writes, plus Markdown export |
| `background.js` | Toolbar icon, right-click menu, Alt+B command |
| `content.css` | Styles, all prefixed `acb-` so they never clash with the site |
| `library.*` | The Library page |

Adding a new AI site mostly means adding an adapter to `adapters.js`.

## License

[MIT](LICENSE)
