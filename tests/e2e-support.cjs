const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");

const projectDirectory = path.resolve(__dirname, "..");
const fixtureDirectory = path.join(__dirname, "fixtures");
const currentExtensionFiles = [
  "manifest.json",
  "background.js",
  "content.js",
  "recovery.html",
  "recovery.js",
];

function findPlaywrightCore() {
  if (process.env.PLAYWRIGHT_CORE) {
    return process.env.PLAYWRIGHT_CORE;
  }

  try {
    return require.resolve("playwright-core");
  } catch {
    // Also support an existing browser-tool installation outside this repo.
  }

  const linksDirectory = path.join(
    process.env.PLAYWRIGHT_BROWSERS_PATH || (
      process.platform === "darwin"
        ? path.join(os.homedir(), "Library/Caches/ms-playwright")
        : process.platform === "win32"
          ? path.join(process.env.LOCALAPPDATA || os.homedir(), "ms-playwright")
          : path.join(process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache"), "ms-playwright")
    ),
    ".links",
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

function findChromeBinary(defaultExecutable) {
  const candidates = [
    process.env.CHROME_BINARY,
    defaultExecutable,
  ].filter(Boolean);

  return candidates.find(fs.existsSync);
}

const playwrightCore = findPlaywrightCore();

if (!playwrightCore) {
  throw new Error(
    "playwright-core was not found. Set PLAYWRIGHT_CORE to its directory.",
  );
}

const { chromium } = require(playwrightCore);
const chromeBinary = findChromeBinary(chromium.executablePath());

if (!chromeBinary) {
  throw new Error(
    "Chrome for Testing was not found. Set CHROME_BINARY to its executable.",
  );
}

function contentType(filePath) {
  return filePath.endsWith(".html")
    ? "text/html; charset=utf-8"
    : "text/plain";
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
      await restoredPage.waitForLoadState("domcontentloaded", { timeout: 10000 });
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

function copyProjectFiles(extensionDirectory, files) {
  for (const file of files) {
    fs.copyFileSync(
      path.join(projectDirectory, file),
      path.join(extensionDirectory, file),
    );
  }
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
    version: "1.0.4",
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
  copyProjectFiles(extensionDirectory, [
    "background.js",
    "recovery.html",
    "recovery.js",
  ]);
  fs.copyFileSync(
    path.join(fixtureDirectory, "legacy-content.js"),
    path.join(extensionDirectory, "content.js"),
  );

  return extensionDirectory;
}

async function loadUnpackedExtension(context, extensionDirectory) {
  const browser = context.browser();
  assert.ok(browser, "Playwright did not expose the Chrome browser session");
  const session = await browser.newBrowserCDPSession();

  try {
    const { id } = await session.send("Extensions.loadUnpacked", {
      path: extensionDirectory,
    });
    assert.equal(typeof id, "string", "Chrome did not load CmdZ");
  } finally {
    await session.detach();
  }

  await waitForShortcutListeners(context);
}

async function waitForShortcutListeners(context) {
  const worker = context.serviceWorkers().find((item) =>
    item.url().startsWith("chrome-extension://"),
  ) || await context.waitForEvent("serviceworker");
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const ready = await worker.evaluate(async () => {
      const tabs = (await chrome.tabs.query({})).filter((tab) =>
        /^https?:/.test(tab.url || ""),
      );
      const results = await Promise.all(tabs.map((tab) =>
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => Boolean(globalThis.__cmdzShortcutListener),
        }),
      ));
      return results.length > 0 && results.every((frames) => frames[0]?.result);
    });
    if (ready) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail("CmdZ did not attach its shortcut listener to the open pages");
}

async function setExtensionEnabled(page, extensionId, enabled) {
  await page.evaluate(({ extensionId, enabled }) => {
    const item = document.querySelector("extensions-manager").shadowRoot
      .querySelector("extensions-item-list").shadowRoot.querySelector(`#${extensionId}`);
    const toggle = item.shadowRoot.querySelector("#enableToggle");
    if (toggle.checked !== enabled) toggle.click();
  }, { extensionId, enabled });
  await page.waitForFunction(({ extensionId, enabled }) => {
    const item = document.querySelector("extensions-manager").shadowRoot
      .querySelector("extensions-item-list").shadowRoot.querySelector(`#${extensionId}`);
    return item.data.state === (enabled ? "ENABLED" : "DISABLED");
  }, { extensionId, enabled });
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

  copyProjectFiles(extensionDirectory, currentExtensionFiles);

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
  assert.equal(extensionState?.state, "ENABLED", JSON.stringify(extensionState));
  assert.deepEqual(extensionState.manifestErrors, []);
  assert.deepEqual(extensionState.runtimeWarnings, []);
  return extensionState;
}

async function assertNoRestore(context, marker) {
  const pagesBefore = context.pages();
  const restoredPage = await waitForRestoredTab(context, marker, 500);
  assert.equal(restoredPage, null, `CmdZ restored ${marker} inside an editor`);
  assert.deepEqual(context.pages(), pagesBefore, "CmdZ unexpectedly opened a different tab");
}

async function assertRestoredTab(context, marker, failureMessage) {
  const restoredPage = await waitForRestoredTab(context, marker);
  assert.ok(restoredPage, failureMessage);
  await restoredPage.close();
}

module.exports = {
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
  waitForShortcutListeners,
  waitForRestoredTab,
};
