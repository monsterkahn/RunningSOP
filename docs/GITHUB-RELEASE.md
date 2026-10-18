# Running SOP v1.1.0

Running SOP brings visual, step-by-step instructions to your work webpages. Create and follow SOPs beside the task, then publish reviewed procedures to your own storage.

## What's new

- Lightweight folder guidance plays three cycles, stops when connected, pauses on hidden pages and respects reduced motion. No animation library or additional permissions.
- Fixed folder-library identifiers on Chrome 116; the minimum browser requirement remains Chrome 116.
- When 10 local drafts fill the limit, confirmed cleanup frees space without deleting published SOPs. Cancel preserves data; active recordings cannot be deleted.
- Reviewed permissions and updated privacy and installation documentation for the simplified interface. Existing SOP formats and local storage keys remain compatible.

## Chrome standards

Developed for Chrome Manifest V3, with executable scripts bundled locally, on-demand work-site permissions and user-authorized storage. SOP content is handled as data, not executable code. Recording does not read typed field values, screenshots are user-initiated, and no developer cloud analytics service is included.

This describes developer implementation and self-review. It is not Google certification or confirmation of Chrome Web Store approval.

## Verification

108 core tests passed. The packaged runtime passed 10 browser scenarios on Chromium 151.0.7922.34 and 10 on Chrome for Testing 116.0.5845.96. Coverage includes screenshot annotation persistence and isolation, recording, folder initialization, draft cleanup and dashboard languages. See the repository's release review for the complete scope and limitations.

Native operating-system authorization, actual older hardware and real two-computer shared-storage behavior remain manual acceptance checks.

## Downloads

- **running-sop-extension-v1.1.0.zip**: installation package. Extract it, open `chrome://extensions`, enable Developer mode, choose Load unpacked and select the `extension/` folder.
- **running-sop-github-v1.1.0.zip**: complete source and documentation.
- **running-sop-webstore-v1.1.0.zip**: Web Store upload package for maintainers, not a one-click installer.
- **SHA256SUMS.txt**: package checksums.

Upgrade by replacing files in the existing extension directory and reloading it. Do not uninstall first if you need local drafts.

New installations do not connect to shared storage or enable statistics synchronization. Users select and authorize their folder. The extension interface supports English, Simplified and Traditional Chinese, Spanish, Russian, Korean and Japanese; authored SOP content is not automatically translated.

The previous official release and its binary assets are preserved. This GitHub publication is separate from Chrome Web Store submission and review.
