# CmdZ Privacy Policy

Effective date: July 23, 2026

CmdZ is a Chrome extension whose single purpose is to reopen the most recently
closed individual tab when a user invokes the platform's normal Undo shortcut
outside an editing context. The extension works across desktop operating
systems; its **Command + Z** behavior is inspired by Safari on macOS.

## Data handled

CmdZ uses Chrome's `sessions` permission to request the browser's recently closed session list. Chrome may include session identifiers and browsing metadata such as tab titles and URLs in that response. CmdZ uses only the information necessary to identify the newest closed individual tab and ask Chrome to restore it.

CmdZ also runs a small local shortcut listener on HTTP and HTTPS pages. When
the user presses **Command + Z** or **Ctrl + Z**, the listener checks only the
key and modifier state and whether the focused element is an editing surface.
It does not read typed text, field values, document contents, or unrelated
keystrokes.

## Collection, storage, and sharing

All processing happens transiently and locally in the user's browser. CmdZ:

- does not store browsing or session data;
- does not store shortcut or editing-context data;
- does not transmit data over a network;
- does not use analytics, tracking, advertising, or cookies;
- does not sell or share user data with third parties; and
- does not allow the developer or any other person to access user data.

Because no user data is retained, there is no stored user data to access, export, correct, or delete.

## Permission and site access

The `sessions` permission is the narrowest Chrome permission that can restore a
recently closed tab.

CmdZ's shortcut listener runs on HTTP and HTTPS pages because a browser-scoped
extension command would consume Undo before an editor such as Google Docs could
receive it. The listener uses page access only to identify whether the focused
element is editable. It does not inspect or modify text, field values, or
document contents.

## Limited Use disclosure

The use of information received from Google APIs will adhere to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), including the Limited Use requirements. CmdZ uses browser session information only to provide its disclosed tab-restoration feature.

## Changes

If CmdZ's data practices change, this policy and the Chrome Web Store disclosures will be updated before those changes are released.

## Contact

For privacy questions or support, [open an issue on GitHub](https://github.com/patrykchojecki/CmdZ/issues).
