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

// Inbox holds right-click saves from any website. Found by its name.
const INBOX_NAME = 'Inbox';

function ensureInbox() {
  return addProject(INBOX_NAME);
}

// Notes holds answers the user wrote a note on without picking a project. Found by its name.
const NOTES_NAME = 'Notes';

function ensureNotes() {
  return addProject(NOTES_NAME);
}

function isInbox(project) {
  return !!project && project.name.toLowerCase() === INBOX_NAME.toLowerCase();
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

// fields: { projectId, ai, text, plain?, question, chatTitle, url, convId, msgId, pos?, fromEnd?, note? }
// pos = where the answer sat in the chat (0 = top, 1 = bottom), a hint for jumping back.
// fromEnd = px from the answer to the end of the chat: the better hint, since sites load
// older messages at the top and that changes pos but not fromEnd.
// plain = the answer as plain page text; hash/prefix come from it so the page can find it again.
// remember = make this the last-used project (the ☆ picker's default). Right-click saves don't.
function addItem(fields, { remember = true } = {}) {
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
      fromEnd: typeof fields.fromEnd === 'number' ? fields.fromEnd : null,
      note: normalize(fields.note).slice(0, 120),
      hash: hashText(source),
      prefix: makePrefix(source),
      createdAt: Date.now()
    };
    data.items.push(item);
    if (remember) data.lastProjectId = item.projectId;
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

// Items saved before these hints existed get them the first time they're found, so later
// jumps are quick.
function setItemHints(itemId, pos, fromEnd) {
  return update(data => {
    const item = data.items.find(it => it.id === itemId);
    if (!item) return;
    item.pos = pos;
    item.fromEnd = fromEnd;
  });
}

// A short label the user gives a saved answer, shown instead of its question ('' removes it).
function setItemNote(itemId, note) {
  note = normalize(note).slice(0, 120);
  return update(data => {
    const item = data.items.find(it => it.id === itemId);
    if (item) item.note = note;
    return item || null;
  });
}

// Moves the item to trash. Returns the trash entry (or null).
function deleteItem(itemId) {
  return deleteItems([itemId]).then(entries => entries[0] || null);
}

// Several items in one write. Each gets its own trash entry so each can be restored.
function deleteItems(itemIds) {
  const ids = new Set(itemIds);
  return update(data => {
    const removed = data.items.filter(it => ids.has(it.id));
    data.items = data.items.filter(it => !ids.has(it.id));
    return removed.map(item => {
      const project = data.projects.find(p => p.id === item.projectId);
      return addToTrash(data, 'item', project, [item]);
    });
  });
}

function moveItems(itemIds, projectId) {
  const ids = new Set(itemIds);
  return update(data => {
    for (const item of data.items) if (ids.has(item.id)) item.projectId = projectId;
    data.lastProjectId = projectId;
  });
}

// ---------- Jump to a message in another chat ----------

// Saved just before opening another chat; read by that chat once it has loaded.
// panelView = what the Alt+B panel showed and panelScroll = how far its list was scrolled,
// so it can reopen the same way after a reload.
function setPendingJump(itemId, url, panelView, panelScroll) {
  return queued(() => chrome.storage.local.set({
    pendingJump: { itemId, url, time: Date.now(), panelView: panelView || null, panelScroll: panelScroll || 0 }
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

// ---------- Theme ----------

// The user's choice of light or dark look ('light' or 'dark'); light until they switch.
async function getTheme() {
  const { theme } = await chrome.storage.local.get({ theme: 'light' });
  return theme === 'dark' ? 'dark' : 'light';
}

function setTheme(theme) {
  return queued(() => chrome.storage.local.set({ theme: theme === 'dark' ? 'dark' : 'light' }));
}

// ---------- Backup ----------
// A backup is one JSON file with every project, saved answer and Recently deleted entry.
// background.js saves one to Downloads/AI Chat Bookmarks/ every week (and on "Back up now");
// the Library's "Restore backup…" adds one back.

const BACKUP_APP = 'ai-chat-bookmarks';

async function makeBackup() {
  const { projects, items, trash } = await getData();
  return { app: BACKUP_APP, version: 1, savedAt: Date.now(), projects, items, trash };
}

function isBackup(data) {
  return !!data && data.app === BACKUP_APP && Array.isArray(data.projects) && Array.isArray(data.items);
}

// When the last backup was saved, the backup files kept ([{ id }], download ids, oldest
// first), and whether the weekly backup is on (it is unless the user switched it off).
async function getBackupInfo() {
  const { backupAt, backupFiles, backupAuto } =
    await chrome.storage.local.get({ backupAt: null, backupFiles: [], backupAuto: true });
  return { backupAt, backupFiles, backupAuto: backupAuto !== false };
}

function setBackupAuto(on) {
  return queued(() => chrome.storage.local.set({ backupAuto: !!on }));
}

function setBackupInfo(backupAt, backupFiles) {
  return queued(() => chrome.storage.local.set({ backupAt, backupFiles }));
}

// Adds a backup to what's saved now; nothing already here changes.
// - A project with the same name (ignoring case) gets the backup's answers, no second copy.
// - An answer already here (same id, or the same message of the same chat) is skipped.
// - Recently deleted entries already here, or older than 30 days, are skipped.
// Returns the ids it added ({ projects, items, trash }), for "Undo".
function restoreBackup(backup) {
  if (!isBackup(backup)) return Promise.reject(new Error('Not a backup'));
  return update(data => {
    const added = { projects: [], items: [], trash: [] };
    const projectFor = new Map(); // backup project id → project id here
    for (const p of backup.projects) {
      if (!p || !p.id || !normalize(p.name)) continue;
      const name = normalize(p.name);
      const here = data.projects.find(q => q.id === p.id)
        || data.projects.find(q => q.name.toLowerCase() === name.toLowerCase());
      if (here) {
        projectFor.set(p.id, here.id);
      } else {
        data.projects.push({ id: p.id, name, createdAt: p.createdAt || Date.now() });
        projectFor.set(p.id, p.id);
        added.projects.push(p.id);
      }
    }
    const ids = new Set(data.items.map(it => it.id));
    const messages = new Set(data.items.filter(it => it.msgId).map(it => it.convId + '|' + it.msgId));
    for (const it of backup.items) {
      if (!it || !it.id || ids.has(it.id)) continue;
      if (it.msgId && messages.has(it.convId + '|' + it.msgId)) continue;
      const projectId = projectFor.get(it.projectId)
        || (data.projects.some(p => p.id === it.projectId) ? it.projectId : null);
      if (!projectId) continue;
      data.items.push({ ...it, projectId });
      ids.add(it.id);
      added.items.push(it.id);
    }
    const cutoff = Date.now() - TRASH_DAYS * 24 * 60 * 60 * 1000;
    const inTrash = new Set(data.trash.map(t => t.id));
    for (const t of backup.trash || []) {
      if (!t || !t.id || inTrash.has(t.id) || !(t.deletedAt > cutoff)) continue;
      data.trash.push(t);
      added.trash.push(t.id);
    }
    return added;
  });
}

// "Undo" after a restore: takes out exactly what it added (a project it added stays if
// something was saved into it since).
function undoRestore(added) {
  return update(data => {
    const projects = new Set(added.projects);
    const items = new Set(added.items);
    const trash = new Set(added.trash);
    data.items = data.items.filter(it => !items.has(it.id));
    data.projects = data.projects.filter(p => !projects.has(p.id) || data.items.some(it => it.projectId === p.id));
    data.trash = data.trash.filter(t => !trash.has(t.id));
  });
}

// ---------- Dates ----------

// "just now", "5 min ago", "2 h ago", "Yesterday", "3 days ago", then "Oct 14" (with the year
// when it's another year). Used by the Library and the Alt+B panel.
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
    if (it.note) meta.unshift(`**Note:** ${it.note}`);
    if (it.url) meta.push(`[Open chat](${it.url})`);
    lines.push(meta.join(' · '), '');
    if (it.question) {
      lines.push(...it.question.split('\n').map(l => `> ${l}`), '');
    }
    lines.push(it.text, '');
  }
  return lines.join('\n');
}

// A project as one message to paste into any AI and carry on the research: a short brief,
// then every answer (oldest first) with the AI, the chat, the date and the question asked.
// Right-click saves (no AI) are listed as web clips.
async function projectPrompt(projectId) {
  const { projects, items } = await getData();
  const project = projects.find(p => p.id === projectId);
  if (!project) return '';
  const list = items
    .filter(it => it.projectId === projectId)
    .sort((a, b) => a.createdAt - b.createdAt);
  const ais = [...new Set(list.map(it => it.ai || 'web clips'))];
  const from = ais.length > 1 ? `${ais.slice(0, -1).join(', ')} and ${ais[ais.length - 1]}` : ais[0] || '';
  const n = list.length;
  const day = ms => new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  const lines = [
    `I'm researching "${project.name}". Below ${n === 1 ? 'is 1 answer' : `are ${n} answers`} I collected from ${from}.`,
    'Read them, then help me continue this research. Point out where they disagree or where something looks wrong.',
    ''
  ];
  list.forEach((it, i) => {
    const where = [it.ai || 'Web clip', it.chatTitle && `"${it.chatTitle}"`, day(it.createdAt)].filter(Boolean);
    lines.push(`--- ${i + 1}. ${where.join(' · ')} ---`);
    if (it.note) lines.push(`My note: ${it.note}`);
    if (it.question) lines.push(`Question: ${it.question}`);
    lines.push(it.question ? 'Answer:' : 'Text:', it.text, '');
  });
  return lines.join('\n').trim() + '\n';
}
