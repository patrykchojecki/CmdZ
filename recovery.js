const REPAIR_MESSAGE = "repair-shortcut-listener";
const RECOVERY_COMPLETE_MESSAGE = "cmdz-shortcut-listener-recovered";
const RECOVERY_FAILED_MESSAGE = "cmdz-shortcut-listener-recovery-failed";

chrome.runtime.sendMessage({ type: REPAIR_MESSAGE }, (response) => {
  const repaired = !chrome.runtime.lastError && response?.repaired === true;
  window.parent.postMessage(
    repaired ? RECOVERY_COMPLETE_MESSAGE : RECOVERY_FAILED_MESSAGE,
    "*",
  );
});
