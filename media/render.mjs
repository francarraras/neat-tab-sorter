// Renders the extension icons, the README preview GIF, and the Chrome Web Store images and video.
//   npm install && npm run render       (or `npm run studio` to preview and tweak them live)
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const media = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(media, '..');
const out = file => path.join(root, file);
const serveUrl = await bundle({ entryPoint: path.join(media, 'src', 'index.jsx') });
const composition = id => selectComposition({ serveUrl, id });
fs.mkdirSync(out('docs'), { recursive: true });

for (const [id, file] of [
    ['Icon16', 'src/img/16.png'],
    ['Icon32', 'src/img/32.png'],
    ['Icon48', 'src/img/48.png'],
    ['Icon128', 'src/img/128.png'],
    ['Icon128', 'store/icon-128.png'],
    ['ScreenshotSort', 'store/screenshot-1-sort.png'],
    ['ScreenshotGroups', 'store/screenshot-2-groups.png'],
    ['ScreenshotMenu', 'store/screenshot-3-menu.png'],
    ['PromoSmall', 'store/promo-small-440x280.png'],
    ['PromoMarquee', 'store/promo-marquee-1400x560.png'],
    ['SocialPreview', 'docs/social-preview.png'],
]) {
    await renderStill({ composition: await composition(id), serveUrl, output: out(file), imageFormat: 'png' });
    console.log(`Rendered ${file}`);
}

await renderMedia({
    composition: await composition('Demo'), serveUrl, codec: 'h264', crf: 14, colorSpace: 'bt709', outputLocation: out('store/demo-video.mp4'),
});
console.log('Rendered store/demo-video.mp4');

// The README GIF: render at 960x540 in full color, then reduce it to one shared 256-color palette,
// only redrawing what changes between frames, which keeps the file small.
const intermediate = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'neat-tab-sorter-')), 'preview.mov');
await renderMedia({
    composition: await composition('ReadmePreview'), serveUrl, codec: 'prores', proResProfile: '4444', scale: 0.75, outputLocation: intermediate,
});
const ffmpeg = spawnSync('npx', ['remotion', 'ffmpeg', '-y', '-loglevel', 'error', '-i', intermediate, '-vf',
    'split[a][b];[a]palettegen=stats_mode=full[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
    out('docs/preview.gif')], { cwd: media, stdio: 'inherit' });
fs.rmSync(path.dirname(intermediate), { recursive: true, force: true });
if (ffmpeg.status !== 0) throw new Error('ffmpeg failed to make the GIF');
console.log(`Rendered docs/preview.gif (${(fs.statSync(out('docs/preview.gif')).size / 1e6).toFixed(1)} MB)`);
