# CmdZ Support

## Undo opens a tab instead

CmdZ 1.0.1 and newer leave **Command + Z** or **Ctrl + Z** untouched when an
input, editor, or application-style editing surface is focused. Google Docs and
other web editors should therefore keep their normal Undo behavior.

If Undo still opens a tab:

1. Open `chrome://extensions` and confirm that CmdZ is version 1.0.1 or newer.
2. Click **Reload** on the CmdZ extension card if you installed it from source.
3. Refresh the affected editor tab so Chrome loads the updated shortcut listener.
4. Try Undo again with focus inside the editor.

## Closed tab does not reopen

Refresh web pages that were already open when CmdZ was installed or reloaded.
Chrome does not allow the page-level listener on internal pages such as
`chrome://extensions`; use the CmdZ toolbar icon on those pages.

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
