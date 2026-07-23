const test = require("node:test");
const assert = require("node:assert/strict");

const {
  handleKeydown,
  isEditingElement,
  isInEditingSurface,
  isUndoShortcut,
  pageShouldHandleUndo,
} = require("../content.js");

function element(properties = {}, parentElement = null) {
  return {
    nodeType: 1,
    localName: "div",
    disabled: false,
    readOnly: false,
    isContentEditable: false,
    parentElement,
    getAttribute: () => null,
    ...properties,
  };
}

function keyEvent(properties = {}) {
  return {
    key: "z",
    altKey: false,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    defaultPrevented: false,
    isComposing: false,
    repeat: false,
    composedPath: () => [],
    preventDefault: () => {},
    stopImmediatePropagation: () => {},
    ...properties,
  };
}

function documentWith(properties = {}) {
  return {
    activeElement: null,
    designMode: "off",
    queryCommandEnabled: () => false,
    ...properties,
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

test("recognizes native and ARIA editing elements", () => {
  assert.equal(
    isEditingElement(element({ localName: "textarea" })),
    true,
  );
  assert.equal(
    isEditingElement(element({ localName: "input", type: "text" })),
    true,
  );
  assert.equal(
    isEditingElement(element({ localName: "input", type: "checkbox" })),
    false,
  );
  assert.equal(
    isEditingElement(element({ isContentEditable: true })),
    true,
  );
  assert.equal(
    isEditingElement(element({ getAttribute: () => "application" })),
    true,
  );
  assert.equal(
    isEditingElement(element({ localName: "canvas" })),
    true,
  );
  assert.equal(
    isEditingElement(
      element({
        getAttribute: (name) =>
          name === "aria-keyshortcuts" ? "Control+Z Meta+Z" : null,
      }),
    ),
    true,
  );
});

test("recognizes an editing ancestor", () => {
  const editor = element({ isContentEditable: true });
  const child = element({}, editor);

  assert.equal(isInEditingSurface(child), true);
});

test("leaves undo to focused editors such as the Google Docs event target", () => {
  const docsEditor = element({
    localName: "body",
    isContentEditable: true,
    getAttribute: (name) => (name === "role" ? "textbox" : null),
  });
  const event = keyEvent({
    metaKey: true,
    composedPath: () => [docsEditor],
  });

  assert.equal(
    pageShouldHandleUndo(event, documentWith({ activeElement: docsEditor })),
    true,
  );
});

test("leaves undo to a page that already handled the shortcut", () => {
  assert.equal(
    pageShouldHandleUndo(
      keyEvent({ defaultPrevented: true }),
      documentWith(),
    ),
    true,
  );
});

test("allows tab restoration when the page has no undo context", () => {
  const page = element({ localName: "body" });

  assert.equal(
    pageShouldHandleUndo(
      keyEvent({ composedPath: () => [page] }),
      documentWith({ activeElement: page }),
    ),
    false,
  );
});

test("preserves the original key event and skips restoration in an editor", () => {
  const editor = element({ localName: "textarea" });
  let prevented = false;
  let stopped = false;
  let restored = false;
  const event = keyEvent({
    metaKey: true,
    composedPath: () => [editor],
    preventDefault: () => {
      prevented = true;
    },
    stopImmediatePropagation: () => {
      stopped = true;
    },
  });

  handleKeydown(event, {
    currentDocument: documentWith({ activeElement: editor }),
    platform: "macOS",
    restore: () => {
      restored = true;
    },
  });

  assert.equal(prevented, false);
  assert.equal(stopped, false);
  assert.equal(restored, false);
});

test("consumes unused page undo and requests one tab restoration", () => {
  const page = element({ localName: "body" });
  let prevented = false;
  let stopped = false;
  let restoreCount = 0;
  const event = keyEvent({
    metaKey: true,
    composedPath: () => [page],
    preventDefault: () => {
      prevented = true;
    },
    stopImmediatePropagation: () => {
      stopped = true;
    },
  });

  handleKeydown(event, {
    currentDocument: documentWith({ activeElement: page }),
    platform: "macOS",
    restore: () => {
      restoreCount += 1;
    },
  });

  assert.equal(prevented, true);
  assert.equal(stopped, true);
  assert.equal(restoreCount, 1);
});

test("does not restore additional tabs for a held shortcut", () => {
  const page = element({ localName: "body" });
  let restoreCount = 0;

  handleKeydown(
    keyEvent({
      metaKey: true,
      repeat: true,
      composedPath: () => [page],
    }),
    {
      currentDocument: documentWith({ activeElement: page }),
      platform: "macOS",
      restore: () => {
        restoreCount += 1;
      },
    },
  );

  assert.equal(restoreCount, 0);
});
