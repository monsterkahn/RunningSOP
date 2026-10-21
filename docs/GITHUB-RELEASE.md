# Running SOP v2.0.0

Create step-by-step guides with screenshots, follow them beside your work, and share SOPs through a folder you choose.

## What's new

- Browse statistics, categories, searchable SOP rows and step counts in one overview, with a matching standalone index.
- Save workflow relationships in a separate graph and follow explicit next-SOP links. Opening the graph from the connected overview reuses the authorized folder; Save requests write access and retains revision checks, backups and read-back verification.
- Mask screenshot areas with opaque mosaic tiles. Saving replaces the edited image bytes; older publications, history and backups remain unchanged.
- Read neutral step cards with 16:6 image previews, then open the original proportions and annotation scale. Verified publication returns to the published SOP and removes only its unchanged draft; cleared steps are omitted.
- Choose Light, Dark or System appearance on the overview and relationship pages. Use seven flag-free interface languages, including Traditional Chinese.
- Open the overview or install missing shared pages from equal-width actions below the Settings connection card. Installation requires explicit folder selection and write authorization and preserves existing pages, including older or customized copies.

## Verification and limits

The [2.0.0 release review](https://github.com/monsterkahn/RunningSOP/blob/main/docs/RELEASE-REVIEW-2.0.0.md) records 241 passing core tests, 59 passing browser scenarios each on current Chromium and actual Chrome 116, and 20 passing Chrome 116 scenarios from the extracted flat Web Store ZIP. Build/public scanning, archive integrity, source-byte comparisons, bundled-page hashes and listing-media checks also passed.

Native operating-system permission dialogs, physical two-device NAS/shared-folder acceptance, HTTPS deployment and team statistics remain user-deferred. Synthetic storage and injected permission outcomes do not establish native or real-network acceptance. The optional team service remains experimental and uses HTTP unless an administrator separately configures HTTPS. Missing historical content cannot be reconstructed.

Chrome 116, Manifest V3, bundled executable code and existing permissions remain the baseline. Fresh installations do not connect, synchronize or publish by default. This GitHub release does not establish Chrome Web Store submission, approval or Google certification.

## Downloads and updates

- **running-sop-extension-v2.0.0.zip**: installation package. Extract it, open `chrome://extensions`, enable Developer mode, choose Load unpacked and select `extension/`.
- **running-sop-github-v2.0.0.zip**: source and documentation.
- **running-sop-webstore-v2.0.0.zip**: maintainer upload package, with `manifest.json` at its root; it is not submitted automatically.
- **running-sop-team-service-v2.0.0-experimental.zip**: optional service source, requiring Node.js 24 or later; it does not configure HTTPS.
- **running-sop-media-v2.0.0.zip**: five actual-extension listing screenshots with synthetic data and two brand promotions.
- **SHA256SUMS.txt**: checksums for the five ZIPs.

For an existing unpacked installation, replace files in the same extension directory and reload, preserving the extension identity. Same-identity updates retain drafts and configuration without a data migration or settings reset; folder authorization may need renewal. Do not uninstall first if you need local drafts. Existing shared HTML pages are not automatically upgraded or overwritten. Earlier published releases and binary assets are preserved.
