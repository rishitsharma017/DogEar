// All storage read/write + markdown export.
// Loaded by content scripts, background.js and library.html, so it must not touch the page.

// ---------- Text helpers ----------

// Collapse all whitespace so the same answer always gives the same hash.
function normalize(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

// Small, fast string hash (FNV-1a, 32-bit) → 8 hex characters.
function hashText(text) {
  const s = normalize(text);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function makePrefix(text) {
  return normalize(text).slice(0, 120);
}

function uid() {
  return crypto.randomUUID();
}

// ---------- Reading ----------

async function getData() {
  return chrome.storage.local.get({ projects: [], items: [], lastProjectId: null, trash: [] });
}

async function itemsForConv(convId) {
  if (!convId) return [];
  const { items } = await getData();
  return items.filter(it => it.convId === convId);
}

async function itemsForProject(projectId) {
  const { items } = await getData();
  return items.filter(it => it.projectId === projectId);
}

async function getLastProject() {
  const { projects, lastProjectId } = await getData();
  return projects.find(p => p.id === lastProjectId) || null;
}

// ---------- Writing ----------

// Every write waits for the previous one, so two quick saves can't overwrite each other.
let writeQueue = Promise.resolve();

function queued(task) {
  const run = writeQueue.then(task);
  writeQueue = run.catch(() => {});
  return run;
}

function update(change) {
  return queued(async () => {
    const data = await getData();
    const result = change(data);
    await chrome.storage.local.set(data);
    return result;
  });
}

// Returns the existing project if one with the same name exists (ignoring case).
function addProject(name) {
  name = normalize(name);
  if (!name) return Promise.reject(new Error('Project name is empty'));
  return update(data => {
    const existing = data.projects.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    const project = { id: uid(), name, createdAt: Date.now() };
    data.projects.push(project);
    return project;
  });
}

function ensureInbox() {
  return addProject('Inbox');
}

function renameProject(projectId, name) {
  name = normalize(name);
  if (!name) return Promise.reject(new Error('Project name is empty'));
  return update(data => {
    const project = data.projects.find(p => p.id === projectId);
    if (project) project.name = name;
    return project || null;
  });
}

// ---------- Recently deleted ----------
// Deleted projects and items go to `trash` first, so they can be restored.
// trash: [{ id, kind: 'project' | 'item', deletedAt, project, items }]
// (for an item, project = the project it was in, so it can go back there)

const TRASH_DAYS = 30;

function addToTrash(data, kind, project, items) {
  const cutoff = Date.now() - TRASH_DAYS * 24 * 60 * 60 * 1000;
  data.trash = data.trash.filter(t => t.deletedAt > cutoff);
  const entry = { id: uid(), kind, deletedAt: Date.now(), project: project || null, items };
  data.trash.push(entry);
  return entry;
}

// Deletes the project and its items (into trash). Returns the trash entry.
function deleteProject(projectId) {
  return update(data => {
    const project = data.projects.find(p => p.id === projectId);
    if (!project) return null;
    const items = data.items.filter(it => it.projectId === projectId);
    data.projects = data.projects.filter(p => p.id !== projectId);
    data.items = data.items.filter(it => it.projectId !== projectId);
    if (data.lastProjectId === projectId) data.lastProjectId = null;
    return addToTrash(data, 'project', project, items);
  });
}

// Puts a trash entry back. If its project was deleted meanwhile, the project comes back too.
function restoreFromTrash(entryId) {
  return update(data => {
    const entry = data.trash.find(t => t.id === entryId);
    if (!entry) return null;
    data.trash = data.trash.filter(t => t.id !== entryId);
    if (entry.project && !data.projects.some(p => p.id === entry.project.id)) {
      data.projects.push(entry.project);
    }
    const have = new Set(data.items.map(it => it.id));
    data.items.push(...entry.items.filter(it => !have.has(it.id)));
    return entry;
  });
}

function deleteFromTrash(entryId) {
  return update(data => {
    data.trash = data.trash.filter(t => t.id !== entryId);
  });
}

function emptyTrash() {
  return update(data => {
    data.trash = [];
  });
}

// fields: { projectId, ai, text, plain?, question, chatTitle, url, convId, msgId, pos? }
// pos = where the answer sat in the chat (0 = top, 1 = bottom), a hint for jumping back.
// plain = the answer as plain page text; hash/prefix come from it so the page can find it again.
function addItem(fields) {
  const source = fields.plain != null ? fields.plain : fields.text;
  if (!fields.projectId) return Promise.reject(new Error('addItem needs a projectId'));
  return update(data => {
    const item = {
      id: uid(),
      projectId: fields.projectId,
      ai: fields.ai || '',
      text: fields.text || '',
      question: fields.question || '',
      chatTitle: fields.chatTitle || '',
      url: fields.url || '',
      convId: fields.convId || '',
      msgId: fields.msgId || '',
      pos: typeof fields.pos === 'number' ? fields.pos : null,
      hash: hashText(source),
      prefix: makePrefix(source),
      createdAt: Date.now()
    };
    data.items.push(item);
    data.lastProjectId = item.projectId;
    return item;
  });
}

function moveItem(itemId, projectId) {
  return update(data => {
    const item = data.items.find(it => it.id === itemId);
    if (!item) return null;
    item.projectId = projectId;
    data.lastProjectId = projectId;
    return item;
  });
}

// Items saved before pos existed get it the first time they're found, so later jumps are quick.
function setItemPos(itemId, pos) {
  return update(data => {
    const item = data.items.find(it => it.id === itemId);
    if (item) item.pos = pos;
  });
}

// Moves the item to trash. Returns the trash entry (or null).
function deleteItem(itemId) {
  return update(data => {
    const item = data.items.find(it => it.id === itemId);
    if (!item) return null;
    data.items = data.items.filter(it => it.id !== itemId);
    const project = data.projects.find(p => p.id === item.projectId);
    return addToTrash(data, 'item', project, [item]);
  });
}

// ---------- Jump to a message in another chat ----------

// Saved just before opening another chat; read by that chat once it has loaded.
// panelView = what the Alt+B panel showed, so it can reopen the same way after a reload.
function setPendingJump(itemId, url, panelView) {
  return queued(() => chrome.storage.local.set({
    pendingJump: { itemId, url, time: Date.now(), panelView: panelView || null }
  }));
}

async function getPendingJump() {
  const { pendingJump } = await chrome.storage.local.get({ pendingJump: null });
  return pendingJump;
}

function clearPendingJump() {
  return queued(() => chrome.storage.local.remove('pendingJump'));
}

// ---------- Panel position ----------

// Where the user dragged the Alt+B panel: { left, top } in px, or null (default spot).
async function getPanelPos() {
  const { panelPos } = await chrome.storage.local.get({ panelPos: null });
  return panelPos;
}

function setPanelPos(pos) {
  return queued(() => chrome.storage.local.set({ panelPos: pos }));
}

// ---------- Markdown export ----------

async function exportProjectMarkdown(projectId) {
  const { projects, items } = await getData();
  const project = projects.find(p => p.id === projectId);
  if (!project) return '';
  const list = items
    .filter(it => it.projectId === projectId)
    .sort((a, b) => a.createdAt - b.createdAt);

  const day = ms => new Date(ms).toISOString().slice(0, 10);
  const lines = [
    `# ${project.name}`,
    '',
    `_Exported ${day(Date.now())} · ${list.length} item${list.length === 1 ? '' : 's'}_`,
    ''
  ];

  for (const it of list) {
    lines.push('---', '');
    lines.push(`## ${it.chatTitle || it.ai || 'Saved item'}`, '');
    const meta = [`**AI:** ${it.ai || 'unknown'}`, `**Saved:** ${day(it.createdAt)}`];
    if (it.url) meta.push(`[Open chat](${it.url})`);
    lines.push(meta.join(' · '), '');
    if (it.question) {
      lines.push(...it.question.split('\n').map(l => `> ${l}`), '');
    }
    lines.push(it.text, '');
  }
  return lines.join('\n');
}
