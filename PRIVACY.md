# Privacy Policy

_Neat Tab Sorter, last updated October 15, 2026_

Neat Tab Sorter doesn't collect, sell or share any personal data, and it never sends data anywhere. It has no ads, no analytics and no remote code, and it makes no network requests.

## What the extension uses, and why

- **Tab titles, addresses (URLs) and last-used times** in the window you're sorting. They're read only when you sort (or undo), only to work out the new tab order, and only on your device. They aren't saved or sent anywhere.
- **Tab group names**, to put your groups in order.
- **Your settings**, such as which sort order you prefer. They're saved with `chrome.storage.sync`, so if you use Chrome sync they're synced to your other computers by Chrome, through your Google account. The extension's developer can't see them.
- **Each window's tab order from just before its last sort**, so the sort can be undone. It's kept in `chrome.storage.session`: only on your device, only until you close the window or restart your browser.

## Permissions

- `tabs`: read tab titles, addresses and last-used times, and move tabs.
- `tabGroups`: read tab group names and move groups without splitting them.
- `storage`: save your settings and the undo order described above.
- `contextMenus`: add "Undo last sort" and sort options to the toolbar icon's right-click menu.

## Changes and contact

If this policy changes, the new version will be published here with a new date. Questions? Open an issue at https://github.com/francarraras/neat-tab-sorter/issues.
