// Library page: projects sidebar, item list, search, filter, export. (Step 8)
// All storage goes through common.js. Saved text is only ever put in the page with textContent.

const $ = id => document.getElementById(id);

function h(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
}

const state = {
  view: 'all',        // 'all', 'trash' or a projectId
  search: '',
  ai: '',             // '' = every AI
  expanded: new Set() // ids of items showing their full text
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
  if (inTrash) return renderTrash(trash);

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

  const list = $('list');
  list.replaceChildren();
  if (!shown.length) {
    list.append(h('p', 'empty', emptyText(inView.length, filtered)));
    return;
  }
  const names = new Map(projects.map(p => [p.id, p.name]));
  for (const item of shown) list.append(itemCard(item, projects, project ? null : names.get(item.projectId)));
}

function emptyText(total, filtered) {
  if (filtered && total) return 'Nothing matches your search.';
  if (state.view !== 'all') return 'This project is empty.';
  return 'Nothing saved yet. Hover over an answer on claude.ai and click ☆ to save it.';
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

  const bin = navRow('trash', 'Recently deleted', trash.length);
  bin.classList.add('nav-trash');
  nav.append(bin);
}

// ---------- Recently deleted ----------

function renderTrash(trash) {
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
  const deleted = `deleted ${new Date(entry.deletedAt).toLocaleDateString()}`;
  const meta = h('div', 'meta');

  if (entry.kind === 'project') {
    const n = entry.items.length;
    meta.append(h('span', 'ai', 'Project'), h('span', 'details', `${n} item${n === 1 ? '' : 's'} · ${deleted}`));
    card.append(meta, h('div', 'question', entry.project.name));
  } else {
    const item = entry.items[0];
    if (item.ai) meta.append(h('span', 'ai', item.ai));
    const from = entry.project ? `from ${entry.project.name}` : '';
    const details = [from, item.chatTitle, deleted].filter(Boolean);
    meta.append(h('span', 'details', details.join(' · ')));
    card.append(meta);
    if (item.question) card.append(h('div', 'question', item.question));
    card.append(h('div', 'text short', item.text));
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
  card.append(actions);
  return card;
}

function navRow(view, name, count) {
  const row = h('button', 'nav-item');
  if (view === state.view) row.classList.add('active');
  row.append(h('span', 'nav-name', name), h('span', 'nav-count', String(count)));
  row.title = name;
  row.addEventListener('click', () => {
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

function itemCard(item, projects, projectName) {
  const card = h('article', 'item');

  const meta = h('div', 'meta');
  if (item.ai) meta.append(h('span', 'ai', item.ai));
  const details = [item.chatTitle, projectName, new Date(item.createdAt).toLocaleDateString()].filter(Boolean);
  meta.append(h('span', 'details', details.join(' · ')));
  card.append(meta);

  if (item.question) card.append(h('div', 'question', item.question));

  const text = h('div', 'text', item.text);
  const open = state.expanded.has(item.id);
  text.classList.toggle('open', open);
  card.append(text);

  const actions = h('div', 'item-actions');
  // Only offer "Show more" when the text is actually cut off.
  const more = h('button', 'link', open ? 'Show less' : 'Show more');
  more.hidden = true;
  requestAnimationFrame(() => { more.hidden = !open && text.scrollHeight <= text.clientHeight + 2; });
  more.addEventListener('click', () => {
    if (state.expanded.has(item.id)) state.expanded.delete(item.id);
    else state.expanded.add(item.id);
    const nowOpen = state.expanded.has(item.id);
    text.classList.toggle('open', nowOpen);
    more.textContent = nowOpen ? 'Show less' : 'Show more';
  });
  actions.append(more, h('span', 'spacer'));

  if (item.url) {
    // Right-click saves have no convId: just open the page they came from.
    const go = h('button', '', item.convId ? 'Open chat' : 'Open page');
    go.title = item.convId ? 'Open the chat and jump to this answer' : 'Open the page this was saved from';
    go.addEventListener('click', () => openInChat(item));
    actions.append(go);
  }

  const copy = h('button', '', 'Copy');
  copy.title = 'Copy the answer text';
  copy.addEventListener('click', async () => {
    await navigator.clipboard.writeText(item.text);
    copy.textContent = 'Copied ✓';
    setTimeout(() => { copy.textContent = 'Copy'; }, 1500);
  });
  actions.append(copy);

  const move = h('select', 'move');
  move.title = 'Move to another project';
  for (const p of [...projects].sort((a, b) => a.name.localeCompare(b.name))) {
    move.append(new Option(p.name, p.id));
  }
  move.value = item.projectId;
  move.addEventListener('change', () => moveItem(item.id, move.value));
  actions.append(move);

  const del = h('button', 'danger', 'Delete');
  del.title = 'Delete this saved answer';
  del.addEventListener('click', async () => {
    const entry = await deleteItem(item.id);
    if (entry) showUndo('Moved to Recently deleted.', () => restoreFromTrash(entry.id));
  });
  actions.append(del);

  card.append(actions);
  return card;
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
$('empty-trash').addEventListener('click', () => {
  if (confirm('Delete everything in Recently deleted forever? This can’t be undone.')) emptyTrash();
});
$('undo-btn').addEventListener('click', async () => {
  const action = undoAction;
  hideUndo();
  if (action) await action();
});

// Saves, moves and deletes made anywhere (other tabs, the chat sites) show up right away.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.items || changes.projects || changes.trash)) render();
});

render();
