// Runs the real service worker (background.js, engine.js, feedback.js) against a fake chrome.* API
// backed by the tab strip model, to check the wiring, the toolbar feedback, and how sorting copes
// with a window changing mid-sort. Timers are simulated, so waits take no real time.
import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { TabStrip } from './tab-strip.js';

mock.timers.enable({ apis: ['setTimeout'] });

const WINDOW_ID = 1;
const DEFAULT_TITLE = 'Sort tabs';
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
    activeTabId: null,
    badges: new Map(), // tab id -> { text, color, title } on the toolbar icon
    menus: new Map(),
    openedTabs: [],
    beforeMove: null,
    reset(tabs, groups = []) {
        this.strip = new TabStrip(tabs);
        this.meta = new Map(tabs.map(tab => [tab.id, tab]));
        this.groups = groups;
        this.activeTabId = tabs[0].id;
        this.badges.clear();
    },
    get urls() {
        return this.strip.ids.map(id => this.meta.get(id).url);
    },
    badge(tabId) {
        if (!this.badges.has(tabId)) this.badges.set(tabId, {});
        return this.badges.get(tabId);
    },
};

globalThis.chrome = {
    action: {
        onClicked: event('action.onClicked'),
        setBadgeText: async ({ tabId, text }) => { browser.badge(tabId).text = text; },
        setBadgeBackgroundColor: async ({ tabId, color }) => { browser.badge(tabId).color = color; },
        setBadgeTextColor: async () => {},
        setTitle: async ({ tabId, title }) => { browser.badge(tabId).title = title; },
    },
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
        getManifest: () => ({ action: { default_title: DEFAULT_TITLE } }),
    },
    storage: { onChanged: event('storage.onChanged'), sync: storageArea('sync'), session: storageArea('session') },
    windows: { onRemoved: event('windows.onRemoved'), getLastFocused: async () => ({ id: WINDOW_ID }) },
    tabs: {
        create: async props => browser.openedTabs.push(props.url),
        query: async ({ windowId, active }) => {
            assert.equal(windowId, WINDOW_ID);
            const tabs = browser.strip.tabs.map((tab, index) => ({ ...browser.meta.get(tab.id), ...tab, index, windowId }));
            return active ? tabs.filter(tab => tab.id === browser.activeTabId) : tabs;
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

// Lets the service worker run, moving the simulated clock forward 10 ms at a time.
async function until(condition, timeout = 5000) {
    for (let elapsed = 0; !condition(); elapsed += 10) {
        if (elapsed > timeout) throw new Error(`Timed out waiting for: ${condition}`);
        await new Promise(resolve => setImmediate(resolve));
        mock.timers.tick(10);
    }
}

const tabs = urls => urls.map((url, index) => ({ id: index + 1, url, title: url.toUpperCase(), groupId: -1 }));
const UNSORTED = ['https://c.com/', 'https://a.com/', 'https://d.com/', 'https://b.com/'];
const SORTED = ['https://a.com/', 'https://b.com/', 'https://c.com/', 'https://d.com/'];
const click = () => fire('action.onClicked', { windowId: WINDOW_ID });
const undo = () => fire('contextMenus.onClicked', { menuItemId: 'undo' }, { windowId: WINDOW_ID });
const sameUrls = expected => () => browser.urls.join() === expected.join();
const badge = () => browser.badges.get(browser.activeTabId) ?? {};

test('installing creates the menu and opens the user guide', async () => {
    fire('runtime.onInstalled', { reason: 'install' });
    await until(() => browser.menus.size === 6);
    assert.deepEqual([...browser.menus.keys()], ['undo', 'separator', 'sortBy:title', 'sortBy:url', 'sortBy:custom', 'sortBy:lastAccessed']);
    assert.equal(browser.menus.get('sortBy:url').checked, true);
    assert.deepEqual(browser.openedTabs, ['userguide.html']);
});

test('clicking the icon sorts the window, and "Undo last sort" restores it', async () => {
    browser.reset(tabs(UNSORTED));
    click();
    await until(sameUrls(SORTED));
    undo();
    await until(sameUrls(UNSORTED));
});

test('the icon shows how many tabs moved, or ✓ when none had to', async () => {
    browser.reset(tabs(UNSORTED));
    click();
    await until(() => badge().text === '2');
    assert.match(badge().title, /^Sorted: moved 2 of 4 tabs in \d+ ms\. Right-click to undo\.$/);
    assert.equal(badge().color, '#0d9488');
    click();
    await until(() => badge().text === '✓');
    assert.equal(badge().title, 'Already sorted: none of the 4 tabs needed to move.');
});

test('undo shows what it did, and says when there is nothing to undo', async () => {
    browser.reset(tabs(UNSORTED));
    click();
    await until(sameUrls(SORTED));
    undo();
    await until(() => badge().title === 'Undone: moved 2 tabs back.');
    assert.equal(badge().text, '2');
    assert.equal(badge().color, '#5f6368');
    undo();
    await until(() => badge().text === '–');
    assert.equal(badge().title, 'Nothing to undo in this window.');
});

test('the badge clears after a few seconds', async () => {
    browser.reset(tabs(UNSORTED));
    click();
    await until(() => badge().text === '2');
    mock.timers.tick(3900);
    assert.equal(badge().text, '2');
    mock.timers.tick(200);
    assert.equal(badge().text, '');
    assert.equal(badge().title, DEFAULT_TITLE);
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
    await until(() => badge().text === '✓'); // the extra clicks found nothing to move
    undo();
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
