# Contributing

Thanks for helping! Neat Tab Sorter is small on purpose: it sorts tabs quickly and exactly, and everything stays on your computer.

## Bugs, ideas and questions

- **Bugs and feature requests:** [open an issue](https://github.com/francarraras/neat-tab-sorter/issues/new/choose). The forms ask for what's needed to reproduce a problem.
- **Questions and ideas you'd like to talk through:** use [Discussions](https://github.com/francarraras/neat-tab-sorter/discussions).
- **Security problems:** report them privately, as described in [SECURITY.md](SECURITY.md).

## How the project is organized

| Path | What's there |
| --- | --- |
| `src/` | The extension. No build step and no dependencies. |
| `src/sort.js` | Decides the order and plans the fewest moves. Pure code with no Chrome APIs, so it's tested in Node. |
| `src/engine.js` | Applies plans to real windows, checks the result, and keeps the undo order. |
| `src/background.js` | The toolbar icon, its right-click menu, and the shortcuts. |
| `test/*.test.js` | Unit tests. They replay sorts against `test/tab-strip.js`, a model of Chrome's own tab-moving rules. |
| `test/browser.e2e.js` | Browser tests that load the real extension in headless Chromium. |
| `media/` | A [Remotion](https://www.remotion.dev) project that draws the icon, the README preview, and the Chrome Web Store images and video, using the real sort engine. |
| `store/` | The Chrome Web Store listing text and images. |

## Setting up

```sh
git clone https://github.com/francarraras/neat-tab-sorter.git
cd neat-tab-sorter
npm test                          # unit tests: needs Node.js 22+, nothing else
npm install                       # Playwright, for the browser tests
npx playwright install chromium
npm run test:e2e
```

To try your changes, open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and choose `src/`. After editing, click the reload button on the extension's card.

## Making a change

1. For anything bigger than a small fix, open an issue first so we can agree on the approach.
2. Work on a branch and keep each pull request focused on one thing.
3. Follow these guidelines:
   - Keep the extension free of dependencies and build steps, with no network requests, analytics or remote code.
   - Avoid new permissions. Adding one makes Chrome disable the extension for existing users until they approve it.
   - Sorting logic belongs in `src/sort.js`, with tests in `test/sort.test.js`. Changes to how tabs move must keep the random-window tests passing.
   - Match the existing style: 4-space indentation, ES modules, small functions, and comments that explain why.
   - Write UI text in short, plain language, and update `src/userguide.html` when behavior changes.
4. Run `npm test` and `npm run test:e2e`.
5. If something visible changed, refresh the images: `npm run screenshots` for the settings page, and `npm run media` for the drawn ones (see below). Put before and after screenshots in the pull request.
6. Add a line to `CHANGELOG.md` under "Unreleased".
7. Open the pull request. CI runs every test and attaches a ready-to-load build of your branch.

## Images and video

The README preview, the icon, and the Chrome Web Store screenshots and video are made with Remotion in `media/`:

```sh
cd media
npm install
npm run studio    # preview and tweak them live
npm run render    # render everything into src/img, store and docs
```

Remotion is free for individuals and for companies of up to three people; larger companies need a [Remotion license](https://www.remotion.dev/license). It's only used to make these images, never in the extension.

## License

By contributing, you agree that your contributions are licensed under the [GNU General Public License v3](LICENSE).
