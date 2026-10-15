# Neat Tab Sorter

<img src="src/img/128.png" width="96" alt="Neat Tab Sorter icon"/>

A fast, tidy tab sorter for Chrome. Click the toolbar icon or press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> to sort the tabs in the current window; right-click the icon to undo, or to sort a different way.

- **Only moves what's out of place.** Re-sorting a sorted window does nothing, and big windows sort in a blink.
- **Tab groups stay intact.** Groups go first, in name order ("1. Work", "2. Trip", "10. Later") or in your own order. Split views and pinned tabs are respected too.
- **Undo** the last sort in any window.
- **Natural order:** "Episode 2" before "Episode 10", case ignored, and unread counters like "(3) Inbox" don't move tabs around.
- **Four sort orders:** title, URL, custom (keeps each site's tabs together) and recently used.
- **Private:** no data collection, no network requests, no remote code. See [PRIVACY.md](PRIVACY.md).

## Install

- **Chrome Web Store:** coming soon.
- **From source:** download or clone this repository, open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and choose the `src` folder.

The User Guide (on the extension's options page) explains every setting.

## Development

The sorting logic lives in `src/sort.js` and doesn't depend on Chrome, so its tests run on plain Node.js 22 or later, with nothing to install:

```sh
npm test
```

They replay every sort against a model of Chrome's own tab-moving rules (`test/tab-strip.js`), across thousands of random windows with pinned tabs, tab groups and split views.

To also run the extension in a real (headless) Chromium, and to regenerate the Chrome Web Store images and demo video in `store/`:

```sh
npm install
npx playwright install chromium
npm run test:e2e
npm run assets
```

`npm run package` builds `dist/neat-tab-sorter-v<version>.zip` for the Chrome Web Store. [PUBLISHING.md](PUBLISHING.md) walks through publishing a release.

## Credits and license

Neat Tab Sorter is based on [Simple Tab Sorter](https://github.com/pwhite2/simple-tab-sorter) by Peter White and was modified from it in 2026. Both are free software under the [GNU General Public License v3](LICENSE).
