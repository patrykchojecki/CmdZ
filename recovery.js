const REPAIR_MESSAGE = "repair-shortcut-listener";
const RECOVERY_COMPLETE_MESSAGE = "cmdz-shortcut-listener-recovered";

chrome.runtime.sendMessage({ type: REPAIR_MESSAGE }, () => {
  void chrome.runtime.lastError;
  window.parent.postMessage(RECOVERY_COMPLETE_MESSAGE, "*");
});
