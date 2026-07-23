const REOPEN_MESSAGE = "reopen-last-closed-tab";
const REPAIR_MESSAGE = "repair-shortcut-listener";
const repairsInProgress = new Set();

async function reopenLastClosedTab() {
  const sessions = await chrome.sessions.getRecentlyClosed();
  const lastClosedTab = sessions.find((session) => session.tab?.sessionId);

  if (lastClosedTab) {
    await chrome.sessions.restore(lastClosedTab.tab.sessionId);
    return true;
  }

  return false;
}

async function injectShortcutListenerIntoOpenTabs() {
  const tabs = await chrome.tabs.query({});
  const injections = tabs
    .filter((tab) => Number.isInteger(tab.id))
    .map((tab) =>
      chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ["content.js"],
      }),
    );

  await Promise.allSettled(injections);
}

async function repairShortcutListener(tabId) {
  if (repairsInProgress.has(tabId)) {
    return;
  }

  repairsInProgress.add(tabId);

  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ["content.js"],
    });
  } finally {
    repairsInProgress.delete(tabId);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  injectShortcutListenerIntoOpenTabs().catch(() => {
    // Restricted pages reject injection and keep the toolbar fallback.
  });
});

chrome.runtime.onStartup.addListener(() => {
  injectShortcutListenerIntoOpenTabs().catch(() => {
    // Static content scripts still cover pages loaded during startup.
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === REOPEN_MESSAGE) {
    reopenLastClosedTab()
      .then((restored) => sendResponse({ restored }))
      .catch(() => sendResponse({ restored: false }));
    return true;
  }

  if (
    message?.type === REPAIR_MESSAGE &&
    Number.isInteger(_sender.tab?.id)
  ) {
    repairShortcutListener(_sender.tab.id)
      .then(() => sendResponse({ repaired: true }))
      .catch(() => sendResponse({ repaired: false }));
    return true;
  }

  return false;
});

chrome.action.onClicked.addListener(() => {
  reopenLastClosedTab().catch(() => {
    // There may be no restorable tab yet. Nothing else is needed.
  });
});
