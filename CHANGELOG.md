# Changelog

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
