// Briefly shows on the toolbar icon what a sort or undo did: a badge with how many tabs moved (or
// ✓ when none had to), and the details in the icon's tooltip.
const SHOW_FOR_MS = 4000;
const SORT_COLOR = '#0d9488';
const UNDO_COLOR = '#5f6368';
const DEFAULT_TITLE = chrome.runtime.getManifest().action.default_title;

const timers = new Map(); // tab id -> timer that clears its badge

export function showSorted(windowId, { moved, total, ms }) {
    return moved
        ? show(windowId, count(moved), SORT_COLOR, `Sorted: moved ${moved} of ${tabs(total)} in ${duration(ms)}. Right-click to undo.`)
        : show(windowId, '✓', SORT_COLOR, `Already sorted: none of the ${tabs(total)} needed to move.`);
}

export function showUndone(windowId, result) {
    if (!result) return show(windowId, '–', UNDO_COLOR, 'Nothing to undo in this window.');
    return result.moved
        ? show(windowId, count(result.moved), UNDO_COLOR, `Undone: moved ${tabs(result.moved)} back.`)
        : show(windowId, '✓', UNDO_COLOR, 'Undone: the tabs were already back in place.');
}

async function show(windowId, text, color, title) {
    // Badges are per tab: show it on the tab you're looking at.
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    if (!tab) return;
    const tabId = tab.id;
    clearTimeout(timers.get(tabId));
    await Promise.all([
        chrome.action.setBadgeText({ tabId, text }),
        chrome.action.setBadgeBackgroundColor({ tabId, color }),
        chrome.action.setBadgeTextColor?.({ tabId, color: '#ffffff' }), // Chrome 110+
        chrome.action.setTitle({ tabId, title }),
    ]);
    timers.set(tabId, setTimeout(() => {
        timers.delete(tabId);
        // The tab may be gone by now.
        chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
        chrome.action.setTitle({ tabId, title: DEFAULT_TITLE }).catch(() => {});
    }, SHOW_FOR_MS));
}

const count = n => (n > 999 ? '999+' : String(n));
const tabs = n => `${n} tab${n === 1 ? '' : 's'}`;
const duration = ms => (ms < 1000 ? `${Math.max(1, Math.round(ms))} ms` : `${(ms / 1000).toFixed(1)} s`);
