# Chrome Web Store submission

This file contains the copy, disclosures, assets, and final manual steps needed to submit CmdZ through the Chrome Web Store Developer Dashboard.

## Package

Upload [`dist/CmdZ-1.0.3.zip`](dist/CmdZ-1.0.3.zip). The archive contains `manifest.json` at its root and only the files Chrome needs at runtime.

## Store Listing tab

### Product details

**Name**

```text
CmdZ
```

**Summary** — sourced from `manifest.json`; 63 of 132 characters

```text
Reopen closed tabs with Command+Z without overriding page undo.
```

**Detailed description**

```text
Recover the last tab you closed in Chrome without sacrificing Undo on a website.

Press Command+Z on macOS or Ctrl+Z on Windows and Linux. When an input, editor, or application-style editing surface is focused, CmdZ steps aside so the website receives its normal Undo shortcut. Otherwise, CmdZ restores your most recently closed individual tab.

The Command+Z behavior is inspired by Safari on macOS. A toolbar button is also available for direct tab restoration.

- Reopens the most recently closed individual tab
- Preserves Undo in Google Docs and other web editors
- Never reads typed text, field values, or page contents
- No tracking, ads, accounts, or network requests
- No popup, configuration, or third-party dependencies

Chrome does not allow the page-level shortcut listener on internal chrome:// pages. Use the CmdZ toolbar button on those pages.
```

**Category**

```text
Functionality & UI
```

**Language**

```text
English
```

**Mature content**

```text
No
```

### Graphic assets

| Dashboard field | File |
| --- | --- |
| Store icon, 128×128 PNG | `store-assets/icon-128.png` |
| Screenshot, 1280×800 PNG | `store-assets/screenshot-1-1280x800.png` |
| Small promo tile, 440×280 PNG | `store-assets/small-promo-440x280.png` |

A promotional video and 1400×560 marquee image are optional and intentionally omitted.

### Additional fields

**Official URL**

Leave this optional field blank unless you have added and verified a site you own through Google Search Console. The GitHub repository can still be used as the Homepage URL below.

**Homepage URL**

```text
https://github.com/patrykchojecki/CmdZ
```

**Support URL**

```text
https://github.com/patrykchojecki/CmdZ/issues
```

## Privacy practices tab

**Single purpose description**

```text
CmdZ lets Chrome users reopen their most recently closed individual tab with the platform's Undo shortcut when the current page has no editing action to undo.
```

**`sessions` permission justification**

```text
The sessions permission is required to request Chrome's recently closed sessions, identify the newest entry that represents an individual tab, and restore that tab. Session metadata is processed transiently on the user's device and is never stored or transmitted.
```

**`scripting` permission justification**

```text
The scripting permission lets CmdZ attach its packaged shortcut listener to HTTP and HTTPS pages that were already open when the extension was installed, updated, or reloaded. It executes only content.js bundled in the reviewed extension package and never downloads or executes remote code.
```

**Site access justification**

```text
CmdZ runs a small local shortcut listener on HTTP and HTTPS pages so it can leave Command+Z or Ctrl+Z untouched when an editor has something to undo. This page-level handling is necessary because a browser-scoped extension command would consume the shortcut before editors such as Google Docs receive it. The listener checks only trusted Undo shortcut events and whether the focused element is editable. It never reads typed text, field values, or document contents, and it stores or transmits nothing. Site access also lets CmdZ reattach the packaged listener to pages that remain open across extension updates or reloads.
```

**Remote code**

```text
No, I am not using remote code.
```

**Data usage disclosure**

- Select **Web history** because Chrome's sessions API may supply metadata about recently closed tabs, even though CmdZ processes it only locally and transiently.
- Do not select an additional category for the local shortcut check; it does not
  collect typed text, page contents, or unrelated keyboard activity.
- Do not select other data categories.
- Certify that data is not sold to third parties.
- Certify that data is not used or transferred for purposes unrelated to CmdZ's single purpose.
- Certify that data is not used or transferred to determine creditworthiness or for lending.

**Privacy policy URL**

```text
https://github.com/patrykchojecki/CmdZ/blob/main/PRIVACY.md
```

## Distribution tab

Recommended initial settings:

- Visibility: **Public**
- Regions: **All regions**

The listing and screenshots clearly explain the context-aware shortcut behavior,
cross-platform support, and Safari inspiration.

## Final dashboard steps

1. Confirm that the Privacy Policy URL above loads publicly.
2. Register or confirm the Chrome Web Store developer account.
3. Enable 2-Step Verification on the publishing Google Account.
4. In the Developer Dashboard, select **Add new item** and upload `dist/CmdZ-1.0.3.zip`.
5. Paste the Store Listing and Privacy practices content above.
6. Upload the three required graphic assets.
7. Confirm the developer contact email and complete email verification if prompted.
8. Choose the Distribution settings and submit the item for review.

The final dashboard submission requires the publisher's Google Account and cannot be completed from the source repository alone.
