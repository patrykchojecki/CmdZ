const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  assertNoRestore,
  assertRestoredTab,
  chromeBinary,
  chromium,
  closeRestorableTab,
  createUpgradeableExtensionDirectory,
  loadUnpackedExtension,
  reloadExtension,
  startFixtureServer,
  waitForRestoredTab,
} = require("./e2e-support.cjs");

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
    await loadUnpackedExtension(context, extensionDirectory);

    const page = context.pages()[0] || (await context.newPage());
    await page.goto(`${origin}/runtime.html`);

    await closeRestorableTab(context, origin, "plain-page");
    await page.locator("body").focus();
    await page.keyboard.press("Meta+z");

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
    await page.keyboard.press("Meta+z");

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
    await page.keyboard.press("Meta+z");

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

    await closeRestorableTab(context, origin, "native-input");
    const input = page.locator("#native-input");
    await input.focus();
    await input.pressSequentially("draft");
    await page.keyboard.press("Meta+z");
    await assertNoRestore(context, "native-input");
    assert.notEqual(await input.inputValue(), "draft");

    await closeRestorableTab(context, origin, "empty-native-input");
    await page.keyboard.press("Meta+z");
    await assertRestoredTab(
      context,
      "empty-native-input",
      "CmdZ did not restore a tab after the focused input exhausted its undo history",
    );

    await closeRestorableTab(context, origin, "contenteditable");
    const contenteditable = page.locator("#contenteditable");
    await contenteditable.focus();
    await contenteditable.pressSequentially(" draft");
    await page.keyboard.press("Meta+z");
    await assertNoRestore(context, "contenteditable");
    assert.equal(
      (await contenteditable.textContent()).includes("draft"),
      false,
    );

    await closeRestorableTab(context, origin, "empty-contenteditable");
    await page.keyboard.press("Meta+z");
    await assertRestoredTab(
      context,
      "empty-contenteditable",
      "CmdZ did not restore a tab after contenteditable exhausted its undo history",
    );

    await closeRestorableTab(context, origin, "custom-application");
    await page.locator("#application").focus();
    await page.keyboard.press("Meta+z");
    await assertNoRestore(context, "custom-application");
    assert.equal(await page.evaluate(() => window.applicationUndoCount), 1);

    await closeRestorableTab(context, origin, "stopped-keydown");
    await page.locator("#stopped-keydown").focus();
    await page.keyboard.press("Meta+z");
    await assertRestoredTab(
      context,
      "stopped-keydown",
      "CmdZ did not restore after the target stopped keydown propagation",
    );

    await closeRestorableTab(context, origin, "stopped-beforeinput");
    const stoppedBeforeInput = page.locator("#stopped-beforeinput");
    await stoppedBeforeInput.focus();
    await stoppedBeforeInput.pressSequentially("draft");
    await page.keyboard.press("Meta+z");
    await assertNoRestore(context, "stopped-beforeinput");
    assert.notEqual(await stoppedBeforeInput.inputValue(), "draft");

    await closeRestorableTab(
      context,
      origin,
      "empty-stopped-beforeinput",
    );
    await page.keyboard.press("Meta+z");
    await assertRestoredTab(
      context,
      "empty-stopped-beforeinput",
      "CmdZ did not restore after the propagation-stopping input exhausted its undo history",
    );

    await closeRestorableTab(context, origin, "docs-frame");
    const docsBody = page.frameLocator("#docs-frame").locator("body");
    await docsBody.focus();
    await docsBody.pressSequentially(" draft");
    await page.keyboard.press("Meta+z");
    await assertNoRestore(context, "docs-frame");

    await page.locator("body").focus();
    await page.keyboard.press("Meta+z");
    await assertRestoredTab(
      context,
      "docs-frame",
      "CmdZ did not resume tab restoration after editing",
    );

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
