const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

function findPlaywrightCore() {
  if (process.env.PLAYWRIGHT_CORE) {
    return process.env.PLAYWRIGHT_CORE;
  }

  const linksDirectory = path.join(
    os.homedir(),
    "Library/Caches/ms-playwright/.links",
  );

  if (!fs.existsSync(linksDirectory)) {
    return null;
  }

  for (const linkName of fs.readdirSync(linksDirectory)) {
    const linkedDirectory = fs
      .readFileSync(path.join(linksDirectory, linkName), "utf8")
      .trim();
    const playwrightDirectory = [
      linkedDirectory,
      path.join(linkedDirectory, "node_modules/playwright-core"),
    ].find((directory) =>
      fs.existsSync(path.join(directory, "package.json")),
    );

    if (playwrightDirectory) {
      return playwrightDirectory;
    }
  }

  return null;
}

const playwrightCore = findPlaywrightCore();

if (!playwrightCore) {
  throw new Error(
    "playwright-core was not found. Set PLAYWRIGHT_CORE to its directory.",
  );
}

const { chromium } = require(playwrightCore);

const projectDirectory = path.resolve(__dirname, "..");
const fixtureDirectory = path.join(__dirname, "fixtures");
const chromeCandidates = [
  process.env.CHROME_BINARY,
  path.join(
    os.homedir(),
    "Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64",
    "Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
  ),
].filter(Boolean);
const chromeBinary = chromeCandidates.find(fs.existsSync);

if (!chromeBinary) {
  throw new Error(
    "Chrome for Testing was not found. Set CHROME_BINARY to its executable.",
  );
}

function contentType(filePath) {
  return filePath.endsWith(".html") ? "text/html; charset=utf-8" : "text/plain";
}

function startFixtureServer() {
  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url, "http://127.0.0.1");
    const relativePath =
      requestUrl.pathname === "/"
        ? "runtime.html"
        : requestUrl.pathname.replace(/^\/+/, "");
    const filePath = path.join(fixtureDirectory, relativePath);

    if (!filePath.startsWith(`${fixtureDirectory}${path.sep}`)) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    try {
      const body = fs.readFileSync(filePath);
      response.writeHead(200, { "content-type": contentType(filePath) });
      response.end(body);
    } catch {
      response.writeHead(404).end("Not found");
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      resolve({
        origin: `http://127.0.0.1:${server.address().port}`,
        server,
      });
    });
  });
}

async function waitForRestoredTab(context, marker, timeout = 3000) {
  const deadline = Date.now() + timeout;

  while (Date.now() < deadline) {
    const restoredPage = context
      .pages()
      .find((page) => page.url().includes(`closed=${marker}`));

    if (restoredPage) {
      await restoredPage.waitForLoadState("domcontentloaded");
      return restoredPage;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return null;
}

async function closeRestorableTab(context, origin, marker) {
  const page = await context.newPage();
  await page.goto(`${origin}/runtime.html?closed=${marker}`);
  await page.close();
}

function createUpgradeableExtensionDirectory() {
  const extensionDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "cmdz-e2e-extension-"),
  );
  const manifest = JSON.parse(
    fs.readFileSync(path.join(projectDirectory, "manifest.json"), "utf8"),
  );
  const legacyManifest = {
    ...manifest,
    version: "1.0.3",
  };

  fs.cpSync(
    path.join(projectDirectory, "icons"),
    path.join(extensionDirectory, "icons"),
    { recursive: true },
  );

  fs.writeFileSync(
    path.join(extensionDirectory, "manifest.json"),
    `${JSON.stringify(legacyManifest, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(extensionDirectory, "background.js"),
    fs.readFileSync(path.join(projectDirectory, "background.js")),
  );
  fs.writeFileSync(
    path.join(extensionDirectory, "content.js"),
    `document.addEventListener("keydown", (event) => {
  if (!event.metaKey || event.key.toLowerCase() !== "z") return;
  if (event.target.matches("input, textarea, [contenteditable=true], [role=application]")) return;
  if (typeof chrome.runtime?.id !== "string") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  chrome.runtime.sendMessage({ type: "reopen-last-closed-tab" });
});
`,
  );
  fs.copyFileSync(
    path.join(projectDirectory, "recovery.html"),
    path.join(extensionDirectory, "recovery.html"),
  );
  fs.copyFileSync(
    path.join(projectDirectory, "recovery.js"),
    path.join(extensionDirectory, "recovery.js"),
  );

  return extensionDirectory;
}

async function reloadExtension(context, extensionDirectory) {
  const serviceWorker = context
    .serviceWorkers()
    .find((worker) => worker.url().startsWith("chrome-extension://"));

  assert.ok(serviceWorker, "CmdZ service worker was not running");
  const extensionId = new URL(serviceWorker.url()).host;
  const extensionsPage = await context.newPage();
  await extensionsPage.goto(`chrome://extensions/?id=${extensionId}`);

  await extensionsPage.evaluate(() => {
    const manager = document.querySelector("extensions-manager");
    const toolbar = manager.shadowRoot.querySelector("extensions-toolbar");
    const devModeToggle = toolbar.shadowRoot.querySelector("#devMode");

    if (!devModeToggle.checked) {
      devModeToggle.click();
    }
  });

  await extensionsPage.waitForFunction(() => {
    const manager = document.querySelector("extensions-manager");
    const toolbar = manager.shadowRoot.querySelector("extensions-toolbar");
    return toolbar.shadowRoot.querySelector("#devMode").checked;
  });

  for (const file of [
    "manifest.json",
    "background.js",
    "content.js",
    "recovery.html",
    "recovery.js",
  ]) {
    fs.copyFileSync(
      path.join(projectDirectory, file),
      path.join(extensionDirectory, file),
    );
  }

  await extensionsPage.evaluate((id) => {
    const manager = document.querySelector("extensions-manager");
    const itemList = manager.shadowRoot.querySelector("extensions-item-list");
    const item = itemList.shadowRoot.querySelector(`#${id}`);
    item.shadowRoot.querySelector("#dev-reload-button").click();
  }, extensionId);

  await new Promise((resolve) => setTimeout(resolve, 2000));
  const extensionState = await extensionsPage.evaluate((id) => {
    const manager = document.querySelector("extensions-manager");
    const itemList = manager.shadowRoot.querySelector("extensions-item-list");
    const item = itemList.shadowRoot.querySelector(`#${id}`);

    return item
      ? {
          disableReasons: item.data.disableReasons,
          manifestErrors: item.data.manifestErrors,
          runtimeWarnings: item.data.runtimeWarnings,
          state: item.data.state,
          version: item.data.version,
        }
      : null;
  }, extensionId);
  await extensionsPage.close();
  return extensionState;
}

async function assertNoRestore(context, marker) {
  const restoredPage = await waitForRestoredTab(context, marker, 500);
  assert.equal(restoredPage, null, `CmdZ restored ${marker} inside an editor`);
}

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
      args: [
        `--disable-extensions-except=${extensionDirectory}`,
        `--load-extension=${extensionDirectory}`,
      ],
    });

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
    const emptyInputRestore = await waitForRestoredTab(
      context,
      "empty-native-input",
    );
    assert.ok(
      emptyInputRestore,
      "CmdZ did not restore a tab after the focused input exhausted its undo history",
    );
    await emptyInputRestore.close();

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
    const emptyContenteditableRestore = await waitForRestoredTab(
      context,
      "empty-contenteditable",
    );
    assert.ok(
      emptyContenteditableRestore,
      "CmdZ did not restore a tab after contenteditable exhausted its undo history",
    );
    await emptyContenteditableRestore.close();

    await closeRestorableTab(context, origin, "custom-application");
    await page.locator("#application").focus();
    await page.keyboard.press("Meta+z");
    await assertNoRestore(context, "custom-application");
    assert.equal(await page.evaluate(() => window.applicationUndoCount), 1);

    await closeRestorableTab(context, origin, "docs-frame");
    const docsBody = page.frameLocator("#docs-frame").locator("body");
    await docsBody.focus();
    await docsBody.pressSequentially(" draft");
    await page.keyboard.press("Meta+z");
    await assertNoRestore(context, "docs-frame");

    await page.locator("body").focus();
    await page.keyboard.press("Meta+z");
    const finalRestore = await waitForRestoredTab(context, "docs-frame");
    assert.ok(finalRestore, "CmdZ did not resume tab restoration after editing");

    console.log("CmdZ runtime checks passed in Chrome for Testing.");
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
