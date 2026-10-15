// Runs the extension in a real (headless) Chromium. Needs Playwright:
//   npm install && npx playwright install chromium && npm run test:e2e
// Set EXTENSION_DIR to test another build, e.g. the unzipped Chrome Web Store package.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const extensionDir = path.resolve(process.env.EXTENSION_DIR ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src'));
let server;
let context;
let worker;
let page;
let extensionId;
const errors = [];

// Pages at http://<name>.localhost:<port>/<path>?t=<title>; Chrome resolves *.localhost locally.
const url = (host, pathname = '/', title) => `http://${host}.localhost:${server.address().port}${pathname}${title ? `?t=${encodeURIComponent(title)}` : ''}`;

/** Runs `fn(arg)` in the extension's options page, where the real engine is loaded as `engine`. */
async function inExtension(fn, arg) {
    await page.evaluate(async () => {
        if (globalThis.engine) return;
        globalThis.engine = await import(chrome.runtime.getURL('engine.js'));
        globalThis.feedback = await import(chrome.runtime.getURL('feedback.js'));
        globalThis.loaded = async windowId => {
            for (let i = 0; i < 400; i++) {
                const tabs = await chrome.tabs.query({ windowId });
                if (tabs.every(tab => tab.status === 'complete')) return tabs;
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            throw new Error('Tabs did not finish loading');
        };
        globalThis.snapshot = async windowId => (await chrome.tabs.query({ windowId }))
            .sort((a, b) => a.index - b.index)
            .map(tab => ({ id: tab.id, url: tab.url, title: tab.title, pinned: tab.pinned, groupId: tab.groupId }));
    });
    return page.evaluate(fn, arg);
}

const titles = tabs => tabs.map(tab => tab.title);
const membership = tabs => Object.fromEntries(tabs.map(tab => [tab.id, tab.groupId]));

before(async () => {
    server = http.createServer((request, response) => {
        const title = new URL(request.url, 'http://localhost').searchParams.get('t') ?? request.url;
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        response.end(`<!doctype html><title>${title.replace(/</g, '&lt;')}</title>`);
    });
    await new Promise(resolve => server.listen(0, resolve));

    context = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'neat-tab-sorter-e2e-')), {
        channel: 'chromium',
        headless: true,
        args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
    });
    context.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    context.on('weberror', error => errors.push(String(error.error())));
    [worker] = context.serviceWorkers();
    worker ??= await context.waitForEvent('serviceworker');
    extensionId = new URL(worker.url()).host;
    page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/options.html`);
});

after(async () => {
    await context?.close();
    server?.close();
});

test('the service worker registers its listeners', async () => {
    const listeners = await worker.evaluate(() => ({
        action: chrome.action.onClicked.hasListeners(),
        commands: chrome.commands.onCommand.hasListeners(),
        menus: chrome.contextMenus.onClicked.hasListeners(),
        installed: chrome.runtime.onInstalled.hasListeners(),
    }));
    assert.deepEqual(listeners, { action: true, commands: true, menus: true, installed: true });
});

test('installing opens the user guide', async () => {
    // The extension opens it asynchronously, so give it a moment.
    const deadline = Date.now() + 5000;
    while (!context.pages().some(p => p.url().endsWith('/userguide.html'))) {
        assert.ok(Date.now() < deadline, 'the user guide never opened');
        await new Promise(resolve => setTimeout(resolve, 50));
    }
});

test('the sort shortcut is assigned', async () => {
    const commands = await inExtension(() => chrome.commands.getAll());
    assert.ok(commands.find(command => command.name === '_execute_action').shortcut);
});

let windowId;
let before0;

test('URL sort: pinned first, groups by name, then ungrouped tabs', async () => {
    const urls = [
        url('b', '/2', 'Bravo 2'), url('a', '/10', 'Alpha 10'), url('z', '/', 'Zulu'), url('c', '/', '(5) Charlie'),
        url('a', '/2', 'Alpha 2'), url('www.d', '/', 'Delta'), url('e', '/x', 'Echo'), url('f', '/y', 'Foxtrot'),
        url('g', '/', 'Golf'), url('h', '/', 'Hotel'),
    ];
    ({ windowId, before: before0 } = await inExtension(async urls => {
        await chrome.storage.sync.clear();
        const win = await chrome.windows.create({ url: urls, focused: false });
        const tabs = await loaded(win.id);
        const id = u => tabs.find(tab => tab.url === u).id;
        await chrome.tabs.update(id(urls[2]), { pinned: true });
        const later = await chrome.tabs.group({ tabIds: [id(urls[7]), id(urls[6])], createProperties: { windowId: win.id } });
        await chrome.tabGroups.update(later, { title: '10. Later' });
        const work = await chrome.tabs.group({ tabIds: [id(urls[9]), id(urls[8])], createProperties: { windowId: win.id } });
        await chrome.tabGroups.update(work, { title: '2. Work' });
        await chrome.tabGroups.move(work, { index: -1 }); // after the ungrouped tabs, so sorting must move it
        return { windowId: win.id, before: await snapshot(win.id) };
    }, urls));
    const sorted = await inExtension(async id => { await engine.sortWindow(id); return snapshot(id); }, windowId);
    assert.deepEqual(titles(sorted), ['Zulu', 'Golf', 'Hotel', 'Echo', 'Foxtrot', 'Alpha 2', 'Alpha 10', 'Bravo 2', '(5) Charlie', 'Delta']);
    assert.deepEqual(membership(sorted), membership(before0));
});

test('re-sorting a sorted window moves nothing', async () => {
    const result = await inExtension(id => engine.sortWindow(id), windowId);
    assert.equal(result.moved, 0);
    assert.equal(result.total, 10);
});

test('undo restores the previous order exactly', async () => {
    const restored = await inExtension(async id => { await engine.undoSort(id); return snapshot(id); }, windowId);
    assert.deepEqual(restored.map(tab => tab.id), before0.map(tab => tab.id));
    assert.deepEqual(membership(restored), membership(before0));
    assert.equal(await inExtension(id => engine.undoSort(id), windowId), null, 'nothing left to undo');
});

test('title sort ignores unread counters, and group order can be kept', async () => {
    const sorted = await inExtension(async id => {
        await chrome.storage.sync.set({ sortBy: 'title', sortGroupsByTitle: false });
        await engine.sortWindow(id);
        return snapshot(id);
    }, windowId);
    // "10. Later" was left of "2. Work" before sorting, and stays there.
    assert.deepEqual(titles(sorted), ['Zulu', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'Alpha 2', 'Alpha 10', 'Bravo 2', '(5) Charlie', 'Delta']);
    await inExtension(() => chrome.storage.sync.clear());
});

test('150 shuffled tabs: correct, group-safe, fast and undoable', async t => {
    const hosts = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta', 'iota', 'kappa', 'www.lambda', 'mu'];
    const urls = Array.from({ length: 150 }, (_, i) => url(hosts[(i * 7) % hosts.length], `/page/${(i * 37) % 101}`, `Tab ${(i * 53) % 150}`));
    const report = await inExtension(async urls => {
        const win = await chrome.windows.create({ url: urls[0], focused: false });
        for (const u of urls.slice(1)) chrome.tabs.create({ windowId: win.id, url: u, active: false });
        let tabs = [];
        while (tabs.length < urls.length || tabs.some(tab => tab.status !== 'complete')) {
            await new Promise(resolve => setTimeout(resolve, 50));
            tabs = await chrome.tabs.query({ windowId: win.id });
        }
        tabs.sort((a, b) => a.index - b.index);
        for (const i of [3, 77, 120]) await chrome.tabs.update(tabs[i].id, { pinned: true });
        const groupTitles = ['3. C', '1. A', '', '20. T'];
        for (let g = 0; g < groupTitles.length; g++) {
            const groupId = await chrome.tabs.group({ tabIds: [10, 31, 52, 73, 94].map(i => tabs[i + g].id), createProperties: { windowId: win.id } });
            await chrome.tabGroups.update(groupId, { title: groupTitles[g] });
        }
        const before = await snapshot(win.id);
        let start = performance.now();
        await engine.sortWindow(win.id);
        const sortMs = performance.now() - start;
        const sorted = await snapshot(win.id);
        const movedAgain = (await engine.sortWindow(win.id)).moved;
        start = performance.now();
        await engine.undoSort(win.id);
        const undoMs = performance.now() - start;
        const restored = await snapshot(win.id);
        const groups = await chrome.tabGroups.query({ windowId: win.id });
        await chrome.windows.remove(win.id);
        return { before, sorted, restored, groups, sortMs, undoMs, movedAgain };
    }, urls);
    const { before, sorted, restored, groups } = report;
    assert.deepEqual(membership(sorted), membership(before), 'group membership unchanged');
    assert.equal(report.movedAgain, 0, 'second sort moves nothing');
    assert.deepEqual(restored.map(tab => tab.id), before.map(tab => tab.id), 'undo restores the order');

    // Check the result independently: pinned tabs, then groups by name, then ungrouped; each part by URL.
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    const key = u => { const parsed = new URL(u); return parsed.host.replace(/^www\./, '') + parsed.pathname; };
    const segments = [];
    for (const tab of sorted) {
        const name = tab.pinned ? 'pinned' : tab.groupId === -1 ? 'ungrouped' : groups.find(g => g.id === tab.groupId).title;
        if (segments.at(-1)?.name !== name) segments.push({ name, tabs: [] });
        segments.at(-1).tabs.push(tab);
    }
    assert.deepEqual(segments.map(s => s.name), ['pinned', '1. A', '3. C', '20. T', '', 'ungrouped']);
    for (const segment of segments.slice(1)) {
        for (let i = 1; i < segment.tabs.length; i++) {
            assert.ok(collator.compare(key(segment.tabs[i - 1].url), key(segment.tabs[i].url)) <= 0, `${segment.name} is sorted`);
        }
    }
    assert.ok(report.sortMs < 2000 && report.undoMs < 2000, `sort ${report.sortMs} ms, undo ${report.undoMs} ms`);
    t.diagnostic(`150 tabs: sort ${report.sortMs.toFixed(0)} ms, undo ${report.undoMs.toFixed(0)} ms`);
});

test('the toolbar icon shows what a sort did, then clears', async () => {
    const shown = await inExtension(async id => {
        const [active] = await chrome.tabs.query({ active: true, windowId: id });
        const icon = async () => ({
            text: await chrome.action.getBadgeText({ tabId: active.id }),
            title: await chrome.action.getTitle({ tabId: active.id }),
        });
        await chrome.storage.sync.set({ sortBy: 'url' });
        const moved = await engine.sortWindow(id); // the previous test left this window sorted by title
        await feedback.showSorted(id, moved);
        const afterSort = { ...(await icon()), moved: moved.moved };
        await feedback.showSorted(id, await engine.sortWindow(id));
        const afterResort = await icon();
        await new Promise(resolve => setTimeout(resolve, 4300));
        return { afterSort, afterResort, cleared: await icon() };
    }, windowId);
    assert.ok(shown.afterSort.moved > 0);
    assert.equal(shown.afterSort.text, String(shown.afterSort.moved));
    assert.match(shown.afterSort.title, /^Sorted: moved \d+ of 10 tabs in \d+ ms\. Right-click to undo\.$/);
    assert.equal(shown.afterResort.text, '✓');
    assert.equal(shown.afterResort.title, 'Already sorted: none of the 10 tabs needed to move.');
    assert.equal(shown.cleared.text, '');
    assert.equal(shown.cleared.title, 'Sort tabs (right-click for undo and sort options)');
    await inExtension(() => chrome.storage.sync.clear());
});

test('the settings page saves changes and disables custom-only settings', async () => {
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await page.waitForFunction(() => document.getElementById('sortBy').value === 'url');
    assert.equal(await page.isDisabled('#groupFrom'), true);
    await page.selectOption('#sortBy', 'custom');
    await page.waitForFunction(() => !document.getElementById('groupFrom').disabled);
    await page.click('text=Sort pinned tabs');
    await page.waitForFunction(() => document.getElementById('status').textContent === 'Saved');
    const stored = await inExtension(() => chrome.storage.sync.get(null));
    assert.equal(stored.sortBy, 'custom');
    assert.equal(stored.sortPinnedTabs, true);
});

test('no errors in the console', () => {
    assert.deepEqual(errors, []);
});
