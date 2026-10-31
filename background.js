// Background service worker: toolbar icon, right-click menu, Alt+B command.
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

// ---------- Alt+B ----------

// Alt+B → tell the current tab to show/hide the panel. Tabs without our content
// script (other sites) just don't answer, which is fine.
chrome.commands.onCommand.addListener(async command => {
  if (command !== 'toggle-panel') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) chrome.tabs.sendMessage(tab.id, { type: 'toggle-panel' }).catch(() => {});
});
