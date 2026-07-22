const REOPEN_COMMAND = "reopen-last-closed-tab";

async function reopenLastClosedTab() {
  const sessions = await chrome.sessions.getRecentlyClosed();
  const lastClosedTab = sessions.find((session) => session.tab?.sessionId);

  if (lastClosedTab) {
    await chrome.sessions.restore(lastClosedTab.tab.sessionId);
  }
}

chrome.commands.onCommand.addListener((command) => {
  if (command === REOPEN_COMMAND) {
    reopenLastClosedTab().catch(() => {
      // There may be no restorable tab yet. Nothing else is needed.
    });
  }
});
