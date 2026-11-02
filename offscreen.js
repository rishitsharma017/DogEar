// Hidden page for background.js: turns the backup text into a file link it can download
// (a background service worker can't make one itself).
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'backup-file') {
    sendResponse(URL.createObjectURL(new Blob([msg.text], { type: 'application/json' })));
  }
});
