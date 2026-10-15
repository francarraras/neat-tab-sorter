// The demo: one click sorts a messy window, the menu switches the default order, Undo puts the
// tabs back, and the shortcut sorts again. It loops seamlessly (for the README GIF).
import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import {
    BrowserWindow, Brand, ContextMenu, Cursor, EXTENSION_BUTTON_INSET, Keys, MENU_WIDTH, Place, Ripple,
    TABSTRIP_HEIGHT, TOOLBAR_HEIGHT, menuItemPoint,
} from './components.jsx';
import { DEMO_BY_TITLE, DEMO_BY_URL, DEMO_MESSY } from './data.js';

export const DEMO_SECONDS = 14;

const ZOOM = 1.15;
const WINDOW = { x: 48, y: 168, width: 1030 }; // width before zoom
const BUTTON = {
    x: WINDOW.x + ZOOM * (WINDOW.width - EXTENSION_BUTTON_INSET),
    y: WINDOW.y + ZOOM * (TABSTRIP_HEIGHT + TOOLBAR_HEIGHT / 2),
};
const MENU = { x: BUTTON.x - ZOOM * MENU_WIDTH, y: BUTTON.y + 2 };
const onMenu = id => {
    const point = menuItemPoint(id);
    return { x: MENU.x + ZOOM * point.x, y: MENU.y + ZOOM * point.y };
};
const REST = { x: 760, y: 610 };

const SORTS = [
    { at: 1.55, from: DEMO_MESSY, to: DEMO_BY_TITLE }, // click
    { at: 4.7, from: DEMO_BY_TITLE, to: DEMO_BY_URL }, // menu: Sort by URL
    { at: 7.8, from: DEMO_BY_URL, to: DEMO_BY_TITLE }, // menu: Undo last sort
    { at: 9.9, from: DEMO_BY_TITLE, to: DEMO_BY_URL }, // shortcut, with URL now the default
];
const GLIDE_SECONDS = 0.5;
const END_CARD = { in: 11.6, out: 13.6 };

const CAPTIONS = [
    { start: 0.15, end: 1.5, title: 'Messy tabs?' },
    { start: 1.6, end: 3.55, title: 'One click. Sorted instantly.', sub: 'Groups stay intact, “Issue #2” comes before “Issue #19”, and “(3)” is ignored.' },
    { start: 3.65, end: 6.85, title: 'Pick your favorite order.', sub: 'It becomes your default, right from the toolbar icon.' },
    { start: 6.95, end: 9.3, title: 'Changed your mind? Undo.', sub: 'Every tab goes back exactly where it was.' },
    { start: 9.4, end: 11.5, title: <>Or press <Keys names={['Alt', 'Shift', 'S']} /></>, sub: 'Sorts with your default order.' },
];

const MENUS = [
    { open: 3.6, close: 4.6, hovers: [[4.15, 'url']], checked: t => (t < 4.45 ? 'title' : 'url') },
    { open: 6.9, close: 7.7, hovers: [[7.45, 'undo']], checked: () => 'url' },
];
const PRESSED = [[1.4, 1.6], [3.55, 4.6], [6.85, 7.7]];

// The pointer moves between these [time, position] points.
const POINTER = [
    [0, REST], [0.9, REST], [1.4, BUTTON], [3.6, BUTTON], [4.25, onMenu('url')], [4.45, onMenu('url')],
    [4.95, { x: 900, y: 560 }], [6.4, { x: 900, y: 560 }], [6.9, BUTTON], [7.45, onMenu('undo')], [7.65, onMenu('undo')],
    [8.2, { x: 880, y: 600 }],
];
const CLICKS = [[1.45, BUTTON], [3.6, BUTTON], [4.45, onMenu('url')], [6.9, BUTTON], [7.65, onMenu('undo')]];

const ease = Easing.bezier(0.65, 0, 0.35, 1);
const progress = (t, start, end) => interpolate(t, [start, end], [0, 1], { easing: ease, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
const visibility = (t, start, end, fade = 0.3) => Math.min(progress(t, start, start + fade), 1 - progress(t, end - fade, end));

function pointerAt(t) {
    for (let i = 1; i < POINTER.length; i++) {
        const [time, to] = POINTER[i];
        if (t > time) continue;
        const [previousTime, from] = POINTER[i - 1];
        const k = progress(t, previousTime, time);
        return { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
    }
    return POINTER[POINTER.length - 1][1];
}

export function Demo({ flat }) {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();
    const t = frame / fps;

    let tabs = { from: DEMO_MESSY, to: DEMO_MESSY, glide: 0 };
    for (const sort of SORTS) {
        if (t >= sort.at) tabs = { from: sort.from, to: sort.to, glide: progress(t, sort.at, sort.at + GLIDE_SECONDS) };
    }
    // Back to the messy window behind the end card, so the loop starts over seamlessly.
    if (t >= END_CARD.in + 0.5) tabs = { from: DEMO_MESSY, to: DEMO_MESSY, glide: 0 };

    const menu = MENUS.find(m => t >= m.open && t < m.close + 0.15);
    const menuOpacity = menu ? Math.min(progress(t, menu.open, menu.open + 0.15), 1 - progress(t, menu.close, menu.close + 0.15)) : 0;
    const hover = menu?.hovers.filter(([time]) => t >= time).at(-1)?.[1];
    const pointer = pointerAt(t);
    const click = CLICKS.find(([time]) => t >= time && t < time + 0.45);

    return (
        <AbsoluteFill className={`scene${flat ? ' flat' : ''}`}>
            {CAPTIONS.map(caption => (
                <div key={caption.start} className="caption" style={{ top: 34, opacity: visibility(t, caption.start, caption.end) }}>
                    <h2>{caption.title}</h2>
                    {caption.sub && <p>{caption.sub}</p>}
                </div>
            ))}
            <Place x={WINDOW.x} y={WINDOW.y} zoom={ZOOM}>
                <BrowserWindow
                    from={tabs.from}
                    to={tabs.to}
                    progress={tabs.glide}
                    active="issue2"
                    url="tracker.example/issues/2"
                    page="full"
                    width={WINDOW.width}
                    extensionPressed={PRESSED.some(([start, end]) => t >= start && t < end)}
                />
            </Place>
            {menu && (
                <Place x={MENU.x} y={MENU.y} zoom={ZOOM} style={{ opacity: menuOpacity, transform: `scale(${0.96 + 0.04 * menuOpacity})`, transformOrigin: 'top right' }}>
                    <ContextMenu checked={menu.checked(t)} hover={hover} />
                </Place>
            )}
            {click && <Ripple x={click[1].x} y={click[1].y} progress={(t - click[0]) / 0.45} />}
            <Cursor x={pointer.x} y={pointer.y} opacity={Math.min(progress(t, 0.5, 0.8), 1 - progress(t, 11.2, 11.5))} />
            <AbsoluteFill className={`scene${flat ? ' flat' : ''}`} style={{ alignItems: 'center', justifyContent: 'center', gap: 28, opacity: visibility(t, END_CARD.in, END_CARD.out + 0.4, 0.5) }}>
                <Brand size={132} wordSize={72} />
                <p className="sub" style={{ margin: 0, fontSize: 30, fontWeight: 650 }}>Fast. Exact. Your order.</p>
                <p className="sub" style={{ margin: 0, fontSize: 22 }}>Free &nbsp;·&nbsp; Open source &nbsp;·&nbsp; No tracking</p>
            </AbsoluteFill>
        </AbsoluteFill>
    );
}
