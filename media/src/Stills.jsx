// The extension icon, and the Chrome Web Store screenshots (1280x800) and promo tiles.
import React from 'react';
import { AbsoluteFill } from 'remotion';
import {
    Badge, BrowserWindow, Brand, ContextMenu, Cursor, EXTENSION_BUTTON_INSET, Keys, MENU_WIDTH, Place,
    TABSTRIP_HEIGHT, TOOLBAR_HEIGHT, menuItemPoint,
} from './components.jsx';
import { GROUPS_MESSY, GROUPS_SORTED, HERO_MESSY, HERO_SORTED } from './data.js';

// Drawn on a 16-unit grid, so each size lands on whole pixels. The 128px icon keeps 16px of
// transparent padding, as the Chrome Web Store asks.
export const Icon = ({ size, padding }) => (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Badge size={size - 2 * padding} />
    </AbsoluteFill>
);

function Headline({ title, sub }) {
    return (
        <Place x={48} y={56}>
            <h1 className="headline">{title}</h1>
            <p className="sub">{sub}</p>
        </Place>
    );
}

function BeforeAfter({ before, after, active, url, afterLabel }) {
    const window = tabs => <BrowserWindow from={tabs} active={active} url={url} page="short" width={1184} />;
    return (
        <>
            <Place x={48} y={206}><div className="label">Before</div></Place>
            <Place x={48} y={242}>{window(before)}</Place>
            <Place x={48} y={434}><div className="label">{afterLabel}</div></Place>
            <Place x={48} y={470}>{window(after)}</Place>
        </>
    );
}

const Footnote = ({ children }) => (
    <Place x={48} y={676} style={{ width: 1184 }}><p className="sub" style={{ fontSize: 19, margin: 0 }}>{children}</p></Place>
);

export const ScreenshotSort = () => (
    <AbsoluteFill className="scene">
        <Headline title="Sort every tab in one click" sub={<>Tab groups stay intact &nbsp;·&nbsp; Undo anytime &nbsp;·&nbsp; Numbers sort naturally</>} />
        <BeforeAfter before={HERO_MESSY} after={HERO_SORTED} active="issue2" url="tracker.example/issues/2" afterLabel={<>After &nbsp;·&nbsp; sorted by title</>} />
        <Footnote>Pinned tabs stay put. Groups come first, in name order. Everything else is sorted, and "(3)" unread counters are ignored.</Footnote>
    </AbsoluteFill>
);

export const ScreenshotGroups = () => (
    <AbsoluteFill className="scene">
        <Headline title="Tab groups stay intact" sub="Number your groups to choose their order: 2 comes before 10." />
        <BeforeAfter before={GROUPS_MESSY} after={GROUPS_SORTED} active="news" url="news.example/today" afterLabel="After" />
        <Footnote>Prefer your own group order, or want grouped tabs left alone? There's a setting for each. Split views are never pulled apart.</Footnote>
    </AbsoluteFill>
);

export const ScreenshotMenu = () => {
    const window = { x: 48, y: 250, width: 1184 };
    const button = { x: window.x + window.width - EXTENSION_BUTTON_INSET, y: window.y + TABSTRIP_HEIGHT + TOOLBAR_HEIGHT / 2 };
    const menu = { x: button.x - MENU_WIDTH, y: button.y + 2 };
    const undo = menuItemPoint('undo');
    return (
        <AbsoluteFill className="scene">
            <Headline title="Undo, sort orders and a shortcut" sub={<>Right-click the icon to undo or pick a sort order, or sort with <Keys names={['Alt', 'Shift', 'S']} /></>} />
            <Place x={window.x} y={window.y}>
                <BrowserWindow from={HERO_SORTED} active="issue2" url="tracker.example/issues/2" page="full" width={window.width} extensionPressed />
            </Place>
            <Place x={menu.x} y={menu.y}><ContextMenu checked="title" hover="undo" /></Place>
            <Cursor x={menu.x + undo.x} y={menu.y + undo.y} />
        </AbsoluteFill>
    );
};

export const PromoSmall = () => (
    <AbsoluteFill className="scene" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Brand size={84} wordSize={30} vertical />
    </AbsoluteFill>
);

// GitHub's social preview (Settings > Social preview), shown when the repository link is shared.
export const SocialPreview = () => (
    <AbsoluteFill className="scene">
        <Place x={80} y={92}>
            <Brand size={104} wordSize={60} />
            <p className="sub" style={{ fontSize: 28, marginTop: 24 }}>Your tabs, in your order, in one click. Fast, exact, and undoable.</p>
        </Place>
        <Place x={80} y={340}>
            <BrowserWindow from={HERO_SORTED} active="issue2" url="tracker.example/issues/2" page="short" width={1184} />
        </Place>
    </AbsoluteFill>
);

export const PromoMarquee = () => (
    <AbsoluteFill className="scene">
        <Place x={96} y={170}>
            <Brand size={120} wordSize={64} />
            <p className="sub" style={{ fontSize: 26, marginTop: 26 }}>One click. Tidy tabs. Groups stay intact.</p>
        </Place>
        <Place x={720} y={120} zoom={1.18}>
            <BrowserWindow from={HERO_SORTED} active="issue2" url="tracker.example/issues/2" page="full" width={760} />
        </Place>
    </AbsoluteFill>
);
