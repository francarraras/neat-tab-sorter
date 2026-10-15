import { loadSettings } from './settings.js';

const SORT_BY_HINTS = {
    title: 'Alphabetical by page title. Unread counters like "(3)" are ignored.',
    url: 'Alphabetical by address, ignoring "https://" and "www.".',
    custom: 'Keeps tabs from the same site together, without reordering the sites. See "Custom sort" below.',
    lastAccessed: 'The tabs you used most recently come first.',
};

const form = document.getElementById('settings');
const status = document.getElementById('status');
let statusTimer;

function render(settings) {
    for (const [name, value] of Object.entries(settings)) {
        const field = form.elements[name];
        if (field?.type === 'checkbox') field.checked = value;
        else if (field) field.value = value;
    }
    const { sortBy } = form.elements;
    document.getElementById('sortBy-hint').textContent = SORT_BY_HINTS[sortBy.value] ?? '';
    document.getElementById('custom-settings').disabled = sortBy.value !== 'custom';
}

function showStatus(message) {
    status.textContent = message;
    status.classList.add('visible');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => status.classList.remove('visible'), 1600);
}

form.addEventListener('change', async ({ target }) => {
    try {
        await chrome.storage.sync.set({ [target.name]: target.type === 'checkbox' ? target.checked : target.value });
        showStatus('Saved');
    } catch (error) {
        showStatus(`Couldn't save: ${error.message}`);
    }
});

// Also reflects changes made from the toolbar icon's menu, or synced from another computer.
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync') loadSettings().then(render);
});

loadSettings().then(render);
