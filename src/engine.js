// Applies sort plans to real windows, and remembers each window's previous order for undo.
import { loadSettings } from './settings.js';
import { planRestore, planSort } from './sort.js';

const MAX_ATTEMPTS = 4;
const TAB_STRIP_BUSY = /cannot be edited right now/i; // the user is dragging a tab

const undoKey = windowId => `undo:${windowId}`;

/** Sorts a window. Returns true if any tab was moved. */
export async function sortWindow(windowId) {
    const settings = await loadSettings();
    return rearrange(
        windowId,
        ({ tabs, groups }) => planSort(tabs, groups, settings),
        // Remember the order from before the first move, so the sort can be undone.
        order => chrome.storage.session.set({ [undoKey(windowId)]: order }),
    );
}

/** Puts a window's tabs back the way they were before its last sort. Returns false if there's nothing to undo. */
export async function undoSort(windowId) {
    const key = undoKey(windowId);
    const { [key]: saved } = await chrome.storage.session.get(key);
    if (!saved) return false;
    await rearrange(windowId, ({ tabs }) => planRestore(tabs, saved));
    await chrome.storage.session.remove(key);
    return true;
}

export function forgetWindow(windowId) {
    return chrome.storage.session.remove(undoKey(windowId));
}

/**
 * Plans and makes the moves for a window, then checks the result. If the window changed under us
 * (a tab was opened or closed mid-sort, or the user grabbed a tab), it re-plans from the new state.
 */
async function rearrange(windowId, makePlan, beforeFirstMove) {
    let moved = false;
    for (let attempt = 1; ; attempt++) {
        const state = await readWindow(windowId);
        const { moves, order } = makePlan(state);
        if (!moves.length) return moved;
        if (!moved) {
            moved = true;
            await beforeFirstMove?.(state.tabs.map(tab => tab.id));
        }
        try {
            await applyMoves(moves);
            const { tabs } = await readWindow(windowId, { tabsOnly: true });
            if (tabs.length === order.length && tabs.every((tab, index) => tab.id === order[index])) return true;
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
