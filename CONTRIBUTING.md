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
./scripts/package-extension.sh
unzip -t dist/CmdZ-1.0.4.zip
```

Then test the extension manually:

1. Reload CmdZ at `chrome://extensions` while leaving the test page open.
2. Type in an input, press Undo, and confirm that the text change is undone
   without reopening a tab.
3. Press Undo again after the input's history is exhausted and confirm that the
   closed tab now reopens without moving focus.
4. Repeat both checks in a content-editable or application-style editor.
5. Close a different tab, focus a non-editable web page, and press the
   platform's Undo shortcut.
6. Confirm that the most recently closed individual tab reopens.
7. Confirm that clicking the toolbar icon also restores a closed tab.
8. Return to the page that stayed open during the extension reload and confirm
   that the shortcut still works without refreshing it.

## Pull requests

- Keep each pull request focused and explain the user-visible effect.
- Link any related issue.
- Include screenshots when changing icons or store assets.
- Update documentation when behavior, permissions, or release steps change.
- Do not change the manifest version unless the pull request is preparing a release.

By contributing, you agree that your contribution will be licensed under the project's [MIT License](LICENSE).
