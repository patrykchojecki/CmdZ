const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const manifestPath = path.join(__dirname, "..", "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

test("does not register Undo as a browser-scoped extension command", () => {
  assert.equal(manifest.commands, undefined);
});

test("loads the undo-safe listener in web pages and editable child frames", () => {
  assert.deepEqual(manifest.content_scripts, [
    {
      matches: ["http://*/*", "https://*/*"],
      js: ["content.js"],
      all_frames: true,
      match_about_blank: true,
      run_at: "document_start",
    },
  ]);
});

test("can reattach the listener after an extension reload", () => {
  assert.deepEqual(manifest.permissions, ["sessions", "scripting"]);
  assert.deepEqual(manifest.host_permissions, [
    "http://*/*",
    "https://*/*",
  ]);
  assert.deepEqual(manifest.web_accessible_resources, [
    {
      resources: ["recovery.html"],
      matches: ["http://*/*", "https://*/*"],
    },
  ]);
});

test("provides a toolbar fallback where content scripts cannot run", () => {
  assert.equal(
    manifest.action.default_title,
    "Reopen the most recently closed tab",
  );
});
