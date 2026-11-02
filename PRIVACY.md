# DogEar privacy policy

*Last updated: 2 November 2026*

DogEar is a Chrome extension that saves answers from AI chats (ChatGPT, Claude, Gemini,
Perplexity and Grok) into your own projects. This page explains what it stores and what it
doesn't.

## The short version

- **Everything stays in your browser.** DogEar has no server, no account and no sign-in.
- **Nothing is sent anywhere.** DogEar makes no network requests of its own: no analytics, no
  tracking, no crash reports, no ads.
- **Nothing is sold or shared**, because DogEar never has your data in the first place.

## What DogEar stores

Only what you choose to save, in Chrome's own extension storage on your computer:

- **Saved answers:** the text of an answer you star, the question asked just before it, the
  chat's title and link, which AI it came from, when you saved it, and a note if you add one.
- **Your projects:** their names and when you made them.
- **Text you save with right-click → "Save selection to DogEar"**, with the page's title and link.
- **Recently deleted** projects and answers, kept for 30 days so you can restore them.
- **Settings:** light or dark mode, the panel's position, the last project you used, and
  whether the weekly backup is on.

A saved answer can contain whatever you discussed with the AI, so treat it like the chat itself:
it stays on your computer only.

DogEar does **not** read or store your other chats, answers you didn't star, your account
details, your passwords, your browsing history or anything from other websites.

## Backups

Once a week (you can switch it off in the Library), DogEar saves a backup file of your saved
answers to your own **Downloads › DogEar** folder, and keeps the newest 5. These files stay on
your computer. "Restore backup" only reads a file you pick yourself.

## Permissions and why DogEar needs them

| Permission | Why |
| --- | --- |
| Access to chatgpt.com, claude.ai, gemini.google.com, perplexity.ai, grok.com | To show the ☆ under answers on these sites, save the answer you star, and jump back to it. |
| `storage`, `unlimitedStorage` | To keep your saved answers in your browser (the normal limit fills up quickly with long answers). |
| `contextMenus` | For the right-click "Save selection to DogEar" menu. |
| `activeTab`, `scripting` | To read the text you selected when you use that right-click menu, on the page you're on, only at that moment. |
| `downloads`, `offscreen`, `alarms` | For the weekly backup file: `alarms` schedules it, `offscreen` turns your data into a file, `downloads` saves it to your Downloads folder. |

## Deleting your data

- Delete answers or projects in the Library (they go to *Recently deleted*, then are removed
  after 30 days, or straight away with "Delete forever").
- Removing the extension from Chrome deletes everything it stored. Backup files in your
  Downloads folder stay until you delete them.

## Chrome Web Store User Data Policy

DogEar's use of information follows the
[Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq),
including the Limited Use requirements.

## Changes to this policy

If this policy changes, the date at the top is updated, and every change is visible in this
file's history on GitHub.

## Contact

Questions or problems: open an issue at
[github.com/rishitsharma017/DogEar/issues](https://github.com/rishitsharma017/DogEar/issues).
