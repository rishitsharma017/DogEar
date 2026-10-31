// Stars, picker, panel, jump-to-message. No site-specific code here.

const acb = {
  adapter: getAdapter(),
  url: '',
  convId: '',
  saved: [],              // items saved from the current chat
  prints: new WeakMap(),  // message element → { hash, prefix } (only for finished answers)
  lastChange: 0,          // when the page last changed (performance.now()), see waitForQuiet
  leaving: null           // messages of the chat we're switching away from, see waitForQuiet
};

// Parts of a message that are never part of the answer text (incl. the site's button row
// and the site's hidden screen-reader text).
const SKIP = ['.acb-ui, button, svg, style, script, [aria-hidden="true"]',
  ...((acb.adapter && acb.adapter.actionsSelectors) || []),
  ...((acb.adapter && acb.adapter.skipSelectors) || [])].join(', ');

function h(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
}

// ---------- Message text ----------

// Plain text of a message (used for the hash, so it must always be built the same way).
function messageText(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue;
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  if (node.matches(SKIP)) return '';
  let s = '';
  for (const child of node.childNodes) s += messageText(child);
  return s;
}

// Simple markdown of a message: code blocks, lists, headings, bold, links. Everything else = text.
function toMarkdown(root) {
  return mdChildren(root)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function mdChildren(node) {
  let s = '';
  for (const child of node.childNodes) s += mdNode(child);
  return s;
}

function mdNode(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue.replace(/\s+/g, ' ');
  if (node.nodeType !== Node.ELEMENT_NODE || node.matches(SKIP)) return '';
  const tag = node.tagName.toLowerCase();
  const inner = () => mdChildren(node).trim();

  switch (tag) {
    case 'pre': {
      const code = node.querySelector('code');
      const lang = ((code && code.className.match(/language-([\w+#-]+)/)) || [])[1] || '';
      const text = (code || node).textContent.replace(/\n$/, '');
      return `\n\n\`\`\`${lang}\n${text}\n\`\`\`\n\n`;
    }
    case 'code':
      return '`' + node.textContent + '`';
    case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
      return `\n\n${'#'.repeat(Number(tag[1]))} ${inner()}\n\n`;
    case 'p':
      return `\n\n${inner()}\n\n`;
    case 'br':
      return '\n';
    case 'hr':
      return '\n\n---\n\n';
    case 'strong': case 'b': {
      const t = inner();
      return t ? `**${t}**` : '';
    }
    case 'em': case 'i': {
      const t = inner();
      return t ? `*${t}*` : '';
    }
    case 'a': {
      const t = inner();
      return t && /^https?:/.test(node.href) ? `[${t}](${node.href})` : t;
    }
    case 'ul': case 'ol':
      return '\n\n' + mdList(node, tag === 'ol') + '\n\n';
    case 'blockquote':
      return '\n\n' + inner().split('\n').map(l => '> ' + l).join('\n') + '\n\n';
    case 'table':
      return '\n\n' + mdTable(node) + '\n\n';
    case 'div': case 'section': case 'article':
      return '\n' + mdChildren(node) + '\n';
    default:
      return mdChildren(node);
  }
}

function mdList(list, ordered) {
  let n = ordered ? (list.start || 1) : 0;
  const lines = [];
  for (const li of list.children) {
    if (li.tagName !== 'LI') continue;
    const marker = ordered ? `${n++}. ` : '- ';
    const body = mdChildren(li).trim().replace(/\n{2,}/g, '\n');
    lines.push(marker + body.split('\n').join('\n' + ' '.repeat(marker.length)));
  }
  return lines.join('\n');
}

function mdTable(table) {
  const rows = [...table.querySelectorAll('tr')]
    .map(tr => [...tr.children].map(cell => normalize(cell.textContent).replace(/\|/g, '\\|')));
  if (!rows.length) return '';
  const line = cells => `| ${cells.join(' | ')} |`;
  return [line(rows[0]), line(rows[0].map(() => '---')), ...rows.slice(1).map(line)].join('\n');
}

// A real written answer has at least one paragraph, list, code block, heading, quote or
// table with text. Tool/skill steps ("Read github.com … Stopped") are just a status line.
const ANSWER_BLOCKS = 'p, li, pre, h1, h2, h3, h4, h5, h6, blockquote, table';

function hasAnswerText(el) {
  return getTextParts(acb.adapter, el).some(part => [...part.querySelectorAll(ANSWER_BLOCKS)]
    .some(n => !n.closest(SKIP) && normalize(messageText(n))));
}

// Only the written reply, without tool/skill steps.
function answerPlain(el) {
  return getTextParts(acb.adapter, el).map(messageText).join('\n');
}

function answerMarkdown(el) {
  return getTextParts(acb.adapter, el).map(toMarkdown).filter(Boolean).join('\n\n');
}

// ---------- Recognising a message ----------

// Remembered per element, and worked out again when its text length changes (sites may
// put a message in the page first and fill in its text a moment later).
function fingerprint(el) {
  const len = el.textContent.length;
  let fp = acb.prints.get(el);
  if (!fp || fp.len !== len) {
    const text = answerPlain(el);
    fp = { hash: hashText(text), prefix: makePrefix(text), len };
    acb.prints.set(el, fp);
  }
  return fp;
}

function isBusy(el) {
  return acb.adapter.isBusy ? acb.adapter.isBusy(el) : false;
}

function msgIdOf(el) {
  return (acb.adapter.msgId && acb.adapter.msgId(el)) || '';
}

// The saved item for this message, if any: msgId first → hash → prefix.
// Items saved with a msgId only ever match by msgId, so similar-looking answers
// (e.g. replies to several "I don't understand") never get mixed up.
function savedItemFor(el) {
  const msgId = msgIdOf(el);
  const byId = msgId && acb.saved.find(it => it.msgId === msgId);
  if (byId) return byId;
  const fp = fingerprint(el);
  if (!fp.prefix) return null; // empty text: never match
  const byText = acb.saved.filter(it => !it.msgId);
  return byText.find(it => it.hash === fp.hash)
    || byText.find(it => it.prefix === fp.prefix)
    || null;
}

// ---------- ☆ buttons ----------

// btn.acbMsg is the answer this star belongs to (set on every scan).
function makeStar() {
  const btn = h('button', 'acb-ui acb-star');
  btn.type = 'button';
  btn.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    hideTip();
    openPicker(btn, btn.acbMsg);
  });
  btn.addEventListener('mouseenter', () => showTip(btn));
  btn.addEventListener('focus', () => showTip(btn));
  btn.addEventListener('mouseleave', hideTip);
  btn.addEventListener('blur', hideTip);
  return btn;
}

// Small dark label above the ☆ on hover ("Bookmark"), like the site's own button tooltips.
// One shared element, shown with a short delay so it doesn't flicker when passing over.
let tip = null;
let tipTimer = 0;

function showTip(btn) {
  clearTimeout(tipTimer);
  tipTimer = setTimeout(() => {
    if (!btn.isConnected || !btn.matches(':hover, :focus-visible') || btn.classList.contains('acb-open')) return;
    if (!tip) tip = h('div', 'acb-ui acb-tip');
    tip.textContent = btn.getAttribute('aria-label');
    document.body.append(tip);
    const r = btn.getBoundingClientRect();
    const left = Math.min(Math.max(4, r.left + r.width / 2 - tip.offsetWidth / 2), innerWidth - tip.offsetWidth - 4);
    const above = r.top - tip.offsetHeight - 8;
    tip.style.left = `${Math.round(left)}px`;
    tip.style.top = `${Math.round(above >= 4 ? above : r.bottom + 8)}px`;
    tip.classList.add('acb-show');
  }, 250);
}

function hideTip() {
  clearTimeout(tipTimer);
  if (tip) {
    tip.classList.remove('acb-show');
    tip.remove();
  }
}

// Star outline as an SVG (built with DOM calls, no innerHTML). Filled via CSS when saved.
function starIcon() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.7l5.9-.9z');
  svg.append(path);
  return svg;
}

// Only touch the button when something changed, otherwise our own edit would
// trigger the MutationObserver again and scan forever.
function renderStar(btn, item) {
  const state = item ? 'saved' : 'empty';
  if (btn.dataset.state === state) return;
  btn.dataset.state = state;
  if (!btn.firstChild) btn.append(starIcon());
  // No title: that would show the browser's own tooltip on top of ours.
  btn.removeAttribute('title');
  btn.setAttribute('aria-label', item ? 'Edit bookmark' : 'Bookmark');
  btn.classList.toggle('acb-saved', !!item);
}

// Put the star right after the site's last button in its button row, or at the end of
// the answer if there's no row.
// acb-turn = the box holding both the answer and the row: hovering it shows the ☆.
// Only moves it when it's in the wrong place.
function placeStar(btn, el) {
  const bar = getActionBar(acb.adapter, el);
  if (bar) {
    let turn = bar;
    while (turn && !turn.contains(el)) turn = turn.parentElement;
    if (turn && !turn.classList.contains('acb-turn')) turn.classList.add('acb-turn');
    matchSiteButton(btn, bar);
    // Before the button the site wants it in front of (starBefore), else after the last one.
    const before = acb.adapter.starBefore && bar.querySelector(`:scope > ${acb.adapter.starBefore}`);
    if (before) {
      if (before.previousElementSibling === btn) return;
      btn.classList.add('acb-inbar');
      before.before(btn);
      return;
    }
    const buttons = bar.querySelectorAll(':scope > button:not(.acb-ui)');
    const after = buttons[buttons.length - 1];
    if (after ? after.nextElementSibling === btn : btn.parentElement === bar) return;
    btn.classList.add('acb-inbar');
    after ? after.after(btn) : bar.append(btn);
  } else if (btn.parentElement !== el) {
    btn.classList.remove('acb-inbar');
    el.appendChild(btn);
  }
}

// Sites whose adapter names a starLike button: make the ☆ the same size and colour as it,
// and always visible like it (acb-matched), so it looks like one of the site's own buttons.
// Set once per star.
function matchSiteButton(btn, bar) {
  if (!acb.adapter.starLike || btn.dataset.matched) return;
  const like = bar.querySelector(`:scope > ${acb.adapter.starLike}`);
  const icon = like && like.querySelector('svg');
  if (!like || !like.offsetWidth || !icon) return;
  const size = icon.getBoundingClientRect();
  btn.style.setProperty('--acb-star-box', `${like.offsetWidth}px`);
  btn.style.setProperty('--acb-star-icon', `${Math.round(size.width)}px`);
  btn.style.setProperty('--acb-star-color', getComputedStyle(like).color);
  btn.style.setProperty('--acb-star-radius', getComputedStyle(like).borderRadius);
  btn.dataset.matched = '1';
  btn.classList.add('acb-matched');
}

const stars = new WeakMap(); // answer element → its ☆ button (it may live outside the answer)

function scan() {
  if (location.href !== acb.url) {
    loadSaved();
    return;
  }
  try {
    for (const msg of getMessages(acb.adapter)) {
      if (msg.role !== 'ai') continue;
      if (isBusy(msg.el)) {
        acb.prints.delete(msg.el); // text is still changing
        continue;
      }
      // No written answer (e.g. only a tool step like "Read github.com … Stopped"): no star.
      if (!fingerprint(msg.el).prefix || !hasAnswerText(msg.el)) {
        const old = stars.get(msg.el);
        if (old) old.remove();
        stars.delete(msg.el);
        continue;
      }
      // Reuse a star that's already on the page, so re-renders never make duplicates.
      let btn = stars.get(msg.el);
      if (!btn || !btn.isConnected) {
        const bar = getActionBar(acb.adapter, msg.el);
        btn = (bar && bar.querySelector('.acb-star')) || msg.el.querySelector('.acb-star') || makeStar();
        stars.set(msg.el, btn);
        msg.el.classList.add('acb-host');
      }
      btn.acbMsg = msg.el;
      placeStar(btn, msg.el);
      renderStar(btn, savedItemFor(msg.el));
    }
  } catch (e) {
    // Never break the page.
  }
}

// Called on start, on chat switch, and whenever saved items change.
async function loadSaved() {
  acb.url = location.href;
  const convId = getConvId(acb.adapter);
  if (convId !== acb.convId) jumpToken++; // switched chat: stop any jump still searching
  acb.convId = convId;
  acb.saved = await itemsForConv(acb.convId);
  scan();
  renderPanel();
  checkPendingJump();
}

// ---------- Save picker ----------

let picker = null; // { box, btn } while open

function closePicker() {
  if (!picker) return;
  picker.box.remove();
  picker.btn.classList.remove('acb-open');
  document.removeEventListener('mousedown', onOutsideClick, true);
  document.removeEventListener('keydown', onPickerKey, true);
  document.removeEventListener('scroll', onPageScroll, true);
  picker = null;
}

function onOutsideClick(e) {
  if (picker && !picker.box.contains(e.target) && e.target !== picker.btn) closePicker();
}

function onPickerKey(e) {
  if (e.key === 'Escape') closePicker();
}

function onPageScroll(e) {
  if (picker && !picker.box.contains(e.target)) closePicker();
}

async function saveMessage(el, projectId) {
  await addItem({
    projectId,
    ai: acb.adapter.name,
    text: answerMarkdown(el),
    plain: answerPlain(el),
    question: getQuestion(acb.adapter, el),
    chatTitle: getChatTitle(acb.adapter),
    url: location.href,
    convId: acb.convId,
    msgId: msgIdOf(el),
    pos: positionOf(el),
    fromEnd: fromEndOf(el)
  });
}

// Where an element sits in its scrolling chat: 0 = top, 1 = bottom.
function positionOf(el) {
  const box = scrollBoxOf(el);
  if (!box.scrollHeight) return null;
  return Math.min(1, Math.max(0, offsetIn(el, box) / box.scrollHeight));
}

// How far the answer sits above the end of the chat, in px. Unlike pos, this stays right
// while the site loads older messages at the top (the newest part never moves).
function fromEndOf(el) {
  const box = scrollBoxOf(el);
  if (!box.scrollHeight) return null;
  return Math.max(0, Math.round(box.scrollHeight - offsetIn(el, box)));
}

// el's distance from the top of the scrolling chat, in px.
function offsetIn(el, box) {
  const boxTop = box === document.scrollingElement ? 0 : box.getBoundingClientRect().top;
  return box.scrollTop + el.getBoundingClientRect().top - boxTop;
}

// ☆ → pick a project to save into. ★ → move to another project, or remove.
async function openPicker(btn, el) {
  if (picker && picker.btn === btn) return closePicker();
  closePicker();

  const item = savedItemFor(el);
  const { projects, lastProjectId } = await getData();
  const current = item && projects.find(p => p.id === item.projectId);
  // Inbox is for web clips (right-click saves), so it isn't offered for AI answers.
  const choices = projects
    .filter(p => !isInbox(p))
    .filter(p => !item || p.id !== item.projectId)
    .sort((a, b) => (b.id === lastProjectId) - (a.id === lastProjectId) || a.name.localeCompare(b.name));

  const box = h('div', 'acb-ui acb-picker');
  const title = h('div', 'acb-picker-title',
    item ? `Saved in “${current ? current.name : 'unknown'}”` : 'Save to project');
  const input = h('input', 'acb-picker-input');
  input.type = 'text';
  input.placeholder = item ? 'Move to new project…' : 'New project name…';
  const list = h('div', 'acb-picker-list');
  box.append(title, input, list);

  const choose = async project => {
    closePicker();
    if (item) await moveItem(item.id, project.id);
    else await saveMessage(el, project.id);
  };

  let shown = [];
  const renderList = () => {
    list.textContent = '';
    const typed = normalize(input.value);
    const q = typed.toLowerCase();
    shown = choices.filter(p => p.name.toLowerCase().includes(q));
    if (item && shown.length) list.append(h('div', 'acb-picker-label', 'Move to:'));
    for (const p of shown) {
      const b = h('button', 'acb-picker-item', p.name);
      b.type = 'button';
      if (!item && p.id === lastProjectId) b.classList.add('acb-last');
      b.addEventListener('click', () => choose(p));
      list.append(b);
    }
    if (typed && !projects.some(p => p.name.toLowerCase() === q)) {
      const b = h('button', 'acb-picker-item acb-picker-new', `+ Create “${typed}”`);
      b.type = 'button';
      b.addEventListener('click', async () => choose(await addProject(typed)));
      list.append(b);
    }
    if (!list.childElementCount) {
      list.append(h('div', 'acb-picker-label',
        choices.length || item ? 'No other projects yet' : 'Type a name and press Enter'));
    }
  };

  // Enter: create/use the typed project, or pick the first one in the list.
  input.addEventListener('input', renderList);
  input.addEventListener('keydown', async e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const typed = normalize(input.value);
    if (typed) choose(await addProject(typed));
    else if (shown[0]) choose(shown[0]);
  });
  // Keep the site from reacting to our typing.
  box.addEventListener('keydown', e => e.stopPropagation());

  if (item) {
    const remove = h('button', 'acb-picker-remove', 'Remove bookmark');
    remove.type = 'button';
    remove.addEventListener('click', async () => {
      closePicker();
      await deleteItem(item.id);
    });
    box.append(remove);
  }

  renderList();
  document.body.append(box);

  // Below the star if there's room, otherwise above it.
  const r = btn.getBoundingClientRect();
  let top = r.bottom + 6;
  if (top + box.offsetHeight > innerHeight - 8) top = Math.max(8, r.top - box.offsetHeight - 6);
  const left = Math.min(Math.max(8, r.left), innerWidth - box.offsetWidth - 8);
  box.style.top = `${top}px`;
  box.style.left = `${left}px`;

  picker = { box, btn };
  btn.classList.add('acb-open');
  document.addEventListener('mousedown', onOutsideClick, true);
  document.addEventListener('keydown', onPickerKey, true);
  document.addEventListener('scroll', onPageScroll, true);
  input.focus();
}

// ---------- Jump to message ----------


// The answer on the page for a saved item. Saved with a msgId → only that exact message
// (text matching could land on a similar-looking answer). Otherwise text hash → prefix.
function findMessage(item) {
  const ais = getMessages(acb.adapter).filter(m => m.role === 'ai' && !isBusy(m.el));
  const found = item.msgId
    ? ais.find(m => m.msgId === item.msgId)
    : ais.find(m => fingerprint(m.el).hash === item.hash)
      || (item.prefix && ais.find(m => fingerprint(m.el).prefix === item.prefix));
  return found ? found.el : null;
}

// The box that scrolls the chat (the nearest scrollable parent of a message).
function scrollBoxOf(el) {
  for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
    const overflow = getComputedStyle(n).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll') && n.scrollHeight > n.clientHeight + 10) return n;
  }
  return document.scrollingElement;
}

// The part of a message to light up after a jump: the adapter's highlightSelectors (e.g. the
// speech bubble, so it isn't the full width of the chat), else the bubble around the
// message, else the whole message.
function highlightPart(el) {
  const sels = acb.adapter.highlightSelectors;
  return (sels && queryIn(el, sels)[0]) || bubbleAround(el) || el;
}

// The speech bubble a question sits in: the message itself or one of its first few parents
// that has a background colour and rounded corners. Never so high that it holds an answer.
function bubbleAround(el) {
  let n = el;
  for (let level = 0; n && n !== document.body && level < 4; level++, n = n.parentElement) {
    if (level > 0 && queryIn(n, acb.adapter.aiSelectors).length) break;
    const style = getComputedStyle(n);
    const filled = style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent';
    if (filled && parseFloat(style.borderTopLeftRadius) > 0) return n;
  }
  return null;
}

function flash(el) {
  el.classList.remove('acb-flash');
  void el.offsetWidth; // restart the animation if it's already running
  el.classList.add('acb-flash');
  setTimeout(() => el.classList.remove('acb-flash'), 3700);
}

// Small note at the bottom of the screen. ms = 0 → stays until removed.
function toast(text, ms = 3000) {
  const note = h('div', 'acb-ui acb-toast', text);
  document.body.append(note);
  if (ms) setTimeout(() => note.remove(), ms);
  return note;
}

// Scroll to a saved answer and highlight it. Sites may only keep messages near the screen
// in the page, so if it isn't there: scroll up step by step (older messages may load at
// the top), then down, retrying for ~15 s. A newer jump cancels this one.
//
// A first jump sometimes ends away from the message while a second one lands (the site is
// still loading messages around it). So afterwards check, and if it's off, jump once more.
let jumpToken = 0;

const nextFrame = () => new Promise(r => requestAnimationFrame(r));

async function jumpTo(item, firstTry = true) {
  const token = ++jumpToken;
  let answer = findMessage(item);
  if (!answer) {
    const cover = showSearchCover(token);
    try {
      answer = await searchFor(item, token);
    } finally {
      cover.remove();
    }
    if (token !== jumpToken) return;
    if (!answer) {
      toast('Couldn’t find this message');
      return;
    }
  }
  if (!await land(item, token)) return;
  learnHints(item);
  if (firstTry) {
    const watch = watchUser();
    await new Promise(r => setTimeout(r, 300));
    watch.stop();
    if (token !== jumpToken || watch.moved) return;
    if (!landedOn(item)) return jumpTo(item, false);
  }
}

// After a jump, store where the answer really is now, so the next jump goes straight there.
// Fixes items saved before the hints existed, and chats that grew after saving (new
// messages below push the answer further from the end).
function learnHints(item) {
  const answer = findMessage(item);
  if (!answer) return;
  const fromEnd = fromEndOf(answer);
  if (fromEnd === null) return;
  if (typeof item.fromEnd === 'number' && Math.abs(item.fromEnd - fromEnd) < 300) return;
  item.pos = positionOf(answer);
  item.fromEnd = fromEnd;
  setItemHints(item.id, item.pos, item.fromEnd);
}

// Is the message (its question, if on the page) where land() put it?
function landedOn(item) {
  const answer = findMessage(item);
  if (!answer) return false;
  const el = getQuestionEl(acb.adapter, answer) || answer;
  const box = scrollBoxOf(el);
  return Math.abs(scrollTopFor(el, box) - box.scrollTop) < 100;
}

// While searching, the chat jumps around (the site loads older messages and shifts the
// page). A dim cover over the chat hides that. Cancel, Esc or the mouse wheel stop the search.
function showSearchCover(token) {
  const first = getMessages(acb.adapter)[0];
  const box = first ? scrollBoxOf(first.el) : null;
  const cover = h('div', 'acb-ui acb-cover');
  if (box && box !== document.scrollingElement) {
    const r = box.getBoundingClientRect();
    Object.assign(cover.style, {
      left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px'
    });
  }
  const cancel = h('button', 'acb-cover-cancel', 'Cancel');
  cancel.type = 'button';
  // Gold ring sweeping around a softly pulsing ★.
  const spinner = h('span', 'acb-spinner');
  spinner.append(h('span', 'acb-spinner-ring'), starIcon());
  const text = h('span', 'acb-cover-text');
  text.append(h('span', 'acb-cover-title', 'Finding message'),
    h('span', 'acb-cover-hint', 'Searching the chat · Esc to cancel'));
  const card = h('div', 'acb-cover-card');
  card.append(spinner, text, cancel);
  cover.append(card);
  document.body.append(cover);
  requestAnimationFrame(() => cover.classList.add('acb-show'));

  let gone = false;
  const remove = () => {
    if (gone) return;
    gone = true;
    document.removeEventListener('keydown', onKey, true);
    cover.classList.remove('acb-show');
    setTimeout(() => cover.remove(), 200);
  };
  const stop = () => {
    if (jumpToken === token) jumpToken++; // cancels the search
    remove();
  };
  const onKey = e => { if (e.key === 'Escape') stop(); };
  cancel.addEventListener('click', stop);
  cover.addEventListener('wheel', stop, { passive: true });
  document.addEventListener('keydown', onKey, true);
  return { remove };
}

// Tracks whether the user scrolls, clicks or types (our own pretend wheel doesn't count).
function watchUser() {
  const watch = { moved: false };
  const onUser = e => { if (e.isTrusted) watch.moved = true; };
  const events = ['wheel', 'touchstart', 'keydown', 'mousedown'];
  events.forEach(type => addEventListener(type, onUser, true));
  watch.stop = () => events.forEach(type => removeEventListener(type, onUser, true));
  return watch;
}

// scrollTop that puts el 80px below the top of the chat (room for the site's header).
function scrollTopFor(el, box) {
  const boxTop = box === document.scrollingElement ? 0 : box.getBoundingClientRect().top;
  const want = box.scrollTop + el.getBoundingClientRect().top - boxTop - 80;
  return Math.min(Math.max(0, want), box.scrollHeight - box.clientHeight);
}

// Put the question asked before the answer at the top of the screen (answer right below
// it) and highlight it; no question on the page → the answer itself.
//
// Then keep it there until it has been steady for 0.4 s (2.5 s at most). Every frame the
// message is looked up again, because right after a jump the site may swap the element for
// a new copy or resize messages around it. If it vanishes for 0.3 s, search again (once).
// Stops as soon as the user scrolls, clicks or types, or another jump starts.
// Returns false when stopped like that (or the message is lost), true otherwise.
async function land(item, token) {
  const watch = watchUser();
  const end = performance.now() + 2500;
  let flashed = null;
  let steadySince = 0;
  let missingSince = 0;
  let searchedAgain = false;
  try {
    while (performance.now() < end) {
      if (token !== jumpToken || watch.moved) return false;
      const now = performance.now();
      const answer = findMessage(item);
      if (!answer) {
        steadySince = 0;
        if (!missingSince) missingSince = now;
        else if (now - missingSince > 300 && !searchedAgain) {
          searchedAgain = true;
          if (!await searchFor(item, token)) return false;
          missingSince = 0;
          continue;
        }
        await nextFrame();
        continue;
      }
      missingSince = 0;

      const el = getQuestionEl(acb.adapter, answer) || answer;
      if (el !== flashed) {
        flash(highlightPart(el));
        flashed = el;
      }
      const box = scrollBoxOf(el);
      const want = scrollTopFor(el, box);
      if (Math.abs(want - box.scrollTop) > 2) {
        releaseStickToBottom(box); // otherwise the site may pull us straight back down
        box.scrollTop = want;
        steadySince = 0;
      } else if (!steadySince) {
        steadySince = now;
      } else if (now - steadySince > 400) {
        return true;
      }
      await nextFrame();
    }
    return true;
  } finally {
    watch.stop();
  }
}

// Chat sites stick to the bottom (pulling you back down when content changes) until they
// see the user scroll up with the wheel. A pretend wheel-up tells them to let go. It
// doesn't scroll anything itself.
function releaseStickToBottom(box) {
  box.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, bubbles: true, cancelable: true }));
}

// Find the answer by scrolling. Returns the answer element, or null after ~15 s (longer
// while a long chat is still loading older messages).
//
// 1. Saved with fromEnd (px from the end of the chat) → go straight there, loading older
//    messages first if needed (seekFromEnd). Not exactly there → look around it, then sweep.
// 2. Only pos (older saves) → jump there and look, then: one screen down, up to the top,
//    down to the bottom. pos is unreliable on sites that load older messages at the top
//    (it was measured against however much of the chat had loaded), so up comes first:
//    unloaded messages are always above.
// 3. No hint → up to the top, then down.
//
// While searching, the browser's scroll anchoring is switched off on the chat: when the
// site fills in taller messages above the screen, anchoring pushes the page back down and
// cancels out our scrolling.
async function searchFor(item, token) {
  let deadline = Date.now() + 15000;
  let box = null;
  const boxWait = Date.now() + 3000;
  while (!box) { // wait for the chat to load
    await nextFrame();
    if (token !== jumpToken || Date.now() > deadline) return null;
    const el = findMessage(item);
    if (el) return el;
    const messages = getMessages(acb.adapter);
    if (!messages.length) continue;
    // Right after a chat opens, its scrolling box may not be set up yet, so the whole page
    // looks like the scroller (and can't scroll). Give the real one a moment to appear.
    const found = scrollBoxOf(messages[0].el);
    if (found !== document.scrollingElement || Date.now() > boxWait) box = found;
  }

  box.style.overflowAnchor = 'none';
  try {
    releaseStickToBottom(box);
    let phases = [[-1, Infinity], [1, Infinity]];
    if (typeof item.fromEnd === 'number') {
      const el = await seekFromEnd(box, item, token);
      if (el) return el;
      if (token !== jumpToken) return null;
      deadline = Math.max(deadline, Date.now() + 5000); // loading may have used up the 15 s
      // Not exactly there: sites guess the height of messages off screen, and new messages
      // added after saving push the answer further up. Check just below, then go up.
      phases = [[1, box.clientHeight], [-1, Infinity], [1, Infinity]];
    } else if (typeof item.pos === 'number') {
      box.scrollTop = item.pos * box.scrollHeight - box.clientHeight / 3;
      const el = await settle(item, token, 300);
      if (el) return el;
      phases = [[1, box.clientHeight], [-1, Infinity], [1, Infinity]];
    }
    for (const [direction, limit] of phases) {
      const el = await sweep(box, item, token, direction, limit, deadline);
      if (el) return el;
      if (token !== jumpToken || Date.now() > deadline) return null;
    }
    return null;
  } finally {
    box.style.overflowAnchor = '';
  }
}

// Go straight to where the answer was, measured from the end of the chat. If the chat isn't
// that long yet, older messages haven't loaded: stay at the top so the site loads batch
// after batch (no need to scroll through each one), until it's long enough.
// Keeps waiting as long as the chat is still growing (long chats load in many batches),
// up to 45 s. Returns the answer, or null if it isn't right there.
async function seekFromEnd(box, item, token) {
  const cap = Date.now() + 45000;
  let height = -1;
  let grewAt = performance.now();
  while (Date.now() < cap) {
    if (token !== jumpToken) return null;
    const el = findMessage(item);
    if (el) return el;
    const target = box.scrollHeight - item.fromEnd - box.clientHeight / 3;
    if (target >= 0) {
      box.scrollTop = target;
      return settle(item, token, 300);
    }
    if (box.scrollHeight !== height) {
      height = box.scrollHeight;
      grewAt = performance.now();
    } else if (performance.now() - grewAt > 2500) {
      return null; // nothing more loads: the sweeps take over from the top
    }
    if (box.scrollTop > 0) box.scrollTop = 0;
    await nextFrame();
  }
  return null;
}

// Checks every frame for up to ms (lets the site put newly visible messages in the page).
async function settle(item, token, ms) {
  const end = performance.now() + ms;
  while (performance.now() < end) {
    await nextFrame();
    if (token !== jumpToken) return null;
    const el = findMessage(item);
    if (el) return el;
  }
  return null;
}

// Smooth continuous scroll in one direction (-1 up, 1 down), checking every frame, for at
// most `limit` px. Starts at 2500 px/s, speeds up to 5000 px/s (faster can fly past
// messages the site hasn't put in the page yet). Returns the answer, or null when the
// limit is reached, it's stuck at the end, or time is up.
//
// Distance counts only our own scrolling: when the site loads older messages at the top,
// scrollTop jumps by thousands of px without us moving past anything.
async function sweep(box, item, token, direction, limit, deadline) {
  let speed = 2500;
  let moved = 0;
  let progress = 0; // `moved` at the last check that we're not stuck
  let progressAt = performance.now();
  let triedEnd = false;
  let last = performance.now();

  while (Date.now() < deadline) {
    await nextFrame();
    if (token !== jumpToken) return null;
    const now = performance.now();
    const dt = Math.min(now - last, 50) / 1000;
    last = now;

    const el = findMessage(item);
    if (el) return el;
    if (moved >= limit) return null;

    const before = box.scrollTop;
    box.scrollTop += direction * speed * dt;
    moved += Math.abs(box.scrollTop - before);
    speed = Math.min(speed * (1 + dt), 5000);
    // The site pulled us back to the bottom: tell it again to let go.
    if (direction < 0 && box.scrollTop > before + 200) releaseStickToBottom(box);

    // At the top, give the site time to load the next batch of older messages.
    const patience = direction < 0 && box.scrollTop <= 0 ? 2500 : 1000;
    if (moved > progress + 50) {
      progress = moved;
      progressAt = now;
    } else if (now - progressAt > patience) {
      const atEnd = direction < 0
        ? box.scrollTop <= 0
        : box.scrollTop >= box.scrollHeight - box.clientHeight - 1;
      if (triedEnd || atEnd || limit !== Infinity) return null;
      // Stuck: jump straight to the end and look there for another second.
      box.scrollTop = direction < 0 ? 0 : box.scrollHeight;
      triedEnd = true;
      progressAt = now;
    }
  }
  return null;
}

// Panel click: same chat → jump. Other chat → remember the jump, then open that chat.
// Opening it through a link already on the page (the site's own chat list) switches chat
// without reloading, so the panel stays open. No such link → normal page load.
async function openItem(item) {
  if (item.convId && item.convId === acb.convId) return jumpTo(item);
  if (!item.url) return;
  await setPendingJump(item.id, item.url, panel.box ? panel.view : null, panel.listScroll);
  // Another site (a ChatGPT answer while on Claude, a web clip): open it in a new tab and
  // leave this one as it is. The new tab picks up pendingJump like any other chat.
  if (!sameSite(item.url)) {
    chrome.runtime.sendMessage({ type: 'open-tab', url: item.url }).catch(() => {});
    return;
  }
  const link = linkTo(item.url);
  if (link) {
    acb.leaving = new Set(getMessages(acb.adapter).map(m => m.el));
    link.click();
  } else {
    location.assign(item.url);
  }
}

// A link on the page (not ours) that goes to this url, or null.
function linkTo(url) {
  return [...document.querySelectorAll('a[href]')]
    .find(a => !a.closest('.acb-ui') && samePage(a.href, url)) || null;
}

// Wait until the chat has stopped changing (just switched or loaded): 400 ms without
// page changes, at least one message on the page, and none of the old chat's messages
// left (sites change the URL first and swap the messages in later). 8 s at most.
async function waitForQuiet() {
  const end = performance.now() + 8000;
  while (performance.now() < end) {
    await nextFrame();
    const messages = getMessages(acb.adapter);
    const oldLeft = acb.leaving && messages.some(m => acb.leaving.has(m.el));
    if (performance.now() - acb.lastChange > 400 && messages.length && !oldLeft) break;
  }
  acb.leaving = null;
}

// Is url on the AI site this tab is on (perplexity.ai and www.perplexity.ai count as one)?
function sameSite(url) {
  try {
    return getAdapter(new URL(url).hostname) === acb.adapter;
  } catch (e) {
    return false;
  }
}

function samePage(a, b) {
  try {
    const x = new URL(a), y = new URL(b);
    return x.origin === y.origin && x.pathname === y.pathname;
  } catch (e) {
    return false;
  }
}

// After opening a chat for a jump: if pendingJump is for this page and under 60 s old, do it.
async function checkPendingJump() {
  const pending = await getPendingJump();
  if (!pending) return;
  const fresh = Date.now() - pending.time < 60000;
  if (fresh && !samePage(pending.url, location.href)) return; // not there yet
  await clearPendingJump();
  if (!fresh) return;
  // After a full page load the panel is gone: reopen it the way it was.
  if (pending.panelView && !panel.box) {
    panel.view = pending.panelView;
    panel.shownView = pending.panelView; // same list as before: keep its scroll spot
    panel.shownConv = acb.convId;
    panel.listScroll = pending.panelScroll || 0;
    togglePanel();
  }
  const { items } = await getData();
  const item = items.find(it => it.id === pending.itemId);
  if (!item) return;
  const token = jumpToken;
  await waitForQuiet();
  if (token === jumpToken) jumpTo(item); // skip if another jump or chat switch came first
}

// ---------- Panel (Alt+B) ----------

// view: 'chat' or a projectId. shownView: the view the list on screen was drawn for.
const panel = { box: null, view: 'chat', shownView: null, shownConv: null, listScroll: 0 };

function togglePanel() {
  if (panel.box) {
    panel.box.remove();
    panel.box = null;
    return;
  }
  panel.box = h('div', 'acb-ui acb-panel');
  // Keep the site from reacting to keys pressed in the panel.
  panel.box.addEventListener('keydown', e => e.stopPropagation());
  // Hidden until it's filled and moved to where the user dragged it last, so it doesn't
  // flash in the default corner first.
  const box = panel.box;
  box.style.visibility = 'hidden';
  document.body.append(box);
  Promise.all([renderPanel(), getPanelPos()]).then(([, pos]) => {
    if (pos) placePanel(pos.left, pos.top);
  }).finally(() => { box.style.visibility = ''; });
}

// Moves the panel, keeping its top bar inside the window. Returns where it ended up.
function placePanel(left, top) {
  const box = panel.box;
  if (!box) return null;
  left = Math.round(Math.min(Math.max(8, left), innerWidth - box.offsetWidth - 8));
  top = Math.round(Math.min(Math.max(8, top), innerHeight - 56));
  box.style.left = `${left}px`;
  box.style.top = `${top}px`;
  box.style.right = 'auto';
  return { left, top };
}

// Drag the panel by its top bar (but not by the dropdown or ×). Remembers the spot.
function makeDraggable(handle) {
  handle.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest('select, button')) return;
    e.preventDefault();
    const start = panel.box.getBoundingClientRect();
    const dx = e.clientX - start.left;
    const dy = e.clientY - start.top;
    let pos = null;
    handle.setPointerCapture(e.pointerId);
    const move = ev => { pos = placePanel(ev.clientX - dx, ev.clientY - dy); };
    const stop = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', stop);
      handle.removeEventListener('pointercancel', stop);
      if (pos) setPanelPos(pos);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', stop);
    handle.addEventListener('pointercancel', stop);
  });
}

// Saved markdown → one line of plain text for the list.
function snippet(markdown) {
  return normalize(markdown
    .replace(/```[\s\S]*?```/g, ' [code] ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*`>|]/g, ' '));
}

function panelRow(item, where) {
  const row = h('div', 'acb-panel-item');
  if (item.question) row.append(h('div', 'acb-panel-q', item.question));
  row.append(h('div', 'acb-panel-text', snippet(item.text)));
  const meta = [item.ai, where, new Date(item.createdAt).toLocaleDateString()].filter(Boolean);
  row.append(h('div', 'acb-panel-meta', meta.join(' · ')));
  row.title = item.convId === acb.convId ? 'Jump to this answer' : 'Open the chat and jump to this answer';
  row.addEventListener('click', () => openItem(item));
  return row;
}

// Redraws the open panel from storage. Called on open, view change, and data changes.
async function renderPanel() {
  if (!panel.box) return;
  const { projects, items } = await getData();
  const box = panel.box;
  if (!box) return;
  if (panel.view !== 'chat' && !projects.some(p => p.id === panel.view)) panel.view = 'chat';

  const select = h('select', 'acb-panel-select');
  select.append(new Option('This chat', 'chat'));
  for (const p of [...projects].sort((a, b) => a.name.localeCompare(b.name))) {
    const count = items.filter(it => it.projectId === p.id).length;
    select.append(new Option(`${p.name} (${count})`, p.id));
  }
  select.value = panel.view;
  select.addEventListener('change', () => {
    panel.view = select.value;
    renderPanel();
  });

  const close = h('button', 'acb-panel-close', '×');
  close.type = 'button';
  close.title = 'Close (Alt+B)';
  close.addEventListener('click', togglePanel);

  const grip = h('div', 'acb-panel-grip', '⠿');
  grip.title = 'Drag to move';
  const head = h('div', 'acb-panel-head');
  head.append(grip, select, close);
  makeDraggable(head);

  // This chat: in the order they were saved. A project: newest first.
  const inChat = panel.view === 'chat';
  const shown = inChat
    ? items.filter(it => acb.convId && it.convId === acb.convId).sort((a, b) => a.createdAt - b.createdAt)
    : items.filter(it => it.projectId === panel.view).sort((a, b) => b.createdAt - a.createdAt);
  const names = new Map(projects.map(p => [p.id, p.name]));

  const list = h('div', 'acb-panel-list');
  for (const it of shown) list.append(panelRow(it, inChat ? names.get(it.projectId) : it.chatTitle));
  if (!shown.length) {
    list.append(h('div', 'acb-panel-empty', inChat
      ? 'Nothing saved from this chat yet. Click ☆ under an answer to save it.'
      : 'No items in this project yet.'));
  }

  // Redrawing builds a new list (e.g. after every jump, which saves the answer's position):
  // keep the user's scroll spot if it's the same view. It's remembered while scrolling, and
  // put back now and again next frame, in case the new list wasn't laid out yet.
  // "This chat" in another chat is a different list, so that starts at the top.
  const sameList = panel.shownView === panel.view && (panel.view !== 'chat' || panel.shownConv === acb.convId);
  const keepScroll = sameList ? panel.listScroll || 0 : 0;
  list.addEventListener('scroll', () => { panel.listScroll = list.scrollTop; }, { passive: true });
  box.textContent = '';
  box.append(head, list);
  list.scrollTop = keepScroll;
  requestAnimationFrame(() => { if (list.isConnected) list.scrollTop = keepScroll; });
  panel.listScroll = keepScroll;
  panel.shownView = panel.view;
  panel.shownConv = acb.convId;
}

// ---------- Start ----------

if (acb.adapter) {
  // A site's button row can appear on hover. Place the star in the same moment (before
  // the screen is drawn) so it doesn't pop in late. Everything else waits 300 ms.
  const barSel = (acb.adapter.actionsSelectors || []).join(', ');
  const touchesBar = r => {
    try {
      if (r.target.closest && r.target.closest(barSel)) return true;
      return [...r.addedNodes].some(n => n.nodeType === Node.ELEMENT_NODE &&
        (n.matches(barSel) || n.querySelector(barSel)));
    } catch (e) {
      return false;
    }
  };

  let scanTimer;
  new MutationObserver(records => {
    acb.lastChange = performance.now();
    clearTimeout(scanTimer);
    if (barSel && records.some(touchesBar)) scan();
    else scanTimer = setTimeout(scan, 300);
  }).observe(document.body, { childList: true, subtree: true });

  // Chat switches change the URL without reloading the page.
  setInterval(() => {
    if (location.href !== acb.url) loadSaved();
  }, 1000);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.items || changes.projects)) loadSaved();
  });

  // Alt+B arrives from background.js.
  chrome.runtime.onMessage.addListener(msg => {
    if (msg && msg.type === 'toggle-panel') togglePanel();
  });

  // Window got smaller: keep a moved panel inside it.
  addEventListener('resize', () => {
    if (panel.box && panel.box.style.left) {
      placePanel(parseFloat(panel.box.style.left), parseFloat(panel.box.style.top));
    }
  });

  loadSaved();
}
