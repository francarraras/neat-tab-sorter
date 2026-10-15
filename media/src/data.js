// The made-up tabs in the demos. Every sorted order is computed by the extension's own sort engine
// (src/sort.js), so the animations always show what the extension really does.
import { DEFAULT_SETTINGS } from '../../src/settings.js';
import { planSort } from '../../src/sort.js';

export const GROUPS = {
    1: { id: 1, title: '1. Work', color: '#1a73e8' },
    2: { id: 2, title: '2. Trip', color: '#188038' },
    3: { id: 3, title: '10. Later', color: '#a142f4' },
};

let nextId = 1;
const tab = (title, url, letter, color, extra = {}) => ({
    id: nextId++, title, url, fav: [color, letter], pinned: false, groupId: -1, splitViewId: -1, ...extra,
});

export const TABS = {
    mail: tab('Mail', 'https://mail.example/', 'M', '#d93025', { pinned: true }),
    issue19: tab('Issue #19', 'https://tracker.example/issues/19', '#', '#24292f'),
    issue2: tab('Issue #2', 'https://tracker.example/issues/2', '#', '#24292f'),
    chat: tab('(3) Team chat', 'https://chat.example/', 'C', '#8430ce'),
    news: tab('Morning news', 'https://news.example/', 'N', '#5f6368'),
    report: tab('Weekly report', 'https://docs.example/report', 'R', '#188038', { groupId: 1 }),
    plan: tab('Project plan', 'https://docs.example/plan', 'P', '#0b57d0', { groupId: 1 }),
    hotels: tab('Lisbon hotels', 'https://hotels.example/lisbon', 'H', '#e8710a', { groupId: 2 }),
    flights: tab('Lisbon flights', 'https://flights.example/lisbon', 'F', '#1967d2', { groupId: 2 }),
    recipes: tab('Pasta recipes', 'https://recipes.example/pasta', 'P', '#c5221f', { groupId: 3 }),
    movies: tab('Movie night', 'https://movies.example/', 'M', '#9334e6', { groupId: 3 }),
};

const keyOf = new Map(Object.entries(TABS).map(([key, value]) => [value.id, key]));

/** Sorts a window (a list of tab keys, left to right) the way the extension would. */
export function sorted(keys, sortBy) {
    const { order } = planSort(keys.map(key => TABS[key]), Object.values(GROUPS), { ...DEFAULT_SETTINGS, sortBy });
    return order.map(id => keyOf.get(id));
}

// The demo video: a messy window, sorted by title, then by URL, undone, then sorted again.
export const DEMO_MESSY = ['mail', 'issue19', 'report', 'plan', 'chat', 'issue2', 'news'];
export const DEMO_BY_TITLE = sorted(DEMO_MESSY, 'title');
export const DEMO_BY_URL = sorted(DEMO_BY_TITLE, 'url');

// Store screenshots.
export const HERO_MESSY = ['mail', 'issue19', 'hotels', 'flights', 'issue2', 'report', 'plan', 'chat'];
export const HERO_SORTED = sorted(HERO_MESSY, 'title');
export const GROUPS_MESSY = ['recipes', 'movies', 'hotels', 'flights', 'news', 'report', 'plan'];
export const GROUPS_SORTED = sorted(GROUPS_MESSY, 'title');
