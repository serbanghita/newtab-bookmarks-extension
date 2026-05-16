# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.5.2] - 2026-05-16

### Changed
- Browser-neutral wording in manifest description, README intro, and in-extension onboarding text, in preparation for the Microsoft Edge Add-ons listing.

## [3.5.1] - 2026-05-16

### Fixed
- Clean theme dark-mode polish.

## [3.5.0] - 2026-05-12

### Added
- New "Clean" theme (#15, contributed by @cawa-93).

### Changed
- Redesigned Settings dialog with radio buttons, slide-up animation, and live preview.
- Documented contribution flow using `npm run preview` (#16).

## [3.4.0] - 2026-05-12

### Added
- ESLint 9 flat config with `typescript-eslint`.

### Changed
- Replaced "Top sites" with locally-tracked Top + Last bookmarks.

## [3.3.0] - 2026-04-16

### Added
- Theme support: Brutalist, iOS Glass, and Windows 98 themes.
- `npm run preview` command for one-click extension testing in Chrome for Testing.

### Changed
- Bookmarks now open via native `<a>` anchors, enabling middle-click open-in-new-tab.
- Pass `--no-sandbox` to Chrome for Testing on Linux.
- Throttled drag handler with `requestAnimationFrame`; debounced search input; single-pass folder lookup; `replaceChildren()` for clearing results.

### Fixed
- Drag-and-drop targeting child elements rather than the bookmark container.
- Stale drag indices and unhandled `move()` rejections.
- Spurious reorder on drag-end when no swap occurred.
- Search no longer matches folder nodes.
- Guard against empty folder names in multi-folder settings.
- Always reset the first-run flag after saving settings.
- Use `includes()` instead of `search()` to avoid regex errors in user input.

## [3.2.0] - 2026-04-16

### Added
- Support for multiple root bookmark folders (comma-separated).
- Flex view configuration (rows, columns).
- TypeScript conversion of the entire codebase (#1).

### Fixed
- `bookmarksWidth` configuration handling (#3).

[3.5.2]: https://github.com/serbanghita/newtab-bookmarks-chrome-extension/compare/v3.5.1...v3.5.2
[3.5.1]: https://github.com/serbanghita/newtab-bookmarks-chrome-extension/compare/v3.5.0...v3.5.1
[3.5.0]: https://github.com/serbanghita/newtab-bookmarks-chrome-extension/compare/v3.4.0...v3.5.0
[3.4.0]: https://github.com/serbanghita/newtab-bookmarks-chrome-extension/compare/v3.3.0...v3.4.0
[3.3.0]: https://github.com/serbanghita/newtab-bookmarks-chrome-extension/compare/v3.2.0...v3.3.0
[3.2.0]: https://github.com/serbanghita/newtab-bookmarks-chrome-extension/releases/tag/v3.2.0
