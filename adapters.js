// Site-specific selectors. The ONLY file that knows about each AI site.
// Selectors in each list are tried in order; the first one that finds anything wins.

const ADAPTERS = [
  {
    name: 'Claude',
    hosts: ['claude.ai'],
    convPattern: /\/chat\/([0-9a-f-]{36})/i,
    userSelectors: ['[data-testid="user-message"]'],
    aiSelectors: [
      'div[data-is-streaming]',
      // Last-resort backups: hand-named classes (not generated), may change.
      '.font-claude-response',
      '.font-claude-message'
    ],
    // The row of the site's own buttons (copy, retry…) under an answer. ☆ goes in here.
    actionsSelectors: [
      '[data-testid="message-actions"]',
      '[role="toolbar"][aria-label="Message actions"]'
    ],
    // The parts of an answer that are the written reply (not tool/skill steps). If none
    // are found, the whole answer is used.
    textSelectors: ['[data-cds="Prose"]', '[data-perf-reply-text]'],
    // ☆ copies Copy's colour and corners. Claude draws its icons in a way that can't be measured,
    // on a 16 px slot that they fill almost fully, so the star is drawn bigger. starOnHover:
    // Claude only shows older answers' buttons on hover, so the ☆ does too.
    starLike: 'button[aria-label="Copy"]',
    starIcon: { size: 19, stroke: 1.6 },
    starOnHover: true,
    // Hidden page text that is not part of the answer ("Claude responded: …" for screen readers).
    skipSelectors: ['[data-find-omitted]', '.sr-only'],
    // The site's name at the end of the tab title ("Exam prep - Claude"), removed when saving.
    titleSuffix: /\s+[-–|]\s+Claude$/,
    // Stable id of an answer ("…-hub-reply"), so a saved answer is found exactly.
    msgId: el => {
      const turn = el.closest('[data-turn-key]');
      return turn ? turn.getAttribute('data-turn-key') : '';
    },
    isBusy: el => el.closest('[data-is-streaming="true"]') !== null,
    // The ☆ tooltip looks like the site's own (measured from its "Retry" tooltip).
    tip: {
      side: 'above', gap: 5,
      style: {
        background: 'var(--cds-tooltip-bg, rgb(48, 48, 48))', color: 'rgba(255, 255, 255, 0.93)',
        font: '400 13px/18px anthropic-sans, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        padding: '3px 8px', borderRadius: '6px', border: 'none', boxShadow: 'none'
      }
    }
  },
  {
    name: 'ChatGPT',
    hosts: ['chatgpt.com'],
    // /c/<id>, also inside a project (/g/g-p-…/c/<id>)
    convPattern: /\/c\/([0-9a-f-]{36})/i,
    // Each question and answer is a "search unit" ending in :user or :assistant.
    userSelectors: [
      '[data-chatgpt-search-unit-key$=":user"]',
      '[data-content-search-unit-key$=":user"]',
      '[data-message-author-role="user"]' // older ChatGPT pages
    ],
    aiSelectors: [
      '[data-chatgpt-search-unit-key$=":assistant"]',
      '[data-content-search-unit-key$=":assistant"]',
      '[data-message-author-role="assistant"]'
    ],
    // The row under an answer: Copy, Read aloud, Share, Regenerate, More. The row itself has
    // no stable name, so find it by its buttons. Copy alone isn't enough: cards inside an
    // answer (e.g. an "Email" draft) have their own Copy button. ("Copy message" = questions.)
    actionsSelectors: [
      'div:has(> button[aria-label="Copy"]):has(> button[aria-label="Regenerate response"])',
      'div:has(> button[aria-label="Copy"]):has(> button[aria-label="Read aloud"])',
      'div:has(> button[aria-label="Copy"]):has(> button[aria-label="More actions"])'
    ],
    // ☆ goes just before "More actions" (…), and copies the look of the Copy button.
    starBefore: 'button[aria-label="More actions"]',
    starLike: 'button[aria-label="Copy"]',
    // After a jump, light up only the question's speech bubble (the row is the full chat width).
    highlightSelectors: ['[data-user-message-bubble]'],
    textSelectors: ['[data-markdown-text-style="assistant-message"]', '.markdown'],
    // "ChatGPT said:" for screen readers, and the code block header ("Python", copy buttons).
    skipSelectors: ['[data-markdown-copy="exclude"]', '.sr-only'],
    titleSuffix: /\s+[-–|]\s+ChatGPT$/,
    msgId: el => {
      const tagged = el.querySelector('[data-chatgpt-selection-message-id]');
      if (tagged) return tagged.getAttribute('data-chatgpt-selection-message-id');
      const ids = el.getAttribute('data-chatgpt-search-message-ids');
      if (ids) return ids.split(' ')[0];
      const old = el.closest('[data-message-id]');
      return old ? old.getAttribute('data-message-id') : '';
    },
    // The turn says "complete" once the answer has finished writing.
    isBusy: el => {
      const turn = el.closest('[data-talvt-turn-state]');
      return turn !== null && turn.getAttribute('data-talvt-turn-state') !== 'complete';
    },
    tip: {
      side: 'below', gap: 6,
      style: {
        background: 'rgb(48, 48, 48)', color: 'rgb(237, 237, 237)',
        font: '600 14px/18px ui-sans-serif, -apple-system, system-ui, "Segoe UI", Helvetica, Arial, sans-serif',
        letterSpacing: '-0.15px', padding: '5px 12px', borderRadius: '16px',
        border: '0.5px solid rgba(255, 255, 255, 0.05)', boxShadow: '0 8px 18px rgba(15, 23, 42, 0.2)'
      }
    }
  },
  {
    name: 'Gemini',
    hosts: ['gemini.google.com'],
    // /app/<id>, also inside a Gem (/gem/<gem>/<id>)
    convPattern: /\/(?:app|gem\/[^/]+)\/([0-9a-f]{12,})/i,
    userSelectors: ['user-query'],
    aiSelectors: ['model-response'],
    // The row under an answer: thumbs up/down, Redo, Copy, More (…).
    actionsSelectors: ['message-actions .buttons-container-v2', 'message-actions'],
    // ☆ goes just before "…" (More), and copies the look of the thumbs-up button.
    starBefore: '[data-test-id="more-menu-button"]',
    starLike: 'thumb-up-button button',
    textSelectors: ['message-content .markdown', 'message-content'],
    // "You said" / "Gemini said" for screen readers, and the screen-reader copy of maths
    // (KaTeX draws every formula twice).
    skipSelectors: ['.cdk-visually-hidden', '.katex-mathml'],
    titleSuffix: /\s+[-–|]\s+Google Gemini$/,
    // Gemini's own response id ("r_…"), in the answer text's element id.
    msgId: el => {
      const content = el.querySelector('message-content[id^="message-content-id-"]');
      if (content) return content.id.slice('message-content-id-'.length);
      const turn = el.closest('.conversation-container[id]');
      return turn ? turn.id : '';
    },
    isBusy: el => el.querySelector('[aria-busy="true"]') !== null,
    highlightSelectors: ['.user-query-bubble-with-background'],
    tip: {
      side: 'below', gap: 8,
      style: {
        background: 'rgb(230, 230, 230)', color: 'rgb(23, 23, 23)',
        font: '400 13px/17px "Google Sans Flex", "Google Sans", "Helvetica Neue", sans-serif',
        padding: '8px 16px', borderRadius: '12px', border: 'none', boxShadow: 'none'
      }
    }
  },
  {
    name: 'Perplexity',
    hosts: ['perplexity.ai'],
    convPattern: /\/search\/([^/?#]+)/,
    // The question's bubble; its whole box as a backup.
    userSelectors: ['[data-message-bubble]', '[data-workflow-entry]'],
    aiSelectors: ['[data-workflow-final-text]'],
    // The left group under an answer: Copy, Share, Helpful / Not helpful, Fork, sources.
    actionsSelectors: ['[data-workflow-text-footer] > div:first-child'],
    // ☆ goes just before the sources button (the only button there without a label),
    // and copies the look of Copy.
    starBefore: 'button:not([aria-label]):not(.acb-ui)',
    starLike: 'button[aria-label="Copy"]',
    // Perplexity's icons (Tabler) fill 12 of their 16 px with thin lines; a star looks smaller
    // than a square icon of the same width, so it's drawn a bit bigger with thinner lines.
    starIcon: { size: 18, stroke: 1.6 },
    // Perplexity's buttons on hover: a faint light circle and a brighter icon.
    starHover: { background: 'rgba(219, 222, 227, 0.06)', color: 'rgb(219, 222, 227)' },
    // The written answer, not the "Finished 4s" step above it.
    textSelectors: ['[data-renderer="lm"]'],
    // Source pills inside the text ("wikipedia +2").
    skipSelectors: ['[data-pplx-citation]'],
    titleSuffix: /\s+[-–|]\s+Perplexity$/,
    // Perplexity numbers each question (data-workflow-entry = 0, 1, 2…), and the answer sits
    // in the box right after it. Messages far off screen are emptied but keep their box, so
    // count from any question still on the page.
    msgId: el => {
      const slot = el.parentElement && el.parentElement.parentElement;
      const list = slot && slot.parentElement;
      if (!list) return '';
      const slots = [...list.children];
      const i = slots.indexOf(slot);
      for (let j = 0; j < slots.length; j++) {
        const q = slots[j].querySelector('[data-workflow-entry]');
        if (!q || (i - 1 - j) % 2 !== 0) continue;
        const n = Number(q.getAttribute('data-workflow-entry')) + (i - 1 - j) / 2;
        return Number.isInteger(n) && n >= 0 ? `entry-${n}` : '';
      }
      return '';
    },
    // The button row only appears once the answer has finished.
    isBusy: el => !el.querySelector('[data-workflow-text-footer] button'),
    highlightSelectors: ['[data-message-bubble]'],
    // Measured from Perplexity's own "Copy" tooltip.
    tip: {
      side: 'above', gap: 8,
      style: {
        background: 'rgb(21, 23, 27)', color: 'rgb(255, 255, 255)',
        font: '470 12px/16px pplxSans, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
        letterSpacing: 'normal', padding: '6px 8px', borderRadius: '8px', border: 'none',
        boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.05), inset 0 0 0 1px rgba(255, 255, 255, 0.05), ' +
          '0 1px 2px rgba(0, 0, 0, 0.24), 0 0 2px rgba(0, 0, 0, 0.19), 0 1px 4px -1px rgba(0, 0, 0, 0.14)'
      }
    }
  },
  {
    name: 'Grok',
    hosts: ['grok.com'],
    convPattern: /\/c\/([0-9a-f-]{36})/i,
    userSelectors: ['[data-testid="user-message"]'],
    aiSelectors: ['[data-testid="assistant-message"]'],
    // The buttons under an answer (Copy, Share, Like, Dislike, Regenerate, More) sit in a box
    // inside the row's button group, next to the answer rather than inside it.
    actionsSelectors: [
      '[role="group"][aria-labelledby^="turn-heading-"] span:has(> button)',
      '[role="group"][aria-labelledby^="turn-heading-"]'
    ],
    // ☆ goes just before "…" (More actions), and copies the look of Like.
    starBefore: 'button[aria-label="More actions"]',
    starLike: 'button[aria-label="Like"]',
    // Grok's icons fill 12–13 of their 16 px; a star looks smaller than other icons of the same
    // width, so it's drawn a bit bigger with thinner lines.
    starIcon: { size: 18, stroke: 1.6 },
    // Grok's buttons on hover: a light circle and a white icon.
    starHover: { background: 'rgba(252, 252, 252, 0.1)', color: 'rgb(252, 252, 252)' },
    // Hand-named class (not generated) around the written answer.
    textSelectors: ['.response-content-markdown'],
    // "Grok" / "You" for screen readers, and the screen-reader copy of maths (KaTeX draws
    // every formula twice).
    skipSelectors: ['[data-no-copy]', '.sr-only', '.katex-mathml'],
    titleSuffix: /\s+[-–|]\s+Grok$/,
    // Grok's own id for each message, in the box around it ("response-<id>").
    msgId: el => {
      const box = el.closest('[id^="response-"]');
      return box ? box.id.slice('response-'.length) : '';
    },
    // The buttons only appear once the answer has finished.
    isBusy: el => {
      const box = el.closest('[id^="response-"]');
      return !!box && !box.querySelector('[role="group"] button');
    },
    // Measured from Grok's own "Like" tooltip.
    tip: {
      side: 'below', gap: 6,
      style: {
        background: 'rgb(35, 33, 31)', color: 'rgb(252, 252, 252)',
        font: '400 13px/16px universalSans, Inter, Roboto, "Open Sans", Arial, sans-serif',
        letterSpacing: '-0.2px', padding: '6px 10px', borderRadius: '8px', border: 'none',
        boxShadow: 'inset 0 0 0 0.5px rgba(252, 252, 252, 0.06), 0 1px 2px rgba(0, 0, 0, 0.3), ' +
          '0 2px 5px -2px rgba(0, 0, 0, 0.25)'
      }
    }
  }
];

// The chat's title without the site's name tacked on.
function getChatTitle(adapter) {
  const title = document.title.trim();
  return (adapter && adapter.titleSuffix ? title.replace(adapter.titleSuffix, '') : title).trim();
}

function getAdapter(host = location.hostname) {
  return ADAPTERS.find(a => a.hosts.some(h => host === h || host.endsWith('.' + h))) || null;
}

function getConvId(adapter, url = location.href) {
  const m = adapter && url.match(adapter.convPattern);
  return m ? m[1] : '';
}

function queryFirst(selectors) {
  for (const sel of selectors) {
    try {
      const found = [...document.querySelectorAll(sel)];
      if (found.length) return found;
    } catch (e) {
      // Bad selector: skip it, never break the page.
    }
  }
  return [];
}

// Keep only outermost matches, so one message never counts twice.
function outermost(els) {
  return els.filter(el => !els.some(other => other !== el && other.contains(el)));
}

// All messages on the page, in page order: [{ el, role: 'user' | 'ai', msgId }]
function getMessages(adapter) {
  if (!adapter) return [];
  try {
    const users = outermost(queryFirst(adapter.userSelectors)).map(el => ({ el, role: 'user' }));
    const ais = outermost(queryFirst(adapter.aiSelectors)).map(el => ({ el, role: 'ai' }));
    return [...users, ...ais]
      .sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
      .map(m => ({ ...m, msgId: (adapter.msgId && adapter.msgId(m.el)) || '' }));
  } catch (e) {
    return [];
  }
}

// The site's button row for this AI answer, or null. Looks inside the answer first,
// then a few levels up, but never so high that another answer is included.
// Each selector is tried at every level before the next, looser one, so a loose match
// inside the answer (a card's own buttons) never beats an exact match just below it.
function getActionBar(adapter, aiEl) {
  const sels = (adapter && adapter.actionsSelectors) || [];
  try {
    for (const sel of sels) {
      let box = aiEl;
      for (let level = 0; box && level < 5; level++, box = box.parentElement) {
        if (level > 0 && queryIn(box, adapter.aiSelectors).length > 1) break;
        const bars = queryIn(box, [sel]);
        if (bars.length === 1) return bars[0];
        if (bars.length > 1) break;
      }
    }
  } catch (e) {
    // Never break the page.
  }
  return null;
}

function queryIn(root, selectors) {
  for (const sel of selectors) {
    try {
      const found = root.querySelectorAll(sel);
      if (found.length) return [...found];
    } catch (e) {
      // Bad selector: skip it.
    }
  }
  return [];
}

// The written-reply parts of an AI answer, in page order. None found → the whole answer.
function getTextParts(adapter, aiEl) {
  if (!adapter || !adapter.textSelectors) return [aiEl];
  try {
    const parts = outermost(queryIn(aiEl, adapter.textSelectors));
    return parts.length ? parts : [aiEl];
  } catch (e) {
    return [aiEl];
  }
}

// The user message element just before this AI answer, or null.
function getQuestionEl(adapter, aiEl) {
  const messages = getMessages(adapter);
  const idx = messages.findIndex(m => m.el === aiEl);
  for (let i = idx - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return messages[i].el;
  }
  return null;
}

// The text of the user message just before this AI answer.
function getQuestion(adapter, aiEl) {
  const q = getQuestionEl(adapter, aiEl);
  if (!q) return '';
  let text = q.innerText;
  // Leave out hidden screen-reader labels ("You said") the site puts inside the question.
  for (const hidden of queryIn(q, (adapter && adapter.skipSelectors) || [])) {
    const label = hidden.innerText.trim();
    if (label) text = text.replace(label, '');
  }
  return text.trim();
}
