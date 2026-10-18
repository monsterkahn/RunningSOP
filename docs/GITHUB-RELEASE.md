# Running SOP v1.2.0

Create step-by-step guides with screenshots, follow them beside your work, and share SOPs through a folder you choose.

This release adds an opt-in experimental team service and library alongside the existing folder-based mode, which remains the default. The service coordinates exclusive per-SOP editing, keeps revision history, and provides backup and recovery tools. It requires Node.js 24 or later. It is a separately operated service and is not enabled by a fresh extension installation. Team ratings stay local; team statistics are not included.

## What's new

- Choose from saved team-service addresses, with names, editing and deletion. Selection does not connect automatically or change the active session.

- Experimental team library with revision history and exclusive editing leases. Account/session fencing prevents a stale client from publishing under a changed account or overwriting a newer edit.
- Verified backup and recovery commands for the team-service database, including history and fencing state present in a snapshot.
- Opt-in team-service source package and an introduction-images archive are provided with this release.
- Preserved folder-based storage as the default and the existing local workflow behavior.

## Verification and known limits

Local candidate validation passed 153 core tests and 14 browser scenarios each on Chrome 116 and the current tested Chromium. The unchanged service runtime has 44 passing tests on Node.js 24/26. The preceding validated runtime passed the recorded Windows package checks. Publication is gated on core/build/browser checks, both Windows package checks, and the team-service OS/Node/browser/container checks for the release commit. See the [v1.2.0 review](https://github.com/monsterkahn/RunningSOP/blob/main/docs/RELEASE-REVIEW-1.2.0.md) and [team-service operations](https://github.com/monsterkahn/RunningSOP/blob/main/server/README.md) for evidence and scope.

Chrome 116 remains the minimum supported browser. The team service uses unencrypted HTTP by default; administrators must configure and verify an HTTPS reverse proxy for network use. This project has not verified an HTTPS deployment, native operating-system permission prompts, or real two-device acceptance. These checks were consciously deferred for this release. Automated test results do not establish acceptance on every computer, storage system, or production network.

## Downloads

- **running-sop-extension-v1.2.0.zip**: installation package. Extract it, open chrome://extensions, enable Developer mode, select Load unpacked, and choose the extension/ folder.
- **running-sop-github-v1.2.0.zip**: source and documentation.
- **running-sop-webstore-v1.2.0.zip**: store upload package for maintainers; this release does not submit it to the Chrome Web Store.
- **running-sop-team-service-v1.2.0-experimental.zip**: optional experimental service source package. It does not include Node.js, install a service, configure HTTPS, or establish production readiness.
- **running-sop-media-v1.2.0.zip**: step-by-step introduction images.
- **SHA256SUMS.txt**: checksums for all five release ZIPs.

For an existing unpacked installation, replace files in the same extension directory and reload it. Do not uninstall first if you need to retain local drafts.

Developed for Chrome Manifest V3 with locally bundled extension code, user-authorized storage and no developer cloud analytics. This is a developer implementation statement, not Google certification or confirmation of Chrome Web Store approval. The experimental service is a separate Node.js program. This GitHub release does not submit or replace any Chrome Web Store package.

Review details: [v1.2.0 release review](https://github.com/monsterkahn/RunningSOP/blob/main/docs/RELEASE-REVIEW-1.2.0.md) · [team-service operations](https://github.com/monsterkahn/RunningSOP/blob/main/server/README.md).
