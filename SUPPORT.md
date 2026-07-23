# CmdZ Support

## Undo opens a tab instead

CmdZ 1.0.4 and newer leave **Command + Z** or **Ctrl + Z** untouched when the
page actually performs or handles Undo. Google Docs and other web editors
therefore keep their normal Undo behavior.

If Undo still opens a tab:

1. Open `chrome://extensions` and confirm that CmdZ is version 1.0.4 or newer.
2. Click **Reload** on the CmdZ extension card if you installed it from source.
3. Try Undo again with focus inside the editor.

## Closed tab does not reopen

CmdZ 1.0.4 automatically attaches its listener to web pages that were already
open when the extension was installed, updated, or reloaded. Chrome does not
allow the page-level listener on internal pages such as `chrome://extensions`;
use the CmdZ toolbar icon on those pages.

If an input or editor still has focus but has no remaining edit to undo, CmdZ
restores the closed tab. Focus alone no longer suppresses restoration.

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
