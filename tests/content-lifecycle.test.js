const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../content.js"), "utf8");
const recoverySource = fs.readFileSync(path.join(__dirname, "../recovery.js"), "utf8");

function eventTarget() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(type, listener, capture = false) {
      const key = `${type}:${capture}`;
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key).add(listener);
    },
    removeEventListener(type, listener, capture = false) {
      listeners.get(`${type}:${capture}`)?.delete(listener);
    },
    dispatch(type, event = {}) {
      for (const capture of [true, false]) {
        for (const listener of [...(listeners.get(`${type}:${capture}`) || [])]) {
          listener(event);
        }
      }
    },
  };
}

function harness({ visible = true, child = false } = {}) {
  const window = eventTarget();
  window.top = child ? {} : window;
  const frames = [];
  const timeouts = [];
  const intervals = new Set();
  const messages = [];
  const document = {
    ...eventTarget(),
    visibilityState: visible ? "visible" : "hidden",
    documentElement: { append(frame) { frame.isConnected = true; frames.push(frame); } },
    createElement() {
      return {
        contentWindow: {},
        setAttribute() {},
        remove() { this.isConnected = false; },
      };
    },
  };
  const runtime = {
    id: "cmdz",
    // Node does not register chrome-extension as an origin-bearing scheme.
    getURL: () => "https://cmdz.test/recovery.html",
    sendMessage(message, callback) { messages.push(message); callback?.(); },
  };
  const context = vm.createContext({
    window, document, chrome: { runtime }, URL,
    navigator: { platform: "MacIntel" },
    setTimeout: (callback) => timeouts.push(callback),
    setInterval: (callback) => { intervals.add(callback); return callback; },
    clearInterval: (callback) => intervals.delete(callback),
  });
  return {
    context, window, document, runtime, frames, intervals, messages,
    install() { vm.runInContext(source, context); },
    keydown() {
      window.dispatch("keydown", { key: "z", metaKey: true, isTrusted: true });
    },
    flush() { while (timeouts.length) timeouts.shift()(); },
    tick() { for (const callback of [...intervals]) callback(); },
  };
}

test("input historyUndo protects edits when beforeinput was not observed", () => {
  const h = harness();
  h.install();
  h.keydown();
  h.window.dispatch("input", { inputType: "historyUndo", isTrusted: true });
  h.flush();
  assert.equal(h.messages.length, 0);
  h.keydown();
  h.flush();
  assert.equal(h.messages.length, 1);
});

test("reinjection cancels pending work and leaves exactly one listener", () => {
  const h = harness();
  h.install();
  h.keydown();
  h.install();
  h.flush();
  assert.equal(h.messages.length, 0);
  h.keydown();
  h.flush();
  assert.equal(h.messages.length, 1);
  assert.equal(h.intervals.size, 1);
  for (const listeners of h.window.listeners.values()) assert.equal(listeners.size, 1);
});

test("hidden tabs and child frames do not poll for recovery", () => {
  for (const options of [{ visible: false }, { child: true }]) {
    const h = harness(options);
    h.install();
    assert.equal(h.intervals.size, 0);
  }
  const h = harness();
  h.install();
  h.document.visibilityState = "hidden";
  h.document.dispatch("visibilitychange");
  assert.equal(h.intervals.size, 0);
  h.runtime.id = undefined;
  h.document.visibilityState = "visible";
  h.document.dispatch("visibilitychange");
  assert.equal(h.intervals.size, 1);
  assert.equal(h.frames.length, 1);
});

test("stale scripts fail quietly and recovery verifies both origin and source", () => {
  const h = harness();
  h.install();
  h.runtime.id = undefined;
  h.keydown();
  h.flush();
  assert.equal(h.messages.length, 0);
  h.tick();
  const frame = h.frames[0];
  for (const event of [
    { origin: "https://page.test", source: frame.contentWindow },
    { origin: "https://cmdz.test", source: {} },
  ]) {
    h.window.dispatch("message", { ...event, data: "cmdz-shortcut-listener-recovered" });
    assert.equal(frame.isConnected, true);
  }
  h.window.dispatch("message", {
    origin: "https://cmdz.test", source: frame.contentWindow,
    data: "cmdz-shortcut-listener-recovered",
  });
  assert.equal(frame.isConnected, false);
  assert.equal(h.intervals.size, 0);
  for (const listeners of h.window.listeners.values()) assert.equal(listeners.size, 0);
  h.document.dispatch("visibilitychange");
  assert.equal(h.intervals.size, 0);
});

test("failed recovery is retried instead of permanently disabling recovery", () => {
  const h = harness();
  h.install();
  h.runtime.id = undefined;
  h.tick();
  const frame = h.frames[0];
  h.window.dispatch("message", {
    origin: "https://cmdz.test", source: frame.contentWindow,
    data: "cmdz-shortcut-listener-recovery-failed",
  });
  assert.equal(frame.isConnected, false);
  h.tick();
  assert.equal(h.frames.length, 2);
});

test("extension teardown during sendMessage does not throw", () => {
  const h = harness();
  h.install();
  h.runtime.sendMessage = () => { throw new Error("Extension context invalidated"); };
  h.keydown();
  assert.doesNotThrow(() => h.flush());
});

test("recovery acknowledges only a successful repair response", () => {
  for (const [response, lastError, expected] of [
    [{ repaired: true }, undefined, "cmdz-shortcut-listener-recovered"],
    [{ repaired: false }, undefined, "cmdz-shortcut-listener-recovery-failed"],
    [undefined, undefined, "cmdz-shortcut-listener-recovery-failed"],
    [{ repaired: true }, { message: "Connection lost" }, "cmdz-shortcut-listener-recovery-failed"],
  ]) {
    const messages = [];
    vm.runInNewContext(recoverySource, {
      chrome: { runtime: {
        lastError,
        sendMessage(message, callback) {
          assert.equal(message.type, "repair-shortcut-listener");
          callback(response);
        },
      } },
      window: { parent: { postMessage: (message) => messages.push(message) } },
    });
    assert.deepEqual(messages, [expected]);
  }
});

test("persistent recovery failure stops polling until the tab becomes visible again", () => {
  const h = harness();
  h.install();
  h.runtime.id = undefined;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    h.tick();
    h.window.dispatch("message", {
      origin: "https://cmdz.test", source: h.frames[attempt].contentWindow,
      data: "cmdz-shortcut-listener-recovery-failed",
    });
  }
  assert.equal(h.intervals.size, 0);
  h.tick();
  assert.equal(h.frames.length, 3);
  h.document.visibilityState = "hidden";
  h.document.dispatch("visibilitychange");
  h.document.visibilityState = "visible";
  h.document.dispatch("visibilitychange");
  assert.equal(h.frames.length, 4);
  assert.equal(h.intervals.size, 1);
});
