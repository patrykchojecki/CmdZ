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

When an input, editor, or application-style editing surface is focused, CmdZ
steps aside and the website receives its normal Undo shortcut. This includes
editors such as Google Docs. You can also click the CmdZ toolbar icon to restore
a tab directly.

CmdZ requests only the `sessions` permission. A small local shortcut listener
runs on web pages so it can distinguish page-level Undo from tab restoration.
It does not read typed text or page contents. There is no popup, settings page,
analytics, network access, third-party dependency, or remotely hosted code.

## Install

For now, install CmdZ locally in a few steps:

1. Download or clone this repository:

   ```sh
   git clone https://github.com/patrykchojecki/CmdZ.git
   ```

   Alternatively, download [`dist/CmdZ-1.0.1.zip`](dist/CmdZ-1.0.1.zip) and extract it.

2. Open `chrome://extensions` in Google Chrome.
3. Enable **Developer mode** in the upper-right corner.
4. Click **Load unpacked**.
5. Select the repository folder, or the folder extracted from the release ZIP.
6. Refresh any web page that was already open when CmdZ was installed.
7. Close a tab and press <kbd>Command</kbd> + <kbd>Z</kbd> on macOS or
   <kbd>Ctrl</kbd> + <kbd>Z</kbd> on Windows and Linux.

### Undo safety

CmdZ leaves the shortcut untouched when:

- a text input, text area, or editable element is focused;
- the focused surface exposes an editor or application role;
- the page has already handled the shortcut; or
- Chrome reports that the current page has an Undo action available.

Chrome does not allow content scripts on internal pages such as
`chrome://extensions`. On those pages, click the CmdZ toolbar icon or use
Chrome's built-in reopen-tab shortcut.

For bug reports and diagnostic details, see [Support](SUPPORT.md).

## How it works

CmdZ listens for the platform's normal Undo shortcut inside each web page. If
the event belongs to an editing context, CmdZ does nothing and the original,
trusted keyboard event continues to the page. Otherwise, it prevents the unused
page-level shortcut and asks the service worker to restore the newest closed
individual tab by session ID.

CmdZ requires Chrome 96 or newer and uses only official Chrome extension APIs.

## Privacy

CmdZ does not collect, store, or transmit data. The `sessions` permission is
required solely to identify and restore recently closed tabs. Its page-level
listener checks only the Undo key event and whether the focused element is
editable; it does not read text, field values, or page contents. See the full
[Privacy Policy](PRIVACY.md).

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
node --test tests/*.test.js
python3 -m json.tool manifest.json >/dev/null
unzip -t dist/CmdZ-1.0.1.zip
```

To rebuild the distributable archive from the repository root:

```sh
./scripts/package-extension.sh
```

## License

CmdZ is available under the [MIT License](LICENSE).
