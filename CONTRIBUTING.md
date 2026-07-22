# Contributing to CmdZ

Thanks for helping improve CmdZ. The project intentionally does one thing: it reopens the most recently closed Chrome tab when you press **Command + Z** on macOS.

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

Chrome may not assign **Command + Z** automatically if another shortcut conflicts. Check `chrome://extensions/shortcuts` before reporting shortcut behavior.

## Project principles

Changes should preserve the project's small footprint and privacy guarantees:

- no analytics, telemetry, advertising, or network requests;
- no remotely hosted code or third-party runtime dependencies;
- no host permissions or access to page content;
- only the minimum Chrome permission needed to restore a closed tab; and
- no popup or settings page unless a future requirement clearly justifies one.

## Validate your change

Run the basic checks from the repository root:

```sh
node --check background.js
python3 -m json.tool manifest.json >/dev/null
./scripts/package-extension.sh
unzip -t dist/CmdZ-1.0.0.zip
```

Then test the extension manually:

1. Reload CmdZ at `chrome://extensions`.
2. Open and close a tab.
3. Press **Command + Z**.
4. Confirm that the most recently closed individual tab reopens.

## Pull requests

- Keep each pull request focused and explain the user-visible effect.
- Link any related issue.
- Include screenshots when changing icons or store assets.
- Update documentation when behavior, permissions, or release steps change.
- Do not change the manifest version unless the pull request is preparing a release.

By contributing, you agree that your contribution will be licensed under the project's [MIT License](LICENSE).
