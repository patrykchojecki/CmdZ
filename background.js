const REOPEN_MESSAGE = "reopen-last-closed-tab";

async function reopenLastClosedTab() {
  const sessions = await chrome.sessions.getRecentlyClosed();
  const lastClosedTab = sessions.find((session) => session.tab?.sessionId);

  if (lastClosedTab) {
    await chrome.sessions.restore(lastClosedTab.tab.sessionId);
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === REOPEN_MESSAGE) {
    reopenLastClosedTab().catch(() => {
      // There may be no restorable tab yet. Nothing else is needed.
    });
  }
});

chrome.action.onClicked.addListener(() => {
  reopenLastClosedTab().catch(() => {
    // There may be no restorable tab yet. Nothing else is needed.
  });
});
