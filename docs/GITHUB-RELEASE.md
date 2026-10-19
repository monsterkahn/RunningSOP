# Running SOP v1.3.3

Create step-by-step guides with screenshots, follow them beside your work, and share SOPs through a folder you choose.

## What's new since v1.2.0

- View an SOP overview in Settings and read retained versions from your authorized folder or optional team library, including their exact screenshots and annotations. Historical versions are read-only; returning to the latest version does not restore or rewrite content.
- Publish and continue reading immediately. After a verified folder or team acknowledgement, Running SOP removes only the corresponding unchanged local draft and opens those published steps. Failed or uncertain publication preserves drafts; newer edits from another panel are never deleted.
- Cleared or untouched empty steps are omitted when publishing, with consecutive numbering for the remaining steps. An entirely empty SOP cannot be published. Partially filled steps still require valid instructions.
- Edit screenshots with grouped icon controls for zoom, annotation tools and undo/clear, separated by vertical lines. Drag or nudge numbered markers and rounded boxes. Save notes commits the marks; Exit discards unsaved changes. The restricted-page fallback retains the same save/exit behavior.
- Send passage feedback for a specific SOP version and step. This feedback stays on the device; it is not synchronized to the developer or team service.
- Open PayPal account details on demand, with two visible coffee placeholders reserved for future support methods.
- Improve bounded shared-file reads, slow-network recovery, lazy screenshot loading, case-insensitive folder discovery and Windows text-byte preservation. The optional team service remains experimental and opt-in; folder storage remains the default.

## Verification and limits

The scheduled release check passed 199 core tests and 52 service tests. The current full browser and exact extracted-package results are recorded in the [v1.3.3 release review](https://github.com/monsterkahn/RunningSOP/blob/main/docs/RELEASE-REVIEW-1.3.3.md). GitHub publication is gated on Linux verification, Windows 2022/2025 package checks, service checks on Windows/macOS/Linux with Node.js 24/26, team/history/interaction browser checks on all three operating systems, and container startup.

Chrome 116 remains the minimum supported browser. The extension uses Manifest V3 and bundles its executable code locally; no new permissions or developer cloud analytics were added. This is a developer implementation statement, not Google certification or Chrome Web Store approval.

Native operating-system authorization, real two-device NAS/shared-folder acceptance, HTTPS deployment and team statistics remain explicitly deferred. The team service uses HTTP unless an administrator configures and verifies HTTPS. Automated verification does not establish production readiness or compatibility with every computer or storage system. Missing historical data cannot be reconstructed; file-based sharing does not provide a distributed transaction lock.

## Downloads

- **running-sop-extension-v1.3.3.zip**: complete installation package. Extract it, open chrome://extensions, enable Developer mode, choose Load unpacked, and select the extension/ folder.
- **running-sop-github-v1.3.3.zip**: source and documentation.
- **running-sop-webstore-v1.3.3.zip**: Chrome Web Store upload package for maintainers, with manifest.json at the archive root. This release does not submit it to the store.
- **running-sop-team-service-v1.3.3-experimental.zip**: optional service source package. Requires Node.js 24 or later; it does not install Node.js, configure HTTPS, or establish deployment acceptance.
- **running-sop-media-v1.3.3.zip**: English introduction images captured from actual extension pages using synthetic examples.
- **SHA256SUMS.txt**: checksums for all five ZIPs.

For an existing unpacked installation, replace files in the same extension directory and reload it. Do not uninstall first if you need to retain unpublished drafts. Previous published versions and their binary assets are preserved.
