## Summary

Describe the change and its user-visible effect.

## Related issue

Link the related issue, if one exists.

## Validation

- [ ] `node --check background.js`
- [ ] `node --check content.js` and `node --check recovery.js`
- [ ] `node --test tests/*.test.js`
- [ ] `python3 -m json.tool manifest.json >/dev/null`
- [ ] `node tests/e2e.cjs` (or explain why unavailable)
- [ ] Tested native Undo and empty-history restore; list OS/browser versions
- [ ] For a release: package and validate the newly versioned ZIP

## Project scope

- [ ] The change keeps CmdZ focused on reopening the most recently closed tab with Command + Z.
- [ ] The change adds no analytics, advertising, remote code, or network requests.
- [ ] Any new permission is necessary, minimal, and explained in this pull request.
- [ ] Documentation is updated where needed.

## Screenshots

Include before-and-after images for icon or store-asset changes. Otherwise, write "Not applicable."
