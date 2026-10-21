# Running SOP 1.4.0 local candidate review

Scope: local installation candidate including the extension, standalone index
dashboard and separate relationship editor. No GitHub publication or Chrome
Web Store submission is included in this request.

The shared relationship format is distinct from catalog, categories and SOP
bodies. Strict validation, bounded reads, revision and full-snapshot conflict
checks, previous-revision backup and read-back verification protect saves.
Browser-origin locking does not provide a distributed NAS transaction lock.

## Current verification

- Core: `npm test` passed 225 tests on 2026-10-21.
- Seven new next-SOP scenarios passed on current Chromium and actual Chrome 116, including real work-tab navigation, no-address fallback, source-change races, offline status and history isolation.
- Existing publication, step feedback and workspace history checks passed on both browsers (10 scenarios), along with the updated guided-reading layout check.
- Folder selection, category management, screenshot mosaic saving/publication and public extension checks passed on both browsers. An obsolete style assertion was updated to check the approved reading-card structure, 20px indentation and auxiliary-card styling; that scenario then passed on both browsers.
- Annotation pointer/keyboard/undo/save checks passed on both browsers (2 scenarios), as did team workspace/service-picker checks (3 scenarios).
- The real OPFS relationship integration and existing dashboard six-language scenario passed on both browsers (2 scenarios). They check explicit selection, metadata-only rendering, 100% default zoom, direct node/port interaction, shared save, history backup, independent-writer conflicts, changed-catalog guards, source switching, empty libraries and reduced motion.
- Build and public-content scan passed. Installation includes standalone index.html, relationships.html and sop.html. The Web Store ZIP has manifest.json at its root.
- Five actual-interface listing images were exported at 1280 x 800 as opaque 24-bit RGB PNGs, plus 440 x 280 and 1400 x 560 brand promotions. Raw captures, provenance and checksums are retained in the separate media archive. Product screenshots use isolated synthetic documents, not real SOPs or accounts. Local format checks do not establish store approval.

Synthetic fixtures and isolated browser profiles are used. No real SOPs,
credentials or development browser profiles are included in distribution.

The three distribution archives passed CRC, version, checksum and complete source-byte comparisons. Extracted-installation public/navigation checks passed 13 scenarios on actual Chrome 116. The extracted standalone index opened the packaged relationship editor at 100% without automatic writes, remote requests or page errors. These final checks supplement, rather than replace, the acceptance limitations below.

## Acceptance limitations

Native OS folder permission prompts, physical two-device NAS/SMB operation,
HTTPS deployment and team statistics remain user-deferred and are not reported
as passed. Automated tests on actual Chrome 116 check browser compatibility;
they do not substitute for older physical hardware or deployment acceptance.

The package preserves the minimum Chrome 116 requirement, Manifest V3 and
existing permission declarations. No remote executable code or developer cloud
analytics is added. Screenshot masking is manual and does not remove original
copies from earlier publications, history or external backups.
