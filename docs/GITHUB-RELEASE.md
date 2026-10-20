# Running SOP v1.3.5

Create step-by-step guides with screenshots, follow them beside your work, and share SOPs through a folder you choose.

## What's new since v1.3.4

- Open Category settings beside the Categories heading in the SOP overview.
- Choose category icons visually and choose colors from swatches instead of text-only dropdowns in category editors.
- Preserve separate category metadata, explicit write permission, revisioned backups, optimistic conflict checks, read-back verification and source guards. The existing category storage format is unchanged.
- Retain the v1.3.4 category management, verified offline reading and explicit folder recovery behavior.

## Verification and limits

The current source passed 202 core tests and both affected category browser scenarios on current Chromium and actual Chrome 116. The browser scenarios cover graphical selection, arrow-key operation, saved values, source changes, permission denial, conflicts and all seven interface languages across narrow and desktop layouts. Package integrity and extracted-runtime checks are recorded in the release review. GitHub distribution preserves v1.3.4 and earlier binary assets.

Native operating-system permission dialogs, physical two-device NAS/shared-folder acceptance, HTTPS deployment and team statistics remain explicitly user-deferred. Synthetic OPFS and injected permission-denial tests do not establish native or real-network acceptance. The optional team service remains experimental and uses HTTP unless an administrator separately configures and verifies HTTPS. A missing historical version cannot be reconstructed.

Chrome 116 remains the minimum browser; Manifest V3 and bundled executable code remain the implementation baseline. These developer statements do not constitute Google certification or Chrome Web Store approval. This candidate does not submit or replace a Chrome Web Store package.

## Downloads

- **running-sop-extension-v1.3.5.zip**: complete installation package. Extract it, open chrome://extensions, enable Developer mode, choose Load unpacked, and select the extension/ folder.
- **running-sop-github-v1.3.5.zip**: source and documentation.
- **running-sop-webstore-v1.3.5.zip**: maintainer upload package, with manifest.json at the root; it is not submitted automatically.
- **running-sop-team-service-v1.3.5-experimental.zip**: optional service source package, requiring Node.js 24 or later. It does not install Node.js or configure HTTPS.
- **running-sop-media-v1.3.5.zip**: English introduction images from actual extension pages with synthetic examples, including category icon/color settings..
- **SHA256SUMS.txt**: checksums for all five ZIPs.

For an existing unpacked installation, replace the files in the same extension directory and reload it. Do not uninstall first if you need to retain unpublished drafts. Existing published versions and binary assets are preserved.
