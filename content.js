(() => {
  const REOPEN_MESSAGE = "reopen-last-closed-tab";
  const LISTENER_STATE = "__cmdzShortcutListener";
  const RECOVERY_COMPLETE_MESSAGE = "cmdz-shortcut-listener-recovered";
  const RECOVERY_CHECK_INTERVAL_MS = 1000;

  function isMacPlatform(platform) {
    return /mac/i.test(platform || "");
  }

  function isUndoShortcut(event, platform) {
    if (
      event.key?.toLowerCase() !== "z" ||
      event.altKey ||
      event.shiftKey
    ) {
      return false;
    }

    return isMacPlatform(platform)
      ? event.metaKey && !event.ctrlKey
      : event.ctrlKey && !event.metaKey;
  }

  function getPlatform() {
    return navigator.userAgentData?.platform || navigator.platform || "";
  }

  function hasActiveExtensionContext() {
    try {
      return (
        typeof chrome !== "undefined" &&
        typeof chrome.runtime?.id === "string"
      );
    } catch {
      return false;
    }
  }

  function requestTabRestore() {
    if (!hasActiveExtensionContext()) {
      return false;
    }

    try {
      chrome.runtime.sendMessage({ type: REOPEN_MESSAGE }, () => {
        // Reading lastError prevents expected teardown errors from being logged.
        void chrome.runtime.lastError;
      });
      return true;
    } catch {
      // A newer listener will handle the shortcut after an extension reload.
      return false;
    }
  }

  function createShortcutController({
    platform = getPlatform(),
    restore = requestTabRestore,
    schedule = (callback) => setTimeout(callback, 0),
  } = {}) {
    let pendingUndo = null;

    function handleBeforeInput(event) {
      if (
        event.isTrusted === false ||
        event.inputType !== "historyUndo" ||
        !pendingUndo
      ) {
        return;
      }

      pendingUndo.undoObserved = true;
    }

    function handleKeydown(event) {
      if (
        event.isTrusted === false ||
        event.isComposing ||
        event.repeat ||
        !isUndoShortcut(event, platform)
      ) {
        return;
      }

      const pending = {
        event,
        undoObserved: false,
      };
      pendingUndo = pending;

      schedule(() => {
        if (pendingUndo === pending) {
          pendingUndo = null;
        }

        if (!pending.undoObserved && !pending.event.defaultPrevented) {
          restore();
        }
      });
    }

    return {
      handleBeforeInput,
      handleKeydown,
    };
  }

  if (typeof module === "object" && module.exports) {
    module.exports = {
      createShortcutController,
      hasActiveExtensionContext,
      isMacPlatform,
      isUndoShortcut,
      requestTabRestore,
    };
  } else {
    const previousState = globalThis[LISTENER_STATE];

    if (previousState) {
      previousState.target.removeEventListener(
        "keydown",
        previousState.listener,
      );

      if (previousState.beforeInputListener) {
        previousState.target.removeEventListener(
          "beforeinput",
          previousState.beforeInputListener,
          true,
        );
      }

      previousState.disposeRecovery();
    }

    const controller = createShortcutController();
    const listener = (event) => controller.handleKeydown(event);
    const beforeInputListener = (event) =>
      controller.handleBeforeInput(event);
    const recoveryUrl = chrome.runtime.getURL("recovery.html");
    const recoveryOrigin = new URL(recoveryUrl).origin;
    const ownsRecovery = window === window.top;
    let recoveryFrame = null;
    let recoveryTimer = null;

    const handleRecoveryComplete = (event) => {
      if (
        event.origin !== recoveryOrigin ||
        event.source !== recoveryFrame?.contentWindow ||
        event.data !== RECOVERY_COMPLETE_MESSAGE
      ) {
        return;
      }

      clearInterval(recoveryTimer);
      recoveryFrame.remove();
      recoveryFrame = null;
      window.removeEventListener("message", handleRecoveryComplete);
    };

    const recoverInvalidContext = () => {
      if (
        !ownsRecovery ||
        document.visibilityState !== "visible" ||
        hasActiveExtensionContext() ||
        recoveryFrame?.isConnected
      ) {
        return;
      }

      recoveryFrame = document.createElement("iframe");
      recoveryFrame.hidden = true;
      recoveryFrame.setAttribute("aria-hidden", "true");
      recoveryFrame.src = recoveryUrl;
      (document.documentElement || document).append(recoveryFrame);
    };

    const disposeRecovery = () => {
      clearInterval(recoveryTimer);
      recoveryFrame?.remove();
      window.removeEventListener("message", handleRecoveryComplete);
    };

    document.addEventListener("keydown", listener);
    document.addEventListener("beforeinput", beforeInputListener, true);

    if (ownsRecovery) {
      recoveryTimer = setInterval(
        recoverInvalidContext,
        RECOVERY_CHECK_INTERVAL_MS,
      );
      window.addEventListener("message", handleRecoveryComplete);
    }

    globalThis[LISTENER_STATE] = {
      beforeInputListener,
      disposeRecovery,
      listener,
      target: document,
    };
  }
})();
