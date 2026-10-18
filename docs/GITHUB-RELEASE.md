# Running SOP v1.1.1

This update improves shared-storage reliability and cross-platform verification. Existing SOP formats, drafts and storage settings remain compatible.

## Fixes

- Fixed false multiple-library errors on case-insensitive disks when SOP and sop refer to the same folder.
- Preserved verified document bytes across Windows Git checkouts.
- Added size checks before reading shared documents and images, including immutable-file verification, to protect memory and keep invalid content out of the catalog.
- Added Windows Server 2022/2025 verification of the packaged extension from paths containing Unicode and spaces. Windows and Linux checks must pass before GitHub publication.

## Verification and limits

The preceding runtime review passed 115 core tests on macOS and all 10 browser scenarios on Chromium 151 and Chrome for Testing 116. Both Windows environments passed 114 core tests, with one Linux-only workflow test skipped, and all 10 browser scenarios. The release pipeline reruns checks for this version. See docs/COMPATIBILITY-REVIEW.md for evidence and coverage boundaries.

Chrome 116 remains the minimum. Windows server VMs do not establish acceptance on every Windows 10/11 desktop or older computer. Native permission dialogs and actual two-device NAS behavior still require manual acceptance. Invalid or interrupted shared files are not automatically overwritten.

## Downloads

- **running-sop-extension-v1.1.1.zip**: installation package. Extract it, open chrome://extensions, enable Developer mode, select Load unpacked, and choose the extension/ folder.
- **running-sop-github-v1.1.1.zip**: source and documentation.
- **running-sop-webstore-v1.1.1.zip**: store upload package for maintainers.
- **SHA256SUMS.txt**: package checksums.

For an existing unpacked installation, replace files in the same extension directory and reload it. Do not uninstall first if you need to retain local drafts.

Developed for Chrome Manifest V3 with locally bundled code, user-authorized storage and no developer cloud analytics. This is a developer implementation statement, not Google certification or confirmation of Chrome Web Store approval. This GitHub update does not submit or replace the store package currently under review.
