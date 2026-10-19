# Running SOP v1.3.3 — GitHub distribution review

Review date: 2026-10-20. The user authorized the scheduled GitHub distribution while retaining the previously deferred deployment acceptance checks. This record separates executed automated verification from those unperformed checks; it is not full native or production acceptance.

## Included behavior

Cleared or untouched steps without authored content are omitted from publication, and retained steps are numbered consecutively. A retained address or automatically derived location does not make a step nonempty. Content-bearing incomplete steps remain subject to validation. An entirely empty SOP is refused without deleting its draft.

Verified folder or team publication removes only the corresponding unchanged local draft and opens that exact published SOP. Failure or uncertain acknowledgement preserves the draft; the recorder serializes compare-and-delete with edits from other panels. Other local drafts, retained versions and published SOPs are preserved.

The complete package includes the latest screenshot toolbar: grouped SVG controls for zoom, annotation tools and undo/clear, vertical separators, extra spacing and the previous right-edge inset. Save notes commits annotations and Exit discards unsaved changes; there is no separate Cancel control. The fallback editor follows the same save/exit behavior. Rounded boxes and numbers remain movable by drag and keyboard.

It also includes the SOP overview, exact read-only retained-version viewing for folder/team sources, device-local passage feedback, PayPal disclosure and coffee placeholders, and the tested sharing/network hardening developed after v1.2.0. The experimental team service remains separately configured and opt-in. Chrome116, ManifestV3, bundled code and the existing permission/privacy boundaries remain unchanged.

## Executed scheduled checks

- Core: 199 passed; service: 52 passed on local Node.js26.9.0.
- Complete selected source browser suites: 52 passed on current Chromium151 and 52 on actual Chrome for Testing116, without skips. These include original recording/privacy/folder/dashboard cases, annotations, local step feedback, post-publication reading/cleanup, shared editing, slow-network/lost-response recovery, lazy images and retained history.
- Complete installation extraction: 25 browser scenarios passed per browser on current Chromium151 and actual Chrome116, without skips. All72 installed runtime files and all Web Store entries matched source exactly. All five ZIP integrity checks passed; manifest1.3.3 is at the Web Store ZIP root.
- Packaging uses the actual package version for all introduction-media filenames and visible version labels; it does not overwrite old-version media names. Actual English extension screens are captured with synthetic data.
- Exact package extraction, ZIP integrity and checksum verification are recorded in the scheduled release evidence after the build. GitHub's release job separately verifies downloaded upload bytes before publishing.

The preceding local v1.3.3 and toolbar patch evidence remains historical; the scheduled checks above were rerun against the integrated current runtime. Native operating-system permission prompts, physical two-device NAS/SMB behavior, HTTPS deployment and team statistics were not accepted in this run. These limitations remain explicit in the release notes. No Chrome Web Store submission is performed.

## Publication

GitHub publication is gated by Linux verification, two Windows package jobs, six OS/Node service jobs, three OS team/history/interaction browser jobs and a non-root container startup check. The remote workflow and final asset readback must succeed before publication is reported as complete. Existing published versions and binary assets must remain unchanged. See evidence/scheduled-release-1.3.3-2026-10-20.json for runtime hashes and executed local checks; remote completion is recorded separately after it occurs.
