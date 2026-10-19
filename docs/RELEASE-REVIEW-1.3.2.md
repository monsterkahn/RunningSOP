# v1.3.2 installation candidate review

Prepared 2026-10-19. This is a local installation candidate. The published GitHub baseline remains v1.2.0; no GitHub upload or Chrome Web Store submission is part of this task.

## Changes under review

- Successful publication returns to reading the corresponding SOP, bound to its source and published identity. Failed publication preserves editing and explicit retry.
- Screenshot tools use icons with accessible labels. Numbered markers and rectangles support dragging and keyboard adjustment. Rectangle outlines have subtle rounded corners; saved marks remain compatible with existing readers.
- Step feedback is tied to the exact SOP version and step and stored locally. It does not add vendor analytics, folder statistics synchronization or a team feedback API.
- The existing authorized PayPal layout remains a row of three equal-width slots with 48px collapsed controls, with two inactive light-gray coffee-cup placeholders. Account details remain collapsed until activated.

## Verification status

Current checks completed on macOS arm64 with Chromium151 and actual Chrome116. `npm test` passed199 tests; the unchanged service suite passed52. Broader source browser suites passed51 scenarios per browser. After final feedback-context label polish, the extracted Web Store runtime passed20 relevant browser scenarios per browser, plus two publication fault scenarios per browser (overlapping counts, not a unique total). These include exact publication reading, real folder writes and real team-service acknowledgements, lost-response recovery, post-commit local quota failures, source changes while queued, history, image privacy, annotation selection/drag/keyboard/undo/cancel, seven feedback languages and narrow widths.

All72 Web Store runtime files match source and the tested extraction. Installation, Web Store and source archives passed integrity inspection; manifest version1.3.2, ManifestV3, Chrome116 minimum and unchanged permissions were checked. Actual synthetic screenshots were visually inspected for annotation tools, rounded marks, the published reader and coffee placeholders. [Machine-readable evidence](evidence/interactions-1.3.2-2026-10-19.json) records executed checks and fingerprints.

A directory fence now runs before publication work and before committing the catalog pointer. A change in local edit-link storage after a verified commit is reported as a publication warning, not as a failed commit. Updates with unknown server acknowledgement retain explicit idempotent recovery.

## Boundaries

Chrome Manifest V3 and Chrome 116 remain the baseline. No new permissions or automatic shared connection are intended. Imported content remains structured data, and screenshots remain explicit user actions. Native authorization dialogs, real two-device shared-storage behavior and HTTPS deployment remain outside this local automated check and are not reported as passed. History before retention began cannot be reconstructed.
