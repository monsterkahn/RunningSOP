# Changelog

## 2.0.0 - 2026-10-22 - Web Store package candidate

- Combine statistics, category management, searchable SOP listings and step counts in a unified overview, with retained-version reading and a standalone index.
- Add a separate SOP relationship editor and explicit next-SOP navigation for verified folder libraries. Reuse the connected folder for reading; request write access only on Save and retain conflict, source-change, backup and read-back checks.
- Install only missing standalone index and relationship pages after explicit folder selection and write authorization; preserve existing pages.
- Add browser-local Light, Dark and System appearance choices to the overview and relationship pages.
- Add deliberate screenshot mosaic masking; saved masking replaces image bytes but does not purge older copies.
- Use neutral reading cards and 16:6 previews while preserving original screenshot and annotation proportions in full viewing.
- Include empty-step filtering, unchanged-draft cleanup after verified publication, exact published-SOP reading, seven flag-free interface languages and stable local device display names.
- Preserve Manifest V3, Chrome 116 minimum, permission declarations, local settings and existing SOP data. No breaking data migration or settings reset.
- Web Store package preparation does not establish submission or approval. Native permission prompts, physical two-device storage, HTTPS deployment and team statistics remain deferred.

## 1.4.1 - 2026-10-21 - Local installation candidate

- After explicit SOP folder selection and write authorization, install missing index and relationship pages from a hashed package-local bundle.
- Preserve all existing pages, including custom or older files. This is missing-page installation, not an automatic shared-page upgrade.
- Add Settings controls to open the dashboard and retry installing missing pages. The internal dashboard can read the selected authorized folder without enabling polling.
- Keep an existing library readable when optional deployment write access is denied.
- Recreate plugin-only listing images in the earlier pale-blue brand style. No dashboard, index or relationship editor screenshots are included.
- Apply the approved neutral 15px reading cards, 12px gaps and unindented content; remove connectors and the repeated reading address. Keep editing URLs and internal matching/feedback context.
- Crop reading previews through a 16:6 viewport while retaining the original image and annotation proportions for full viewing. Put next step inside an equal-width card.
- Local packaging only; no GitHub or Web Store publication. Native permission and physical two-device deployment acceptance remain deferred.

## 1.4.0 - 2026-10-21 - Local installation candidate

- Include the standalone index dashboard and separate relationship editor in the installation ZIP, preserving existing dashboard functions.
- Edit SOP title/count nodes and connections directly, with 100% default zoom, connection deletion and undo.
- Save validated relationships separately in relations.json with explicit folder authorization, revision checks, history backups and read-back verification.
- Show a next step card for verified folder relationships and open the next SOP's configured work page on request.
- Group reading instructions and screenshots, connect STEP labels, and show one feedback control per step. Report and issue cards appear only with content.
- Include screenshot mosaic masking, short device display names, overview category management and revised language choices.
- Local packaging only; native prompts, physical two-device storage and HTTPS acceptance remain deferred. No GitHub or Web Store publication is claimed.

## 1.3.7 · 2026-10-20 — Local distribution

- Replace flag-based language choices with SC, TC, EN, ES, RU, KO and JA above the full language names. Use 16px abbreviations without individual borders.
- Place Follow browser language below all manual choices, retaining the Chrome icon. Keep equal-width responsive choices and visible selected states.
- Retain existing settings when updating the same extension identity; browser-managed folder permissions may require reauthorization.
- Local packaging only; no GitHub release or Chrome Web Store submission.

## 1.3.6 · 2026-10-20 — Local distribution

- Produce a new maintenance package from the verified v1.3.5 functionality with v1.3.6 metadata and multilingual release notes.
- Preserve settings and the SOP storage address when updating the same extension identity. Uninstalling or installing with a different ID does not transfer its local data; native folder access can require reauthorization.
- No GitHub release or Chrome Web Store submission is part of this local packaging request.

## 1.3.5 · 2026-10-20 — GitHub distribution

- Place Category settings beside the Categories heading in the SOP overview.
- Replace text-only icon and color dropdowns with graphical icon choices and color swatches in category editors.
- Preserve category storage, write permissions, conflict checks and existing published v1.3.4 assets.
- Core 202 and affected category browser scenarios passed on current Chromium and actual Chrome 116, including extracted-package checks. Native permission, physical two-device and HTTPS acceptance remain deferred; no Chrome Web Store submission.

## 1.3.4 · 2026-10-20 — GitHub distribution

- Manage folder categories from Settings or the SOP overview: create, rename, nest and delete empty categories, choose icons and colors, and assign or clear SOP categories.
- Keep category metadata separate from SOP bodies, with explicit write permission, revisioned backups, conflict detection, verified writes and source guards. No administrator role or distributed lock is added.
- Read verified cached current SOPs during folder outages, with a stale-copy notice. Reconnect explicitly from the overview and inspect read-error details.
- Recover malformed older connection settings after explicit folder selection; choosing a folder does not enable background polling.
- Retain Chrome 116, Manifest V3, existing permissions and privacy boundaries. Native permissions, physical two-device/HTTPS acceptance and team statistics remain deferred.

## 1.3.3 · 2026-10-20 — GitHub distribution

- Omit cleared or untouched empty steps when publishing, and number the remaining steps consecutively. Refuse publication if every step is empty; partially completed steps still require valid instructions.
- After verified folder or team publication, remove only the unchanged corresponding local draft and display the exact published SOP steps. Preserve drafts on failed or uncertain writes and preserve newer concurrent edits.
- Include the previous publication-reading and candidate-selection fixes.
- Bundle the latest grouped screenshot toolbar: zoom, annotation and undo/clear icons, vertical separators, Save notes and Exit.
- Include the SOP overview, exact retained-version reading, local step feedback and support-panel changes developed after v1.2.0.
- Generate versioned introduction media using the package version, avoiding old-version archive names.
- Preserve the explicitly deferred native-permission, physical two-device and HTTPS acceptance checks; this distribution is not a Chrome Web Store submission.


## 1.3.2 · 2026-10-19 — Local installation candidate

- Retained three48px support-method slots and added two inactive light-gray coffee-cup placeholders beside PayPal.
- Added queued folder-target fencing and distinct post-commit local-state warnings, preserving explicit uncertain-publication recovery.
- Successful publication returns to reading the corresponding SOP; failures preserve the editor and its content for explicit retry.
- Screenshot annotation tools use icons with accessible names. Numbered markers and boxes can be dragged and nudged with the keyboard. Boxes use subtle rounded corners.
- Reading provides step-level feedback tied to the exact SOP version. These records stay on the device and are not part of folder statistics or team synchronization.
- Retains the three equal-width PayPal/support slots, 48px collapsed height, and the v1.3.1 account disclosure and collaboration controls.
- Chrome 116 and Manifest V3 remain the baseline. No new permissions or team API changes are introduced. This is a local package preparation, not a GitHub publication or store submission; current verification is recorded separately.

## 1.3.1 · 2026-10-19 — Local installation package

- PayPal displays its logo initially; clicking or keyboard activation reveals the existing account locally.
- Removed the duplicate team collaboration heading while preserving the accessible group name. Connect and Disconnect now share dimensions and visual styles, with distinct disabled states.
- Retains the v1.3.0 SOP overview and read-only retained history. No permissions, storage formats or team API changes. This package is not a GitHub publication or store submission.

## 1.3.0 · 2026-10-19 — Local candidate, not published

- Added an explicit **View SOP overview** entry in Settings, with folder/team routing, categories, search, paging and setup guidance before connection. No shared index file is generated.
- Added read-only viewing of retained SOP versions in the team library and an explicitly authorized folder. Historical text, images and annotations stay tied to the selected version, with a historical notice and return to latest action.
- History reading does not change the current publication, add roles or approval flows, or grant management/restore permissions. Missing or invalid historical content is reported rather than substituted from the latest version.
- Retained the post-v1.2.0 hardening for verified separate-image reads, older-service compatibility, cancellation, bounded slow transfers, explicit publication replay, complete 100-step editing and language initialization. See [the development audit](docs/TEAM-COMPLETION-AUDIT.md) for the earlier verification scope.
- This is the current local candidate package, not a GitHub release or a Chrome Web Store submission. Published v1.2.0 assets remain unchanged. Current candidate checks must be recorded separately; earlier results do not validate the added history paths.
- Chrome 116 and Manifest V3 remain the extension baseline. Native permissions, physical two-device NAS/HTTPS acceptance and team statistics remain user-deferred, not passed. See [Version history](docs/VERSION-HISTORY.md) for retention and read-only boundaries.

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
