# Changelog

All notable changes to Neat Tab Sorter. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [semantic versioning](https://semver.org).

## [Unreleased]

### Added

- After each sort, the toolbar icon briefly shows how many tabs moved, or ✓ when the window was already in order. Its tooltip has the details, such as "Moved 7 of 42 tabs in 40 ms", and a reminder that right-clicking undoes the sort.
- Undo shows what it did too, and says when there's nothing to undo.

## [1.0.0] - 2026-10-15

First release of Neat Tab Sorter, based on Simple Tab Sorter 0.4.2 by Peter White.

### Added

- Undo the last sort, from the toolbar icon's right-click menu or with a shortcut you assign.
- Sort with <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd>.
- Pick a sort order from the toolbar icon's right-click menu: it sorts right away and becomes the default.
- "Recently used" sort order.
- Settings to keep your own tab group order, and to leave the tabs inside groups alone.
- Natural number order ("Issue #2" before "Issue #19"), case-insensitive sorting, and titles' unread counters ignored.
- Split views are never pulled apart.
- Tabs suspended by any Great Suspender fork are recognized automatically.

### Changed

- A new sorting engine plans the whole window and moves only the tabs that are out of place. It checks the result, and re-plans if the window changes mid-sort.
- Clicking the toolbar icon sorts straight away, with no popup.
- New settings pages that save automatically and follow the system's dark mode, without jQuery or Bootstrap.

### Fixed

- Tabs could fall out of their groups, and repeated sorts could give different results.
- The settings page and the sorter disagreed on the default for "Preserve order within groups".
- Long addresses containing `uri=` could be mistaken for suspended tabs.
- The toolbar icon wasn't set from the manifest.
