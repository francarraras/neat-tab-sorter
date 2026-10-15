import React from 'react';
import { Composition, Still } from 'remotion';
import { DEMO_SECONDS, Demo } from './Demo.jsx';
import { Icon, PromoMarquee, PromoSmall, ScreenshotGroups, ScreenshotMenu, ScreenshotSort, SocialPreview } from './Stills.jsx';
import './styles.css';

export function Root() {
    return (
        <>
            {/* The demo video for the Chrome Web Store, and the same demo for the README (a GIF, so 20 fps and a flat background). */}
            <Composition id="Demo" component={Demo} width={1280} height={720} fps={30} durationInFrames={DEMO_SECONDS * 30} defaultProps={{ flat: false }} />
            <Composition id="ReadmePreview" component={Demo} width={1280} height={720} fps={20} durationInFrames={DEMO_SECONDS * 20} defaultProps={{ flat: true }} />
            {[16, 32, 48, 128].map(size => (
                <Still key={size} id={`Icon${size}`} component={Icon} width={size} height={size} defaultProps={{ size, padding: size === 128 ? 16 : 0 }} />
            ))}
            <Still id="ScreenshotSort" component={ScreenshotSort} width={1280} height={800} />
            <Still id="ScreenshotGroups" component={ScreenshotGroups} width={1280} height={800} />
            <Still id="ScreenshotMenu" component={ScreenshotMenu} width={1280} height={800} />
            <Still id="PromoSmall" component={PromoSmall} width={440} height={280} />
            <Still id="PromoMarquee" component={PromoMarquee} width={1400} height={560} />
            <Still id="SocialPreview" component={SocialPreview} width={1280} height={640} />
        </>
    );
}
