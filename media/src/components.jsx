import React from 'react';
import { GROUPS, TABS } from './data.js';

export const TABSTRIP_HEIGHT = 44;
export const TOOLBAR_HEIGHT = 46;
// From the window's right edge to the middle of the extension's toolbar button (see .toolbar).
export const EXTENSION_BUTTON_INSET = 102;
const TAB_WIDTH = 136;
const PINNED_TAB_WIDTH = 44;
const CHIP_FONT = '700 12px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

let canvas;
function chipWidth(group) {
    canvas ??= document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = CHIP_FONT;
    return Math.ceil(context.measureText(group.title).width) + 18;
}

/** Tab keys, left to right → tab strip items, with a group's name chip before its first tab. */
function stripItems(keys) {
    return keys.flatMap((key, index) => {
        const { groupId } = TABS[key];
        return groupId !== -1 && TABS[keys[index - 1]]?.groupId !== groupId ? [`group:${groupId}`, key] : [key];
    });
}

function layout(items) {
    const x = {};
    let end = 8;
    for (const item of items) {
        if (item.startsWith('group:')) {
            x[item] = end + 4;
            end += chipWidth(GROUPS[item.slice(6)]) + 8;
        } else {
            x[item] = end;
            end += TABS[item].pinned ? PINNED_TAB_WIDTH : TAB_WIDTH;
        }
    }
    x.newTab = end + 6;
    return x;
}

/** Places children at (x, y) in the scene, optionally zoomed. */
export function Place({ x, y, zoom = 1, style, children }) {
    return (
        <div style={{ position: 'absolute', left: x, top: y, ...style }}>
            <div style={{ zoom }}>{children}</div>
        </div>
    );
}

/** A browser window whose tabs glide from one order to another as `progress` goes from 0 to 1. */
export function BrowserWindow({ from, to = from, progress = 0, active, url, page = 'none', width, extensionPressed = false }) {
    const items = stripItems(from);
    const start = layout(items);
    const end = layout(stripItems(to));
    const lift = Math.sin(Math.PI * progress);
    const slash = url.indexOf('/');
    return (
        <div className="window" style={{ width }}>
            <div className="tabstrip">
                {items.map(item => {
                    const moving = start[item] !== end[item];
                    return (
                        <StripItem
                            key={item}
                            item={item}
                            active={item === active}
                            style={{
                                transform: `translate(${start[item] + (end[item] - start[item]) * progress}px, ${moving ? -3 * lift : 0}px)`,
                                // Tabs travelling furthest pass over the others.
                                zIndex: moving ? Math.round(Math.abs(end[item] - start[item]) * lift) : 0,
                                '--lift': moving ? lift : 0,
                            }}
                        />
                    );
                })}
                <div className="item newtab" style={{ transform: `translateX(${start.newTab + (end.newTab - start.newTab) * progress}px)` }}>+</div>
            </div>
            <div className="toolbar">
                <span className="btn"><BackIcon /></span>
                <span className="btn"><ForwardIcon /></span>
                <span className="btn"><ReloadIcon /></span>
                <div className="omnibox"><b>{url.slice(0, slash)}</b>{url.slice(slash)}</div>
                <span className="btn"><PuzzleIcon /></span>
                <span className={`btn${extensionPressed ? ' pressed' : ''}`}><Badge size={18} /></span>
                <span className="avatar" />
                <span className="btn"><MoreIcon /></span>
            </div>
            {page === 'short' && (
                <div className="viewport" style={{ height: 64, paddingTop: 20 }}>
                    <div className="line" style={{ width: '58%' }} />
                    <div className="line" style={{ width: '34%' }} />
                </div>
            )}
            {page === 'full' && (
                <div className="viewport">
                    <div className="line title" />
                    {[92, 84, 88, 61].map(width => <div key={width} className="line" style={{ width: `${width}%` }} />)}
                    <div className="cards"><div /><div /><div /></div>
                </div>
            )}
        </div>
    );
}

function StripItem({ item, active, style }) {
    if (item.startsWith('group:')) {
        const group = GROUPS[item.slice(6)];
        return <div className="item chip" style={{ ...style, width: chipWidth(group), '--group': group.color }}>{group.title}</div>;
    }
    const tab = TABS[item];
    const group = GROUPS[tab.groupId];
    const className = ['item', 'tab', tab.pinned && 'pinned', active && 'active'].filter(Boolean).join(' ');
    return (
        <div className={className} style={{ ...style, ...(group && { '--group': group.color }) }}>
            <span className="fav" style={{ background: tab.fav[0] }}>{tab.fav[1]}</span>
            {!tab.pinned && <span className="title">{tab.title}</span>}
        </div>
    );
}

// The toolbar icon's right-click menu, as Chrome shows it.
const MENU_ITEMS = [
    { id: 'head', label: 'Neat Tab Sorter', kind: 'head' },
    { kind: 'sep' },
    { id: 'undo', label: 'Undo last sort' },
    { kind: 'sep' },
    { id: 'title', label: 'Sort by title', radio: true },
    { id: 'url', label: 'Sort by URL', radio: true },
    { id: 'custom', label: 'Sort by site (custom)', radio: true },
    { id: 'lastAccessed', label: 'Sort by recently used', radio: true },
    { kind: 'sep' },
    { id: 'options', label: 'Options', kind: 'muted' },
    { id: 'unpin', label: 'Unpin', kind: 'muted' },
    { id: 'manage', label: 'Manage extension', kind: 'muted' },
];
export const MENU_WIDTH = 272;

/** Where to point at a menu item, relative to the menu's top-left corner. */
export function menuItemPoint(id) {
    let y = 8;
    for (const item of MENU_ITEMS) {
        const height = item.kind === 'sep' ? 13 : 32;
        if (item.id === id) return { x: 150, y: y + height / 2 };
        y += height;
    }
    throw new Error(`No menu item ${id}`);
}

export function ContextMenu({ checked, hover }) {
    return (
        <div className="menu">
            {MENU_ITEMS.map((item, index) => {
                if (item.kind === 'sep') return <div key={index} className="sep" />;
                const className = ['mi', item.kind, hover === item.id && 'hover'].filter(Boolean).join(' ');
                return (
                    <div key={index} className={className}>
                        {item.kind === 'head' && <Badge size={16} />}
                        {item.radio && <span className={`radio${checked === item.id ? ' on' : ''}`} />}
                        {item.label}
                    </div>
                );
            })}
        </div>
    );
}

/** The extension icon: a teal badge with white bars, or inverted for teal backgrounds. */
export function Badge({ size, inverse = false, shadow = false }) {
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" style={{ flex: 'none', filter: shadow ? `drop-shadow(0 ${size / 12}px ${size / 6}px rgb(0 0 0 / 28%))` : undefined }}>
            <defs>
                <linearGradient id="badge" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#14b8a6" />
                    <stop offset="1" stopColor="#0f766e" />
                </linearGradient>
            </defs>
            <rect width="16" height="16" rx="3.5" fill={inverse ? '#fff' : 'url(#badge)'} />
            {/* At toolbar size the rounded bar ends would only blur the edges. */}
            {[[4, 4], [7, 7], [10, 10]].map(([y, length]) => (
                <rect key={y} x="3" y={y} width={length} height="2" rx="1" fill={inverse ? '#0f766e' : '#fff'} shapeRendering={size <= 16 ? 'crispEdges' : undefined} />
            ))}
        </svg>
    );
}

export function Brand({ size, wordSize, vertical = false }) {
    return (
        <div className="brand" style={vertical ? { flexDirection: 'column', gap: size * 0.2 } : undefined}>
            <Badge size={size} inverse shadow />
            <div className="wordmark" style={{ fontSize: wordSize, textShadow: '0 2px 12px rgb(0 0 0 / 20%)' }}>Neat Tab Sorter</div>
        </div>
    );
}

export function Keys({ names }) {
    return (
        <span className="keys">
            {names.map((name, index) => (
                <React.Fragment key={name}>
                    {index > 0 && <span className="plus">+</span>}
                    <span className="key">{name}</span>
                </React.Fragment>
            ))}
        </span>
    );
}

export function Cursor({ x, y, opacity = 1 }) {
    return (
        <svg className="cursor" viewBox="0 0 24 24" style={{ left: x, top: y, opacity }}>
            <path d="M5 2.5v17.2l4.6-4.3 3 6.6 3-1.4-3-6.4h6.3z" fill="#111" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
    );
}

export function Ripple({ x, y, progress }) {
    if (progress <= 0 || progress >= 1) return null;
    return <div className="ripple" style={{ left: x, top: y, opacity: 1 - progress, transform: `scale(${0.4 + progress * 0.8})` }} />;
}

const icon = path => () => <svg viewBox="0 0 24 24"><path d={path} fill="currentColor" /></svg>;
const BackIcon = icon('M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z');
const ForwardIcon = icon('M4 11h12.2l-5.6-5.6L12 4l8 8-8 8-1.4-1.4 5.6-5.6H4z');
const ReloadIcon = icon('M17.7 6.3A8 8 0 1 0 19.7 14h-2.1a6 6 0 1 1-1.4-6.2L13 11h7V4z');
const PuzzleIcon = icon('M20.5 11H19V7a2 2 0 0 0-2-2h-4V3.5a2.5 2.5 0 0 0-5 0V5H4a2 2 0 0 0-2 2v3.8h1.5a2.7 2.7 0 0 1 0 5.4H2V20a2 2 0 0 0 2 2h3.8v-1.5a2.7 2.7 0 0 1 5.4 0V22H17a2 2 0 0 0 2-2v-4h1.5a2.5 2.5 0 0 0 0-5z');
const MoreIcon = () => (
    <svg viewBox="0 0 24 24">{[5, 12, 19].map(cy => <circle key={cy} cx="12" cy={cy} r="2" fill="currentColor" />)}</svg>
);
