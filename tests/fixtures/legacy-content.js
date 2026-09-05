(() => {
  let pendingUndo = null;
  const beforeInputListener = (event) => {
    if (event.inputType === "historyUndo" && pendingUndo) {
      pendingUndo.undoObserved = true;
    }
  };
  const listener = (event) => {
    const isMac = /mac/i.test(navigator.platform);
    if (!(isMac ? event.metaKey : event.ctrlKey) || event.key.toLowerCase() !== "z") return;
    const pending = { event, undoObserved: false };
    pendingUndo = pending;
    setTimeout(() => {
      if (pendingUndo === pending) pendingUndo = null;
      if (!pending.undoObserved && !pending.event.defaultPrevented) {
        chrome.runtime.sendMessage({ type: "reopen-last-closed-tab" });
      }
    }, 0);
  };
  document.addEventListener("keydown", listener);
  document.addEventListener("beforeinput", beforeInputListener, true);
  globalThis.__cmdzShortcutListener = {
    beforeInputListener,
    disposeRecovery() {},
    listener,
    target: document,
  };
})();
