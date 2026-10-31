// Background service worker: toolbar icon, right-click menu, Alt+B command.
importScripts('common.js');

// Toolbar icon → open the Library in a new tab.
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('library.html') });
});

// Alt+B → tell the current tab to show/hide the panel. Tabs without our content
// script (other sites) just don't answer, which is fine.
chrome.commands.onCommand.addListener(async command => {
  if (command !== 'toggle-panel') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) chrome.tabs.sendMessage(tab.id, { type: 'toggle-panel' }).catch(() => {});
});
