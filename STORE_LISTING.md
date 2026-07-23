# Chrome Web Store submission

This file contains the copy, disclosures, assets, and final manual steps needed to submit CmdZ through the Chrome Web Store Developer Dashboard.

## Package

Upload [`dist/CmdZ-1.0.0.zip`](dist/CmdZ-1.0.0.zip). The archive contains `manifest.json` at its root and only the files Chrome needs at runtime.

## Store Listing tab

### Product details

**Name**

```text
CmdZ
```

**Summary** — sourced from `manifest.json`; 51 of 132 characters

```text
Reopen the most recently closed tab with Command+Z.
```

**Detailed description**

```text
Recover the last tab you closed in Chrome on any desktop operating system.

CmdZ is a focused keyboard utility that adds one shortcut and stays out of the way. Its suggested Command+Z shortcut is inspired by Safari on macOS; on other operating systems, assign the key combination you prefer in Chrome's extension shortcut settings.

- Reopens the most recently closed individual tab
- Runs only when the shortcut is invoked
- No tracking, ads, accounts, page access, or network requests
- No popup, configuration, or third-party dependencies

Suggested macOS shortcut: Command+Z

On other operating systems, or if Chrome does not assign the shortcut automatically, open chrome://extensions/shortcuts and assign your preferred shortcut to CmdZ.
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
CmdZ lets Chrome users on desktop operating systems reopen their most recently closed individual tab with a keyboard shortcut. It suggests Command+Z on macOS, inspired by Safari's reopen-tab behavior.
```

**`sessions` permission justification**

```text
The sessions permission is required to request Chrome's recently closed sessions, identify the newest entry that represents an individual tab, and restore that tab. Session metadata is processed transiently on the user's device and is never stored or transmitted.
```

**Remote code**

```text
No, I am not using remote code.
```

**Data usage disclosure**

- Select **Web history** because Chrome's sessions API may supply metadata about recently closed tabs, even though CmdZ processes it only locally and transiently.
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

The listing and screenshots clearly explain that CmdZ works across desktop
operating systems while the suggested Command+Z shortcut is macOS-specific and
inspired by Safari.

## Final dashboard steps

1. Confirm that the Privacy Policy URL above loads publicly.
2. Register or confirm the Chrome Web Store developer account.
3. Enable 2-Step Verification on the publishing Google Account.
4. In the Developer Dashboard, select **Add new item** and upload `dist/CmdZ-1.0.0.zip`.
5. Paste the Store Listing and Privacy practices content above.
6. Upload the three required graphic assets.
7. Confirm the developer contact email and complete email verification if prompted.
8. Choose the Distribution settings and submit the item for review.

The final dashboard submission requires the publisher's Google Account and cannot be completed from the source repository alone.
