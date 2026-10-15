// Screenshots of the real settings page, in light and dark mode, for the Chrome Web Store.
// Everything else in store/ is drawn by media/ (Remotion). Needs Playwright:
//   npm install && npx playwright install chromium && npm run screenshots
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neat-tab-sorter-screenshots-'));
const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${src}`, `--load-extension=${src}`],
});
try {
    // Read the extension id right away: its service worker stops when idle.
    let [worker] = context.serviceWorkers();
    worker ??= await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).host;
    const page = await context.newPage();
    for (const [colorScheme, file] of [['light', 'screenshot-4-settings.png'], ['dark', 'screenshot-5-settings-dark.png']]) {
        await page.emulateMedia({ colorScheme });
        await page.goto(`chrome-extension://${extensionId}/options.html`);
        await page.addStyleTag({ content: 'body { zoom: 1.3 }' });
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(root, 'store', file) });
        console.log(`Rendered store/${file}`);
    }
} finally {
    await context.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
}
