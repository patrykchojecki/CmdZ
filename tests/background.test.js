const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createBackgroundController,
  installBackground,
} = require("../background.js");

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
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

test("serializes rapid restores so each request restores a different tab", async () => {
  const firstRestore = deferred();
  const sessions = ["newest", "older"];
  const restored = [];
  const harness = chromeHarness({
    sessions: {
      async getRecentlyClosed() {
        return sessions.map((sessionId) => ({ tab: { sessionId } }));
      },
      async restore(sessionId) {
        restored.push(sessionId);
        if (restored.length === 1) await firstRestore.promise;
        assert.equal(sessions.shift(), sessionId);
      },
    },
  });
  const controller = createBackgroundController(harness.chromeApi);
  const first = controller.reopenLastClosedTab();
  const second = controller.reopenLastClosedTab();
  // Observe both promises immediately, including the pre-fix rejection.
  const results = Promise.allSettled([first, second]);
  await new Promise(setImmediate);
  firstRestore.resolve();

  assert.deepEqual(await results, [
    { status: "fulfilled", value: true },
    { status: "fulfilled", value: true },
  ]);
  assert.deepEqual(restored, ["newest", "older"]);
});

test("a failed restore does not block later requests", async () => {
  let attempts = 0;
  const harness = chromeHarness({
    sessions: {
      async getRecentlyClosed() {
        return [{ tab: { sessionId: "tab-session" } }];
      },
      async restore() {
        if (++attempts === 1) throw new Error("Session no longer available");
      },
    },
  });
  const controller = createBackgroundController(harness.chromeApi);
  await assert.rejects(controller.reopenLastClosedTab());
  assert.equal(await controller.reopenLastClosedTab(), true);
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
  let duplicateFinished = false;
  duplicateRepair.then(() => { duplicateFinished = true; });
  await new Promise(setImmediate);

  assert.equal(injectionCount, 1);
  assert.equal(duplicateFinished, false);

  injection.resolve();
  await Promise.all([firstRepair, duplicateRepair]);
});

test("duplicate repairs share failure and a later repair can retry", async () => {
  const injection = deferred();
  let attempts = 0;
  const harness = chromeHarness({
    scripting: {
      executeScript() {
        return ++attempts === 1 ? injection.promise : Promise.resolve();
      },
    },
  });
  const controller = createBackgroundController(harness.chromeApi);
  const results = Promise.allSettled([
    controller.repairShortcutListener(12),
    controller.repairShortcutListener(12),
  ]);
  injection.reject(new Error("Tab not ready"));
  assert.deepEqual((await results).map((result) => result.status), [
    "rejected", "rejected",
  ]);
  await controller.repairShortcutListener(12);
  assert.equal(attempts, 2);
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

test("restricted or closed tabs do not prevent injection into other tabs", async () => {
  const injected = [];
  const harness = chromeHarness({
    tabs: { async query() { return [{ id: 1 }, { id: 2 }, { id: 3 }]; } },
    scripting: {
      async executeScript({ target }) {
        if (target.tabId === 2) throw new Error("Cannot access a chrome:// URL");
        injected.push(target.tabId);
      },
    },
  });
  await createBackgroundController(harness.chromeApi).injectShortcutListenerIntoOpenTabs();
  assert.deepEqual(injected, [1, 3]);
});

test("runtime requests report API failures without leaving the response open", async () => {
  const harness = chromeHarness({
    sessions: { async getRecentlyClosed() { throw new Error("Unavailable"); } },
    scripting: { async executeScript() { throw new Error("Tab closed"); } },
  });
  const controller = createBackgroundController(harness.chromeApi);
  for (const [type, expected] of [
    ["reopen-last-closed-tab", { restored: false }],
    ["repair-shortcut-listener", { repaired: false }],
  ]) {
    const response = await new Promise((resolve) => {
      assert.equal(controller.handleMessage({ type }, { tab: { id: 4 } }, resolve), true);
    });
    assert.deepEqual(response, expected);
  }
  assert.equal(controller.handleMessage({ type: "repair-shortcut-listener" }, {}, () => {}), false);
});

test("install and browser startup attach to existing tabs; worker setup alone does not", async () => {
  let queries = 0;
  const harness = chromeHarness({
    tabs: { async query() { queries += 1; return [{ id: 4 }]; } },
  });
  installBackground(harness.chromeApi);
  assert.equal(queries, 0);
  harness.chromeApi.runtime.onInstalled.listeners[0]();
  harness.chromeApi.runtime.onStartup.listeners[0]();
  await new Promise(setImmediate);
  assert.equal(queries, 2);
  assert.equal(harness.scriptInjections.length, 2);
});

test("toolbar clicks restore tabs without any content script or sender", async () => {
  const harness = chromeHarness();
  harness.chromeApi.sessions.getRecentlyClosed = async () => [{ tab: { sessionId: "toolbar" } }];
  installBackground(harness.chromeApi);
  harness.chromeApi.action.onClicked.listeners[0]();
  await new Promise(setImmediate);
  assert.deepEqual(harness.restoredSessionIds, ["toolbar"]);
});
