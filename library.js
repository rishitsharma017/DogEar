// Library page: projects sidebar, item list, search, filter, export. (Step 8)
// All storage goes through common.js. Saved text is only ever put in the page with textContent.

const $ = id => document.getElementById(id);

function h(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
}

// ---------- Saved Markdown → page ----------
// Saved answers are simple Markdown (see "Data" in CLAUDE.md). Drawn with DOM calls and
// textContent only, never innerHTML, so nothing in a saved answer can run as page code.

const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const BLOCK_START = /^(```|#{1,6}\s|>|(\s*)([-*+]|\d+[.)])\s|\|)/;

function renderMarkdown(text) {
  const box = document.createDocumentFragment();
  renderBlocks(box, String(text || '').replace(/\r/g, '').split('\n'));
  return box;
}

function renderBlocks(parent, lines) {
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    // ```lang … ``` → code box
    const fence = line.match(/^\s*```\s*([\w+#.-]*)/);
    if (fence) {
      const code = [];
      for (i++; i < lines.length && !/^\s*```\s*$/.test(lines[i]); i++) code.push(lines[i]);
      i++;
      const pre = h('pre', 'md-code');
      if (fence[1]) pre.dataset.lang = fence[1];
      pre.append(h('code', '', code.join('\n')));
      parent.append(pre);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = Math.min(heading[1].length, 3);
      parent.append(inline(h(`h${level + 2}`, 'md-h'), heading[2]));
      i++;
      continue;
    }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      parent.append(h('hr', 'md-hr'));
      i++;
      continue;
    }

    // | a | b | with a |---| line under the first row → table
    if (/^\s*\|/.test(line) && /^\s*\|\s*:?-{2,}/.test(lines[i + 1] || '')) {
      const rows = [];
      for (; i < lines.length && /^\s*\|/.test(lines[i]); i++) rows.push(lines[i]);
      parent.append(table(rows));
      continue;
    }

    if (/^\s*>/.test(line)) {
      const quoted = [];
      for (; i < lines.length && /^\s*>/.test(lines[i]); i++) quoted.push(lines[i].replace(/^\s*>\s?/, ''));
      const quote = h('blockquote', 'md-quote');
      renderBlocks(quote, quoted);
      parent.append(quote);
      continue;
    }

    if (LIST_ITEM.test(line)) {
      i = list(parent, lines, i);
      continue;
    }

    // Paragraph: lines up to a blank line or the start of another block. A single line break
    // inside it stays a line break (sites often write one line per box).
    const para = [];
    for (; i < lines.length && lines[i].trim() && !(para.length && BLOCK_START.test(lines[i])); i++) {
      para.push(lines[i].trim());
    }
    parent.append(inline(h('p', 'md-p'), para.join('\n')));
  }
}

// A run of list items from lines[i]. An item's following lines that are indented belong to
// it (that's how nested lists and multi-line items are saved). Returns the next line index.
function list(parent, lines, i) {
  const first = lines[i].match(LIST_ITEM);
  const indent = first[1].length;
  const ordered = /\d/.test(first[2]);
  const el = h(ordered ? 'ol' : 'ul', 'md-list');
  if (ordered && parseInt(first[2], 10) !== 1) el.start = parseInt(first[2], 10);
  while (i < lines.length) {
    const m = lines[i].match(LIST_ITEM);
    if (!m || m[1].length !== indent || /\d/.test(m[2]) !== ordered) break;
    const body = [m[3]];
    const cut = indent + m[2].length + 1;
    for (i++; i < lines.length; i++) {
      const next = lines[i];
      if (!next.trim()) {
        // A blank line ends the item unless more indented lines follow.
        if (/^\s+\S/.test(lines[i + 1] || '') && (lines[i + 1].match(/^\s*/)[0].length > indent)) { body.push(''); continue; }
        break;
      }
      const lead = next.match(/^\s*/)[0].length;
      if (lead <= indent) break;
      body.push(next.slice(Math.min(lead, cut)));
    }
    const li = h('li');
    if (body.length === 1) inline(li, body[0]);
    else renderBlocks(li, body);
    el.append(li);
    if (!lines[i] || !lines[i].trim()) {
      // Blank line between items of the same list: keep going if the list continues.
      const next = lines[i + 1] && lines[i + 1].match(LIST_ITEM);
      if (next && next[1].length === indent && /\d/.test(next[2]) === ordered) i++;
      else break;
    }
  }
  parent.append(el);
  return i;
}

function table(rows) {
  const cells = row => row.trim().replace(/^\|/, '').replace(/\|$/, '')
    .split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
  const wrap = h('div', 'md-table');
  const t = h('table');
  const headRow = h('tr');
  for (const c of cells(rows[0])) headRow.append(inline(h('th'), c));
  const head = h('thead');
  head.append(headRow);
  const body = h('tbody');
  for (const row of rows.slice(2)) {
    const tr = h('tr');
    for (const c of cells(row)) tr.append(inline(h('td'), c));
    body.append(tr);
  }
  t.append(head, body);
  wrap.append(t);
  return wrap;
}

// Inline marks: `code`, **bold**, *italic*, [text](https://…). Single line breaks → <br>.
const INLINE = /(`+)([\s\S]+?)\1|\*\*([\s\S]+?)\*\*|\*(?=\S)([^*\n]+?)\*|\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g;

function inline(parent, s) {
  let last = 0;
  for (const m of s.matchAll(INLINE)) {
    plain(parent, s.slice(last, m.index));
    if (m[1]) parent.append(h('code', 'md-inline', m[2]));
    else if (m[3]) parent.append(inline(h('strong'), m[3]));
    else if (m[4]) parent.append(inline(h('em'), m[4]));
    else {
      const a = h('a', 'md-link');
      a.href = m[6];
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      parent.append(inline(a, m[5]));
    }
    last = m.index + m[0].length;
  }
  plain(parent, s.slice(last));
  return parent;
}

function plain(parent, s) {
  s.split('\n').forEach((part, n) => {
    if (n) parent.append(h('br'));
    if (part) parent.append(document.createTextNode(part));
  });
}

const state = {
  view: 'all',        // 'all', 'trash' or a projectId
  search: '',
  ai: '',             // '' = every AI
  expanded: new Set(), // ids of items showing their full text
  selecting: false,    // checkboxes shown (after clicking "Select")
  selected: new Set(), // ids of ticked items
  shownIds: []         // ids of the items in the list right now (for "select all")
};
let renaming = false; // don't redraw while the rename box is open

// ---------- Drawing ----------

async function render() {
  if (renaming) return;
  const data = await getData();
  const { projects, items } = data;
  const cutoff = Date.now() - TRASH_DAYS * 24 * 60 * 60 * 1000;
  const trash = data.trash.filter(t => t.deletedAt > cutoff);
  const inTrash = state.view === 'trash';
  if (!inTrash && state.view !== 'all' && !projects.some(p => p.id === state.view)) state.view = 'all';
  const project = projects.find(p => p.id === state.view);

  renderSidebar(projects, items, trash);
  renderAiFilter(items);

  $('project-actions').hidden = !project;
  $('trash-actions').hidden = !inTrash || !trash.length;
  $('trash-note').hidden = !inTrash;
  $('toolbar').hidden = inTrash;
  if (inTrash) {
    stopSelecting();
    $('selection-bar').hidden = true;
    return renderTrash(trash);
  }

  $('title').textContent = project ? project.name : 'All saved';

  const inView = project ? items.filter(it => it.projectId === project.id) : items;
  const shown = inView
    .filter(it => !state.ai || it.ai === state.ai)
    .filter(it => matches(it, state.search))
    .sort((a, b) => b.createdAt - a.createdAt);

  const filtered = state.search || state.ai;
  $('count').textContent = filtered
    ? `${shown.length} of ${inView.length}`
    : `${inView.length} item${inView.length === 1 ? '' : 's'}`;

  // Checkboxes only after clicking "Select" (the user's choice: no clutter otherwise).
  // Ticked items no longer in the list (moved, deleted, filtered out) drop out.
  const selectable = state.selecting;
  state.shownIds = selectable ? shown.map(it => it.id) : [];
  const shownSet = new Set(state.shownIds);
  for (const id of state.selected) if (!shownSet.has(id)) state.selected.delete(id);
  renderSelectionBar(projects);

  const list = $('list');
  list.replaceChildren();
  if (!shown.length) {
    renderIndex([]);
    const empty = h('div', 'empty');
    empty.append(h('p', '', emptyText(inView.length, filtered)));
    if (filtered && inView.length) {
      const clear = h('button', '', state.search ? 'Clear search' : 'Show all AIs');
      clear.addEventListener('click', () => {
        state.search = '';
        state.ai = '';
        $('search').value = '';
        render();
        $('search').focus();
      });
      empty.append(clear);
    }
    list.append(empty);
    return;
  }
  // Grouped under guide words (Today, Yesterday, This week, months), like a dictionary's
  // sections; the index tabs on the right edge jump between them.
  const names = new Map(projects.map(p => [p.id, p.name]));
  const groups = [];
  for (const item of shown) {
    const g = dateGroup(item.createdAt);
    if (!groups.length || groups[groups.length - 1].key !== g.key) groups.push({ ...g, items: [] });
    groups[groups.length - 1].items.push(item);
  }
  for (const g of groups) {
    const guide = h('h2', 'guide');
    guide.id = `g-${g.key}`;
    const n = g.items.length;
    guide.append(h('span', '', g.label), h('span', 'guide-count', `${n} answer${n === 1 ? '' : 's'}`));
    list.append(guide);
    for (const item of g.items) {
      list.append(itemCard(item, projects, project ? null : names.get(item.projectId), selectable));
    }
  }
  renderIndex(groups);
}

// Which guide-word section a date belongs to: Today, Yesterday, This week (the 5 days before),
// then one per month ("October", or "September 2025" for other years).
function dateGroup(ms) {
  const day = d => new Date(d).setHours(0, 0, 0, 0);
  const days = Math.round((day(Date.now()) - day(ms)) / 86400000);
  if (days <= 0) return { key: 'today', label: 'Today', tab: 'Today' };
  if (days === 1) return { key: 'yesterday', label: 'Yesterday', tab: 'Yesterday' };
  if (days < 7) return { key: 'week', label: 'This week', tab: 'This week' };
  const date = new Date(ms);
  const thisYear = date.getFullYear() === new Date().getFullYear();
  const month = date.toLocaleDateString(undefined, { month: 'long' });
  const short = date.toLocaleDateString(undefined, { month: 'short' });
  return {
    key: `${date.getFullYear()}-${date.getMonth()}`,
    label: thisYear ? month : `${month} ${date.getFullYear()}`,
    tab: thisYear ? short : `${short} ’${String(date.getFullYear()).slice(2)}`
  };
}

// The thumb index: one half-moon tab per section on the right edge. A tab scrolls to its
// guide word; the tab of the section you're reading is the gilt one.
function renderIndex(groups) {
  const index = $('index');
  index.replaceChildren();
  index.hidden = !groups.length;
  for (const g of groups) {
    const tab = h('button', 'tab', g.tab);
    tab.type = 'button';
    tab.dataset.key = g.key;
    tab.title = `Jump to ${g.label}`;
    tab.addEventListener('click', () => {
      document.getElementById(`g-${g.key}`).scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    index.append(tab);
  }
  markIndex();
}

function markIndex() {
  const guides = [...document.querySelectorAll('#list .guide')];
  let current = guides[0];
  for (const g of guides) if (g.getBoundingClientRect().top <= 140) current = g;
  for (const tab of document.querySelectorAll('#index .tab')) {
    tab.classList.toggle('on', !!current && `g-${tab.dataset.key}` === current.id);
  }
}

addEventListener('scroll', () => requestAnimationFrame(markIndex), { passive: true });

function emptyText(total, filtered) {
  if (filtered && total) return 'Nothing matches your search.';
  if (state.view !== 'all') return 'This project is empty.';
  return 'Nothing saved yet. Click ☆ under any answer on Claude, ChatGPT, Gemini, Perplexity or Grok to save it here.';
}

function matches(item, search) {
  if (!search) return true;
  const hay = `${item.question}\n${item.text}\n${item.chatTitle}`.toLowerCase();
  return search.toLowerCase().split(/\s+/).filter(Boolean).every(word => hay.includes(word));
}

function renderSidebar(projects, items, trash) {
  const counts = new Map();
  for (const it of items) counts.set(it.projectId, (counts.get(it.projectId) || 0) + 1);

  const nav = $('projects');
  nav.replaceChildren(navRow('all', 'All saved', items.length));
  if (projects.length) nav.append(h('div', 'nav-label', 'Projects'));
  const sorted = [...projects].sort((a, b) => a.name.localeCompare(b.name));
  for (const p of sorted) nav.append(navRow(p.id, p.name, counts.get(p.id) || 0));

  // "+ New project": name it, then open it.
  const add = h('button', 'nav-new', '+ New project');
  add.type = 'button';
  add.addEventListener('click', async () => {
    const id = await pickedProject(NEW_PROJECT);
    if (!id) return;
    stopSelecting();
    state.view = id;
    render();
  });
  nav.append(add);

  const bin = navRow('trash', 'Recently deleted', trash.length);
  bin.classList.add('nav-trash');
  nav.append(bin);
}

// ---------- Recently deleted ----------

function renderTrash(trash) {
  renderIndex([]);
  $('title').textContent = 'Recently deleted';
  $('count').textContent = `${trash.length} item${trash.length === 1 ? '' : 's'}`;
  const list = $('list');
  list.replaceChildren();
  if (!trash.length) {
    list.append(h('p', 'empty', 'Nothing deleted.'));
    return;
  }
  for (const entry of [...trash].sort((a, b) => b.deletedAt - a.deletedAt)) {
    list.append(trashCard(entry));
  }
}

function trashCard(entry) {
  const card = h('article', 'item deleted');
  const meta = h('div', 'meta');
  const deleted = when(entry.deletedAt, 'deleted ');
  const body = h('div', 'body');

  if (entry.kind === 'project') {
    const n = entry.items.length;
    meta.append(h('span', 'kind', 'Project'), h('span', 'details', `${n} item${n === 1 ? '' : 's'}`), deleted);
    body.append(h('div', 'question', entry.project.name));
    card.append(meta, body);
  } else {
    const item = entry.items[0];
    meta.append(aiMark(item.ai));
    const from = entry.project ? `from ${entry.project.name}` : '';
    const details = [from, item.chatTitle].filter(Boolean).join(' · ');
    if (details) meta.append(h('span', 'details', details));
    meta.append(deleted);
    card.append(meta, body);
    if (item.question) body.append(h('div', 'question', item.question));
    const text = h('div', 'text md short');
    text.append(renderMarkdown(item.text));
    body.append(text);
    requestAnimationFrame(() => text.classList.toggle('clipped', text.scrollHeight > text.clientHeight + 2));
  }

  const actions = h('div', 'item-actions');
  actions.append(h('span', 'spacer'));
  const restore = h('button', '', 'Restore');
  restore.title = entry.kind === 'project' ? 'Put the project and its answers back' : 'Put this answer back in its project';
  restore.addEventListener('click', () => restoreFromTrash(entry.id));
  const forever = h('button', 'danger', 'Delete forever');
  forever.addEventListener('click', () => {
    if (confirm('Delete this forever? This can’t be undone.')) deleteFromTrash(entry.id);
  });
  actions.append(restore, forever);
  body.append(actions);
  return card;
}

// Which AI an answer came from: its name with a small dot in that AI's own colour (set in
// library.css by data-ai), so answers from different AIs can be told apart at a glance.
// Right-click saves have no AI: "Web clip".
function aiMark(ai) {
  const mark = h('span', 'ai');
  mark.dataset.ai = ai || '';
  mark.append(h('span', 'ai-dot'), document.createTextNode(ai || 'Web clip'));
  return mark;
}

// "2 h ago", "Yesterday", "Oct 14"…; the full date and time on hover.
function when(ms, prefix = '') {
  const el = h('time', 'when', prefix + timeAgo(ms));
  const date = new Date(ms);
  el.dateTime = date.toISOString();
  el.title = date.toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' });
  return el;
}

function timeAgo(ms) {
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours} h ago`;
  const day = d => new Date(d).setHours(0, 0, 0, 0);
  const days = Math.round((day(Date.now()) - day(ms)) / 86400000);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  const date = new Date(ms);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, sameYear
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' });
}

function navRow(view, name, count) {
  const row = h('button', 'nav-item');
  if (view === state.view) row.classList.add('active');
  row.append(h('span', 'nav-name', name), h('span', 'nav-count', String(count)));
  row.title = name;
  row.addEventListener('click', () => {
    if (state.view !== view) stopSelecting();
    state.view = view;
    render();
  });
  return row;
}

// The AI filter lists only the AIs that have saved items.
function renderAiFilter(items) {
  const select = $('ai-filter');
  const ais = [...new Set(items.map(it => it.ai).filter(Boolean))].sort();
  if (state.ai && !ais.includes(state.ai)) state.ai = '';
  select.replaceChildren(new Option('All AIs', ''), ...ais.map(ai => new Option(ai, ai)));
  select.value = state.ai;
}

function itemCard(item, projects, projectName, selectable) {
  const card = h('article', 'item');
  card.classList.toggle('selected', state.selected.has(item.id));

  const meta = h('div', 'meta');
  if (selectable) {
    const tick = h('input', 'tick');
    tick.type = 'checkbox';
    tick.title = 'Select (to move or delete several at once)';
    tick.checked = state.selected.has(item.id);
    tick.addEventListener('change', () => {
      if (tick.checked) state.selected.add(item.id);
      else state.selected.delete(item.id);
      card.classList.toggle('selected', tick.checked);
      renderSelectionBar();
    });
    meta.append(tick);
  }
  meta.append(aiMark(item.ai));
  const details = [item.chatTitle, projectName].filter(Boolean).join(' · ');
  if (details) meta.append(h('span', 'details', details));
  meta.append(when(item.createdAt));
  const body = h('div', 'body');
  card.append(meta, body);

  if (item.question) body.append(h('div', 'question', item.question));

  const text = h('div', 'text md');
  text.append(renderMarkdown(item.text));
  const open = state.expanded.has(item.id);
  text.classList.toggle('open', open);
  body.append(text);

  const actions = h('div', 'item-actions');
  // Only offer "Show more" when the text is actually cut off; a cut-off preview fades out.
  const more = h('button', 'link', open ? 'Show less' : 'Show more');
  more.hidden = true;
  requestAnimationFrame(() => {
    const cut = text.scrollHeight > text.clientHeight + 2;
    more.hidden = !open && !cut;
    text.classList.toggle('clipped', !open && cut);
  });
  more.addEventListener('click', () => {
    if (state.expanded.has(item.id)) state.expanded.delete(item.id);
    else state.expanded.add(item.id);
    const nowOpen = state.expanded.has(item.id);
    text.classList.toggle('open', nowOpen);
    text.classList.toggle('clipped', !nowOpen);
    more.textContent = nowOpen ? 'Show less' : 'Show more';
  });
  actions.append(more, h('span', 'spacer'));

  // One clear action per card (Open chat, the gold one, last). Copy stays visible but quiet;
  // Move and Delete only show while the card is hovered or has keyboard focus (item-tools).
  const tools = h('div', 'item-tools');

  const move = h('select', 'move quiet');
  move.title = 'Move to another project';
  fillProjectMenu(move, projects, 'Move to…');
  const here = [...move.options].find(o => o.value === item.projectId);
  if (here) {
    here.disabled = true;
    here.textContent += ' (here)';
  }
  move.value = '';
  move.addEventListener('change', async () => {
    const projectId = await pickedProject(move.value);
    move.value = '';
    if (projectId && projectId !== item.projectId) moveItem(item.id, projectId);
  });

  const del = h('button', 'quiet danger', 'Delete');
  del.title = 'Delete this saved answer (you can undo)';
  del.addEventListener('click', async () => {
    const entry = await deleteItem(item.id);
    if (entry) showUndo('Moved to Recently deleted.', () => restoreFromTrash(entry.id));
  });
  tools.append(move, del);
  actions.append(tools);

  const copy = h('button', 'quiet', 'Copy');
  copy.title = 'Copy the answer text';
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(item.text);
      copy.textContent = 'Copied ✓';
    } catch (e) {
      copy.textContent = 'Couldn’t copy';
    }
    setTimeout(() => { copy.textContent = 'Copy'; }, 1500);
  });
  actions.append(copy);

  if (item.url) {
    // Right-click saves have no convId: just open the page they came from.
    const go = h('button', 'primary', item.convId ? 'Open chat' : 'Open page');
    go.title = item.convId ? 'Open the chat and jump to this answer' : 'Open the page this was saved from';
    go.addEventListener('click', () => openInChat(item));
    actions.append(go);
  }

  body.append(actions);
  return card;
}

// ---------- Move menus ----------

const NEW_PROJECT = '__new__';

// Projects A–Z, then "+ New project…". placeholder = a first, non-project line.
function fillProjectMenu(select, projects, placeholder) {
  const sorted = [...projects].sort((a, b) => a.name.localeCompare(b.name));
  select.replaceChildren(
    ...(placeholder ? [new Option(placeholder, '')] : []),
    ...sorted.map(p => new Option(p.name, p.id)),
    new Option('+ New project…', NEW_PROJECT)
  );
}

// The project chosen in a move menu: an existing one, or a new one named by the user.
// Returns null when cancelled.
async function pickedProject(value) {
  if (value !== NEW_PROJECT) return value || null;
  const name = prompt('Name of the new project:');
  if (!name || !normalize(name)) return null;
  const project = await addProject(name); // same name as an existing project → that one
  return project.id;
}

// ---------- Selecting several ----------

// The bar above the list while selecting: count, select all, move, delete, done.
// projects is passed on a full redraw; ticking a box only updates the count.
function renderSelectionBar(projects) {
  const n = state.selected.size;
  $('selection-bar').hidden = !state.selecting;
  $('select-mode').hidden = state.selecting;
  $('selected-count').textContent = n ? `${n} selected` : 'Tick the answers to move or delete';
  $('bulk-move').disabled = $('bulk-delete').disabled = !n;
  const all = $('select-all');
  all.checked = n > 0 && n === state.shownIds.length;
  all.indeterminate = n > 0 && n < state.shownIds.length;
  all.title = all.checked ? 'Unselect all' : `Select all ${state.shownIds.length}`;
  if (projects) fillProjectMenu($('bulk-move'), projects, 'Move to…');
}

function startSelecting() {
  state.selecting = true;
  render();
}

function stopSelecting() {
  state.selecting = false;
  state.selected.clear();
}

async function moveSelected() {
  const select = $('bulk-move');
  const projectId = await pickedProject(select.value);
  select.value = '';
  if (!projectId) return;
  const ids = [...state.selected];
  state.selected.clear();
  await moveItems(ids, projectId);
}

async function deleteSelected() {
  const ids = [...state.selected];
  state.selected.clear();
  const entries = await deleteItems(ids);
  if (!entries.length) return;
  const n = entries.length;
  showUndo(`Moved ${n} item${n === 1 ? '' : 's'} to Recently deleted.`, async () => {
    for (const entry of entries) await restoreFromTrash(entry.id);
  });
}

function setAllSelected(on) {
  state.selected = new Set(on ? state.shownIds : []);
  render();
}

// ---------- Actions ----------

// Same as a panel click from another chat: remember the jump, then open the chat.
// The chat's page picks up pendingJump once it loads and scrolls to the answer.
async function openInChat(item) {
  await setPendingJump(item.id, item.url, null);
  chrome.tabs.create({ url: item.url });
}

async function currentProject() {
  const { projects } = await getData();
  return projects.find(p => p.id === state.view) || null;
}

// Swap the title for a text box. Enter or clicking away saves, Esc cancels.
async function startRename() {
  const project = await currentProject();
  if (!project || renaming) return;
  renaming = true;

  const title = $('title');
  const input = h('input', 'rename-box');
  input.value = project.name;
  title.replaceChildren(input);
  input.focus();
  input.select();

  let done = false;
  const finish = async save => {
    if (done) return;
    done = true;
    const name = input.value;
    renaming = false;
    if (save && normalize(name) && normalize(name) !== project.name) {
      await renameProject(project.id, name); // storage change redraws the page
    } else {
      render();
    }
  };
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') finish(true);
    if (e.key === 'Escape') finish(false);
  });
  input.addEventListener('blur', () => finish(true));
}

async function exportProject() {
  const project = await currentProject();
  if (!project) return;
  const markdown = await exportProjectMarkdown(project.id);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown' }));
  a.download = `${project.name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'project'}.md`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function removeProject() {
  const project = await currentProject();
  if (!project) return;
  const n = (await itemsForProject(project.id)).length;
  const what = n ? ` and its ${n} saved item${n === 1 ? '' : 's'}` : '';
  if (!confirm(`Delete the project “${project.name}”${what}?`)) return;
  const removed = await deleteProject(project.id);
  if (!removed) return;
  state.view = 'all';
  render();
  showUndo(`Deleted “${project.name}”${n ? ` and ${n} item${n === 1 ? '' : 's'}` : ''}.`, () => restoreFromTrash(removed.id));
}

// Bar at the bottom for 8 s. A newer one replaces it (the older delete stays done).
let undoTimer = null;
let undoAction = null;

function showUndo(text, action) {
  $('undo-text').textContent = text;
  $('undo').hidden = false;
  undoAction = action;
  clearTimeout(undoTimer);
  undoTimer = setTimeout(hideUndo, 8000);
}

function hideUndo() {
  $('undo').hidden = true;
  undoAction = null;
  clearTimeout(undoTimer);
}

// ---------- Start ----------

$('search').addEventListener('input', e => {
  state.search = e.target.value.trim();
  render();
});
$('ai-filter').addEventListener('change', e => {
  state.ai = e.target.value;
  render();
});
$('rename').addEventListener('click', startRename);
$('export').addEventListener('click', exportProject);
$('delete').addEventListener('click', removeProject);
$('select-all').addEventListener('change', e => setAllSelected(e.target.checked));
$('bulk-move').addEventListener('change', moveSelected);
$('bulk-delete').addEventListener('click', deleteSelected);
$('bulk-done').addEventListener('click', () => {
  stopSelecting();
  render();
});
$('select-mode').addEventListener('click', startSelecting);
$('empty-trash').addEventListener('click', () => {
  if (confirm('Delete everything in Recently deleted forever? This can’t be undone.')) emptyTrash();
});
$('undo-btn').addEventListener('click', async () => {
  const action = undoAction;
  hideUndo();
  if (action) await action();
});

// Light or dark look: the "Dark mode" switch at the bottom of the sidebar. The page stays
// hidden until the saved choice is applied (library.css), so it never flashes the other look.
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $('theme-toggle').setAttribute('aria-checked', String(theme === 'dark'));
}

$('theme-toggle').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  setTheme(next);
});

// Saves, moves and deletes made anywhere (other tabs, the chat sites) show up right away;
// so does a theme switched in another Library tab.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.theme) applyTheme(changes.theme.newValue === 'dark' ? 'dark' : 'light');
  if (changes.items || changes.projects || changes.trash) render();
});

getTheme().then(applyTheme, () => applyTheme('light'));
render();
