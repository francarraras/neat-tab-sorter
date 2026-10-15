# Chrome Web Store listing

Everything to paste into the [developer dashboard](https://chrome.google.com/webstore/devconsole), tab by tab. The images and video in this folder are drawn by `npm run media`, except the settings-page screenshots, which come from `npm run screenshots`.

## Package

Upload `dist/neat-tab-sorter-v1.0.0.zip` (from `npm run package`). The name, summary and icon come from `src/manifest.json`:

- **Name:** Neat Tab Sorter
- **Summary** (132 characters max): Sort tabs by title, URL, site or recent use in one click. Tab groups stay intact, numbers sort naturally, and you can undo.

## Store listing

**Description**

```text
Neat Tab Sorter puts the tabs in your window in order with one click on its toolbar icon, or with Alt+Shift+S.

• Only moves what's out of place: re-sorting a sorted window changes nothing, and big windows sort in a blink. The icon shows you how many tabs moved.
• Tab groups stay intact. Groups come first, ordered by name (number them "1. Work", "2. Trip", "10. Later" to choose their order), or keep your own group order.
• Undo: right-click the icon and choose "Undo last sort" to put every tab back where it was.
• Natural order: "Episode 2" comes before "Episode 10", upper and lower case are treated the same, and unread counters like "(3) Inbox" don't make tabs jump around.
• Pinned tabs are left alone unless you choose to sort them, and tabs in a split view are never pulled apart.

FOUR WAYS TO SORT
• Title
• URL (ignoring "https://" and "www.")
• Custom: keeps each site's tabs together, without reordering the sites
• Recently used: most recent first
Pick one in Settings, or straight from the icon's right-click menu.

ALSO
• Only the window you're in is sorted, and tabs are only ever moved: nothing is closed, reloaded, ungrouped or unpinned.
• Works with tab suspenders based on The Great Suspender, such as The Marvellous Suspender: suspended tabs are sorted by their real address, or grouped together if you prefer.
• Settings save automatically, sync with your browser profile, and follow your system's light or dark mode.

PRIVACY
Neat Tab Sorter doesn't collect or send any data, and has no ads, analytics or remote code. It reads your tabs' titles and addresses only to sort them, on your computer.

Free and open source (GPL-3.0): https://github.com/francarraras/neat-tab-sorter
Based on Simple Tab Sorter by Peter White.
```

- **Category:** Productivity → Workflow & Planning (Tools also fits)
- **Language:** English

**Graphic assets**

| Field | File |
| --- | --- |
| Store icon (128×128) | `icon-128.png` |
| Global promo video | YouTube link to `demo-video.mp4` (upload it to YouTube first; Unlisted is fine) |
| Screenshots (1280×800), in this order | `screenshot-1-sort.png`, `screenshot-2-groups.png`, `screenshot-3-menu.png`, `screenshot-4-settings.png`, `screenshot-5-settings-dark.png` |
| Small promo tile (440×280) | `promo-small-440x280.png` |
| Marquee promo tile (1400×560, optional) | `promo-marquee-1400x560.png` |

**Additional fields**

- **Homepage URL:** https://github.com/francarraras/neat-tab-sorter
- **Support URL:** https://github.com/francarraras/neat-tab-sorter/issues
- **Mature content:** No

## Privacy practices

**Single purpose description**

```text
Neat Tab Sorter sorts the tabs in the current browser window (by title, URL, site or recent use), keeping tab groups, split views and pinned tabs intact, and can undo the last sort.
```

**Permission justifications**

- **tabs:**
  ```text
  To sort a window, the extension reads the title, URL and last-used time of each of its tabs and moves the tabs with chrome.tabs.move. This happens only on the user's device, only when they sort or undo, and the information is never stored or sent anywhere.
  ```
- **tabGroups:**
  ```text
  Reads tab group names to put groups in order, and moves whole groups with chrome.tabGroups.move so a group is never split apart.
  ```
- **storage:**
  ```text
  chrome.storage.sync stores the user's sort settings. chrome.storage.session keeps each window's previous tab order (tab IDs only) so a sort can be undone; it's cleared when the window closes or the browser restarts.
  ```
- **contextMenus:**
  ```text
  Adds "Undo last sort" and quick sort-order choices to the right-click menu of the extension's toolbar icon.
  ```

**Remote code:** No, I am not using remote code.

**Data usage:** check **Web history** only. Tab URLs, titles and last-used times are read to sort tabs; they never leave the device, but Chrome Web Store policy asks for local-only handling to be disclosed too. Leave every other category unchecked, and check all three certifications:

- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** https://github.com/francarraras/neat-tab-sorter/blob/master/PRIVACY.md

## Distribution

- **Payments:** Free of charge
- **Visibility:** Public
- **Distribution:** All regions
