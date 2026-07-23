# CmdZ Support

## Undo opens a tab instead

CmdZ 1.0.5 and newer leave **Command + Z** or **Ctrl + Z** untouched when the
page initiates native Undo or explicitly handles the shortcut. The listener
attaches at the earliest page phase so common propagation-stopping handlers do
not hide normal Undo events before they reach the document.

If Undo still opens a tab:

1. Open `chrome://extensions` and confirm that CmdZ is version 1.0.5 or newer.
2. Click **Reload** on the CmdZ extension card if you installed it from source.
3. Try Undo again with focus inside the editor.

## Closed tab does not reopen

CmdZ 1.0.5 automatically attaches its listener to web pages that were already
open when the extension was installed, and reattaches after an update or reload
from version 1.0.3 or newer. If you upgrade directly from 1.0.1 or 1.0.2,
refresh tabs that were already open once; Chrome does not let the new extension
detach the invalidated listener left by those releases.

Chrome does not allow the page-level listener on the New Tab page, other
internal pages, the omnibox, or browser UI; use the CmdZ toolbar icon in those
contexts.

If a native input or content-editable area still has focus but has no remaining
native edit to undo, CmdZ restores the closed tab. Custom editors maintain their
own private Undo stacks, which Chrome does not expose to extensions; if one
continues consuming Undo with an empty stack, use the toolbar icon to restore.

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
