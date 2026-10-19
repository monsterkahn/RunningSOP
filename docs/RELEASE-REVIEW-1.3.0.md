# v1.3.0 local candidate review

Recorded 2026-10-19. This is a locally built installation candidate for user inspection, not a new GitHub release, main merge, Chrome Web Store submission or production certification. The published v1.2.0 binary assets are preserved.

## Added behavior

Settings now keeps **View SOP overview** visible, including before a storage connection is configured. It opens the enabled team library when connected, otherwise the folder overview. Folder viewing requires an explicitly selected and authorized library; an unconfigured view provides setup guidance without contacting a service. Categories, search, pagination, current SOP reading and retained-version viewing are available from the overview. Opening it does not generate a shared index file or grant management permissions. The full-width library reads validated category data and offers search and 50-row paging without generating or modifying an `index.html` on shared storage. Reading a retained historical entry displays its exact saved title, notice, step locations/addresses, instructions, reporting/approval requirements, images and annotations. A visible historical/read-only banner and **Return to current** action distinguish it from the latest publication. The side panel and existing team library provide equivalent historical viewing.

Folder history follows linked publication metadata and hash-addressed immutable documents. Before publishing an update, the previous verified body is retained without repacking or changing its hash; missing legacy baseline metadata is recorded with an unknown timestamp rather than an invented publication time. Existing historical records are preserved. Hash/schema/path/source checks and bounded traversal apply to historical documents and their image assets.

Historical reading has separate identity/provenance. Editing, publication, ratings and current-read statistics cannot use the historical side-panel display. Account, folder, tab and SOP changes cancel outstanding work. Closing a modal cancels pending work before queued results can reopen or replace it. This adds no restore, role-management or approval workflow.

## Checks actually run

All checks below completed without failed tests. The two tested browsers were current Chromium151.0.7922.34 and actual Chrome116.0.5845.96 on macOS/arm64. Counts are per suite, not an assertion that each overlapping scenario is unique.

| Check | Result |
| --- | --- |
| `npm test` | 190 passed |
| `node server/tools/test.cjs` | 52 passed |
| `npm run test:team-browser` | 29 passed per browser |
| `npm run test:release-browser` | 10 passed per browser |
| New source history scenarios | Eight passed per browser |
| Extracted Web Store ZIP: history + team library/image scenarios | 15 passed per browser |
| `npm run build` and `npm run build:team-service` | Completed |
| ZIP integrity and path checks | Four archives passed |
| Extracted runtime vs source | All70 Web Store files byte-identical |

The new folder browser scenario uses native origin-private directory/file handles, two real publications with distinct retained text/marks, 51 valid guide documents for paging, validated category data, search, seven UI languages and narrow widths320/390. It verifies that historical reads do not alter the catalog and that a selected-folder change clears old content. Only the native OS picker result is substituted; actual system permission prompts are not claimed tested.

The historical team scenarios exercise exact revision text/images/annotations, older-service complete-read fallback, return-current, direct mutation guards, delayed account changes, delayed old reads, screenshot-viewer refresh and unavailable history. Tests exposed a Chrome116 Escape/queued-close race; cancellation now runs synchronously on native cancel, and the unchanged race scenario passes. Unknown dates do not become1970. Additional reader checks cover historical title/notice/location/URL and combined reporting/approval points as plain text.

An independently reviewed folder reader exposed missing standalone location/URL and combined-point labels, which were corrected and checked. A delayed repeated image-open decode is invalidated when the image dialog closes, preventing it from reopening after Close. Screenshots were visually inspected using synthetic content only.

Machine-readable checks, source fingerprints and runtime-package hashes are in [the candidate evidence](evidence/version-history-1.3.0-2026-10-19.json).

## Overview follow-up verification

After making the Settings overview entry explicit and visible, `npm test` passed 190 tests. The affected folder and team library browser scenarios passed two tests per browser against current Chromium and actual Chrome116, both from source and the extracted Web Store runtime. These cover unconfigured opening without HTTP requests, routing to the connected team, explicit folder viewing, pagination and retained history. Rebuilt installation, source and Web Store ZIP integrity passed; all70 runtime files matched source. Earlier broader suite counts above describe the initial candidate, not a second full rerun.

## Acceptance boundaries

Folder traversal is bounded to200 retained versions, with an explicit display-limit message; older retained files are not deleted. Files overwritten or deleted before retention cannot be reconstructed. Missing or corrupt history fails visibly and never substitutes the current image/body. Keep old documents and referenced assets in independent library backups if their versions must remain readable.

No new permissions, remote executable code or developer analytics were added. Chrome116 remains the minimum. A fresh installation does not connect to shared storage, publish or enable background synchronization. Folder access remains explicitly authorized in each browser.

Native permission prompts, true two-device NAS/SMB and trusted HTTPS acceptance, and team statistics remain user-deferred. The updated workflow will run history scenarios on its existing three-platform browser matrix when the source is uploaded; this local review does not claim that new remote matrix has already passed. These tests do not establish every older computer, storage brand or hardware-failure scenario.
