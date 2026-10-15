import { forgetWindow, sortWindow, undoSort } from './engine.js';
import { loadSettings } from './settings.js';

const UNDO_MENU_ID = 'undo';
const SORT_BY_MENU_PREFIX = 'sortBy:';
const SORT_BY_MENU_TITLES = {
    title: 'Sort by title',
    url: 'Sort by URL',
    custom: 'Sort by site (custom)',
    lastAccessed: 'Sort by recently used',
};

// Sorts and undos run one at a time, so a double-click or a held-down shortcut can't interleave
// two runs in the same window.
let queue = Promise.resolve();
function enqueue(task) {
    queue = queue.then(task).catch(error => console.error('Neat Tab Sorter:', error));
    return queue;
}

async function windowIdOf(tab) {
    return tab?.windowId ?? (await chrome.windows.getLastFocused()).id;
}

// Toolbar icon click, or the "Sort tabs" keyboard shortcut (_execute_action).
chrome.action.onClicked.addListener(tab => enqueue(async () => sortWindow(await windowIdOf(tab))));

chrome.commands.onCommand.addListener((command, tab) => {
    if (command === 'undo-sort') enqueue(async () => undoSort(await windowIdOf(tab)));
});

chrome.contextMenus.onClicked.addListener(({ menuItemId }, tab) => {
    if (menuItemId === UNDO_MENU_ID) {
        enqueue(async () => undoSort(await windowIdOf(tab)));
    } else if (menuItemId.startsWith(SORT_BY_MENU_PREFIX)) {
        // Picking a sort order makes it the default and sorts right away.
        const sortBy = menuItemId.slice(SORT_BY_MENU_PREFIX.length);
        enqueue(async () => {
            await chrome.storage.sync.set({ sortBy });
            await sortWindow(await windowIdOf(tab));
        });
    }
});

chrome.storage.onChanged.addListener((changes, area) => {
    const sortBy = changes.sortBy?.newValue;
    if (area === 'sync' && sortBy in SORT_BY_MENU_TITLES) {
        chrome.contextMenus.update(SORT_BY_MENU_PREFIX + sortBy, { checked: true }, () => chrome.runtime.lastError);
    }
});

chrome.windows.onRemoved.addListener(forgetWindow);

chrome.runtime.onInstalled.addListener(({ reason }) => {
    createMenus().catch(error => console.error('Neat Tab Sorter:', error));
    if (reason === chrome.runtime.OnInstalledReason.INSTALL) chrome.tabs.create({ url: 'userguide.html' });
});

// Items on the toolbar icon's right-click menu (Chrome allows up to 6).
async function createMenus() {
    const { sortBy } = await loadSettings();
    await new Promise(resolve => chrome.contextMenus.removeAll(resolve));
    chrome.contextMenus.create({ id: UNDO_MENU_ID, title: 'Undo last sort', contexts: ['action'] });
    chrome.contextMenus.create({ id: 'separator', type: 'separator', contexts: ['action'] });
    for (const [mode, title] of Object.entries(SORT_BY_MENU_TITLES)) {
        chrome.contextMenus.create({
            id: SORT_BY_MENU_PREFIX + mode,
            title,
            type: 'radio',
            checked: mode === sortBy,
            contexts: ['action'],
        });
    }
}
