(() => {
  const REOPEN_MESSAGE = "reopen-last-closed-tab";
  const LISTENER_STATE = "__cmdzShortcutListener";
  const RECOVERY_COMPLETE_MESSAGE = "cmdz-shortcut-listener-recovered";
  const RECOVERY_CHECK_INTERVAL_MS = 1000;

  const NON_TEXT_INPUT_TYPES = new Set([
    "button",
    "checkbox",
    "color",
    "file",
    "hidden",
    "image",
    "radio",
    "range",
    "reset",
    "submit",
  ]);

  const EDITOR_ROLES = new Set([
    "application",
    "combobox",
    "grid",
    "searchbox",
    "spinbutton",
    "textbox",
    "treegrid",
  ]);

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

  function isEditingElement(element) {
    if (!element || element.nodeType !== 1) {
      return false;
    }

    const tagName = element.localName?.toLowerCase();

    if (tagName === "textarea" || tagName === "select") {
      return !element.disabled && !element.readOnly;
    }

    if (tagName === "canvas") {
      return true;
    }

    if (tagName === "input") {
      const inputType = (element.type || "text").toLowerCase();
      return (
        !element.disabled &&
        !element.readOnly &&
        !NON_TEXT_INPUT_TYPES.has(inputType)
      );
    }

    if (element.isContentEditable) {
      return true;
    }

    const declaredShortcuts = element
      .getAttribute?.("aria-keyshortcuts")
      ?.toLowerCase()
      .split(/\s+/);

    if (
      declaredShortcuts?.some((shortcut) =>
        ["command+z", "control+z", "meta+z"].includes(shortcut),
      )
    ) {
      return true;
    }

    const role = element.getAttribute?.("role")?.toLowerCase();
    return EDITOR_ROLES.has(role);
  }

  function isInEditingSurface(element) {
    let currentElement = element;

    while (currentElement) {
      if (isEditingElement(currentElement)) {
        return true;
      }

      currentElement = currentElement.parentElement;
    }

    return false;
  }

  function pageShouldHandleUndo(event, currentDocument) {
    if (event.defaultPrevented || event.isComposing) {
      return true;
    }

    const eventPath =
      typeof event.composedPath === "function" ? event.composedPath() : [];

    if (eventPath.some(isInEditingSurface)) {
      return true;
    }

    if (isInEditingSurface(currentDocument.activeElement)) {
      return true;
    }

    if (currentDocument.designMode?.toLowerCase() === "on") {
      return true;
    }

    return false;
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

  function handleKeydown(
    event,
    {
      currentDocument = document,
      platform = getPlatform(),
      restore = requestTabRestore,
      isActive = hasActiveExtensionContext,
    } = {},
  ) {
    if (event.isTrusted === false || !isUndoShortcut(event, platform)) {
      return;
    }

    if (pageShouldHandleUndo(event, currentDocument)) {
      return;
    }

    if (event.repeat) {
      if (!isActive()) {
        return;
      }
    } else if (restore() === false) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
  }

  if (typeof module === "object" && module.exports) {
    module.exports = {
      handleKeydown,
      hasActiveExtensionContext,
      isEditingElement,
      isInEditingSurface,
      isMacPlatform,
      isUndoShortcut,
      pageShouldHandleUndo,
      requestTabRestore,
    };
  } else {
    const previousState = globalThis[LISTENER_STATE];

    if (previousState) {
      previousState.target.removeEventListener(
        "keydown",
        previousState.listener,
      );
      previousState.disposeRecovery();
    }

    const listener = (event) => handleKeydown(event);
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

    if (ownsRecovery) {
      recoveryTimer = setInterval(
        recoverInvalidContext,
        RECOVERY_CHECK_INTERVAL_MS,
      );
      window.addEventListener("message", handleRecoveryComplete);
    }

    globalThis[LISTENER_STATE] = {
      disposeRecovery,
      listener,
      target: document,
    };
  }
})();
