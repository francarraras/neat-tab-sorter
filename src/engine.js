// Applies sort plans to real windows, and remembers each window's previous order for undo.
import { loadSettings } from './settings.js';
import { planRestore, planSort } from './sort.js';

const MAX_ATTEMPTS = 4;
const TAB_STRIP_BUSY = /cannot be edited right now/i; // the user is dragging a tab

const undoKey = windowId => `undo:${windowId}`;

/** Sorts a window. Returns what it did: { moved, total, ms }, where moved is 0 if it was already sorted. */
export async function sortWindow(windowId) {
    const settings = await loadSettings();
    return rearrange(
        windowId,
        ({ tabs, groups }) => planSort(tabs, groups, settings),
        // Remember the order from before the first move, so the sort can be undone.
        order => chrome.storage.session.set({ [undoKey(windowId)]: order }),
    );
}

/**
 * Puts a window's tabs back the way they were before its last sort. Returns what it did, like
 * sortWindow(), or null if there's nothing to undo.
 */
export async function undoSort(windowId) {
    const key = undoKey(windowId);
    const { [key]: saved } = await chrome.storage.session.get(key);
    if (!saved) return null;
    const result = await rearrange(windowId, ({ tabs }) => planRestore(tabs, saved));
    await chrome.storage.session.remove(key);
    return result;
}

export function forgetWindow(windowId) {
    return chrome.storage.session.remove(undoKey(windowId));
}

/**
 * Plans and makes the moves for a window, then checks the result. If the window changed under us
 * (a tab was opened or closed mid-sort, or the user grabbed a tab), it re-plans from the new state.
 * Returns how many tabs it moved, out of how many, and how long it took in milliseconds.
 */
async function rearrange(windowId, makePlan, beforeFirstMove) {
    const start = performance.now();
    let started = false;
    let moved = 0;
    for (let attempt = 1; ; attempt++) {
        const state = await readWindow(windowId);
        const { moves, order, movedTabs } = makePlan(state);
        const result = () => ({ moved, total: state.tabs.length, ms: performance.now() - start });
        if (!moves.length) return result();
        if (!started) {
            started = true;
            await beforeFirstMove?.(state.tabs.map(tab => tab.id));
        }
        try {
            await applyMoves(moves);
            moved += movedTabs;
            const { tabs } = await readWindow(windowId, { tabsOnly: true });
            if (tabs.length === order.length && tabs.every((tab, index) => tab.id === order[index])) return result();
            if (attempt >= MAX_ATTEMPTS) throw new Error(`Window ${windowId} kept changing while it was being sorted`);
        } catch (error) {
            if (attempt >= MAX_ATTEMPTS) throw error;
            if (TAB_STRIP_BUSY.test(error?.message)) await new Promise(resolve => setTimeout(resolve, 250));
        }
    }
}

async function readWindow(windowId, { tabsOnly = false } = {}) {
    const [tabs, groups] = await Promise.all([
        chrome.tabs.query({ windowId }),
        // chrome.tabGroups is missing in browsers without tab groups.
        tabsOnly || !chrome.tabGroups ? [] : chrome.tabGroups.query({ windowId }),
    ]);
    return { tabs: tabs.sort((a, b) => a.index - b.index), groups };
}

// Each move depends on the ones before it, so they're made strictly in order.
async function applyMoves(moves) {
    for (const move of moves) {
        if (move.groupId !== undefined) await chrome.tabGroups.move(move.groupId, { index: move.index });
        else await chrome.tabs.move(move.tabIds.length === 1 ? move.tabIds[0] : move.tabIds, { index: move.index });
    }
}
