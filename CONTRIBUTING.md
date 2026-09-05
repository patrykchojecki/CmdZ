# Contributing to CmdZ

Thanks for helping improve CmdZ. The project intentionally does one thing: it
reopens the most recently closed Chrome tab when the platform's Undo shortcut
has no page-level editing work to do. CmdZ works across desktop operating
systems; its **Command + Z** behavior is inspired by Safari on macOS.

## Before you start

- Search the [existing issues](https://github.com/patrykchojecki/CmdZ/issues) before opening a new one.
- Use the provided issue forms for bug reports and feature requests.
- Keep proposals within CmdZ's single-purpose scope.
- Report security problems privately as described in [SECURITY.md](SECURITY.md).

## Local development

CmdZ has no dependencies and no build step.

1. Fork and clone the repository.
2. Open `chrome://extensions` in Google Chrome.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the repository folder.
5. After editing the extension, click **Reload** on CmdZ's extension card.

CmdZ handles **Command + Z** on macOS and **Ctrl + Z** on Windows and Linux
inside web pages. Do not register these combinations through `chrome.commands`;
browser-scoped commands consume the shortcut before page editors can undo.

## Project principles

Changes should preserve the project's small footprint and privacy guarantees:

- no analytics, telemetry, advertising, or network requests;
- no remotely hosted code or third-party runtime dependencies;
- no reading or modification of text, field values, or page contents;
- limit the page-level listener to trusted shortcut and Undo outcome events;
- only the minimum Chrome permissions needed to restore tabs and keep the
  page listener attached after extension reloads; and
- no popup or settings page unless a future requirement clearly justifies one.

## Validate your change

Run the basic checks from the repository root:

```sh
node --check background.js
node --check content.js
node --check recovery.js
node --test tests/*.test.js
python3 -m json.tool manifest.json >/dev/null
```

The automated runtime suite additionally requires an existing `playwright-core`
installation and a recent Chrome for Testing binary with `Extensions.loadUnpacked`
support. These are test tools, not extension dependencies. It uses Playwright's
installed browser by default; set `PLAYWRIGHT_CORE` or `CHROME_BINARY` when those are in custom
locations:

```sh
node tests/e2e.cjs
```

The suite uses temporary profiles and local fixtures. It covers native Undo and
exhausted histories, textarea/password/shadow-DOM inputs, canceled Undo, custom
handlers, held keys, modifiers, dynamic frames, installation, extension reloads,
worker restart, tab restoration order, and skipping closed windows.
The Node tests also exercise concurrent restores, API failures, and recovery cleanup.

Manually verify behavior that depends on the OS, browser UI, or real editors:

1. On each supported OS/browser, close a tab, type in a native field, and Undo:
   the edit must undo first; after native history is exhausted, a fresh press
   should restore the tab. Repeat in a textarea and contenteditable. History can
   span fields, so use a fresh page for independent cases.
2. In a real custom editor (for example, Docs or a canvas editor), Undo an edit.
   No tab should open when the editor cancels the shortcut. Empty custom history
   may still consume Undo; use the toolbar in that case.
3. With a real IME active, compose text and press the shortcut: no tab should
   restore during composition. Check Caps Lock and a non-US keyboard layout.
4. Close tabs A, B, C in that order and press the shortcut three times: expect
   C, B, A. Close a separate window: CmdZ must skip the window session.
5. In New Tab, the omnibox, `chrome://settings`, the Web Store, and a local file,
   verify native browser behavior and use the toolbar to restore a closed tab.
6. Leave pages and frames open across installation, update, reload, disable/enable,
   and a full browser restart with session restore. Check a previously hidden tab
   after returning to it. If site access or a frame policy blocks recovery,
   refreshing the page once should attach the listener.
7. On the oldest supported Chrome version (96), repeat native Undo, empty-history
   restore, and reload checks; current Chrome for Testing does not verify that baseline.

When preparing a release, update the manifest version and package links, then run:

```sh
./scripts/package-extension.sh
unzip -t dist/CmdZ-<version>.zip
```

The packaging script validates syntax, tests, and the manifest before archiving.
Do not overwrite a released ZIP merely to validate a development change.

## Pull requests

- Keep each pull request focused and explain the user-visible effect.
- Link any related issue.
- Include screenshots when changing icons or store assets.
- Update documentation when behavior, permissions, or release steps change.
- Do not change the manifest version unless the pull request is preparing a release.

By contributing, you agree that your contribution will be licensed under the project's [MIT License](LICENSE).
