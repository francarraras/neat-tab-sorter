import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_SETTINGS } from '../src/settings.js';
import {
    cleanTitle,
    describeTab,
    heaviestIncreasingSubsequence,
    planRestore,
    planSort,
    suspendedOriginalUrl,
} from '../src/sort.js';
import { TabStrip } from './tab-strip.js';

let nextId = 1;
const tab = (url, props = {}) => ({ id: nextId++, url, title: '', pinned: false, groupId: -1, splitViewId: -1, ...props });
const suspended = url => `chrome-extension://noogafoofpebimajpfpamcfhoaifemoa/suspended.html#ttl=Title&pos=0&uri=${url}`;
const withIndex = tabs => tabs.map((t, index) => ({ ...t, index }));

/** Sorts `tabs` on a model of Chrome's tab strip, checking that nothing but the order changed. */
function sort(tabs, settings = {}, groups = []) {
    const { moves, order } = planSort(withIndex(tabs), groups, { ...DEFAULT_SETTINGS, ...settings });
    const strip = new TabStrip(tabs);
    strip.apply(moves);
    assert.deepEqual(strip.events, []);
    assert.deepEqual(strip.ids, order);
    const byId = new Map(tabs.map(t => [t.id, t]));
    return { tabs: order.map(id => byId.get(id)), moves, strip };
}
const urls = ({ tabs }) => tabs.map(t => t.url);
const titles = ({ tabs }) => tabs.map(t => t.title);
const movedTabs = moves => moves.reduce((count, move) => count + (move.tabIds?.length ?? 1), 0);

test('URL sort ignores protocol and www, and compares numbers naturally', () => {
    const result = sort([
        tab('https://github.com/pwhite2/simple-tab-sorter/issues/19'),
        tab('https://www.example.com/'),
        tab('https://github.com/pwhite2/simple-tab-sorter/issues/2'),
        tab('http://apple.com/'),
        tab('https://Zeta.dev/'),
    ]);
    assert.deepEqual(urls(result), [
        'http://apple.com/',
        'https://www.example.com/',
        'https://github.com/pwhite2/simple-tab-sorter/issues/2',
        'https://github.com/pwhite2/simple-tab-sorter/issues/19',
        'https://Zeta.dev/',
    ]);
});

test('title sort ignores unread counters and case, and compares numbers naturally', () => {
    const result = sort([
        tab('https://b.com/', { title: '(3) Inbox' }),
        tab('https://a.com/', { title: 'banana' }),
        tab('https://c.com/', { title: 'Apple' }),
        tab('https://d.com/', { title: 'Episode 10' }),
        tab('https://e.com/', { title: 'Episode 2' }),
    ], { sortBy: 'title' });
    assert.deepEqual(titles(result), ['Apple', 'banana', 'Episode 2', 'Episode 10', '(3) Inbox']);
});

test('recently used sort puts the most recent tabs first', () => {
    const result = sort([
        tab('https://a.com/', { lastAccessed: 10 }),
        tab('https://b.com/', { lastAccessed: 30 }),
        tab('https://c.com/', { lastAccessed: 20 }),
    ], { sortBy: 'lastAccessed' });
    assert.deepEqual(urls(result), ['https://b.com/', 'https://c.com/', 'https://a.com/']);
});

test('custom sort keeps sites in the order they already appear', () => {
    const tabs = [
        tab('https://b.com/1'),
        tab('https://www.a.com/2'),
        tab('https://b.com/0'),
        tab('https://c.com/'),
        tab('https://a.com/1'),
    ];
    assert.deepEqual(urls(sort(tabs, { sortBy: 'custom' })), [
        'https://b.com/1', 'https://b.com/0', 'https://www.a.com/2', 'https://a.com/1', 'https://c.com/',
    ]);
    assert.deepEqual(urls(sort(tabs, { sortBy: 'custom', preserveOrderWithinGroups: false })), [
        'https://b.com/0', 'https://b.com/1', 'https://a.com/1', 'https://www.a.com/2', 'https://c.com/',
    ]);
    // Right to left: sites are ordered by their rightmost tab.
    assert.deepEqual(urls(sort(tabs, { sortBy: 'custom', groupFrom: 'rightToLeft' })), [
        'https://b.com/1', 'https://b.com/0', 'https://c.com/', 'https://www.a.com/2', 'https://a.com/1',
    ]);
});

test('suspended tabs sort by their original URL, or go first when grouped', () => {
    const tabs = [
        tab('https://c.com/'),
        tab(suspended('https://b.com/')),
        tab('https://a.com/'),
        tab(suspended('https://a.com/z')),
    ];
    assert.deepEqual(urls(sort(tabs)), [tabs[2].url, tabs[3].url, tabs[1].url, tabs[0].url]);
    assert.deepEqual(urls(sort(tabs, { groupSuspendedTabs: true })), [tabs[3].url, tabs[1].url, tabs[2].url, tabs[0].url]);
    // Custom sort ranks suspended sites among the suspended tabs only.
    assert.deepEqual(urls(sort(tabs, { sortBy: 'custom', groupSuspendedTabs: true })), [tabs[1].url, tabs[3].url, tabs[0].url, tabs[2].url]);
});

test('suspended URLs are parsed like The Great Suspender does', () => {
    const base = 'chrome-extension://noogafoofpebimajpfpamcfhoaifemoa/suspended.html#';
    assert.equal(suspendedOriginalUrl(`${base}ttl=T&pos=0&uri=https://x.com/?a=1&b=2#frag`), 'https://x.com/?a=1&b=2#frag');
    assert.equal(suspendedOriginalUrl(`${base}ttl=T&url=https%3A%2F%2Fx.com%2F`), 'https://x.com/');
    assert.equal(suspendedOriginalUrl('chrome-extension://noogafoofpebimajpfpamcfhoaifemoa/options.html'), null);
    assert.equal(suspendedOriginalUrl('https://x.com/suspended.html#uri=https://y.com/'), null);
    // 0.4.x read a "uri" parameter out of any long URL.
    const login = describeTab(tab('https://accounts.example.com/oauth/authorize?client_id=1234567890123456789&uri=https://elsewhere.com/'));
    assert.equal(login.suspended, false);
    assert.equal(login.site, 'accounts.example.com');
});

test('cleanTitle strips unread counters only', () => {
    assert.equal(cleanTitle('(3) Inbox'), 'Inbox');
    assert.equal(cleanTitle('(99+) Home / X'), 'Home / X');
    assert.equal(cleanTitle('(1,234) Feed'), 'Feed');
    assert.equal(cleanTitle('• Chat'), 'Chat');
    assert.equal(cleanTitle('Inbox (3) - me@example.com'), 'Inbox (3) - me@example.com');
    assert.equal(cleanTitle(undefined), '');
});

test('pinned tabs are left alone unless enabled, and always stay first', () => {
    const tabs = [tab('https://z.com/', { pinned: true }), tab('https://y.com/', { pinned: true }), tab('https://b.com/'), tab('https://a.com/')];
    assert.deepEqual(urls(sort(tabs)), ['https://z.com/', 'https://y.com/', 'https://a.com/', 'https://b.com/']);
    assert.deepEqual(urls(sort(tabs, { sortPinnedTabs: true })), ['https://y.com/', 'https://z.com/', 'https://a.com/', 'https://b.com/']);
});

test('tab groups stay intact, go first, and are ordered by name', () => {
    const groups = [{ id: 1, title: '10. Later' }, { id: 2, title: '2. Shopping' }, { id: 3, title: '' }];
    const tabs = [
        tab('https://z.com/'),
        tab('https://e.com/', { groupId: 3 }),
        tab('https://b.com/', { groupId: 1 }),
        tab('https://a.com/', { groupId: 1 }),
        tab('https://y.com/'),
        tab('https://d.com/', { groupId: 2 }),
        tab('https://c.com/', { groupId: 2 }),
    ];
    const run = settings => sort(tabs, settings, groups).tabs.map(t => `${t.groupId}:${new URL(t.url).host[0]}`);
    assert.deepEqual(run({}), ['2:c', '2:d', '1:a', '1:b', '3:e', '-1:y', '-1:z']);
    assert.deepEqual(run({ sortGroupsByTitle: false }), ['3:e', '1:a', '1:b', '2:c', '2:d', '-1:y', '-1:z']);
    assert.deepEqual(run({ sortTabsInGroups: false }), ['2:d', '2:c', '1:b', '1:a', '3:e', '-1:y', '-1:z']);
    assert.deepEqual(run({ sortGroupsByTitle: false, sortTabsInGroups: false }), ['3:e', '1:b', '1:a', '2:d', '2:c', '-1:y', '-1:z']);
});

test('split views are never moved; other tabs are sorted around them', () => {
    const result = sort([
        tab('https://c.com/'),
        tab('https://b.com/', { splitViewId: 7 }),
        tab('https://z.com/', { splitViewId: 7 }),
        tab('https://a.com/'),
        tab('https://d.com/'),
    ]);
    assert.deepEqual(urls(result), ['https://a.com/', 'https://b.com/', 'https://z.com/', 'https://c.com/', 'https://d.com/']);

    // Two split views in the "wrong" order keep their relative order.
    const crossed = sort([
        tab('https://y.com/', { splitViewId: 1 }),
        tab('https://q.com/', { splitViewId: 1 }),
        tab('https://b.com/', { splitViewId: 2 }),
        tab('https://c.com/', { splitViewId: 2 }),
        tab('https://a.com/'),
    ]);
    assert.deepEqual(urls(crossed), ['https://a.com/', 'https://y.com/', 'https://q.com/', 'https://b.com/', 'https://c.com/']);
});

test('only out-of-place tabs move', () => {
    const sorted = ['a', 'b', 'c', 'd', 'e', 'f'].map(letter => tab(`https://${letter}.com/`));
    assert.equal(sort(sorted).moves.length, 0);

    const oneOff = [sorted[0], sorted[4], sorted[1], sorted[2], sorted[3], sorted[5]];
    assert.equal(movedTabs(sort(oneOff).moves), 1);

    const reversed = [...sorted].reverse();
    const { moves } = sort(reversed);
    assert.equal(movedTabs(moves), sorted.length - 1);
    assert.equal(moves.length, 1, 'moves to consecutive indices are batched into one call');
});

test('heaviestIncreasingSubsequence matches brute force', () => {
    const random = mulberry32(7);
    for (let round = 0; round < 300; round++) {
        const n = Math.floor(random() * 9);
        const values = shuffle([...Array(n).keys()], random);
        const weights = values.map(() => 1 + Math.floor(random() * 5));
        const indices = [...heaviestIncreasingSubsequence(values, weights)].sort((a, b) => a - b);
        for (let i = 1; i < indices.length; i++) assert.ok(values[indices[i - 1]] < values[indices[i]]);
        const weight = indices.reduce((total, i) => total + weights[i], 0);
        let best = 0;
        for (let mask = 0; mask < 1 << n; mask++) {
            let last = -1;
            let total = 0;
            let increasing = true;
            for (let i = 0; i < n && increasing; i++) {
                if (!(mask & (1 << i))) continue;
                increasing = values[i] > last;
                last = values[i];
                total += weights[i];
            }
            if (increasing) best = Math.max(best, total);
        }
        assert.equal(weight, best);
    }
});

test('random windows: sorting is safe, minimal, idempotent and undoable', () => {
    const random = mulberry32(2024);
    for (let round = 0; round < 3000; round++) {
        const { tabs, groups } = randomWindow(random);
        const settings = randomSettings(random);
        const { strip } = sort(tabs, settings, groups);

        const byId = new Map(tabs.map(t => [t.id, t]));
        const after = withIndex(strip.tabs.map(({ id }) => byId.get(id)));
        assertWellFormed(after);

        // Sorting again changes nothing.
        const hasSplits = tabs.some(t => t.splitViewId !== -1);
        if (!hasSplits) assert.equal(planSort(after, groups, { ...DEFAULT_SETTINGS, ...settings }).moves.length, 0);

        // Undo restores the original order exactly.
        const undo = new TabStrip(after);
        const restore = planRestore(after, tabs.map(t => t.id));
        undo.apply(restore.moves);
        assert.deepEqual(undo.events, []);
        assert.deepEqual(undo.ids, tabs.map(t => t.id));
    }
});

test('random permutations move exactly n - LIS tabs', () => {
    const random = mulberry32(99);
    for (let round = 0; round < 300; round++) {
        const n = 1 + Math.floor(random() * 30);
        const tabs = shuffle([...Array(n).keys()], random).map(i => tab(`https://site${i}.com/`));
        const target = tabs.map(t => Number(t.url.match(/\d+/)[0]));
        const { moves } = sort(tabs);
        assert.equal(movedTabs(moves), n - longestIncreasing(target));
    }
});

// ---------------------------------------------------------------------------------------------

function assertWellFormed(tabs) {
    const firstUnpinned = tabs.findIndex(t => !t.pinned);
    if (firstUnpinned !== -1) assert.ok(tabs.slice(firstUnpinned).every(t => !t.pinned), 'pinned tabs first');
    const seen = new Set();
    let ungrouped = false;
    tabs.forEach((t, index) => {
        if (t.pinned) return;
        if (t.groupId === -1) ungrouped = true;
        else {
            assert.ok(!ungrouped, 'groups come before ungrouped tabs');
            if (tabs[index - 1]?.groupId !== t.groupId) {
                assert.ok(!seen.has(t.groupId), 'groups are contiguous');
                seen.add(t.groupId);
            }
        }
    });
    tabs.forEach((t, index) => {
        if (t.splitViewId !== -1 && tabs[index - 1]?.splitViewId !== t.splitViewId) {
            assert.equal(tabs[index + 1]?.splitViewId, t.splitViewId, 'split views stay together');
        }
    });
}

function randomWindow(random) {
    const pick = list => list[Math.floor(random() * list.length)];
    const URLS = [
        'https://www.example.com/2', 'https://example.com/10', 'http://example.com/1', 'https://a.dev/x',
        'https://b.org/', 'https://mail.google.com/mail/u/0/#inbox', 'https://docs.google.com/d/1',
        'chrome://newtab/', 'about:blank', 'file:///Users/me/notes.txt', suspended('https://a.dev/y'),
        suspended('https://zzz.io/?q=1&r=2'), 'not a url', '',
    ];
    const TITLES = ['(3) Inbox', 'Inbox', 'inbox', 'Episode 10', 'Episode 2', '', 'Zebra', 'apple', 'Äpfel'];
    const GROUP_TITLES = ['1. Work', '10. Later', '2. Shopping', '', 'alpha', 'Alpha'];
    const tabs = [];
    const groups = [];
    let splitViewId = 1;
    const add = (props, count) => {
        const split = count > 1 ? splitViewId++ : -1;
        for (let i = 0; i < count; i++) {
            tabs.push(tab(pick(URLS), { title: pick(TITLES), lastAccessed: Math.floor(random() * 20), splitViewId: split, ...props }));
        }
    };
    const unitSize = () => (random() < 0.15 ? 2 : 1);
    for (let i = Math.floor(random() * 4); i > 0; i--) add({ pinned: true }, unitSize());
    for (let i = Math.floor(random() * 16); i > 0; i--) {
        if (random() < 0.3) {
            const groupId = 1000 + groups.length;
            groups.push({ id: groupId, title: pick(GROUP_TITLES) });
            for (let u = 1 + Math.floor(random() * 4); u > 0; u--) add({ groupId }, unitSize());
        } else {
            add({}, unitSize());
        }
    }
    return { tabs, groups };
}

function randomSettings(random) {
    const pick = list => list[Math.floor(random() * list.length)];
    return {
        sortBy: pick(['title', 'url', 'custom', 'lastAccessed']),
        sortPinnedTabs: random() < 0.5,
        groupSuspendedTabs: random() < 0.5,
        sortGroupsByTitle: random() < 0.5,
        sortTabsInGroups: random() < 0.5,
        groupFrom: pick(['leftToRight', 'rightToLeft']),
        preserveOrderWithinGroups: random() < 0.5,
    };
}

function longestIncreasing(values) {
    const best = values.map(() => 1);
    for (let i = 0; i < values.length; i++) {
        for (let j = 0; j < i; j++) if (values[j] < values[i]) best[i] = Math.max(best[i], best[j] + 1);
    }
    return Math.max(0, ...best);
}

function shuffle(list, random) {
    for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
}

function mulberry32(seed) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
