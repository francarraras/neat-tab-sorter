// Renders the extension icons (into src/img/) and the Chrome Web Store artwork (into store/):
// screenshots, promo tiles and a short demo video. Needs Playwright's Chromium:
//   npm install && npx playwright install chromium && npm run assets
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'src');
const store = path.join(root, 'store');
const mockups = scene => `file://${path.join(store, 'mockups.html')}?scene=${scene}`;

// The icon, drawn on a 16-unit grid so every size lands on whole pixels: a teal badge with three
// left-aligned bars of increasing length. The 128px icon keeps 16px of transparent padding, as the
// Chrome Web Store asks.
function iconSvg(size, padding) {
    const unit = (size - 2 * padding) / 16;
    const bars = [[4, 4], [7, 7], [10, 10]]
        .map(([y, length]) => `<rect x="${padding + 3 * unit}" y="${padding + y * unit}" width="${length * unit}" height="${2 * unit}" rx="${unit}" fill="#fff"/>`)
        .join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14b8a6"/><stop offset="1" stop-color="#0f766e"/></linearGradient></defs>
        <rect x="${padding}" y="${padding}" width="${16 * unit}" height="${16 * unit}" rx="${3.5 * unit}" fill="url(#g)"/>${bars}</svg>`;
}

function findFfmpeg() {
    const candidates = [process.env.FFMPEG, 'ffmpeg'];
    const cache = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(os.homedir(),
        process.platform === 'darwin' ? 'Library/Caches/ms-playwright' : process.platform === 'win32' ? 'AppData/Local/ms-playwright' : '.cache/ms-playwright');
    for (const dir of fs.existsSync(cache) ? fs.readdirSync(cache).filter(name => name.startsWith('ffmpeg')) : []) {
        for (const name of fs.readdirSync(path.join(cache, dir))) if (name.startsWith('ffmpeg-')) candidates.push(path.join(cache, dir, name));
    }
    return candidates.find(bin => bin && spawnSync(bin, ['-hide_banner', '-encoders']).stdout?.toString().includes('libvpx'));
}

async function renderVideo(page, file) {
    const ffmpeg = findFfmpeg();
    if (!ffmpeg) throw new Error('No ffmpeg with VP8 support found: run "npx playwright install chromium", or set FFMPEG');
    const fps = 30;
    const seconds = 15;
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(mockups('video'));
    await page.evaluate(() => window.ready);
    // High quality (the pale grays of browser UI wash out otherwise), converted from the
    // full-range JPEG frames to standard HD video colors and tagged as such.
    const encoder = spawn(ffmpeg, [
        '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', 'pipe:0',
        '-vf', 'scale=in_range=full:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p',
        '-c:v', 'libvpx', '-crf', '4', '-b:v', '12M', '-qmin', '0', '-qmax', '12', '-deadline', 'good', '-cpu-used', '0',
        '-auto-alt-ref', '1', '-lag-in-frames', '16',
        '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
        file,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let frame = 0; frame < fps * seconds; frame++) {
        await page.evaluate(t => window.render(t), frame / fps);
        const jpeg = await page.screenshot({ type: 'jpeg', quality: 100 });
        if (!encoder.stdin.write(jpeg)) await once(encoder.stdin, 'drain');
    }
    encoder.stdin.end();
    const [code] = await once(encoder, 'close');
    if (code !== 0) throw new Error(`ffmpeg exited with code ${code}`);
}

const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neat-tab-sorter-assets-'));
const context = await chromium.launchPersistentContext(userDataDir, {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${src}`, `--load-extension=${src}`],
});
try {
    // Read the extension id now: its service worker stops when idle.
    let [worker] = context.serviceWorkers();
    worker ??= await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).host;

    const page = await context.newPage();
    const written = [];
    const shot = async (file, options = {}) => {
        await page.screenshot({ path: path.join(...file), ...options });
        written.push(path.relative(root, path.join(...file)));
    };

    // Icons first: the mockups use them.
    for (const [size, padding] of [[16, 0], [32, 0], [48, 0], [128, 16]]) {
        await page.setViewportSize({ width: size, height: size });
        await page.setContent(`<style>html,body{margin:0;background:transparent}</style>${iconSvg(size, padding)}`);
        await shot([src, 'img', `${size}.png`], { omitBackground: true });
    }
    fs.copyFileSync(path.join(src, 'img', '128.png'), path.join(store, 'icon-128.png'));
    written.push('store/icon-128.png');

    for (const [scene, file, width, height] of [
        ['hero', 'screenshot-1-sort.png', 1280, 800],
        ['groups', 'screenshot-2-groups.png', 1280, 800],
        ['menu', 'screenshot-3-menu.png', 1280, 800],
        ['promo-small', 'promo-small-440x280.png', 440, 280],
        ['marquee', 'promo-marquee-1400x560.png', 1400, 560],
    ]) {
        await page.setViewportSize({ width, height });
        await page.goto(mockups(scene));
        await page.evaluate(() => window.ready);
        await shot([store, file]);
    }

    // The real settings page, in light and dark mode.
    await page.setViewportSize({ width: 1280, height: 800 });
    for (const [colorScheme, file] of [['light', 'screenshot-4-settings.png'], ['dark', 'screenshot-5-settings-dark.png']]) {
        await page.emulateMedia({ colorScheme });
        await page.goto(`chrome-extension://${extensionId}/options.html`);
        await page.addStyleTag({ content: 'body { zoom: 1.3 }' });
        await page.waitForTimeout(300);
        await shot([store, file]);
    }
    await page.emulateMedia({ colorScheme: 'light' });

    await renderVideo(page, path.join(store, 'demo-video.webm'));
    written.push('store/demo-video.webm');
    console.log(`Wrote:\n  ${written.join('\n  ')}`);
} finally {
    await context.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
}
