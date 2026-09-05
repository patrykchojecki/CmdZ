(() => {
  const REOPEN_MESSAGE = "reopen-last-closed-tab";
  const LISTENER_STATE = "__cmdzShortcutListener";
  const RECOVERY_COMPLETE_MESSAGE = "cmdz-shortcut-listener-recovered";
  const RECOVERY_FAILED_MESSAGE = "cmdz-shortcut-listener-recovery-failed";
  const RECOVERY_CHECK_INTERVAL_MS = 1000;
  const RECOVERY_RESPONSE_TIMEOUT_MS = 5000;

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
    let disposed = false;

    function handleInput(event) {
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
        disposed ||
        event.isTrusted === false ||
        event.isComposing ||
        event.keyCode === 229 ||
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

        if (
          !disposed &&
          !pending.undoObserved &&
          !pending.event.defaultPrevented
        ) {
          restore();
        }
      });
    }

    return {
      dispose() {
        disposed = true;
        pendingUndo = null;
      },
      handleInput,
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

    if (previousState?.dispose) {
      previousState.dispose();
    } else if (previousState) {
      previousState.target.removeEventListener(
        "keydown",
        previousState.listener,
        previousState.keydownCapture === true,
      );

      if (previousState.beforeInputListener) {
        previousState.target.removeEventListener(
          "beforeinput",
          previousState.beforeInputListener,
          previousState.beforeInputCapture !== false,
        );
      }

      previousState.disposeRecovery();
    }

    const controller = createShortcutController();
    const listener = (event) => controller.handleKeydown(event);
    const beforeInputListener = (event) => controller.handleInput(event);
    const recoveryUrl = chrome.runtime.getURL("recovery.html");
    const recoveryOrigin = new URL(recoveryUrl).origin;
    const ownsRecovery = window === window.top;
    let recoveryFrame = null;
    let recoveryTimer = null;
    let recoveryFailures = 0;
    let recoveryStartedAt = 0;

    const failRecoveryAttempt = () => {
      recoveryFrame?.remove();
      recoveryFrame = null;
      // Do not keep waking the worker if site access remains unavailable.
      if (++recoveryFailures >= 3) clearInterval(recoveryTimer);
    };

    const handleRecoveryComplete = (event) => {
      if (
        event.origin !== recoveryOrigin ||
        event.source !== recoveryFrame?.contentWindow
      ) {
        return;
      }

      if (event.data === RECOVERY_COMPLETE_MESSAGE) {
        dispose();
      } else if (event.data === RECOVERY_FAILED_MESSAGE) {
        // A transient injection failure can be retried on the next check.
        failRecoveryAttempt();
      }
    };

    const recoverInvalidContext = () => {
      if (
        !ownsRecovery ||
        document.visibilityState !== "visible" ||
        hasActiveExtensionContext()
      ) {
        return;
      }

      if (recoveryFrame) {
        // Disabled extensions and blocked frames may never send a response.
        if (
          recoveryFrame.isConnected &&
          Date.now() - recoveryStartedAt < RECOVERY_RESPONSE_TIMEOUT_MS
        ) return;
        failRecoveryAttempt();
        if (recoveryFailures >= 3) return;
      }

      recoveryFrame = document.createElement("iframe");
      recoveryFrame.hidden = true;
      recoveryFrame.setAttribute("aria-hidden", "true");
      recoveryFrame.src = recoveryUrl;
      recoveryStartedAt = Date.now();
      (document.documentElement || document).append(recoveryFrame);
    };

    const disposeRecovery = () => {
      clearInterval(recoveryTimer);
      recoveryFrame?.remove();
      recoveryFrame = null;
      document.removeEventListener("visibilitychange", updateRecoveryTimer);
      window.removeEventListener("message", handleRecoveryComplete);
    };

    const updateRecoveryTimer = () => {
      clearInterval(recoveryTimer);
      if (document.visibilityState === "visible") {
        recoveryFailures = 0;
        recoverInvalidContext();
        recoveryTimer = setInterval(
          recoverInvalidContext,
          RECOVERY_CHECK_INTERVAL_MS,
        );
      }
    };

    function dispose() {
      controller.dispose();
      window.removeEventListener("keydown", listener, true);
      window.removeEventListener("beforeinput", beforeInputListener, true);
      window.removeEventListener("input", beforeInputListener, true);
      disposeRecovery();
    }

    window.addEventListener("keydown", listener, true);
    window.addEventListener("beforeinput", beforeInputListener, true);
    // A page listener installed before CmdZ may hide beforeinput; input still
    // confirms a completed native Undo without inspecting the edited content.
    window.addEventListener("input", beforeInputListener, true);

    if (ownsRecovery) {
      updateRecoveryTimer();
      document.addEventListener("visibilitychange", updateRecoveryTimer);
      window.addEventListener("message", handleRecoveryComplete);
    }

    globalThis[LISTENER_STATE] = {
      beforeInputListener,
      beforeInputCapture: true,
      dispose,
      disposeRecovery,
      keydownCapture: true,
      listener,
      target: window,
    };
  }
})();
