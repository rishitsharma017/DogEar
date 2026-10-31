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
    // Hidden page text that is not part of the answer ("Claude responded: …" for screen readers).
    skipSelectors: ['[data-find-omitted]', '.sr-only'],
    // The site's name at the end of the tab title ("Exam prep - Claude"), removed when saving.
    titleSuffix: /\s+[-–|]\s+Claude$/,
    // Stable id of an answer ("…-hub-reply"), so a saved answer is found exactly.
    msgId: el => {
      const turn = el.closest('[data-turn-key]');
      return turn ? turn.getAttribute('data-turn-key') : '';
    },
    isBusy: el => el.closest('[data-is-streaming="true"]') !== null
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
function getActionBar(adapter, aiEl) {
  const sels = (adapter && adapter.actionsSelectors) || [];
  try {
    let box = aiEl;
    for (let level = 0; box && level < 5; level++, box = box.parentElement) {
      if (level > 0 && queryIn(box, adapter.aiSelectors).length > 1) break;
      const bars = queryIn(box, sels);
      if (bars.length === 1) return bars[0];
      if (bars.length > 1) break;
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
  return q ? q.innerText.trim() : '';
}
