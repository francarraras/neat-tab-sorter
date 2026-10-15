// Pure sorting and move-planning logic. Nothing in this module touches the chrome.* APIs, so it
// can be unit tested in Node (see test/).

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const compareText = collator.compare;

// The Great Suspender and its forks (e.g. The Marvellous Suspender) replace a suspended tab's URL
// with chrome-extension://<id>/suspended.html#ttl=<title>&pos=<scroll>&uri=<original URL>.
const SUSPENDED_URL = /^chrome-extension:\/\/[a-p]{32}\/suspended\.html#(.*)$/s;

// Unread counters that sites put in front of their titles: "(3) Inbox", "(99+) Home", "• Chat".
const TITLE_COUNTER = /^\s*(?:\(\d[\d,.]*\+?\)|[•●])\s*/u;

// ---------------------------------------------------------------------------------------------
// Sort keys

/** Returns the original URL of a tab suspended by a Great Suspender fork, or null if it isn't suspended. */
export function suspendedOriginalUrl(url) {
    const match = SUSPENDED_URL.exec(url);
    if (!match) return null;
    // "uri" is always the last parameter and isn't encoded, so it may itself contain '&' and '#'.
    const uri = /(?:^|&)uri=(.*)$/s.exec(match[1]);
    if (uri) return uri[1];
    // Older versions used an encoded "url" parameter instead.
    const legacy = /(?:^|&)url=([^&]*)/.exec(match[1]);
    if (!legacy) return '';
    try {
        return decodeURIComponent(legacy[1]);
    } catch {
        return legacy[1];
    }
}

export function cleanTitle(title) {
    return (title || '').replace(TITLE_COUNTER, '').trim();
}

/** Precomputes a tab's sort keys, so each URL is parsed once rather than on every comparison. */
export function describeTab(tab) {
    const rawUrl = tab.pendingUrl || tab.url || '';
    const originalUrl = suspendedOriginalUrl(rawUrl);
    const href = originalUrl ?? rawUrl;
    let site = '';
    let urlKey = href;
    try {
        const url = new URL(href);
        // Ignore the protocol and a leading "www." so http/https and www/non-www variants sort together.
        const host = url.host.replace(/^www\./, '');
        site = host || url.protocol;
        urlKey = host + url.pathname + url.search + url.hash;
    } catch {
        // Not a parseable URL: sort by the raw string.
    }
    return {
        suspended: originalUrl !== null,
        site,
        urlKey,
        title: cleanTitle(tab.title) || urlKey,
        lastAccessed: tab.lastAccessed || 0,
    };
}

/**
 * Returns a comparator for the tabs of one segment: the pinned tabs, the tabs of one tab group, or
 * the ungrouped tabs. "custom" orders sites by where they already appear in the segment, so it's
 * built from the segment's tabs, in their current order.
 */
export function segmentComparator(infos, settings) {
    const { sortBy, groupSuspendedTabs, preserveOrderWithinGroups } = settings;
    const suspendedFirst = (a, b) =>
        groupSuspendedTabs && a.suspended !== b.suspended ? (a.suspended ? -1 : 1) : 0;

    switch (sortBy) {
        case 'title':
            return (a, b) => suspendedFirst(a, b) || compareText(a.title, b.title) || compareText(a.urlKey, b.urlKey);
        case 'lastAccessed':
            return (a, b) => suspendedFirst(a, b) || b.lastAccessed - a.lastAccessed;
        case 'custom': {
            // Rank each site by its first tab, scanning from the left or the right. Grouped suspended
            // tabs are ranked separately, since they're kept apart from everything else.
            const rightToLeft = settings.groupFrom === 'rightToLeft';
            const siteKey = info => (groupSuspendedTabs && info.suspended ? 'suspended ' : 'site ') + info.site;
            const rank = new Map();
            for (const info of rightToLeft ? [...infos].reverse() : infos) {
                if (!rank.has(siteKey(info))) rank.set(siteKey(info), rank.size);
            }
            const sign = rightToLeft ? -1 : 1;
            return (a, b) =>
                suspendedFirst(a, b) ||
                sign * (rank.get(siteKey(a)) - rank.get(siteKey(b))) ||
                (preserveOrderWithinGroups ? 0 : compareText(a.urlKey, b.urlKey));
        }
        default: // 'url'
            return (a, b) => suspendedFirst(a, b) || compareText(a.urlKey, b.urlKey);
    }
}

// ---------------------------------------------------------------------------------------------
// Window structure
//
// A window is its pinned tabs followed by "items": tab groups and ungrouped tabs. Tabs shown
// together in a split view form one "unit". Chrome dissolves a split view when one of its tabs is
// moved away from the other, so split views are anchors: they keep their place and everything else
// is arranged around them.

const isSplit = unit => unit.splitId !== -1;

function parseWindow(tabs) {
    const pinned = [];
    const items = [];
    let unit = null;
    for (const tab of tabs) {
        const splitId = tab.splitViewId ?? -1;
        if (splitId !== -1 && unit?.splitId === splitId) {
            unit.tabs.push(tab);
            continue;
        }
        unit = { tabs: [tab], splitId };
        const groupId = tab.groupId ?? -1;
        const last = items[items.length - 1];
        if (tab.pinned) pinned.push(unit);
        else if (groupId !== -1 && last?.groupId === groupId) last.units.push(unit);
        else items.push({ groupId, units: [unit] });
    }
    return { pinned, items };
}

/**
 * Stable-sorts `entries` with `compare`, except for anchors, which keep their current relative
 * order while the other entries are merged in around them.
 */
function arrange(entries, compare, isAnchor = () => false) {
    const movable = entries.filter(entry => !isAnchor(entry)).sort(compare);
    const anchors = entries.filter(isAnchor);
    if (!anchors.length) return movable;
    const position = new Map(entries.map((entry, index) => [entry, index]));
    const merged = [];
    let next = 0;
    for (const anchor of anchors) {
        while (next < movable.length &&
            (compare(movable[next], anchor) || position.get(movable[next]) - position.get(anchor)) < 0) {
            merged.push(movable[next++]);
        }
        merged.push(anchor);
    }
    return merged.concat(movable.slice(next));
}

function arrangeByRank(entries, rankOf, isAnchor) {
    const ranks = new Map(entries.map(entry => [entry, rankOf(entry)]));
    const compare = (a, b) => {
        const rankA = ranks.get(a);
        const rankB = ranks.get(b);
        return rankA < rankB ? -1 : rankA > rankB ? 1 : 0;
    };
    return arrange(entries, compare, isAnchor);
}

// ---------------------------------------------------------------------------------------------
// Plans
//
// A plan is the list of moves that turns a window's current tab order into the desired one, plus
// the resulting order. Moves use Chrome's own semantics: `index` is where the (first) moved tab
// ends up, so moves must be made one after another, in order.
//
//   { tabIds: [1, 2], index: 5 }  ->  chrome.tabs.move([1, 2], { index: 5 })
//   { groupId: 7, index: 0 }      ->  chrome.tabGroups.move(7, { index: 0 })

/** Plans sorting a window. `tabs` must be in index order. */
export function planSort(tabs, groups, settings) {
    const infos = new Map(tabs.map(tab => [tab.id, describeTab(tab)]));
    const sortEntries = (entries, unitOf) => {
        const segment = entries.flatMap(entry => unitOf(entry).tabs.map(tab => infos.get(tab.id)));
        const compare = segmentComparator(segment, settings);
        const info = entry => infos.get(unitOf(entry).tabs[0].id);
        return arrange(entries, (a, b) => compare(info(a), info(b)), entry => isSplit(unitOf(entry)));
    };
    const titles = new Map(groups.map(group => [group.id, group.title || '']));
    const compareGroups = (a, b) => {
        const titleA = titles.get(a.groupId) ?? '';
        const titleB = titles.get(b.groupId) ?? '';
        return !titleA - !titleB || compareText(titleA, titleB); // untitled groups go last
    };

    return plan(tabs, {
        pinned: units => (settings.sortPinnedTabs ? sortEntries(units, unit => unit) : units),
        group: units => (settings.sortTabsInGroups ? sortEntries(units, unit => unit) : units),
        // Tab groups go to the left of all ungrouped tabs.
        items: items => {
            const grouped = items.filter(item => item.groupId !== -1);
            const ungrouped = items.filter(item => item.groupId === -1);
            return [
                ...(settings.sortGroupsByTitle ? arrange(grouped, compareGroups) : grouped),
                ...sortEntries(ungrouped, item => item.units[0]),
            ];
        },
    });
}

/** Plans putting a window's tabs back in `savedOrder` (tab ids), e.g. to undo a sort. */
export function planRestore(tabs, savedOrder) {
    const saved = new Map(savedOrder.map((id, index) => [id, index]));
    // Tabs opened since then keep their current relative order, after the others.
    const rankOf = tabList => tabList.reduce((min, tab) => Math.min(min, saved.get(tab.id) ?? Infinity), Infinity);
    const unitRank = unit => rankOf(unit.tabs);

    return plan(tabs, {
        pinned: units => arrangeByRank(units, unitRank, isSplit),
        group: units => arrangeByRank(units, unitRank, isSplit),
        items: items => arrangeByRank(
            items,
            item => rankOf(item.units.flatMap(unit => unit.tabs)),
            item => item.groupId === -1 && isSplit(item.units[0]),
        ),
    });
}

/**
 * Plans the moves from the current order to the order chosen by `order`, which has a function for
 * each level of the window: the pinned units, the top-level items, and the units in a tab group.
 * Group membership never changes, and groups always move as a whole.
 */
function plan(tabs, order) {
    const { pinned, items } = parseWindow(tabs);
    const sim = tabs.map(tab => tab.id); // the tab order as the planned moves are made
    const ops = [];

    const unitEntries = new Map();
    const unitEntry = unit => {
        if (!unitEntries.has(unit)) unitEntries.set(unit, { ids: unit.tabs.map(tab => tab.id), anchor: isSplit(unit) });
        return unitEntries.get(unit);
    };
    const itemEntries = new Map();
    const itemEntry = item => {
        if (item.groupId === -1) return unitEntry(item.units[0]);
        if (!itemEntries.has(item)) {
            const ids = item.units.flatMap(unit => unitEntry(unit).ids);
            itemEntries.set(item, { ids, groupId: item.groupId, anchor: false });
        }
        return itemEntries.get(item);
    };

    const orderedPinned = order.pinned(pinned);
    planSegment(pinned.map(unitEntry), orderedPinned.map(unitEntry), 0, sim, ops);

    const pinnedCount = pinned.reduce((count, unit) => count + unit.tabs.length, 0);
    const orderedItems = order.items(items);
    planSegment(items.map(itemEntry), orderedItems.map(itemEntry), pinnedCount, sim, ops);

    const expected = orderedPinned.flatMap(unit => unitEntry(unit).ids);
    for (const item of orderedItems) {
        if (item.groupId === -1) {
            expected.push(...unitEntry(item.units[0]).ids);
            continue;
        }
        // Groups moved as a whole, so their first tab is still the same.
        const start = sim.indexOf(itemEntry(item).ids[0]);
        const orderedUnits = order.group(item.units);
        planSegment(item.units.map(unitEntry), orderedUnits.map(unitEntry), start, sim, ops);
        expected.push(...orderedUnits.flatMap(unit => unitEntry(unit).ids));
    }

    if (sim.length !== expected.length || sim.some((id, index) => id !== expected[index])) {
        throw new Error('Planned moves do not produce the planned order');
    }
    return { moves: batch(ops), order: expected };
}

/**
 * Plans the moves that reorder one segment (a contiguous run of entries starting at `start`) from
 * `current` to `target`, moving as few tabs as possible: the heaviest run of entries that are
 * already in the right relative order stays put, and every other entry is moved, in target order,
 * to just after its target predecessor. Anchors are always kept in place.
 */
function planSegment(current, target, start, sim, ops) {
    if (current.length < 2) return;
    const targetIndex = new Map(target.map((entry, index) => [entry, index]));
    const anchorWeight = current.reduce((total, entry) => total + entry.ids.length, 1);
    const kept = heaviestIncreasingSubsequence(
        current.map(entry => targetIndex.get(entry)),
        current.map(entry => (entry.anchor ? anchorWeight : entry.ids.length)),
    );
    const keep = new Set([...kept].map(index => current[index]));

    target.forEach((entry, index) => {
        if (keep.has(entry)) return;
        if (entry.anchor) throw new Error('Planned to move a split view');
        const from = sim.indexOf(entry.ids[0]);
        let to = start;
        if (index > 0) {
            const previous = target[index - 1].ids;
            const after = sim.indexOf(previous[previous.length - 1]);
            to = from < after ? after - entry.ids.length + 1 : after + 1;
        }
        if (to === from) return;
        sim.splice(to, 0, ...sim.splice(from, entry.ids.length));
        if (entry.groupId !== undefined) ops.push({ groupId: entry.groupId, index: to });
        else ops.push({ tabId: entry.ids[0], index: to });
    });
}

/**
 * Returns the indices of the increasing subsequence of `values` (distinct integers 0..n-1) with
 * the largest total weight. O(n log n), using a Fenwick tree of prefix maxima.
 */
export function heaviestIncreasingSubsequence(values, weights) {
    const n = values.length;
    const tree = new Int32Array(n + 1).fill(-1); // index of the best chain ending at a value <= i
    const best = new Float64Array(n);
    const previous = new Int32Array(n).fill(-1);
    let top = -1;
    for (let k = 0; k < n; k++) {
        let chain = -1;
        for (let i = values[k]; i > 0; i -= i & -i) {
            if (tree[i] !== -1 && (chain === -1 || best[tree[i]] > best[chain])) chain = tree[i];
        }
        best[k] = weights[k] + (chain === -1 ? 0 : best[chain]);
        previous[k] = chain;
        for (let i = values[k] + 1; i <= n; i += i & -i) {
            if (tree[i] === -1 || best[k] > best[tree[i]]) tree[i] = k;
        }
        if (top === -1 || best[k] > best[top]) top = k;
    }
    const indices = new Set();
    for (let k = top; k !== -1; k = previous[k]) indices.add(k);
    return indices;
}

/**
 * Merges consecutive single-tab moves into one chrome.tabs.move() call where Chrome would make the
 * exact same moves anyway: it moves the listed tabs one by one, each to the index after the last.
 */
function batch(ops) {
    const moves = [];
    for (const op of ops) {
        const last = moves[moves.length - 1];
        if (op.tabId === undefined) moves.push({ groupId: op.groupId, index: op.index });
        else if (last?.tabIds && op.index === last.index + last.tabIds.length) last.tabIds.push(op.tabId);
        else moves.push({ tabIds: [op.tabId], index: op.index });
    }
    return moves;
}
