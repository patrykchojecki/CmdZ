const REOPEN_MESSAGE = "reopen-last-closed-tab";

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

function requestTabRestore() {
  try {
    chrome.runtime.sendMessage({ type: REOPEN_MESSAGE }, () => {
      // Ignore teardown races if the extension is reloaded while a tab is open.
      void chrome.runtime.lastError;
    });
  } catch {
    // The extension may have been reloaded while this page stayed open.
  }
}

function handleKeydown(
  event,
  {
    currentDocument = document,
    platform = getPlatform(),
    restore = requestTabRestore,
  } = {},
) {
  if (!isUndoShortcut(event, platform)) {
    return;
  }

  if (pageShouldHandleUndo(event, currentDocument)) {
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();

  if (!event.repeat) {
    restore();
  }
}

if (typeof module === "object" && module.exports) {
  module.exports = {
    handleKeydown,
    isEditingElement,
    isInEditingSurface,
    isMacPlatform,
    isUndoShortcut,
    pageShouldHandleUndo,
  };
} else {
  window.addEventListener("keydown", handleKeydown);
}
