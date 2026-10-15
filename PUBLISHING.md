# Publishing a release

## One-time setup

1. Open the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole) with the Google account you want to publish under. Accept the developer agreement and pay the one-time US$5 registration fee.
2. Turn on [2-Step Verification](https://myaccount.google.com/signinoptions/twosv) for that account (required to publish).
3. In the dashboard's **Account** page, set your publisher name and contact email, and verify the email. If you're asked about trader status (an EU requirement), publishing a free extension as an individual usually means **non-trader**.

## Each release

Versioning, the changelog and tagging are covered in [MAINTAINING.md](MAINTAINING.md#releasing): pushing a tag like `v1.1.0` makes the release workflow test everything and publish a GitHub release with `neat-tab-sorter-v1.1.0.zip` attached. Then:

1. **If anything visible changed,** refresh the store images first: `npm run screenshots` (the settings page) and `npm run media` (the icon, the drawn screenshots and promo tiles, the demo video and the README preview).
2. **First release only:** upload `store/demo-video.mp4` to YouTube (Unlisted is fine) for the listing's promo video.
3. In the [dashboard](https://chrome.google.com/webstore/devconsole):
   - **First release:** click **New item** and upload the zip. Then fill in the **Store listing**, **Privacy practices** and **Distribution** tabs from [store/listing.md](store/listing.md).
   - **Updates:** open the item, go to **Package**, and upload the new zip. Every upload needs a higher version than the last.
4. Click **Submit for review**. Reviews usually take from a few hours to a few days, and you'll get an email. You can choose to publish manually once it's approved.
5. **After the first approval:** replace "coming soon" in `README.md` with the store link.

To check the exact package before uploading, build it with `npm run package`, unzip `dist/neat-tab-sorter-v<version>.zip`, load the folder with **Load unpacked**, and run `EXTENSION_DIR=<that folder> npm run test:e2e`.
