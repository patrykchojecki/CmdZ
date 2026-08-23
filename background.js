(() => {
  const REOPEN_MESSAGE = "reopen-last-closed-tab";
  const REPAIR_MESSAGE = "repair-shortcut-listener";
  const CONTENT_SCRIPT = "content.js";

  function createBackgroundController(chromeApi) {
    const repairsInProgress = new Set();

    async function reopenLastClosedTab() {
      const sessions = await chromeApi.sessions.getRecentlyClosed();
      const lastClosedTab = sessions.find(
        (session) => session.tab?.sessionId,
      );

      if (!lastClosedTab) {
        return false;
      }

      await chromeApi.sessions.restore(lastClosedTab.tab.sessionId);
      return true;
    }

    function injectShortcutListener(tabId) {
      return chromeApi.scripting.executeScript({
        target: { tabId, allFrames: true },
        files: [CONTENT_SCRIPT],
      });
    }

    async function injectShortcutListenerIntoOpenTabs() {
      const tabs = await chromeApi.tabs.query({});
      const injections = tabs
        .filter((tab) => Number.isInteger(tab.id))
        .map((tab) => injectShortcutListener(tab.id));

      await Promise.allSettled(injections);
    }

    async function repairShortcutListener(tabId) {
      if (repairsInProgress.has(tabId)) {
        return;
      }

      repairsInProgress.add(tabId);

      try {
        await injectShortcutListener(tabId);
      } finally {
        repairsInProgress.delete(tabId);
      }
    }

    function handleMessage(message, sender, sendResponse) {
      if (message?.type === REOPEN_MESSAGE) {
        reopenLastClosedTab()
          .then((restored) => sendResponse({ restored }))
          .catch(() => sendResponse({ restored: false }));
        return true;
      }

      if (
        message?.type === REPAIR_MESSAGE &&
        Number.isInteger(sender.tab?.id)
      ) {
        repairShortcutListener(sender.tab.id)
          .then(() => sendResponse({ repaired: true }))
          .catch(() => sendResponse({ repaired: false }));
        return true;
      }

      return false;
    }

    return {
      handleMessage,
      injectShortcutListenerIntoOpenTabs,
      reopenLastClosedTab,
      repairShortcutListener,
    };
  }

  function installBackground(chromeApi) {
    const controller = createBackgroundController(chromeApi);

    chromeApi.runtime.onInstalled.addListener(() => {
      controller.injectShortcutListenerIntoOpenTabs().catch(() => {
        // Restricted pages reject injection and keep the toolbar fallback.
      });
    });

    chromeApi.runtime.onStartup.addListener(() => {
      controller.injectShortcutListenerIntoOpenTabs().catch(() => {
        // Static content scripts still cover pages loaded during startup.
      });
    });

    chromeApi.runtime.onMessage.addListener(controller.handleMessage);

    chromeApi.action.onClicked.addListener(() => {
      controller.reopenLastClosedTab().catch(() => {
        // There may be no restorable tab yet. Nothing else is needed.
      });
    });

    return controller;
  }

  if (typeof module === "object" && module.exports) {
    module.exports = {
      createBackgroundController,
      installBackground,
    };
  } else {
    installBackground(chrome);
  }
})();
