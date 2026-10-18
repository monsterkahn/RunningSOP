# Changelog

## 1.2.0 · 2026-10-19 — GitHub release

- Added a saved team-service address picker with add, rename, edit, selection and deletion; connection remains explicit.
- Added an optional experimental team service and library, with exclusive per-SOP editing leases, revision history, recovery and account/session fencing. Existing folder-based storage remains the default.
- Added an opt-in service source package and operational backup/restore guidance. The service requires Node.js 24 or later; extension users still need Chrome 116 or later.
- Team ratings stay on the device; team statistics are not included. The service uses unencrypted HTTP unless an administrator separately configures an HTTPS reverse proxy. HTTPS deployment, native permission prompts and real two-device acceptance remain unverified and were consciously deferred for this release.
- Automated validation passed 148 core tests and 44 service tests on Node.js 24/26, plus 13 browser scenarios each on Chrome 116 and the current tested Chrome. Release CI also passed the regular package checks; see [the v1.2.0 review](docs/RELEASE-REVIEW-1.2.0.md) for evidence and limits.

## 1.1.1 · 2026-10-18

- Fixed false multiple-library errors when SOP and sop refer to the same native directory.
- Preserved hashed text bytes across Windows Git checkouts.
- Bounded shared publication reads and immutable-file verification before allocating content.
- Added Windows Server 2022/2025 package verification; Windows and Linux checks now gate GitHub publication.
- Chrome 116 remains the minimum. Native permission prompts, old hardware and real two-device NAS acceptance remain outstanding. This is not a new Chrome Web Store submission.

## 1.1.0 · 2026-10-18 — Published on GitHub

- Added a finite breathing ring to the SOP folder-selection icon; it stops when connected.
- Respects reduced motion and pauses on hidden pages; animation changes only transform and opacity.
- Fixed internal directory-identifier parsing differences in Chrome 116, preserving the minimum browser version.
- Added a confirmed cleanup action when local drafts reach 10 so recording can continue; published SOPs are not deleted.
- Reviewed permissions against the official Skills and updated privacy documentation and store metadata.
- Published v1.1.0 to GitHub with successful CI. The reviewed GitHub documentation baseline was `5c02d06b3b8788ef35ff7e6fd31339c96e701b28`. No v1.1.0 Chrome Web Store submission has occurred; according to the user, v1.0.0 is awaiting store review. Native-permission and real two-device acceptance checks remain outstanding.

## 1.0.0 · 2026-10-16

First public distribution version, using the existing complete feature set as the 1.0.0 baseline. Internal development records are archived separately and are not public release numbers. SOP data formats and storage keys were unchanged.

- Transparent, dimensional icons for multiple favicon and toolbar sizes.
- Local recording, screenshot editing and annotations, shared-storage publishing, and category management.
- Six-language interface and standalone storage dashboard, with QR and read-only reader functionality recorded at this stage.
- No connection, publishing, or automatic synchronization by default; users must configure and enable them.

Internal development records are available in [Development history](docs/DEVELOPMENT-HISTORY.md).
