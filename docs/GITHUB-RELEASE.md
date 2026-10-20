# Running SOP v1.3.4

Create step-by-step guides with screenshots, follow them beside your work, and share SOPs through a folder you choose.

## What's new since v1.3.3

- Manage folder categories from Settings or the SOP overview. Create, rename or nest categories, choose their icons and colors with a live preview, and delete empty categories.
- Use Assign category beside an SOP to set or clear its category. Category metadata is shared through the selected folder; SOP bodies and publication versions are not rewritten. Other overview pages read the updated categories on refresh.
- Save only after an explicit write-permission action, with revisioned category backups, optimistic conflict checks, read-back verification and source checks through asynchronous writes. Changing folders closes the editor and blocks stale operations. Folder filesystem permissions govern access; this release adds no administrator role or cross-device transaction lock.
- During a folder outage, the overview can show a previously verified catalog and cached current SOPs, with a visible potentially-outdated-copy notice. Uncached content and historical reads require a connection. Editing is disabled while offline.
- Inspect read-error details and explicitly choose the folder again from the overview. A valid explicit folder choice can also replace malformed older connection settings without enabling automatic polling.
- Retain seven interface languages and native selection controls for Chrome 116. No new extension permissions, remote executable code or developer cloud analytics are added.

## Verification and limits

Executed local core, service, browser and extracted-package checks are recorded in the [v1.3.4 release review](https://github.com/monsterkahn/RunningSOP/blob/main/docs/RELEASE-REVIEW-1.3.4.md). GitHub publication is gated on Linux verification, Windows 2022/2025 package checks, service checks on Windows/macOS/Linux with Node.js 24/26, team/history/category/interaction browser checks on all three operating systems, and container startup. The release job downloads and verifies uploaded artifacts before publication.

Native operating-system permission dialogs, physical two-device NAS/shared-folder acceptance, HTTPS deployment and team statistics remain explicitly user-deferred. Synthetic OPFS and injected permission-denial tests do not establish native or real-network acceptance. The optional team service remains experimental and uses HTTP unless an administrator separately configures and verifies HTTPS. A missing historical version cannot be reconstructed.

Chrome 116 remains the minimum browser; Manifest V3 and bundled executable code remain the implementation baseline. These developer statements do not constitute Google certification or Chrome Web Store approval. This GitHub release does not submit or replace a Chrome Web Store package.

## Downloads

- **running-sop-extension-v1.3.4.zip**: complete installation package. Extract it, open chrome://extensions, enable Developer mode, choose Load unpacked, and select the extension/ folder.
- **running-sop-github-v1.3.4.zip**: source and documentation.
- **running-sop-webstore-v1.3.4.zip**: maintainer upload package, with manifest.json at the root; it is not submitted automatically.
- **running-sop-team-service-v1.3.4-experimental.zip**: optional service source package, requiring Node.js 24 or later. It does not install Node.js or configure HTTPS.
- **running-sop-media-v1.3.4.zip**: English introduction images from actual extension pages with synthetic examples, including category icon/color settings.
- **SHA256SUMS.txt**: checksums for all five ZIPs.

For an existing unpacked installation, replace the files in the same extension directory and reload it. Do not uninstall first if you need to retain unpublished drafts. Existing published versions and binary assets are preserved.
