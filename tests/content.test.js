const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createShortcutController,
  isUndoShortcut,
} = require("../content.js");

function keyEvent(properties = {}) {
  return {
    key: "z",
    altKey: false,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    defaultPrevented: false,
    isComposing: false,
    isTrusted: true,
    repeat: false,
    ...properties,
  };
}

function beforeInputEvent(properties = {}) {
  return {
    inputType: "historyUndo",
    isTrusted: true,
    ...properties,
  };
}

function controllerHarness(platform = "macOS") {
  const scheduled = [];
  let restoreCount = 0;
  const controller = createShortcutController({
    platform,
    restore: () => {
      restoreCount += 1;
    },
    schedule: (callback) => {
      scheduled.push(callback);
    },
  });

  return {
    controller,
    flush() {
      while (scheduled.length) {
        scheduled.shift()();
      }
    },
    get restoreCount() {
      return restoreCount;
    },
    get scheduledCount() {
      return scheduled.length;
    },
  };
}

test("recognizes the native undo shortcut for each desktop platform", () => {
  assert.equal(
    isUndoShortcut(keyEvent({ metaKey: true }), "macOS"),
    true,
  );
  assert.equal(
    isUndoShortcut(keyEvent({ ctrlKey: true }), "Windows"),
    true,
  );
  assert.equal(
    isUndoShortcut(keyEvent({ ctrlKey: true }), "Linux"),
    true,
  );
  assert.equal(
    isUndoShortcut(keyEvent({ metaKey: true }), "Windows"),
    false,
  );
});

test("does not treat modified or unrelated shortcuts as undo", () => {
  assert.equal(
    isUndoShortcut(keyEvent({ metaKey: true, shiftKey: true }), "macOS"),
    false,
  );
  assert.equal(
    isUndoShortcut(keyEvent({ metaKey: true, altKey: true }), "macOS"),
    false,
  );
  assert.equal(
    isUndoShortcut(keyEvent({ key: "x", metaKey: true }), "macOS"),
    false,
  );
});

test("defers restoration until the page has had a chance to undo", () => {
  const harness = controllerHarness();

  harness.controller.handleKeydown(keyEvent({ metaKey: true }));

  assert.equal(harness.restoreCount, 0);
  assert.equal(harness.scheduledCount, 1);
});

test("restores a tab when the page does not handle undo", () => {
  const harness = controllerHarness();

  harness.controller.handleKeydown(keyEvent({ metaKey: true }));
  harness.flush();

  assert.equal(harness.restoreCount, 1);
});

test("does not restore when a page prevents the shortcut", () => {
  const harness = controllerHarness();
  const event = keyEvent({ metaKey: true });

  harness.controller.handleKeydown(event);
  event.defaultPrevented = true;
  harness.flush();

  assert.equal(harness.restoreCount, 0);
});

test("does not restore when native undo emits historyUndo", () => {
  const harness = controllerHarness();

  harness.controller.handleKeydown(keyEvent({ metaKey: true }));
  harness.controller.handleBeforeInput(beforeInputEvent());
  harness.flush();

  assert.equal(harness.restoreCount, 0);
});

test("restores after unrelated input when no undo occurred", () => {
  const harness = controllerHarness();

  harness.controller.handleKeydown(keyEvent({ metaKey: true }));
  harness.controller.handleBeforeInput(
    beforeInputEvent({ inputType: "insertText" }),
  );
  harness.flush();

  assert.equal(harness.restoreCount, 1);
});

test("ignores synthetic shortcut and undo events created by websites", () => {
  const syntheticShortcutHarness = controllerHarness();
  syntheticShortcutHarness.controller.handleKeydown(
    keyEvent({ isTrusted: false, metaKey: true }),
  );
  syntheticShortcutHarness.flush();
  assert.equal(syntheticShortcutHarness.restoreCount, 0);

  const syntheticUndoHarness = controllerHarness();
  syntheticUndoHarness.controller.handleKeydown(
    keyEvent({ metaKey: true }),
  );
  syntheticUndoHarness.controller.handleBeforeInput(
    beforeInputEvent({ isTrusted: false }),
  );
  syntheticUndoHarness.flush();
  assert.equal(syntheticUndoHarness.restoreCount, 1);
});

test("leaves composing and held shortcuts entirely to the page", () => {
  const harness = controllerHarness();

  harness.controller.handleKeydown(
    keyEvent({ isComposing: true, metaKey: true }),
  );
  harness.controller.handleKeydown(
    keyEvent({ metaKey: true, repeat: true }),
  );
  harness.flush();

  assert.equal(harness.restoreCount, 0);
  assert.equal(harness.scheduledCount, 0);
});
