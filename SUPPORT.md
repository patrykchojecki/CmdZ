# CmdZ Support

## Undo opens a tab instead

CmdZ leaves **Command + Z** or **Ctrl + Z** untouched when Chrome reports native
Undo or the page cancels the shortcut with `preventDefault()`. Some custom
editors handle Undo privately without canceling the shortcut; extensions cannot
reliably recognize that case.

If Undo still opens a tab:

1. Install the latest source from the repository; released ZIPs are snapshots.
2. Click **Reload** on the CmdZ extension card if you installed it from source.
3. Try Undo again with focus inside the editor.

## Closed tab does not reopen

CmdZ automatically attaches its listener to web pages that were already
open when the extension was installed, and reattaches after an update or reload
from version 1.0.3 or newer. If you upgrade directly from 1.0.1 or 1.0.2,
refresh tabs that were already open once; Chrome does not let the new extension
detach the invalidated listener left by those releases.

Chrome does not allow the page-level listener on the New Tab page, other
`chrome://` pages, the Chrome Web Store, the omnibox, or browser UI. Local files
are also outside CmdZ's HTTP/HTTPS site access. Use the CmdZ toolbar icon in
those contexts.

If the CmdZ icon is not visible, open Chrome's **Extensions** menu (the puzzle
piece beside the address bar) and select **Pin** for CmdZ. Click its toolbar
icon to restore the most recently closed individual tab; no popup opens.
See [Chrome's extension toolbar instructions](https://support.google.com/chrome/answer/2664769)
for more details.

You can also use Chrome's built-in reopen-tab shortcut: **Command + Shift + T**
on macOS, or **Ctrl + Shift + T** on Windows and Linux.

Check that CmdZ has site access at `chrome://extensions`. After an update or
reload, refresh an affected page once if recovery was blocked by site access or
the page's frame policy. There is no CmdZ shortcut to assign at
`chrome://extensions/shortcuts`.

If a native input or content-editable area still has focus but has no remaining
native edit to undo, CmdZ restores the closed tab. Custom editors maintain their
own private Undo stacks, which Chrome does not expose to extensions; if one
continues consuming Undo with an empty stack, use the toolbar icon to restore.
Chrome's native history can also span multiple fields in a document. CmdZ skips
closed windows and can only restore individual tabs in Chrome's recent session list.

## Report a problem

[Open a bug report](https://github.com/patrykchojecki/CmdZ/issues/new?template=bug_report.yml) and include:

- your operating system and version;
- your Chrome version;
- your CmdZ version;
- the website and type of focused editor, without including private document
  content; and
- the steps needed to reproduce the problem.

CmdZ supports Google Chrome 96 or newer on desktop operating systems.

Please report suspected security vulnerabilities privately according to the [Security Policy](SECURITY.md).
