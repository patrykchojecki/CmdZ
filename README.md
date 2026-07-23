<p align="center">
  <img src="icons/icon-128.png" width="96" height="96" alt="CmdZ icon">
</p>

<h1 align="center">CmdZ</h1>

<p align="center">
  Reopen your most recently closed Chrome tab with <kbd>Command</kbd> + <kbd>Z</kbd>—without breaking Undo.
</p>

CmdZ works in Google Chrome across desktop operating systems. Its name and
<kbd>Command</kbd> + <kbd>Z</kbd> shortcut are inspired by Safari on macOS.

## What it does

CmdZ has one feature: press <kbd>Command</kbd> + <kbd>Z</kbd> on macOS or
<kbd>Ctrl</kbd> + <kbd>Z</kbd> on Windows and Linux to reopen your most
recently closed individual tab—unless the current page has something to undo.

CmdZ first gives the website its normal Undo shortcut. If the page actually
initiates a native Undo—or explicitly handles the shortcut—CmdZ steps aside. If
nothing handles the shortcut, CmdZ restores the closed tab. In native text
fields and content-editable areas, this still works after Undo history is
exhausted without requiring focus to move. You can also click the CmdZ toolbar
icon to restore a tab directly.

CmdZ uses the `sessions` permission to restore tabs and the `scripting`
permission to attach its small local shortcut listener to web pages, including
pages that were already open when the extension was installed or reloaded. The
listener distinguishes page-level Undo from tab restoration; it does not read
typed text or page contents. There is no popup, settings page, analytics,
network access, third-party dependency, or remotely hosted code.

## Install

For now, install CmdZ locally in a few steps:

1. Download or clone this repository:

   ```sh
   git clone https://github.com/patrykchojecki/CmdZ.git
   ```

   Alternatively, download [`dist/CmdZ-1.0.5.zip`](dist/CmdZ-1.0.5.zip) and extract it.

2. Open `chrome://extensions` in Google Chrome.
3. Enable **Developer mode** in the upper-right corner.
4. Click **Load unpacked**.
5. Select the repository folder, or the folder extracted from the release ZIP.
6. Close a tab and press <kbd>Command</kbd> + <kbd>Z</kbd> on macOS or
   <kbd>Ctrl</kbd> + <kbd>Z</kbd> on Windows and Linux.

### Undo safety

CmdZ leaves the shortcut untouched when:

- Chrome reports a native Undo intention;
- the website handles or prevents the shortcut itself;
- an input method composition is active; or
- the key press is an automatic repeat from holding the shortcut.

Merely focusing a native input or content-editable area does not suppress tab
restoration. Once its native Undo history is exhausted, the next shortcut
restores the closed tab.

Chrome does not allow page listeners on the New Tab page, other `chrome://`
pages, the omnibox, or other browser UI. In those contexts, click the CmdZ
toolbar icon or use Chrome's built-in reopen-tab shortcut.

Custom editors decide for themselves whether to consume Undo. Chrome does not
expose their private Undo stacks to extensions, so CmdZ deliberately does not
promise empty-history detection inside every custom editor.

For bug reports and diagnostic details, see [Support](SUPPORT.md).

## How it works

CmdZ listens for the platform's normal Undo shortcut at the earliest page
phase and lets the trusted keyboard event continue normally. It then checks
whether the page prevented the shortcut or Chrome emitted a `historyUndo`
input event. If neither happened, the listener asks the service worker to
restore the newest closed individual tab by session ID. The listener
automatically attaches to pages that are already open on installation and
reattaches after an update or reload from version 1.0.3 or newer.

If you upgrade directly from 1.0.1 or 1.0.2, refresh tabs that were already
open once. Chrome isolates their old listener after an extension reload, so a
new version cannot safely detach it without reloading the page.

CmdZ requires Chrome 96 or newer and uses only official Chrome extension APIs.

## Privacy

CmdZ does not collect, store, or transmit data. The `sessions` permission is
required solely to identify and restore recently closed tabs. Its page-level
listener checks only the trusted Undo key event and whether the page reported
an Undo intention; it does not read text, field values, or page contents. See
the full [Privacy Policy](PRIVACY.md).

## Chrome Web Store

CmdZ is not currently available in the Chrome Web Store because I have chosen not to pay the required $5 developer registration fee for now. The extension remains free to install locally, and its upload package, listing graphics, dashboard copy, privacy disclosures, and submission checklist are prepared in [Chrome Web Store submission](STORE_LISTING.md).

## Contributing

Contributions are welcome when they preserve CmdZ's focused purpose and minimal permissions. Read the [contribution guide](CONTRIBUTING.md) before opening an issue or pull request, and follow the project's [Code of Conduct](CODE_OF_CONDUCT.md).

Please report suspected vulnerabilities privately as described in the [Security Policy](SECURITY.md).

## Project structure

```text
CmdZ/
├── .github/            # Issue forms and pull request template
├── background.js       # Tab restoration logic
├── content.js          # Undo-safe page shortcut handling
├── recovery.*          # Reattaches the listener after extension reloads
├── manifest.json       # Manifest V3 configuration
├── icons/              # Source and Chrome extension icons
├── store-assets/       # Chrome Web Store listing graphics
├── scripts/            # Release packaging script
├── tests/              # Shortcut policy tests
├── CODE_OF_CONDUCT.md  # Community participation standards
├── CONTRIBUTING.md     # Contribution and development guide
├── SECURITY.md         # Private vulnerability reporting policy
├── PRIVACY.md          # Public privacy policy
├── STORE_LISTING.md    # Dashboard copy and submission checklist
└── dist/               # Ready-to-upload extension package
```

## Development

There is no build step and no dependency installation. Edit the source files, then click **Reload** for CmdZ on `chrome://extensions`.

Run the basic validation checks with:

```sh
node --check background.js
node --check content.js
node --check recovery.js
node --test tests/*.test.js
python3 -m json.tool manifest.json >/dev/null
unzip -t dist/CmdZ-1.0.5.zip
```

To rebuild the distributable archive from the repository root:

```sh
./scripts/package-extension.sh
```

## License

CmdZ is available under the [MIT License](LICENSE).
