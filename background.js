// Background service worker: toolbar icon, right-click menu, Alt+B command, weekly backup.
importScripts('common.js');

// Toolbar icon → open the Library in a new tab.
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('library.html') });
});

// ---------- Right-click "Save selection" ----------

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'save-selection',
    title: 'Save selection to AI Chat Bookmarks',
    contexts: ['selection']
  });
});

// Saves into "Inbox" (kept apart from the chat projects; move items out in the Library),
// then shows ✓ on the icon for 2 s.
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'save-selection') return;
  try {
    const text = (await selectionWithLineBreaks(tab, info.frameId)) || info.selectionText || '';
    if (!normalize(text)) return;
    const project = await ensureInbox();
    await addItem({
      projectId: project.id,
      text,
      chatTitle: (tab && tab.title) || '',
      url: (tab && tab.url) || info.pageUrl || ''
    }, { remember: false });
    flashBadge('✓', '#2e7d32', tab);
  } catch (err) {
    console.error('AI Chat Bookmarks: save failed', err);
    flashBadge('!', '#b3261e', tab);
  }
});

// info.selectionText squashes everything onto one line, so read the selection from the
// page itself. Some pages don't allow it (chrome:// pages, the PDF viewer) → null.
async function selectionWithLineBreaks(tab, frameId) {
  if (!tab || tab.id == null) return null;
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id, frameIds: [frameId || 0] }, // the frame the user right-clicked in
      func: () => String(window.getSelection()).trim()
    });
    return result && result.result;
  } catch {
    return null;
  }
}

function flashBadge(text, color, tab) {
  const tabId = tab && tab.id != null ? tab.id : undefined;
  chrome.action.setBadgeBackgroundColor({ color, tabId });
  chrome.action.setBadgeText({ text, tabId });
  setTimeout(() => chrome.action.setBadgeText({ text: '', tabId }), 2000);
}

// ---------- Open a bookmark from another site ----------

// The panel on one AI site asked to open a bookmark from another (pages can't open tabs
// themselves reliably). Opens next to the tab it came from.
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg && msg.type === 'open-tab' && typeof msg.url === 'string' && /^https?:/.test(msg.url)) {
    const from = sender.tab;
    chrome.tabs.create({ url: msg.url, index: from ? from.index + 1 : undefined, openerTabId: from ? from.id : undefined });
  }
});

// ---------- Alt+B, Alt+↑, Alt+↓ ----------

// Alt+B → tell the current tab to show/hide the panel; Alt+↑ / Alt+↓ → jump to the previous /
// next starred answer in its chat. Tabs without our content script (other sites) just don't
// answer, which is fine.
chrome.commands.onCommand.addListener(async command => {
  const msg = command === 'toggle-panel' ? { type: 'toggle-panel' }
    : command === 'prev-star' ? { type: 'star-step', dir: -1 }
    : command === 'next-star' ? { type: 'star-step', dir: 1 }
    : null;
  if (!msg) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
});

// ---------- Weekly backup ----------

// Every week (unless switched off in the Library) a backup file goes to
// Downloads/AI Chat Bookmarks/backup-<date>-<time>.json, so saved answers survive removing the
// extension, a Chrome reset or a new computer. Checked every 6 h and when Chrome starts;
// "Back up now" in the Library makes one straight away.
// Every backup is its own file and the newest 5 are kept, so a backup made right after a
// mistake (a project deleted for good) never replaces the good one from before.
const BACKUP_EVERY = 7 * 24 * 60 * 60 * 1000;
const BACKUPS_KEPT = 5;

function scheduleBackups() {
  chrome.alarms.create('backup', { delayInMinutes: 1, periodInMinutes: 360 });
}
chrome.runtime.onInstalled.addListener(scheduleBackups);
chrome.runtime.onStartup.addListener(scheduleBackups);

chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name !== 'backup') return;
  const { backupAt, backupAuto } = await getBackupInfo();
  if (!backupAuto || (backupAt && Date.now() - backupAt < BACKUP_EVERY)) return;
  saveBackup().catch(err => console.error('AI Chat Bookmarks: backup failed', err));
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== 'backup-now') return;
  saveBackup().then(
    at => sendResponse({ ok: true, at }),
    err => sendResponse({ ok: false, error: String((err && err.message) || err) })
  );
  return true; // answers later
});

// One backup at a time (the weekly one and "Back up now" may meet).
let backingUp = null;
function saveBackup() {
  if (!backingUp) backingUp = writeBackup().finally(() => { backingUp = null; });
  return backingUp;
}

// Nothing saved yet → no file, so an empty backup never replaces a good one.
// Returns when it was saved.
async function writeBackup() {
  const backup = await makeBackup();
  if (!backup.items.length && !backup.trash.length) throw new Error('Nothing saved yet');
  const d = new Date(backup.savedAt);
  const two = n => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}`;
  let id;
  try {
    const url = await fileLink(JSON.stringify(backup));
    id = await chrome.downloads.download({
      url,
      filename: `AI Chat Bookmarks/backup-${stamp}.json`,
      conflictAction: 'uniquify', // two in the same minute: "backup-… (1).json"
      saveAs: false
    });
    await finished(id);
  } finally {
    chrome.offscreen.closeDocument().catch(() => {});
  }
  // Keep the newest few: older files are deleted and leave Chrome's download list.
  const { backupFiles } = await getBackupInfo();
  const files = [...backupFiles, { id }];
  for (const f of files.slice(0, -BACKUPS_KEPT)) {
    await chrome.downloads.removeFile(f.id).catch(() => {});
    chrome.downloads.erase({ id: f.id }).catch(() => {});
  }
  await setBackupInfo(backup.savedAt, files.slice(-BACKUPS_KEPT));
  return backup.savedAt;
}

// The background can't make a file link itself, so a hidden page (offscreen.html) does.
async function fileLink(text) {
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['BLOBS'],
    justification: 'Turn the backup into a file to download'
  }).catch(() => {}); // already open
  return chrome.runtime.sendMessage({ type: 'backup-file', text });
}

// Resolves when the download is complete, rejects if it failed.
function finished(id) {
  return new Promise((resolve, reject) => {
    const check = delta => {
      if (delta.id !== id || !delta.state) return;
      if (delta.state.current === 'complete' || delta.state.current === 'interrupted') {
        chrome.downloads.onChanged.removeListener(check);
        if (delta.state.current === 'complete') resolve();
        else reject(new Error('Download failed'));
      }
    };
    chrome.downloads.onChanged.addListener(check);
  });
}
