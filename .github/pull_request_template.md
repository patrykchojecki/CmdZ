## Summary

Describe the change and its user-visible effect.

## Related issue

Link the related issue, if one exists.

## Validation

- [ ] `node --check background.js`
- [ ] `python3 -m json.tool manifest.json >/dev/null`
- [ ] `./scripts/package-extension.sh`
- [ ] `unzip -t dist/CmdZ-1.0.0.zip`
- [ ] Tested the unpacked extension in Google Chrome on macOS

## Project scope

- [ ] The change keeps CmdZ focused on reopening the most recently closed tab with Command + Z.
- [ ] The change adds no analytics, advertising, remote code, or network requests.
- [ ] Any new permission is necessary, minimal, and explained in this pull request.
- [ ] Documentation is updated where needed.

## Screenshots

Include before-and-after images for icon or store-asset changes. Otherwise, write "Not applicable."
