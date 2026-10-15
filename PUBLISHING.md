# Publishing a release

## One-time setup

1. Open the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole) with the Google account you want to publish under. Accept the developer agreement and pay the one-time US$5 registration fee.
2. Turn on [2-Step Verification](https://myaccount.google.com/signinoptions/twosv) for that account (required to publish).
3. In the dashboard's **Account** page, set your publisher name and contact email, and verify the email. If you're asked about trader status (an EU requirement), publishing a free extension as an individual usually means **non-trader**.

## Each release

1. **Check it:**

   ```sh
   npm test            # sorting logic, no install needed
   npm install && npx playwright install chromium    # first time only
   npm run test:e2e    # the real extension in headless Chromium
   ```

2. **Bump the version** in `src/manifest.json` (every upload needs a higher version than the last), and update the date in `PRIVACY.md` if the policy changed.
3. **Regenerate the artwork** if the UI changed: `npm run assets`.
4. **Build the package:** `npm run package` creates `dist/neat-tab-sorter-v<version>.zip`. To double-check the exact package, unzip it, load the folder with **Load unpacked** on `chrome://extensions`, and run `EXTENSION_DIR=<that folder> npm run test:e2e`.
5. **First release only:** upload `store/demo-video.webm` to YouTube (Unlisted is fine) for the listing's promo video.
6. In the dashboard:
   - **First release:** click **New item** and upload the zip. Then fill in the **Store listing**, **Privacy practices** and **Distribution** tabs from [store/listing.md](store/listing.md).
   - **Updates:** open the item, go to **Package**, and upload the new zip.
7. Click **Submit for review**. Reviews usually take from a few hours to a few days; you'll get an email. You can choose to publish manually after approval.
8. **After it's live:** replace "coming soon" in `README.md` with the store link, then tag the release and attach the zip:

   ```sh
   git tag v1.0.0 && git push origin v1.0.0
   gh release create v1.0.0 dist/neat-tab-sorter-v1.0.0.zip --title "Neat Tab Sorter 1.0.0" --notes "First release."
   ```
