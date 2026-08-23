const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createBackgroundController,
  installBackground,
} = require("../background.js");

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function eventChannel() {
  const listeners = [];

  return {
    addListener(listener) {
      listeners.push(listener);
    },
    listeners,
  };
}

function chromeHarness(overrides = {}) {
  const restoredSessionIds = [];
  const scriptInjections = [];
  const chromeApi = {
    action: { onClicked: eventChannel() },
    runtime: {
      onInstalled: eventChannel(),
      onMessage: eventChannel(),
      onStartup: eventChannel(),
    },
    scripting: {
      async executeScript(injection) {
        scriptInjections.push(injection);
      },
    },
    sessions: {
      async getRecentlyClosed() {
        return [];
      },
      async restore(sessionId) {
        restoredSessionIds.push(sessionId);
      },
    },
    tabs: {
      async query() {
        return [];
      },
    },
    ...overrides,
  };

  return { chromeApi, restoredSessionIds, scriptInjections };
}

test("restores the newest recently closed individual tab", async () => {
  const harness = chromeHarness({
    sessions: {
      async getRecentlyClosed() {
        return [
          { window: { sessionId: "window-session" } },
          { tab: { sessionId: "tab-session" } },
          { tab: { sessionId: "older-tab-session" } },
        ];
      },
      async restore(sessionId) {
        harness.restoredSessionIds.push(sessionId);
      },
    },
  });
  const controller = createBackgroundController(harness.chromeApi);

  assert.equal(await controller.reopenLastClosedTab(), true);
  assert.deepEqual(harness.restoredSessionIds, ["tab-session"]);
});

test("reports when there is no individual tab to restore", async () => {
  const harness = chromeHarness({
    sessions: {
      async getRecentlyClosed() {
        return [{ window: { sessionId: "window-session" } }];
      },
      async restore(sessionId) {
        harness.restoredSessionIds.push(sessionId);
      },
    },
  });
  const controller = createBackgroundController(harness.chromeApi);

  assert.equal(await controller.reopenLastClosedTab(), false);
  assert.deepEqual(harness.restoredSessionIds, []);
});

test("routes known runtime messages and ignores unrelated messages", async () => {
  const harness = chromeHarness({
    sessions: {
      async getRecentlyClosed() {
        return [{ tab: { sessionId: "tab-session" } }];
      },
      async restore(sessionId) {
        harness.restoredSessionIds.push(sessionId);
      },
    },
  });
  const controller = createBackgroundController(harness.chromeApi);
  const restoreResponse = new Promise((resolve) => {
    assert.equal(
      controller.handleMessage(
        { type: "reopen-last-closed-tab" },
        {},
        resolve,
      ),
      true,
    );
  });
  const repairResponse = new Promise((resolve) => {
    assert.equal(
      controller.handleMessage(
        { type: "repair-shortcut-listener" },
        { tab: { id: 9 } },
        resolve,
      ),
      true,
    );
  });

  assert.deepEqual(await restoreResponse, { restored: true });
  assert.deepEqual(await repairResponse, { repaired: true });
  assert.deepEqual(harness.restoredSessionIds, ["tab-session"]);
  assert.deepEqual(harness.scriptInjections, [
    {
      target: { tabId: 9, allFrames: true },
      files: ["content.js"],
    },
  ]);
  assert.equal(
    controller.handleMessage({ type: "unrelated" }, {}, () => {}),
    false,
  );
});

test("injects the shortcut listener only into tabs with integer IDs", async () => {
  const harness = chromeHarness({
    tabs: {
      async query() {
        return [{ id: 4 }, { id: undefined }, { id: 7 }];
      },
    },
  });
  const controller = createBackgroundController(harness.chromeApi);

  await controller.injectShortcutListenerIntoOpenTabs();

  assert.deepEqual(harness.scriptInjections, [
    {
      target: { tabId: 4, allFrames: true },
      files: ["content.js"],
    },
    {
      target: { tabId: 7, allFrames: true },
      files: ["content.js"],
    },
  ]);
});

test("coalesces concurrent repairs for the same tab", async () => {
  const injection = deferred();
  let injectionCount = 0;
  const harness = chromeHarness({
    scripting: {
      executeScript() {
        injectionCount += 1;
        return injection.promise;
      },
    },
  });
  const controller = createBackgroundController(harness.chromeApi);

  const firstRepair = controller.repairShortcutListener(12);
  const duplicateRepair = controller.repairShortcutListener(12);
  await duplicateRepair;

  assert.equal(injectionCount, 1);

  injection.resolve();
  await firstRepair;
});

test("registers each extension event with the background controller", () => {
  const harness = chromeHarness();
  const controller = installBackground(harness.chromeApi);

  assert.equal(harness.chromeApi.runtime.onInstalled.listeners.length, 1);
  assert.equal(harness.chromeApi.runtime.onStartup.listeners.length, 1);
  assert.deepEqual(harness.chromeApi.runtime.onMessage.listeners, [
    controller.handleMessage,
  ]);
  assert.equal(harness.chromeApi.action.onClicked.listeners.length, 1);
});
