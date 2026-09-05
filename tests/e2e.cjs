const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const {
  assertNoRestore,
  assertRestoredTab,
  chromeBinary,
  chromium,
  closeRestorableTab,
  createUpgradeableExtensionDirectory,
  loadUnpackedExtension,
  reloadExtension,
  setExtensionEnabled,
  startFixtureServer,
  triggerToolbarAction,
  waitForShortcutListeners,
  waitForRestoredTab,
} = require("./e2e-support.cjs");

const modifier = process.platform === "darwin" ? "Meta" : "Control";
const undo = `${modifier}+z`;

async function run() {
  const { origin, server } = await startFixtureServer();
  const profileDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "cmdz-e2e-profile-"),
  );
  const extensionDirectory = createUpgradeableExtensionDirectory();
  let context;

  try {
    context = await chromium.launchPersistentContext(profileDirectory, {
      executablePath: chromeBinary,
      headless: true,
      ignoreDefaultArgs: ["--disable-extensions"],
      args: ["--enable-unsafe-extension-debugging"],
    });
    context.setDefaultTimeout(10000);
    context.setDefaultNavigationTimeout(10000);
    const page = context.pages()[0] || (await context.newPage());
    await page.goto(`${origin}/runtime.html`);
    // Install into an already-open document, then exercise upgrade and reload.
    await loadUnpackedExtension(context, extensionDirectory);

    await triggerToolbarAction(context, page);
    await page.waitForTimeout(200);
    assert.equal(context.pages().length, 1, "An empty session history should do nothing");

    await closeRestorableTab(context, origin, "plain-page");
    await page.locator("body").focus();
    await page.keyboard.press(undo);

    const plainRestore = await waitForRestoredTab(context, "plain-page");
    assert.ok(
      plainRestore,
      `CmdZ did not restore a tab on a plain page. Events: ${JSON.stringify(
        await page.evaluate(() => window.shortcutEvents),
      )}`,
    );
    await plainRestore.close();

    const extensionState = await reloadExtension(
      context,
      extensionDirectory,
    );
    await closeRestorableTab(context, origin, "extension-reload");
    await page.locator("body").focus();
    await page.keyboard.press(undo);

    const reloadRestore = await waitForRestoredTab(context, "extension-reload");
    assert.ok(
      reloadRestore,
      `CmdZ did not restore a tab on a page that survived an extension reload. ${JSON.stringify(
        {
          frames: page.frames().map((frame) => frame.url()),
          serviceWorkers: context
            .serviceWorkers()
            .map((worker) => worker.url()),
          extensionState,
        },
      )}`,
    );
    await reloadRestore.close();

    const sameVersionState = await reloadExtension(
      context,
      extensionDirectory,
    );
    await closeRestorableTab(context, origin, "same-version-reload");
    await page.locator("body").focus();
    await page.keyboard.press(undo);

    const sameVersionRestore = await waitForRestoredTab(
      context,
      "same-version-reload",
    );
    assert.ok(
      sameVersionRestore,
      `CmdZ did not recover after reloading the current version. ${JSON.stringify(
        sameVersionState,
      )}`,
    );
    await sameVersionRestore.close();

    // A disabled extension's recovery frame loads an error page and never
    // acknowledges repair. Re-enabling must recover without refreshing the site.
    const extensionId = new URL(context.serviceWorkers()[0].url()).host;
    const extensionsPage = await context.newPage();
    await extensionsPage.goto(`chrome://extensions/?id=${extensionId}`);
    await setExtensionEnabled(extensionsPage, extensionId, false);
    await page.bringToFront();
    const recoveryDeadline = Date.now() + 5000;
    while (!page.frames().some((frame) => frame.url().startsWith("chrome-error:"))) {
      assert.ok(Date.now() < recoveryDeadline, "No failed recovery frame appeared while disabled");
      await page.waitForTimeout(50);
    }
    await extensionsPage.bringToFront();
    await setExtensionEnabled(extensionsPage, extensionId, true);
    await page.bringToFront();
    await waitForShortcutListeners(context);
    await extensionsPage.close();
    await closeRestorableTab(context, origin, "re-enabled");
    await page.locator("body").focus();
    await page.keyboard.press(undo);
    await assertRestoredTab(context, "re-enabled", "CmdZ did not recover after disable/re-enable");

    await closeRestorableTab(context, origin, "hidden-beforeinput");
    const hiddenBeforeInput = page.locator("#hidden-beforeinput");
    await hiddenBeforeInput.focus();
    await hiddenBeforeInput.pressSequentially("draft");
    await page.keyboard.press(undo);
    await assertNoRestore(context, "hidden-beforeinput");
    assert.equal(await hiddenBeforeInput.inputValue(), "");

    await closeRestorableTab(context, origin, "empty-hidden-beforeinput");
    await page.keyboard.press(undo);
    await assertRestoredTab(context, "empty-hidden-beforeinput",
      "CmdZ did not restore after the hidden-beforeinput field exhausted Undo");

    await closeRestorableTab(context, origin, "native-input");
    const input = page.locator("#native-input");
    await input.focus();
    await input.pressSequentially("draft");
    await page.keyboard.press(undo);
    await assertNoRestore(context, "native-input");
    assert.notEqual(await input.inputValue(), "draft");

    await closeRestorableTab(context, origin, "empty-native-input");
    await page.keyboard.press(undo);
    await assertRestoredTab(
      context,
      "empty-native-input",
      "CmdZ did not restore a tab after the focused input exhausted its undo history",
    );

    await closeRestorableTab(context, origin, "contenteditable");
    const contenteditable = page.locator("#contenteditable");
    await contenteditable.focus();
    await contenteditable.pressSequentially(" draft");
    await page.keyboard.press(undo);
    await assertNoRestore(context, "contenteditable");
    assert.equal(
      (await contenteditable.textContent()).includes("draft"),
      false,
    );

    await closeRestorableTab(context, origin, "empty-contenteditable");
    await page.keyboard.press(undo);
    await assertRestoredTab(
      context,
      "empty-contenteditable",
      "CmdZ did not restore a tab after contenteditable exhausted its undo history",
    );

    await closeRestorableTab(context, origin, "custom-application");
    await page.locator("#application").focus();
    await page.keyboard.press(undo);
    await assertNoRestore(context, "custom-application");
    assert.equal(await page.evaluate(() => window.applicationUndoCount), 1);

    await closeRestorableTab(context, origin, "stopped-keydown");
    await page.locator("#stopped-keydown").focus();
    await page.keyboard.press(undo);
    await assertRestoredTab(
      context,
      "stopped-keydown",
      "CmdZ did not restore after the target stopped keydown propagation",
    );

    await closeRestorableTab(context, origin, "stopped-beforeinput");
    const stoppedBeforeInput = page.locator("#stopped-beforeinput");
    await stoppedBeforeInput.focus();
    await stoppedBeforeInput.pressSequentially("draft");
    await page.keyboard.press(undo);
    await assertNoRestore(context, "stopped-beforeinput");
    assert.notEqual(await stoppedBeforeInput.inputValue(), "draft");

    await closeRestorableTab(
      context,
      origin,
      "empty-stopped-beforeinput",
    );
    await page.keyboard.press(undo);
    await assertRestoredTab(
      context,
      "empty-stopped-beforeinput",
      "CmdZ did not restore after the propagation-stopping input exhausted its undo history",
    );

    await closeRestorableTab(context, origin, "docs-frame");
    const docsBody = page.frameLocator("#docs-frame").locator("body");
    await docsBody.focus();
    await docsBody.pressSequentially(" draft");
    await page.keyboard.press(undo);
    await assertNoRestore(context, "docs-frame");

    await page.keyboard.press(undo);
    await assertRestoredTab(
      context,
      "docs-frame",
      "CmdZ did not restore inside the existing frame after Undo was exhausted",
    );

    // Now exercise the static document_start listener on a fresh document.
    await page.reload();
    for (const id of ["textarea", "password", "shadow-input"]) {
      await closeRestorableTab(context, origin, id);
      const field = page.locator(`#${id}`);
      await field.focus();
      await field.pressSequentially("draft");
      await page.keyboard.press(undo);
      await assertNoRestore(context, id);
      assert.equal(await field.inputValue(), "", id);
      await page.keyboard.press(undo);
      await assertRestoredTab(context, id, `Empty ${id} did not restore`);
    }

    await closeRestorableTab(context, origin, "canceled-beforeinput");
    const canceledInput = page.locator("#canceled-beforeinput");
    await canceledInput.focus();
    await canceledInput.pressSequentially("draft");
    await page.keyboard.press(undo);
    await assertNoRestore(context, "canceled-beforeinput");
    assert.equal(await canceledInput.inputValue(), "draft");

    // Chrome's native Undo history can span fields in the same document.
    await page.reload();
    await closeRestorableTab(context, origin, "held-undo");
    const repeatInput = page.locator("#native-input");
    await repeatInput.focus();
    await repeatInput.pressSequentially("draft");
    await page.keyboard.down(modifier);
    await page.keyboard.down("z");
    await page.keyboard.down("z");
    await page.keyboard.up("z");
    await page.keyboard.up(modifier);
    await assertNoRestore(context, "held-undo");
    assert.equal(await repeatInput.inputValue(), "");
    await page.keyboard.press(undo);
    await assertRestoredTab(context, "held-undo", "A fresh press after a held Undo did not restore");

    await closeRestorableTab(context, origin, "other-shortcuts");
    await page.locator("body").focus();
    for (const shortcut of [
      `${modifier}+Shift+z`, `${modifier}+Alt+z`, "Meta+Control+z",
    ]) {
      await page.keyboard.press(shortcut);
    }
    await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", {
      key: "z", metaKey: true, ctrlKey: false, bubbles: true,
    })));
    await assertNoRestore(context, "other-shortcuts");

    for (const kind of ["srcdoc", "blank", "same-origin", "cross-origin"]) {
      const id = `dynamic-${kind}`;
      await page.evaluate(({ id, kind, origin }) => {
        const frame = document.createElement("iframe");
        frame.id = id;
        const markup = '<!doctype html><body tabindex="0"><input id="frame-input"></body>';
        if (kind === "srcdoc") frame.srcdoc = markup;
        if (kind === "same-origin") frame.src = `${origin}/frame.html`;
        if (kind === "cross-origin") frame.src = `${origin.replace("127.0.0.1", "localhost")}/frame.html`;
        document.body.append(frame);
        if (kind === "blank") frame.contentDocument.body.innerHTML = '<input id="frame-input">';
      }, { id, kind, origin });
      const field = page.frameLocator(`#${id}`).locator("#frame-input");
      await field.waitFor();
      await closeRestorableTab(context, origin, id);
      await field.focus();
      await field.pressSequentially("draft");
      await page.keyboard.press(undo);
      await assertNoRestore(context, id);
      assert.equal(await field.inputValue(), "", kind);
      await page.keyboard.press(undo);
      await assertRestoredTab(context, id, `Empty ${kind} frame did not restore`);
    }

    // The modifier checks include Redo, which can repopulate native history.
    await page.reload();
    await closeRestorableTab(context, origin, "worker-restart");
    const worker = context.serviceWorkers().find((item) => item.url().startsWith("chrome-extension://"));
    assert.ok(worker);
    await worker.evaluate(() => { globalThis.__cmdzRestartProbe = true; });
    const session = await context.newCDPSession(page);
    await session.send("ServiceWorker.enable");
    await session.send("ServiceWorker.stopAllWorkers");
    await session.detach();
    await page.locator("body").focus();
    await page.keyboard.press(undo);
    await assertRestoredTab(context, "worker-restart", "A shortcut did not wake the stopped worker");
    // Playwright retains its Worker handle across MV3 restarts. Verify that
    // the worker's previous global state was actually discarded.
    assert.equal(await worker.evaluate(() => globalThis.__cmdzRestartProbe), undefined,
      "The worker did not restart with a fresh global scope");

    for (const marker of ["rapid-a", "rapid-b", "rapid-c"]) {
      await closeRestorableTab(context, origin, marker);
    }
    const restoredTabs = [];
    for (const marker of ["rapid-c", "rapid-b", "rapid-a"]) {
      await page.bringToFront();
      await page.locator("body").focus();
      await page.keyboard.press(undo);
      const restored = await waitForRestoredTab(context, marker);
      assert.ok(restored, `Tabs were not restored in closing order: ${marker}`);
      restoredTabs.push(restored);
    }
    for (const restored of restoredTabs) await restored.close();

    await closeRestorableTab(context, origin, "skip-window");
    const restartedWorker = context.serviceWorkers().find((item) => item.url() === worker.url());
    const windowPagePromise = context.waitForEvent("page");
    const windowId = await restartedWorker.evaluate(async (origin) => {
      const created = await chrome.windows.create({ url: `${origin}/frame.html?closed=whole-window` });
      return created.id;
    }, origin);
    const windowPage = await windowPagePromise;
    await windowPage.waitForLoadState("domcontentloaded");
    await restartedWorker.evaluate((id) => chrome.windows.remove(id), windowId);
    await page.bringToFront();
    await page.locator("body").focus();
    await page.keyboard.press(undo);
    await assertRestoredTab(context, "skip-window", "A newer window session hid the newest individual tab");
    assert.equal(context.pages().some((item) => item.url().includes("closed=whole-window")), false);

    for (const [marker, url] of [
      ["toolbar-settings", "chrome://settings/"],
      ["toolbar-newtab", "chrome://newtab/"],
      ["toolbar-file", pathToFileURL(path.join(__dirname, "fixtures/frame.html")).href],
    ]) {
      await page.goto(url);
      await closeRestorableTab(context, origin, marker);
      await triggerToolbarAction(context, page);
      await assertRestoredTab(context, marker, `Toolbar restoration failed on ${url}`);
    }

    await page.goto(`${origin}/runtime.html`);
    for (const marker of ["toolbar-fast-a", "toolbar-fast-b", "toolbar-fast-c"]) {
      await closeRestorableTab(context, origin, marker);
    }
    await Promise.all(Array.from({ length: 3 }, () => triggerToolbarAction(context, page)));
    const fastRestores = [];
    for (const marker of ["toolbar-fast-a", "toolbar-fast-b", "toolbar-fast-c"]) {
      const restored = await waitForRestoredTab(context, marker);
      assert.ok(restored, `Rapid toolbar clicks lost ${marker}`);
      fastRestores.push(restored);
    }
    for (const restored of fastRestores) await restored.close();

    await page.goto(`${origin}/frame.html`);
    await page.goBack();
    await closeRestorableTab(context, origin, "back-navigation");
    await page.locator("body").focus();
    await page.keyboard.press(undo);
    await assertRestoredTab(context, "back-navigation", "The shortcut stopped after back navigation");

    console.log("Verified native and canceled Undo, empty histories, custom handlers, repeat, modifiers, dynamic frames, install, released-ZIP upgrade, reload, disable/re-enable, worker restart, tab order, closed-window skipping, toolbar fallbacks, rapid clicks, and back navigation.");

    console.log(
      `CmdZ runtime checks passed in ${path.basename(chromeBinary)} ${
        context.browser().version()
      }.`,
    );
  } finally {
    await context?.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(profileDirectory, { recursive: true, force: true });
    fs.rmSync(extensionDirectory, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
