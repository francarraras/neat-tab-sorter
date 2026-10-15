// Shared by the settings, user guide and about pages.
const { version } = chrome.runtime.getManifest();
for (const element of document.querySelectorAll('[data-version]')) element.textContent = `v${version}`;

// Shows the current shortcut for each [data-shortcut="<command name>"] element.
async function renderShortcuts() {
    const commands = await chrome.commands.getAll();
    for (const element of document.querySelectorAll('[data-shortcut]')) {
        const shortcut = commands.find(command => command.name === element.dataset.shortcut)?.shortcut;
        const kbd = document.createElement('kbd');
        kbd.textContent = shortcut;
        element.replaceChildren(shortcut ? kbd : 'not set');
        element.classList.toggle('unset', !shortcut);
    }
}

// chrome:// pages can't be linked to directly.
for (const element of document.querySelectorAll('[data-open-shortcuts]')) {
    element.addEventListener('click', event => {
        event.preventDefault();
        chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    });
}

renderShortcuts();
// Pick up changes made on chrome://extensions/shortcuts in another tab.
window.addEventListener('focus', renderShortcuts);
