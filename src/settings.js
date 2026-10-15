// Settings shared by the service worker and the options page, stored in chrome.storage.sync.
export const DEFAULT_SETTINGS = Object.freeze({
    sortBy: 'url', // 'title' | 'url' | 'custom' | 'lastAccessed'
    sortPinnedTabs: false,
    groupSuspendedTabs: false,
    sortGroupsByTitle: true,
    sortTabsInGroups: true,
    groupFrom: 'leftToRight', // "custom" only: 'leftToRight' | 'rightToLeft'
    preserveOrderWithinGroups: true, // "custom" only
});

export function loadSettings() {
    return chrome.storage.sync.get(DEFAULT_SETTINGS);
}
