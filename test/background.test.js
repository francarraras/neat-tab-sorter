// Runs the real service worker (background.js + engine.js) against a fake chrome.* API backed by
// the tab strip model, to check the wiring and how sorting copes with a window changing mid-sort.
import assert from 'node:assert/strict';
import test from 'node:test';
import { TabStrip } from './tab-strip.js';

const WINDOW_ID = 1;
const listeners = {};
const event = name => ({ addListener: listener => (listeners[name] ??= []).push(listener) });
const fire = (name, ...args) => listeners[name].forEach(listener => listener(...args));

function storageArea(name) {
    const data = {};
    return {
        data,
        async get(keys) {
            if (keys === null || keys === undefined) return { ...data };
            if (typeof keys === 'string') keys = [keys];
            if (Array.isArray(keys)) return Object.fromEntries(keys.filter(key => key in data).map(key => [key, data[key]]));
            return { ...keys, ...Object.fromEntries(Object.keys(keys).filter(key => key in data).map(key => [key, data[key]])) };
        },
        async set(items) {
            const changes = Object.fromEntries(Object.entries(items).map(([key, newValue]) => [key, { oldValue: data[key], newValue }]));
            Object.assign(data, items);
            listeners['storage.onChanged']?.forEach(listener => listener(changes, name));
        },
        async remove(keys) {
            for (const key of [].concat(keys)) delete data[key];
        },
    };
}

const browser = {
    strip: null,
    meta: new Map(),
    groups: [],
    menus: new Map(),
    openedTabs: [],
    beforeMove: null,
    reset(tabs, groups = []) {
        this.strip = new TabStrip(tabs);
        this.meta = new Map(tabs.map(tab => [tab.id, tab]));
        this.groups = groups;
    },
    get urls() {
        return this.strip.ids.map(id => this.meta.get(id).url);
    },
};

globalThis.chrome = {
    action: { onClicked: event('action.onClicked') },
    commands: { onCommand: event('commands.onCommand') },
    contextMenus: {
        onClicked: event('contextMenus.onClicked'),
        create: props => browser.menus.set(props.id, { ...props }),
        removeAll: callback => { browser.menus.clear(); callback(); },
        update: (id, props, callback) => { Object.assign(browser.menus.get(id), props); callback(); },
    },
    runtime: {
        onInstalled: event('runtime.onInstalled'),
        OnInstalledReason: { INSTALL: 'install', UPDATE: 'update' },
        setUninstallURL: url => { browser.uninstallUrl = url; },
    },
    storage: { onChanged: event('storage.onChanged'), sync: storageArea('sync'), session: storageArea('session') },
    windows: { onRemoved: event('windows.onRemoved'), getLastFocused: async () => ({ id: WINDOW_ID }) },
    tabs: {
        create: async props => browser.openedTabs.push(props.url),
        query: async ({ windowId }) => {
            assert.equal(windowId, WINDOW_ID);
            return browser.strip.tabs.map((tab, index) => ({ ...browser.meta.get(tab.id), ...tab, index, windowId }));
        },
        move: async (tabIds, { index }) => {
            browser.beforeMove?.();
            browser.strip.moveTabs([].concat(tabIds), index);
        },
    },
    tabGroups: {
        query: async () => browser.groups,
        move: async (groupId, { index }) => {
            browser.beforeMove?.();
            browser.strip.moveGroup(groupId, index);
        },
    },
};

await import('../src/background.js');

async function until(condition, timeout = 2000) {
    const start = Date.now();
    while (!condition()) {
        if (Date.now() - start > timeout) throw new Error(`Timed out waiting for: ${condition}`);
        await new Promise(resolve => setTimeout(resolve, 5));
    }
}

const tabs = urls => urls.map((url, index) => ({ id: index + 1, url, title: url.toUpperCase(), groupId: -1 }));
const UNSORTED = ['https://c.com/', 'https://a.com/', 'https://d.com/', 'https://b.com/'];
const SORTED = ['https://a.com/', 'https://b.com/', 'https://c.com/', 'https://d.com/'];
const click = () => fire('action.onClicked', { windowId: WINDOW_ID });
const sameUrls = expected => () => browser.urls.join() === expected.join();

test('installing creates the menu and opens the user guide', async () => {
    fire('runtime.onInstalled', { reason: 'install' });
    await until(() => browser.menus.size === 6);
    assert.deepEqual([...browser.menus.keys()], ['undo', 'separator', 'sortBy:title', 'sortBy:url', 'sortBy:custom', 'sortBy:lastAccessed']);
    assert.equal(browser.menus.get('sortBy:url').checked, true);
    assert.deepEqual(browser.openedTabs, ['userguide.html']);
    assert.match(browser.uninstallUrl, /^https:\/\/docs\.google\.com\/forms\//);
});

test('clicking the icon sorts the window, and "Undo last sort" restores it', async () => {
    browser.reset(tabs(UNSORTED));
    click();
    await until(sameUrls(SORTED));
    fire('contextMenus.onClicked', { menuItemId: 'undo' }, { windowId: WINDOW_ID });
    await until(sameUrls(UNSORTED));
});

test('picking a sort order from the menu saves it and sorts', async () => {
    browser.reset(tabs(['https://a.com/', 'https://b.com/']).map((tab, i) => ({ ...tab, title: ['Banana', 'Apple'][i] })));
    fire('contextMenus.onClicked', { menuItemId: 'sortBy:title' }, { windowId: WINDOW_ID });
    await until(sameUrls(['https://b.com/', 'https://a.com/']));
    assert.equal(chrome.storage.sync.data.sortBy, 'title');
    assert.equal(browser.menus.get('sortBy:title').checked, true);
    await chrome.storage.sync.set({ sortBy: 'url' });
    assert.equal(browser.menus.get('sortBy:url').checked, true);
    click();
    await until(sameUrls(['https://a.com/', 'https://b.com/']));
});

test('the undo shortcut works without a tab', async () => {
    browser.reset(tabs(UNSORTED));
    click();
    await until(sameUrls(SORTED));
    fire('commands.onCommand', 'undo-sort', undefined);
    await until(sameUrls(UNSORTED));
});

test('rapid clicks run one at a time, and undo goes back to before the first', async () => {
    browser.reset(tabs(UNSORTED));
    click();
    click();
    click();
    await until(sameUrls(SORTED));
    await new Promise(resolve => setTimeout(resolve, 20));
    fire('contextMenus.onClicked', { menuItemId: 'undo' }, { windowId: WINDOW_ID });
    await until(sameUrls(UNSORTED));
});

test('sorting retries while the user is dragging a tab', async () => {
    browser.reset(tabs(UNSORTED));
    let refusals = 2;
    browser.beforeMove = () => {
        if (refusals-- > 0) throw new Error('Tabs cannot be edited right now (user may be dragging a tab).');
    };
    click();
    await until(sameUrls(SORTED));
    browser.beforeMove = null;
});

test('a tab opened mid-sort gets sorted too', async () => {
    browser.reset(tabs(['https://e.com/', 'https://c.com/', 'https://a.com/', 'https://d.com/', 'https://b.com/']));
    browser.beforeMove = () => {
        browser.beforeMove = null;
        browser.meta.set(99, { id: 99, url: 'https://aa.com/', title: 'AA', groupId: -1 });
        browser.strip.tabs.push({ id: 99, pinned: false, groupId: -1, splitViewId: -1 });
    };
    click();
    await until(sameUrls(['https://a.com/', 'https://aa.com/', 'https://b.com/', 'https://c.com/', 'https://d.com/', 'https://e.com/']));
});
