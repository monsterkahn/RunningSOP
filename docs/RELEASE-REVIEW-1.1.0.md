# Running SOP 1.1.0 local build and review

Date: 2026-10-18. Working branch: `codex/v1.1.0`. Outcome: source review, automated regression checks, build, and archive installation checks were completed for this local test version. Store submission, approval, and real two-device acceptance remain separate steps. The user's previously submitted 1.0.0 review materials were not regenerated or overwritten.

## Review references

- The `chrome-extensions` Skill from GoogleChrome/modern-web-guidance: Manifest V3, permissions, side panel entry points, service worker lifecycle, messaging and screenshot boundaries, icons, and the store release checklist.
- The motion guidance was actually searched and read through modern-web-guidance: the halo animates only `transform`/`opacity`, respects reduced motion, runs for three cycles, and pauses on hover, keyboard focus, or page hiding. No animation library, new API, or additional runtime dependency was introduced.
- [Chrome service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) and the [alarms API](https://developer.chrome.com/docs/extensions/reference/api/alarms). Optional scheduled tasks use a one-minute interval for the Chrome 116 minimum, rather than newer browsers' half-minute interval or newer persistence parameters.
- The project's `AGENTS.md` requirements for offline operation, privacy, explicit authorization, strict validation, and avoiding real business data take precedence. Generic guidance examples do not justify adding permissions, executing imported code, or mechanically rewriting Promise queues.

## Findings and changes

| Finding | Change and evidence |
| --- | --- |
| Chrome 116 parses internal `sop-directory` identifiers differently, potentially blocking reads | Replaced URL parsing with strict format validation and constrained relative-path resolution; retained source identity, read limits, and authorization checks. Directory tests reject credentials, query strings, encoded path traversal, and control characters. Connection, content reading, and empty-library initialization passed in actual Chrome 116. |
| At the 10-draft limit, there was no cleanup control and users could not create another draft | **Manage drafts** appears only at the limit. Deletion requires confirmation, can be canceled, and is disabled while a recording session exists. It deletes only local drafts. Tests verify that cancellation changes nothing, only the selected draft is deleted, other drafts and shared configuration remain, and recording can start again. Seven interface languages fit at 320 px without horizontal overflow. |
| Privacy and installation documentation still advertised backup export and statistics settings controls | Updated `PRIVACY.md`, README, installation instructions, and handoff text. Clarified that these controls have been removed, a new folder selection performs one check, previously explicitly enabled background configurations are retained, and empty-library initialization requests write permission. |
| Store listing information and permission justifications lacked a central document | Added `CHROMEWEBSTORE.md` using the Skill template, listing required/optional permissions, data processing and transfer, and pending screenshot/public privacy page updates. Removed export claims from the summary; previously submitted 1.0.0 materials were not rewritten. |
| Browser tests used screenshot coordinates too early, and the Chrome 116 test environment differed | Wait for annotation count/zoom initialization before interacting with the actual canvas, then wait for new annotation feedback. Older-browser tests use new headless mode; an entry point allows tests against files extracted from the archive. The final release regression runs files sequentially, retaining all tests and security assertions. |

## Source review scope

- Manifest V3, Chrome 116 minimum, and consistent versions in the manifest/package/lock file. Referenced icons exist, have the correct dimensions, and are PNGs with transparency. The toolbar explicitly opens the side panel. First-install settings opening handles only the `install` reason.
- Site permissions are requested on demand for the current work origin. The file URL switch is separate from native folder authorization. Animation and cleanup add no permissions. `activeTab` remains for the existing user-triggered compatibility screenshot interface; the current screenshot UI uses the browser chooser.
- Background event handlers register synchronously at entry. Drafts, catalogs, and statistics are stored persistently; in-process queues and loading caches are not treated as persistent storage. Restarting the recording background safely pauses recording rather than claiming uninterrupted business recording.
- Recording-management, catalog, and statistics messages are restricted to the extension origin. Recording events validate the tab, main frame, token, and page identity. Control-label processing does not read input values or editable descendants.
- Screenshot iframes use the extension origin, a closed Shadow DOM, random tokens, and tab/mode/expiry binding. The work page cannot read image bytes; the wrong tab cannot consume or cancel another session. An extension side panel fallback is used when injection is unavailable.
- Imports undergo structural validation and are handled as text or data. Uses of `innerHTML` involve fixed icons, internal emoji, or SVG generated from validated coordinates. The review found no `eval`/`new Function`, remote scripts, `chrome.storage.sync`, or calls exposing session storage to untrusted contexts.
- Publishing writes and verifies immutable content/images first, then optimistically checks the catalog pointer, writes it, and verifies it by reading it back, retaining publication history. File sharing does not provide a cross-device transaction lock; local tests do not establish strong consistency between two devices.
- Tests use synthetic SOPs, isolated Chrome profiles, and temporary directories. They did not test or modify the user's everyday browser profile, real business folders, or actual approval outcomes. This source and local regression review is not independent security certification.

## Recorded test results

| Check | Recorded result | Coverage and limits |
| --- | --- | --- |
| `npm test` | 108 passed, 0 failed | Catalog/cache/assets/publishing/concurrency/recording privacy/statistics/languages/distribution. File system substitutes do not establish real shared-drive acceptance. |
| `npm run test:release-browser`, Chromium 151.0.7922.34 | 10 passed, 0 failed | Runtime loaded from the extracted 1.1.0 store archive; first installation, screenshot isolation/annotation persistence/target switching, recording, draft capacity, folder connection/empty library, six-language dashboard, QR codes, and the mobile read-only page. |
| Same matrix, Chrome for Testing 116.0.5845.96 mac-arm64 | 10 passed, 0 failed | An actual older browser, with manifest minimum version retained at 116. This does not establish coverage on old hardware or every intermediate browser version. |
| Layout/visuals | Screenshots inspected | Folder halo screenshots, 390 px settings, and 320 px draft management; assertions for seven settings/draft-management languages and equal-width layouts. Edited screenshots were not substituted for the actual UI. |
| Build/scans | `npm run build` passed | Generated the example dashboard, read-only page, and three ZIP variants. Public-content scan and local reference checks passed. |
| Artifact verification | Verified before delivery | ZIP CRC/SHA-256; manifest at the store ZIP root; 58 runtime files matched the tested extracted directory byte for byte; icon dimensions/RGBA checked; no source configuration, dependencies, secrets, or real user data in the store archive. All three archived 1.0.0 ZIPs remained byte-for-byte unchanged. |

To reproduce: run `npm test`, then `npm run build`. Extract the store ZIP into an isolated directory, set `RUNTIME_SOP_EXTENSION` to that directory, and run `npm run test:release-browser`. For the older browser, also set `RUNTIME_SOP_CHROME` to its executable. The matrix fixes `--test-concurrency=1` and does not use an everyday Chrome profile.

Earlier parallel runs of several Chrome 116 instances had failures in which input events did not reach the screenshot iframe or APIs were not ready when the worker started. The complete sequential matrix passed. The earlier parallel failures remain failures, and the results do not establish stability on a real shared drive with multiple users. Folder tests replace only the native picker's selection result; subsequent operations use native OPFS handles. Automation has not proved real OS dialogs, persistent authorization, or reauthorization. Page hiding is tested with simulated `visibilitychange` events, not measurements of real background-tab energy use.

## Manual acceptance and pre-submission work still required

1. Actual system folder/screen-sharing choosers, permission denial/restoration, browser restart, and upgrading in the same directory while preserving data.
2. Creation, updates, offline recovery, conflicts, and organizational file permissions with two real computers connected to the same storage.
3. Responsiveness and power consumption on older hardware. This round establishes browser-version compatibility and finite animation, not a hardware-performance guarantee.
4. Recheck 1.1.0 store screenshots, the public privacy page, and actual data disclosures against the local draft. The user's existing 1.0.0 submission and store review are outside this work.

## Delivery

Three standard build archives and `SHA256SUMS.txt` were generated locally. The user-install ZIP wraps the same verified runtime; extract it and select the `Running-SOP` folder to load it. The source archive includes this report, the privacy documentation, and `CHROMEWEBSTORE.md`; the store archive excludes these development documents. This report records the local review stage. Subsequent GitHub updates depend on the repository release; this report does not establish Chrome Web Store submission or installation into the user's everyday Chrome profile.
