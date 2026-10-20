# Running SOP project handoff

Current status updated: 2026-10-20. The user explicitly authorized the current **v1.3.4** package and GitHub distribution after adding Settings category management, icons and colors. The published baseline before this distribution was v1.3.3 at `dfac18a66a84dc39669440b24308a87b530f492f`; its five ZIP assets and workflow `39310357048` were verified. The previously delivered local v1.3.4 ZIPs were review packages only, not GitHub releases. The new v1.3.4 distribution must preserve all existing published versions/assets and wait for verification before being reported as published. Native permission prompts, physical two-device NAS/SMB and HTTPS acceptance and team statistics remain explicitly user-deferred. No Chrome Web Store submission is authorized. Historical sections below describe their recorded stage rather than current publication status.

This folder contains synthetic examples, with no real SOPs, internal addresses, or browser data. Repository: https://github.com/monsterkahn/RunningSOP; local `origin` is configured.

The original handoff was dated 2026-10-16, when v1.0.0 became the public distribution baseline by renumbering the complete feature set. The sections below preserve development history and evidence from that time onward. Historical statements about uploads, branches, layouts, and release readiness describe their recorded stage; the current status above takes precedence. The 2.x numbers are archived internal development identifiers, not current public releases.

The local v1.3.1 package adds a native PayPal account disclosure, removes the duplicated collaboration legend and unifies Connect/Disconnect button styling. It has not been uploaded to GitHub or submitted to the store.

The v1.3.0 local follow-up names the Settings entry **View SOP overview** and keeps it visible before connection. It follows the enabled team source or authorized folder, with safe setup guidance when unconfigured.

The local v1.3.2 candidate implements the approved publication/annotation/step-feedback draft: successful publication returns to the exact SOP reading context; failure preserves editing for retry. Screenshot tools use graphic controls, with drag/keyboard adjustment of numbered markers and rectangles and gently rounded rectangle outlines. Step feedback is device-local and bound to the exact SOP/version/step, not synchronized to a vendor, folder statistics or the experimental team service. The existing authorized three-slot, 48px PayPal layout is retained. See docs/RELEASE-REVIEW-1.3.2.md for the current candidate verification record; earlier v1.3.1 checks do not validate these new paths. GitHub remains at published v1.2.0; no upload, store submission or completed two-device/native acceptance is claimed.

## 1. Purpose and product boundaries

Running SOP is a Chrome Manifest V3 extension. Users read SOPs matched to the current work-page address, or record their work, annotate screenshots, edit steps, and publish to shared storage. It serves internal business and household workflows and is no longer limited to YouTube.

Core flow: open a work page → match SOPs automatically → read steps, thumbnails, and exception branches. When there is no match, show illustrated recording guidance → start recording → edit the first step → save automatically with Next step → finish and publish. URL matching recommends a workflow; it cannot prove that a business action was completed.

## 2. Confirmed product requirements

- Brand: Running SOP; author: don Kimxote; public email: gwangphug@gmail.com; MIT license.
- Compact side panel: Start recording and Settings have equal height; version and feedback appear at the bottom, with feedback hidden during recording. Remove the old recognition, search, and browse-all-SOP modules.
- Group reading content by work address and display it in order. STEP is bold and bordered, with the step name inside the border; names may be blank. Keep action text readable. Images default to thumbnails and can be enlarged.
- Show enlarged screenshots within the current work page, with a close action; do not open another webpage. Use a side-panel fallback on restricted pages. Isolate screenshots in an extension-origin iframe; never put screenshot bytes in the work-page DOM.
- After recording starts, edit the SOP name and first step directly. Next step saves automatically. Next step and Publish have equal width. Avoid redundant Add step, Save this step, and move-forward/back buttons.
- Report and approval points use icon buttons. Screenshot and Add image have equal width and icons, below the description editor. Their border height was set to 42px.
- Screenshots support numbered, arrow, and box annotations. Saved annotations must appear when reopened. Images always default to thumbnails.
- ISSUE denotes an exception-handling branch. Align options with buttons. ISSUE and backup modules need no separate accent colors.
- Satisfaction uses five faces from pale red to pale green. Selection replaces the chosen icon with a centered small paper plane, then Send submits it. A real synchronization failure must not be reported as success.
- Settings use one page. Storage labels refer to SOP storage and local-network storage, using the term “storage” in the interface. About is centered, compact, and expanded, with release notes included and consistent favicons.
- Initially support Chinese, English, Spanish, Russian, Korean, and Japanese, with browser-language selection and fallback. Traditional Chinese was added later (see section 16). Do not claim that Chrome can always translate extension pages.
- Disable selection/copying of pre-recording instructional text while keeping input controls editable.
- Content library and history have separate secondary pages. The overview is a dashboard only. Put the summary above the workspace, omit a recent-updates module, and use the available screen space.
- Categories support custom names, colors, and specified icons. Category organization is separate from URL matching; directory scanning is not recognition.
- Support internal IP addresses, private domains, and `file://` work addresses. Chrome's file-URL access permission still applies. Access to the work page is a prerequisite; do not add a separate approval gate for SOP visibility.

These are product decisions, not proof that every condition has passed acceptance in everyday browser profiles or on real shared drives. Later dated changes supersede earlier layout decisions where stated.

## 3. Entry points and structure

| Path | Purpose |
| --- | --- |
| extension/manifest.json | Extension version, permissions, and entry points |
| extension/workspace.html / workspace.js / workspace.css | Side-panel reading, recording, editing, and feedback |
| extension/options.html / options.js / options.css | Single-page settings |
| extension/about.js / release-notes.js | Author, version, and release notes |
| extension/background.js | Background processing and message coordination |
| extension/recorder-content.js / recorder-runtime.js | Page-event recording and local drafts |
| extension/catalog-engine.js / catalog-runtime.js / search-engine.js | Catalog, loading, and matching |
| extension/nas-publisher.js / sop-assets.js | Shared publishing, separate documents, and images |
| extension/stats-*.js / sync-*.js | Five-level feedback and statistics synchronization |
| extension/screenshot-editor.js / screenshot-overlay.js / screenshot-viewer.* | Screenshot editing, isolated viewing, and return messages |
| extension/image-marks.js | Image-annotation model and rendering |
| extension/category-*.js / dashboard* | Categories and standalone dashboard |
| extension/locale-data.js / workspace-i18n.js | Interface translations and dynamic states |
| examples/ | Synthetic examples, not real business data |
| tests/ | Core and isolated Chrome tests |
| tools/ | Builds, privacy scans, packaging, and sample dashboard |
| docs/STORAGE.md | Shared-storage data documentation |
| docs/RELEASE-CHECKLIST.md | Release checklist |

Read README.md, AGENTS.md, this file, and docs/RELEASE-REVIEW-1.1.0.md first. docs/RELEASE-REVIEW-2.5.13.md contains the earlier baseline review.

## 4. Storage and security boundaries

1. A fresh installation has no private storage address and does not connect, publish, or synchronize by default. Update checks and synchronization run only after user configuration and enablement.
2. Keep local drafts, shared SOPs, categories, and anonymous device statistics separate. Shared storage separates interface files from SOP data so they can be upgraded independently.
3. Shared documents and images are separate files, with a catalog index. Publishing requires validation, conflict protection, history, and read-back verification. Do not update the catalog before validating the document.
4. File sharing does not provide server-level distributed transactions. Concurrent editing of the same SOP still requires coordination. Single-machine concurrency tests do not establish strong consistency across two devices.
5. Recording does not collect form values, passwords, or cookies. Control-label extraction must not indirectly collect text from editable descendants.
6. Screenshots require an explicit user action and may contain private information. Temporary screenshots use trusted extension session storage, with tab, session, mode, and expiration checks. Closing and cancellation must clean up.
7. Do not weaken screenshot isolation, expose session storage to content scripts, or let the wrong tab close or overwrite a valid screenshot session.
8. Treat imports as text or data; never execute scripts. Real business data, private addresses, keys, and browser profiles must not enter source packages.

## 5. Fixes recorded in the original handoff

- Reassignment of a variable prevented editing an already-published SOP containing images.
- Documents, images, and statistics lacked strict verification after persistence.
- Source changes and concurrent loads caused cache mismatches and overwrites.
- Work pages could access screenshot content, and screenshot-session authorization had boundary issues.
- Switching steps while editing annotations could save them to the wrong target.
- Labels containing input descendants could leak entered text.
- Blank step titles broke current-step recognition.
- Dynamic connection states did not follow language changes; narrow layouts and button dimensions needed fixes.

## 6. Validation evidence and limitations

Earlier baseline: 68 core tests, 5 isolated Chrome flows, 52 JS/CJS syntax checks, and 24 localization-state assertions passed. Layouts were checked at 320/390px side-panel widths and 1280px desktop width, across six languages and light/dark themes. See docs/RELEASE-REVIEW-2.5.13.md. These are pre-migration baseline results and do not remove the need to rerun checks on a new machine.

The five browser flows covered fresh installation/settings, the synthetic dashboard, isolated screenshots/annotations, step-by-step recording, and races when switching editing targets.

Manual checks remain: sharing/canceling through Chrome's native screenshot picker; native folder permission and reauthorization; upgrading the original loaded directory while preserving data; two real devices accessing shared storage and handling conflicts; and store permissions/privacy disclosures. Automated write tests have not used the user's everyday browser profile or real business data.

## 7. Development and builds

Node.js 20+ is required. No framework runtime dependencies were added; Playwright is a development/test dependency.

```sh
npm ci
npm test
npm run test:browser
npm run build
```

Browser tests may require a test Chromium installation, or an existing runtime configured with `RUNTIME_SOP_CHROME` and `RUNTIME_SOP_PLAYWRIGHT` as described in tests/public-browser.cjs. Use isolated browser profiles; do not take over the everyday Chrome data directory.

The build produces files in `dist/`, currently named:

- `running-sop-extension-v1.1.0.zip`: developer-mode installation assets.
- `running-sop-github-v1.1.0.zip`: public source package.
- `running-sop-webstore-v1.1.0.zip`: store package, with manifest.json at the ZIP root.
- `SHA256SUMS.txt`: checksums for the three packages from that build.

Earlier v1.0.0 builds used the same filenames with `v1.0.0`. The source package uses an explicit allowlist. When adding public documentation or source files, check tools/package.cjs. This handoff and the continuation prompt are included in the allowlist.

To preserve data during upgrades, back up first, replace files in the originally loaded folder, then reload the extension. Do not uninstall first or casually change directories. Behavior changes require corresponding version, release-note, documentation, and necessary test updates. v1.1.0 is the current public GitHub release; 2.x numbers are internal development history.

## 8. Suggested order for the next maintainer

1. Compare the actual files with AGENTS.md, rerun tests, and confirm environment dependencies.
2. With a test SOP, manually complete recording → screenshot annotation → Next step → publish → read → exception branch → feedback submission.
3. Complete native authorization, in-place upgrades, and real two-device acceptance, and record results.
4. Base further improvements on reproducible issues or explicit requirements. Preserve the confirmed compact layout.
5. Before release, review PRIVACY.md, SECURITY.md, LICENSE, permission descriptions, and ZIP contents. Prior GitHub publication is complete; further publication or store submission requires the relevant authorization. This handoff alone does not authorize a new external release.

Still to confirm: store developer-account details, the public privacy-policy URL, final store copy/screenshots, and the final production storage deployment. Do not invent these details. The GitHub repository is confirmed in the current-status paragraph.

## 9. Archived 2.5.14 QR and read-only reader work

This internal development stage added per-SOP QR labels, local encoding, SVG output, and batch printing based on stable IDs. Added files included sop-sharing.js, qr-code.js, mobile-reader.*, and reader-integrity.js. The read-only reader loaded the published version when opened and did not switch versions during reading. This section preserves implementation history, not mobile deployment or scanning instructions.

At that stage, the user had provided a mounted file path but no phone-accessible HTTP(S) website. Production mobile acceptance had not been completed.

Recorded 2.5.14 validation: 83 core tests, the existing 5 isolated Chrome flows, and 2 additional QR/reader flows passed, including a SHA-256 fallback on plain HTTP, image annotations, version updates, and rejection of corruption. An independent decoder also verified the QR encoder. Real phone-camera behavior and production website reachability were not accepted.

## 10. Archived 2.5.15 folder connections

Added storage-source.js to bind native directory handles to local connection metadata. Internal `sop-directory` identifiers are not public addresses. Background, side panel, and settings share one directory source. Legacy file-address mode remained compatible.

The main control became Select SOP folder, with file and legacy-address modes collapsed. Selecting catalog.json still required authorization for its containing folder; selecting a file must not be presented as automatically granting parent-directory permission. Reading and publishing share the directory, with separate permissions; statistics do not enable automatically. Preserve the original connection after cancellation or a wrong selection, isolate caches on source changes, compare native identities, and verify writes by reading back. Native system pickers, permission restoration, and real two-device access remained manual checks.

Recorded 2.5.15 results: 98 core tests and 8 browser flows passed: 5 existing extension/dashboard/screenshot flows, 2 QR/reader flows, and 1 native-folder-handle flow. The folder flow used native OPFS handles and real IndexedDB inside an isolated extension; it did not establish that the OS picker or a real network share had been tested.

## 11. Archived 2.5.16 connection layout

The earlier centered draft was incorporated into settings. `source-connection` used the pure state model in connection-view.js to show unconfigured/checking/ready/offline/permission/idle. Selecting a folder alone did not mean it was connected; directory checks, source matching, and read permission jointly determined the state. Checking animations ran a limited number of times, stopped outside checking, and respected reduced motion.

Location labels used `preferences.sourceLocationKind` and `sourceLocationEndpoint` explicitly, without guessing local/network status. Language and location labels shared the preference-write queue. Changing libraries did not reuse old labels. Choosing the wrong directory preserved the original connection and the error message.

Recorded 2.5.16 validation: 102 core tests and 8 isolated browser flows passed. The folder flow covered directory validation, offline recovery, location-label persistence, six languages at 320/390px, finite animation, and reduced motion. Refreshing settings during a check did not reenable automatic checks disabled by the user; state refresh did not overwrite manual legacy-address edits. Real OS pickers and two-device sharing still required manual acceptance.

## 12. Archived 2.5.17 dashboard languages

The standalone index dashboard added six-language selection at the upper right, initially following the browser and falling back to English for unsupported languages. Local selection persisted independently. dashboard-i18n.js translated interface text only, without traversing generated SOP, category, or feedback content. Static labels captured original text nodes; dynamic statistics and step markers were translated during rendering. Dates and category sorting used the active locale.

Added `npm run test:dashboard-languages`. Recorded validation: 102 core tests and 8 browser flows passed (5 existing, 2 QR/reader, and 1 six-language dashboard flow). Six-language screenshots at 390px were inspected; selection persistence, preservation of source content, and input-hint translations passed. Real system pickers and two-device sharing still required manual acceptance.

## 13. Archived 2.5.18 icons

The five PNG icon sizes were replaced with a slightly dimensional mark with transparency, preserving the blue checklist motif. Settings favicon, toolbar, side panel, and dashboard use the same assets.

## 14. Public numbering began at 1.0.0

The user requested renumbering the complete version to v1.0.0 and uploading it to GitHub. The 2.x history remains an internal development record. Version renumbering did not change data formats or storage keys. At that stage, the repository and GitHub authorization still needed verification; local packaging was not evidence of an upload. GitHub publication has since completed, as recorded in the current status above.

Recorded v1.0.0 validation: 102 core tests and 9 isolated browser flows passed, including the six-language dashboard, folder handles, screenshot annotations, and QR/reader functionality. All four corners of the five icon sizes were transparent, and appearance on a light-blue background was inspected. GitHub target/account authorization was still pending at the time of that record.

## 15. Voluntary support text in About

2026-10-17: Added user-approved Mars-themed support text below the author details. The user revised it to explain that RunningSOP is developed and maintained by one person, with proceeds intended for a trip to Mars; invite readers to buy the developer a coffee to fuel the Mars plan; and state that donations do not affect use and no boarding places are available. This replaced an earlier statement about recovering a $100 expense. The coffee invitation became its own paragraph, producing three paragraphs in total. The text and title are centered within a rounded border. The Chinese source wording was retained in the product, with English, Spanish, Russian, Korean, and Japanese translations. This follows the interface language and does not affect SOP content.

This stage added text and layout only, without payment links or payment integration. The version stayed at 1.0.0 and no release was performed at that stage. After the text revision, 102 core tests and 5 public-browser flows passed. Isolated-browser checks at 390px verified three centered, bordered paragraphs and no horizontal overflow in each of six languages. Chinese narrow and desktop screenshots were inspected.

## 16. Folder authorization, initialization, and display settings

2026-10-17: Selecting a folder immediately requests read permission. If catalog.json is absent, request write permission, create a valid empty catalog, and verify it by reading back. Validation permits zero SOPs. Do not overwrite an existing corrupt catalog; refusal of permission preserves the original connection. Added display-name/icon editing: six fixed icons and a name of up to 80 characters, stored only in local metadata without modifying the actual folder. Reselecting the same folder preserves its display settings; switching folders does not reuse them. Labels cover six languages. An already-authorized system does not force a second native prompt.

Recorded validation: 106 core tests and the folder browser test passed. Actual 390px screenshots were inspected; the name rendered as text and persisted across refresh/language changes. Empty-catalog creation used native OPFS handles. Native OS prompts and two-device sharing still required manual acceptance. Packages remained at 1.0.0; this stage did not submit changes to GitHub or the store.

2026-10-17 settings simplification: Removed the local-computer card, local/network location choices, and separate network-storage login module. Retained the folder display card and connection state. Icons were limited to folder, network drive, and local computer. Old login settings were no longer used; existing local data was not deleted.

2026-10-17 further settings simplification: The name/icon within the folder card became the native-picker entry point. Removed the connection diagram, separate Select/Check buttons, automatic-update switch, advanced connection settings, and statistics settings below it. Only About follows the folder card. Existing explicitly enabled automatic checks remain enabled; first selection checks once without enabling background checks by default.

2026-10-17: Added the same Running SOP logo to About. Developer support identifies the PayPal account as the public contact email, with six-language translations and no intermediary or unverified payment links. Folder display settings collapse after a successful save.

2026-10-17: The About brand area became a centered group with logo on the left and name/version on the right. Support methods use an extensible grid: PayPal wordmark and public email in a separate card, plus a More support methods / Coming soon placeholder. No payment action was added. Language selection became one row of seven equal buttons (a globe for browser default and six flags), with accessible labels and hover hints.

2026-10-17: Language settings changed to a Chrome-follow button on the first row and seven equal flag/language buttons on the second. Added Traditional Chinese through an offline static dictionary; SOP content is not converted. Browser locales zh-TW, zh-HK, and zh-Hant select Traditional Chinese automatically. About no longer uses details; its heading/icon were removed and content stays expanded.

2026-10-17: Removed backup/export UI from the recording editor; a green Publish button sits to the right of Next step. The former Save locally action became Clear step, clearing only the current step's content, screenshot, annotations, report/approval points, and exception branches while preserving its work address, position, and other steps. The support placeholder became a blank gray card. Underlying draft storage and import validation remain compatible.

2026-10-17: When no SOP matches, illustrated recording guidance now begins with Set save location, directing users to select the save/publish folder through Settings above and explaining that recordings remain local without a configured folder. Covers seven interface languages and adds no recording-permission gate.

2026-10-17: Removed borders/backgrounds from recording-guide icons and aligned them to the top of the text. Centered PayPal card contents and the wordmark's internal anchor. The browser-default button uses a local copy of the complete SVG logo from Google's Chrome website, preserving proportions and whitespace without remote image requests.

2026-10-17: `onInstalled(reason=install)` opens options.html on first installation. Updates, reloads, and browser startup do not open it proactively. No folder selection, directory-permission request, or synchronization is enabled automatically.

## 17. v1.1.0 development and publication history

2026-10-17: At the user's request, installed the official chrome-extensions and modern-web-guidance Skills from GoogleChrome/modern-web-guidance into local Codex skills. These are development aids, excluded from extension packages, and do not change user-browser requirements. Chrome DevTools MCP was not installed in this stage. AGENTS.md records the Chrome 116 minimum, lightweight fallbacks, and low-overhead animation requirements. This installation stage changed development conventions only; product tests, builds, and publication were not rerun then.

The user confirmed that v1.0.0 had been submitted for store review and assigned subsequent requirements to v1.1.0 onward. Development moved to `codex/v1.1.0`. Before switching, the three local v1.0.0 packages and checksum file were archived in `dist/baselines/v1.0.0-before-1.1.0`; previously delivered review materials were not changed. The version change did not alter catalog versions or local storage keys. The first requirement was a lightweight breathing ring inspired by the pin circle: play only three cycles when unconfigured, missing permission, or offline; stop when connected or selecting. Reduced-motion settings produce a static display, and hidden pages pause it. Animation uses only transform/opacity, without an animation library or persistent scripts. Chrome 116 remains the minimum; older browsers require actual testing, and support for earlier versions or old hardware must not be claimed without evidence.

2026-10-18 official-Skill review: Read the chrome-extensions permission, background, and release checklists and modern-web-guidance motion guidance. Fixed internal directory-identifier parsing in Chrome 116. Added a confirmed cleanup action when local drafts reach 10; deletion is disabled during recording, cancellation changes nothing, and published SOPs are untouched. Updated README/PRIVACY/installation documents and CHROMEWEBSTORE.md, removing promotion of the deleted export UI. Recorded results: 108 core tests passed; Chromium 151 and Chrome 116 each passed 10 browser tests against runtimes extracted from ZIPs. The serial matrix command is `npm run test:release-browser`. See docs/RELEASE-REVIEW-1.1.0.md. Native system authorization and real two-device acceptance remained incomplete. At that review stage, v1.0.0 delivery packages were unchanged and v1.1.0 had not yet been pushed or submitted.

Subsequent current status, 2026-10-18: v1.1.0 was published to GitHub with successful CI; `main` is `5c02d06b3b8788ef35ff7e6fd31339c96e701b28`. This supersedes the earlier local-only/pending-upload statements. v1.0.0 remains under store review according to the user; no v1.1.0 store submission has occurred. The outstanding manual checks remain outstanding.

## English documentation update — 2026-10-18

GitHub explanatory documents and official release notes are now maintained in English. Mobile scanning instructions and the standalone mobile deployment guide were removed; software features and necessary data-processing disclosures were retained. Internal changelog entries were moved into docs/DEVELOPMENT-HISTORY.md so the public changelog shows only official releases. The release workflow synchronizes English descriptions for the two existing official releases without replacing published attachments. An isolated workflow test verifies idempotence and preservation of published binary assets; the local core suite now contains 109 passing tests. No extension runtime or interface language was changed by this documentation update.

## Windows stability review — 2026-10-18

Work on `codex/windows-stability` fixes case-insensitive library discovery and bounds shared publication reads, adds stable Git line endings and a read-only Windows CI matrix, and verifies packaged runtimes on Windows Server 2022/2025 plus local Chromium 151 and Chrome 116. See docs/COMPATIBILITY-REVIEW.md for exact evidence and limitations. This branch does not replace published release binaries or establish native authorization, Windows 10/11 desktop, old-hardware, or two-device NAS acceptance.

## Authorized compatibility patch publication - 2026-10-18

The user requested uploading the tested fixes. Version 1.1.1 includes the Windows stability changes, matching package/manifest/lock versions and release notes. The main release workflow calls the Windows matrix and requires Windows and Linux verification before publishing. Existing releases are preserved. No Chrome Web Store submission is performed. Native authorization and two-device acceptance remain outstanding.


## Active team-service development — 2026-10-18

The active user goal is approximately 500 users across mixed devices/configurations/browser versions, with the previously discussed 200,000-SOP catalog. Do not mark that goal complete from the current foundation. Work is on `codex/team-service-foundation`; no new official release or store submission was made. Read `docs/TEAM-SERVICE-DESIGN.md` for the full acceptance ledger, measured failures and remaining work, and `server/README.md` for experimental operations. The service is NAS-brand-independent and can run on a capable NAS or a separate Windows/macOS/Linux host with its database on local disk.

The worktree adds an opt-in HTTP team mode, private device sessions/pending publication recovery, exclusive fenced editing leases, canonical revision history, indexed/bounded search and pagination, stable categories with independent assignment revisions/audit, internal binary image deduplication, response admission, and verified live-WAL backup/restore. Current schema is 6. Server requires Node 24+; extension minimum remains Chrome 116. Build outputs remain ignored and are development artifacts, not replacements for published releases. The Docker definition and new OS CI matrix exist but have not been executed here. Do not report those checks as passing.

Reproduce: `npm test`, `npm run test:server`, `npm run test:team-browser`, `npm run test:release-browser`, `npm run build`. A current Chrome 116 binary exists under ignored `dist/compatibility/chrome116/` and can be selected with `RUNTIME_SOP_CHROME`. Use `node server/tools/scale.cjs --sops 200000 --clients 500` for the catalog workload and `node server/tools/real-large-read.cjs REPORT_PATH` for image-heavy traffic. Both use temporary synthetic data. The latter deliberately demonstrates immediate admission failures before testing eventual recovery; successful recovery does not mean every initial request succeeded. Cold socket bursts hit the local OS accept-queue cap of 128; no host settings were changed.

Outstanding: smaller/lazy image reading protocol, UI/category/dashboard integration and team statistics, bounded pending-request cleanup, executable OS/container CI, stronger mixed-client/upgrade/long-duration evidence, installation artifacts, trusted HTTPS setup and physical two-device/NAS/native-permission acceptance. The folder mode remains the default on a fresh installation. Never silently publish or synchronize team work to the previously selected folder target.


## User-revised workload — 2026-10-18 (takes precedence)

The user now estimates about 500 active SOPs for a 500-person organization, with 15% novice users (75 people). This is the new primary planning scenario, superseding the 200,000-SOP/500-concurrent-reader assumption above. Seventy-five is a potential user cohort, not measured concurrency; use a 75-reader simultaneous burst for validation, without imposing hard product limits. Retain prior stress evidence. The default load tools now use 500 SOPs/75 clients; the image tool accepts `--clients` and `--out` while retaining its legacy positional report path. See the design ledger for exact commands, measured results, remaining acceptance gaps and the revised priorities. Issues belong inside steps; step counts and SOP document counts are not interchangeable. Goal work remains active and incomplete.


## Team-library continuation — 2026-10-18

Added `extension/team-library.html/js/css`, linked from connected Team service settings. It supports 50-record paging, two-character search, all/uncategorized/category filters, custom category name/color/icon/parent, optimistic category assignment/update, safe empty-only deletion, verified current/history reading and in-tab screenshot previews. Seven languages and narrow layouts are browser-tested. Thumbnail decoding is deferred near the viewport with at most two jobs; the network protocol still reads an entire guide. Private pending requests now have count/byte limits and exact-draft cleanup after confirmed deletion; never prune using an old draft snapshot. See `docs/TEAM-LIBRARY.md`. The server remains schema 6; the uncategorized filter requires no schema migration.

The team browser script now includes workspace and library tests. Native prompts/real NAS and the dedicated team statistics/dashboard protocol remain outstanding. Remote OS/container checks must be inspected after execution; they are not established by creating a workflow file.


## Remote experimental validation — 2026-10-18

Draft PR: https://github.com/monsterkahn/RunningSOP/pull/2, branch `codex/team-service-foundation`. Initial GitHub commit `88f047ce8289ef13686b6ca7a2dc52ad39cbd4d8` has tree `cb9e94dbe3495da7919ca8da52da2eff35fea2f9`, verified equal to local commit `8882025`'s tree (different commit lineage). Public main and published assets were not changed. The local manifest description was edited outside this goal's changes and remains unstaged; preserve it and do not overwrite or silently publish it.

Initial remote team-service runs `39127009083` (push) and `39127037080` (PR) passed Ubuntu/macOS Node24/26 service tests, all three OS team-browser jobs and the container build/non-root startup. Both Windows service jobs failed: read-only backup file fsync, incorrect POSIX-signal assumptions in the CLI test, and OS-dependent slow-response test setup. Fixes open the private snapshot `r+`, add trusted-parent IPC graceful stop/disconnect, and hold response completion explicitly in tests. Inspect the updated commit's actual Windows results before claiming resolution. New team-service CI concurrency avoids duplicate push/PR runs for the same branch; canceled runs are not successful evidence.

The continuation also adds deterministic browser cases for delayed image completion and private account changes before their public notification. The library checks identity after responses and invalidates synchronously on connection metadata changes. Local results: 145 core tests, 43 server tests, and 3 team-browser scenarios on current Chromium and actual Chrome 116. Build succeeded. Updated remote Windows results are still pending.

## Queued user-authorized release work — 2026-10-18

After completing the current collaboration/stability goal, the user explicitly requests: (1) use manifest summary `Create step-by-step guides with screenshots, follow them beside your work, and share SOPs through a folder you choose.`; (2) prepare version **1.2.0** packages and matching product introduction images; (3) update GitHub. The description currently exists as an unstaged external manifest edit and is now explicitly authorized for that later release. Preserve it; do not prematurely change release versions or submit a store update. Publication cannot replace the outstanding acceptance work.

Remote portability fixes were verified on GitHub commit `2810dac7aa0f6c15097b208f8db4f25a5c5911ed`: team-service PR run `39127823019` passed all 10 jobs (six OS/Node service combinations, three OS browsers, container build/non-root startup). The duplicate push run was canceled, not passed. Existing extension verification runs `39127823021` and `39127819961` passed. Subsequent account-fencing/package changes require their own final run.

Account-isolation continuation: team settings now discard out-of-order UI reads; workspace reads, copying, lock acquisition and publication capture the starting connection and verify persisted identity across awaits. Same-generation settings loads are coalesced so normal tab refreshes do not cancel explicit actions. Tests hold a successful create response through an account switch and retain the original pending request without touching the replacement account's key. A separate VM harness exercises older/newer settings completion order. The experimental service source ZIP has an allowlist, checksum, symlink rejection and clean extraction/start/shutdown acceptance test. Local checks: 148 core tests, 44 server tests on Node 24 and 26, and 3 team scenarios on current Chromium and Chrome 116. Final remote CI for these additions remains to be inspected.

Final automated checkpoint: GitHub runtime commit `fb70640f689e00c801d4d86c45fda36444119445` (tree `4b349cde2136c6e3ac6e2abd941e60d014548d01`, equal to local `ba08f5c`) passed all 10 team jobs in run `39128728309`, including the 44-test service suite and extracted-package startup on six OS/Node combinations, three OS browser scenarios and container startup. Existing extension run `39128728341` also passed, including both Windows package checks; release was skipped on this development branch. See `docs/evidence/team-final-ci-2026-10-18.json` (relative to the repository root). Duplicate push run `39128725376` was canceled. This proves only those automated environments; trusted HTTPS, real two-device/NAS/native-permission acceptance and team statistics/dashboard remain unfinished. The queued v1.2.0 release has not been made.

## User-authorized v1.2.0 release with deferred acceptance — 2026-10-18

The user stated that team statistics, HTTPS deployment and real two-device acceptance cannot currently be performed and instructed releasing version 1.2.0 now. This explicit instruction supersedes the earlier requirement to finish those gates before a formal release for this version. The gates remain unverified, not passed; do not claim production NAS/TLS/native acceptance. Team feedback remains local, folder mode is the default and the team service remains opt-in/experimental. The exact English manifest summary is now authorized and included. Prepare installation/source/Web Store ZIPs, an optional experimental service source ZIP and introduction-images ZIP with checksums. Update GitHub without submitting to the Chrome Web Store or replacing previous release assets. Runtime schema/protocol and user storage keys remain unchanged.

The team-service workflow is now reusable from the main CI, and publication requires its success in addition to regular/Windows checks. This avoids an independent duplicate team workflow while ensuring the published service is checked. Release media uses actual isolated extension screenshots and synthetic content, with English headings and no invented controls or phone claims. See docs/RELEASE-REVIEW-1.2.0.md for the release evidence and limitations.

Latest user steering, 2026-10-18: finish the local v1.2.0 software package first, let the user install/check it, and publish only after their explicit confirmation. This supersedes immediate-release authorization above. No v1.2.0 GitHub/main/store publication is authorized yet. Prepare the reviewable local packages and media, then wait for the user.

Local candidate delivery: v1.2.0 installation/source/store/service/media ZIPs generated under ignored dist. SHA256SUMS.txt covers all five. Extracted packaged runtime passed 13 browser scenarios each on current Chromium and Chrome 116; core148/service44 checks passed. Actual UI screenshots/English introduction images and RGB dimensions were inspected. No GitHub mutation or store submission occurred during this v1.2.0 preparation. Keep publication pending until the user confirms their installation check.

## Saved service picker — 2026-10-19

The user approved replacing manual team URL entry with a saved-address chooser. Local v1.2.0 now provides a native dialog with add/name/edit/delete/select, in seven UI languages. The separate IndexedDB address list contains only validated ID/name/endpoint metadata, capped at 20 with atomic transactions; it contains no credentials. Existing credentials/pending publications remain in their original stores. Selecting or organizing addresses performs no network request, preserves the active session, and clears any typed join code; Connect remains explicit and preserves its synchronous origin-permission request. Existing active connections appear in the picker without migration or automatic reconnect. Older v1.2.0 delivery ZIPs were preserved under ignored dist/baselines/v1.2.0-before-service-picker. Publication still waits for the user's installation check and explicit confirmation; no GitHub or store mutation is authorized.

Saved-picker candidate verification: 153 core tests pass. Exact extracted ZIP runtime passes 14 browser cases each in current Chromium and actual Chrome 116. The real IndexedDB test verifies 20 successful concurrent saves, one service_limit rejection, and edits at capacity. All five ZIPs verify against SHA256SUMS; media now includes 05-select-team-service.png. No publication or GitHub mutation performed.

## v1.2.0 publication authorization — 2026-10-19 (takes precedence)

The user explicitly requested publishing the current v1.2.0 and updating GitHub, superseding the earlier installation-review hold. The chooser supports manually adding service addresses once and selecting saved metadata afterward; automatic LAN discovery or configuration-file import is not included. Preserve previous release assets. Publish through the gated pipeline only after checks succeed, and verify the public release and its five ZIP assets/checksum manifest. This authorization does not request Chrome Web Store submission. The deferred team-statistics, HTTPS and real-device/native acceptance boundaries remain disclosed.


## Separate-image read experiment — 2026-10-19

After v1.2.0 publication, `codex/post120-capacity-verification` adds optional authenticated read-view and exact-revision image endpoints, with matching read-only SDK methods. Existing full reads, publication, schema 6 and protocol 1 remain unchanged. **No normal UI uses these methods yet**, and no new version has been published. See `docs/TEAM-READ-VIEW.md` for the wire format, integrity boundaries, measured 75-reader comparison and remaining UI integration work. Views are derived only from fully hash-verified guides; image responses must be checked against the chosen view descriptor. Partial views never enter the complete-guide cache or publication path.

Local checkpoint checks passed: 157 core tests, 46 service tests, and all five team-browser scenarios on both current Chromium and actual Chrome 116. Native permission approval remains mocked. Load evidence and hashes are committed with the experiment; current-release download assets remain unchanged. Next step is capability-gated UI integration with cancellation/account-generation guards and bounded selected-image loading, followed by actual UI network assertions; the SDK-only benchmark does not prove UI traffic savings.


## Capability-gated library image loading — 2026-10-19

The next development checkpoint integrates separate-image reads into the team-library UI. It negotiates the capability only on explicit SOP reading, uses exact-revision image descriptors, and limits fetch/decode work to two jobs. Nearby thumbnails load through IntersectionObserver; without that API the same bounded queue processes open content. Closed issue images wait until expansion. Preview reuses the verified current-view image. SOP/revision/account changes abort old reads, discard queued work and close previews. Both thumbnails and previews decode into detached staging before a postdecode persisted-identity check and insertion. Corrupt advertised views stop rather than fall back to unverified full reads. Old services retain complete reads.

The working tree passed 157 core tests and all 11 team-browser scenarios on each of current Chromium 151.0.7922.34 and actual Chrome 116.0.5845.96. An intentionally unsafe temporary extension copy failed the private-account decode regression, independently checking the test's sensitivity. Evidence: `docs/evidence/team-library-images-ui-2026-10-19.json`. No published assets were changed. Side-panel/folder reading and editing remain on complete guides; side-panel reading is the next integration candidate. Real HTTPS/native permissions/physical two-device acceptance and team statistics remain deferred under the user's instructions, not silently treated as proven.


## Sidebar selected-image reading and complete Edit boundary — 2026-10-19

The working side panel now negotiates `read-view-images` for configured team reads, filters visible steps by work address and uses a two-job image fetch/decode queue. Unchosen issue branches do not request images. Repeated selection reuses one holder per issue slot, bounded by the existing guide schema. Older services retain complete reads; corrupt advertised views fail closed. Folder/local editing and publication formats are unchanged.

Edit never clones a stripped reading view into the draft: it fetches and verifies the complete guide, compares revision/hash against the displayed provenance, and copies that full result; existing lease acquisition rechecks the revision. A review found and fixed a refresh gap that cleared team provenance before clearing its partial display. The screenshot-viewer early return now retains provenance, and Edit independently rejects a team source missing matching identity. Tests cover held tab lookup, stale revision, unseen step/issue images and repeated issue selection.

`ScreenshotEditor.view` accepts an optional signal/identity guard, with detached fallback decoding and checks around native access, session storage and overlay mounting. Native access still starts in the initiating click. Cancellation closes the matching guarded view, while normal legacy viewing and screenshot editing remain compatible. The workspace uses per-reading abort signals, not a global close that would cancel unrelated legacy previews.

Validation of the current runtime: 162 core tests, 46 service tests, and 24 team + 10 original release-browser scenarios on each of Chromium 151.0.7922.34 and actual Chrome 116.0.5845.96 passed. Evidence: `docs/evidence/team-sidebar-images-ui-2026-10-19.json`. No published v1.2.0 assets/store submission were changed. Next work is isolated final-package verification and updated cross-platform CI for this development branch, then an objective-wide acceptance audit. Physical deployment/native permission and team-statistics deferrals remain explicit.


## Packaged runtime and refreshed OS matrix — 2026-10-19

Archived local runtime commit `22ff1b589239c4b381d9ef298776fb3a63fcf7a4` into an isolated temporary source directory, ran `npm run build`, verified all three generated ZIPs/checksums and compared every one of the 66 Web Store runtime entries against its source bytes. The extracted runtime passed 24 team and 10 original browser scenarios in both current Chromium and actual Chrome 116. Validation artifacts are development-only and were built outside the user's installed/published package directory; repository numbering and published assets were preserved.

The same source tree `a441009ebbd46ed6a88853a46c444ef85eba0ad0` was uploaded to the separate `codex/post120-capacity-verification` branch as remote commit `aa5fc7b18d7c7f08c9a084282abc116bd820bf22`. GitHub workflow `39180665855` passed all 13 verification jobs: six service OS/Node combinations, team browser scenarios on Windows/macOS/Linux, two Windows package checks, Linux core/build/browser/media verification and container startup. The release job was skipped. Logs confirm 24 passing team scenarios per OS; each Windows core suite has 161 passes and one pre-existing Linux-specific skip, not 162 passes. The public v1.2.0 asset digests remain unchanged. Evidence: `docs/evidence/post120-cross-platform-2026-10-19.json`.

Fresh current-runtime primary checks also passed with 500 SOPs/75 clients, including a cold connection burst (no warm-up) and 1,500 follow-up reads. Gradual-run read p95 was 5.7 ms, broad search 31.2 ms, publication 20.5 ms. Actual SDK text-plus-one-image completion was 1.05 s versus 3.64 s for all twelve images, with roughly 91.6% fewer body bytes and all 75 clients completing. These are same-host synthetic observations, not physical LAN or hardware guarantees. Evidence: `docs/evidence/post120-primary-load-2026-10-19.json`.

Next useful verification before the goal-wide completion audit: actual released-vs-development client/server combinations (beyond a simulated missing capability), followed by slow/interrupted network simulation if it reveals a meaningful acceptance gap. Native permissions, real two-device NAS/HTTPS deployment and team statistics remain deferred; do not turn these automation results into a production certification.


## Actual v1.2.0 interoperation and transport simulation — 2026-10-19

Test-only checkpoint: six actual released/development extension/server interoperability and competing-lease scenarios pass on each of current Chromium and actual Chrome 116. The independent official-source fixture is supplied through `RUNTIME_SOP_RELEASE_ROOT`; it must be verified against the source ZIP digest, not replaced by this checkout. Evidence: `docs/evidence/team-interop-network-2026-10-19.json`.

Side-panel tests now use actual CDP transport emulation without response routing. At 64 KiB/s and 120 ms latency, full reads hit the default 8-second timeout; verified text+one selected image completes in ~0.81/0.82 seconds. Offline publication retains the complete local draft, does not publish automatically after connectivity returns, and explicit retry creates one exact revision. Core162 and team-browser26 pass on each browser; the strengthened 2.5-second no-auto-publication observation also passes separately on each. No runtime/public package changes, new cross-platform run or release is claimed.

The slow full-read failure is meaningful remaining work. Next evaluate bounded connection/stall plus total-transfer deadlines for complete authenticated reads. Preserve strict size/hash/identity checks, cancellation, no automatic mutation retry and full-guide edit requirements. Test a progressing slow transfer separately from a stalled body. Goal remains active; physical deployment/native permissions/HTTPS/team statistics remain explicitly deferred by the user.


## Bounded progressing full reads — 2026-10-19

Fixed slow complete authenticated reads in `extension/team-client.js`: successful `getSop` uses the existing 8-second connection/idle limit plus a 120-second absolute per-attempt cap. Only validated successful headers/nonempty chunks reset idle. Other endpoints, anonymous reads, errors and mutations retain original total deadlines; no automatic write retry or schema/protocol change. Request cleanup aborts unread responses. External cancellation after full-guide SHA verification is checked before inserting the cache entry.

Core170, service46 and final SDK27 pass. Current Chromium151 and actual Chrome116 each pass team26/original10/interoperability6. Actual 64 KiB/s,120ms browser transport now completes full reads in ~11.2 seconds and opens full Edit with all24 step and2 unseen issue images intact. Two old-runtime regressions fail for the intended timeout and missing-cancellation reasons; fixed runtime passes. Isolated build/three ZIP integrity checks/66 byte-equal Web Store runtime entries passed; public v1.2.0 package unchanged. Evidence: `docs/evidence/team-progressive-read-2026-10-19.json`.

Next measured opportunity: complete Edit makes two full downloads (~23 seconds in this fixture). Reusing the freshly verified canonical result may avoid one, but must preserve target/identity and lease base-revision checks, including changes between initial copy and lease acquisition. Also measure slow large publication separately: this read-only timing change does not alter mutation upload/response timeouts. Refresh remote OS CI and inspect the resulting artifacts after remaining runtime changes. No formal new release; goal remains active and prior deployment/native/TLS/statistics deferrals remain explicit.


## One-read Edit and measured large-publication gap — 2026-10-19

Fresh Edit reuses its just-verified full canonical SDK result during lease setup. One full transfer replaces two; saved-draft reopen still fetches afresh. Persisted identity, exactID/revision/hash and acquired lease baseRevision checks remain. A real publication racing the copy is rejected and its acquired lease released, while the complete local draft survives. Removing only the baseRevision guard in a temporary runtime makes that regression fail. Core170/team27/interoperability6 pass on each relevant browser (core once; currentChromium151 and actualChrome116 for browser suites). Complete Edit in the same64KiB/s/120ms simulation drops from~23s to~12s. Isolated build/threeZIPs/66 byte-equal runtime entries passed; official package unchanged.

New standalone `tests/team-slow-publish-browser.cjs` honestly characterizes an unresolved limitation in both browsers: ~726KB guide publication hits the default8-second mutation timeout before this fixture commits. Full local draft and exact private pending payload/key persist; no automatic retry; explicit retry after restoring transport commits exactly once and clears pending/lease. Passing this test is NOT evidence that publication works at throttled bandwidth. It is separate from normal team tests and should be changed to require successful slow publication when implementing the fix. Evidence and fingerprints: `docs/evidence/team-edit-reuse-publish-gap-2026-10-19.json`.

Next: design/verify bounded large-guide upload and response timing without introducing automatic mutation retries. Inspect server body deadlines and lease expiry during transfer, not just client request timeout. Then refresh remote OS CI for accumulated runtime changes and perform an objective-wide audit against500SOP/75simultaneous-reader planning assumptions and documented user deferrals. Goal remains active; no new formal version or public package is implied.


## Bounded publication,100-step Edit and final-platform checkpoint — 2026-10-19

Development now fixes the measured slow-publication gap. SDK large canonical writes over 256 KiB get a size-based upload+verified-reply budget capped at 180 seconds, with 8-second successful-response idle; no automatic mutation retry. Service large authenticated known-length guide bodies and canonical replies get size-based per-phase caps of 120 seconds (body retains 15-second idle). Other/control/chunked/unknown-length/nondefault deadlines stay strict. Node parser body cap 120 seconds is necessary while headers remain 15 seconds; unexpected public GET/OPTIONS bodies now reject immediately to avoid unadmitted slow-body exposure. Existing byte/admission limits are unchanged.

Controller conditionally persists+renews a nearly expired lease under its busy/epoch guard before a large first upload. Healthy leases skip renewal; failed refresh sends no publication; uncertain replay keeps its original body/key/lease and never renews. Canonical write hashing now rechecks cancellation. Actual confirmation-loss replay after a genuine commit succeeds without another revision, even after the original lease expires.

A valid 100-step near-limit browser fixture initially failed Edit because Recorder.MAX_STEPS was 80 although shared format permits 100. Recorder and limit messages now match 100; local total draft 4 MiB limit remains. Same fixture (4,129,408 bytes, 148 JPEG images) now edits and publishes once on actual 64 KiB/s + 120 ms transport in 126 seconds on each of current Chromium 151 and actualChrome 116. The ordinary 726 KB case completes in~22 seconds. Old published clients retain their existing limits; published assets were not replaced.

Validation: core 180/service 52; original-browser 10 and released/development interoperability 6 per browser; exact extracted runtime team 29 per browser. Isolated build/3 extension ZIP integrity/66byte-equal runtime entries and experimental service ZIP/app inspection passed. Fresh 500-SOP/75-client load passes with 1,500 follow-up reads and zero unexpected failures. Negative SDK/public-body regressions fail their intended assertions. Evidence: `docs/evidence/team-bounded-publication-2026-10-19.json`.

Next required step: refresh remote OS/Node/browser/container CI for these accumulated changes, then perform the objective-wide completion audit from current sources. Primary scope remains 500 SOPs/75 simultaneous reader planning assumptions for a 500-person organization; retain earlier large stress results without reinstating the superseded 200,000-SOP requirement. Physical LAN/NAS/native-permission/HTTPS and team-statistics deferrals remain explicit. No new formal release or Web Store submission is requested by this development work. Do not report prior aa5fc7b CI as testing the newest runtime.


## Current remote verification handle — 2026-10-19

Uploaded verified local runtime/source commit `c32f1835fe5cb983056c3fb609daa1a63f7b9139` to the existing development branch `codex/post120-capacity-verification` as remote commit `c39b084cf0c05c44a54119a71be50494228bd763`. Their full tree SHA is exactly `d57fa3afc6c02b490b0c7d6e74610a8684679531`; remote update was fast-forward with expected-head checking. Published main/tags/assets were not changed.

GitHub Actions run https://github.com/monsterkahn/RunningSOP/actions/runs/39184422081 was confirmed queued for that exact commit. This is a live pending check, NOT passing evidence. Poll that run and its jobs rather than recreating work or relying on the earlier aa5fc7b run. No final cross-platform or goal completion claim is valid until its actual results are inspected. This note is local documentation after the uploaded snapshot; it does not change runtime bytes and need not trigger a duplicate verification run while the current one is active.


## Completion audit: rich workload, constrained configurations and language race — 2026-10-19

Inspected actual logs for remote run39184422081 (c39b084): twelve verification jobs passed, but macOS team-browser failed one saved-address case (28/29). Six service OS/Node combinations each passed52; Windows/Linux team browsers each29; Windows packaged originals10 with core179+one Linux-specific skip; container and Linux verify passed. Release skipped. This is not an all-green run.

Root cause: private connection settings and UI language load independently. If the private read renders first, status/captions could retain the default Chinese after English applies. Settings now dispatch an applied-language event; team settings and picker captions repaint without reloading credentials or contacting the service. The strengthened real browser scenario deliberately holds only the language read, observes the early Chinese connection, releases it and requires English plus all seven manual language button labels. Previous runtime reproduces the timeout; current/actual116 pass without increased timeouts. Core180 and team29 pass on each browser. Isolated build and four ZIP integrity checks pass, all66 flat Web Store runtime entries match current source; extracted-package original+picker7 pass per browser. Final OS CI must be refreshed for this correction.

A new self-contained `server/tools/primary-rich.cjs` combines the primary planning assumptions rather than inferring from separate tiny-record/image tests:500 SOPs,3750 steps,1000 pictured issue branches,6 departments/18 subcategories,75 unique authenticated actors and independent sockets. All500 full canonical guides are verified through real SDK/HTTP. Six department renames and75 assignments leave all500 canonical stored rows byte/revision unchanged. All4750 image references deliberately reuse one actual synthetic20732-byte JPEG, explicitly counted; this does not simulate4750 unique screenshots. Root reviewed and reran the fixture independently; zero incomplete/unexpected failures and cleanup verified.

Opt-in constrained mode in `tests/team-slow-publish-browser.cjs` applies actual renderer CDP CPU4 and a128MiB V8 old-space flag. Both current and actual116 pass two slow-publication/lost-confirmation cases. Observed V8 total limits are224MiB/152MiB respectively, not machine RAM. A separate Node128MiB old-space500/75 run has zero unexpected failures and1500 follow-up reads; child V8 limit224MiB is measured via IPC. Normal defaults/deadlines unchanged. Evidence/fingerprints: `docs/evidence/team-completion-audit-supplement-2026-10-19.json`.

Updated the previously stale requirements table in TEAM-SERVICE-DESIGN.md. No public main/tag/assets/store submission changed. Goal remains active pending the corrected remote matrix and final evidence audit; native permissions, real two-device NAS/HTTPS and team statistics remain user-deferred, not passed.


The final extracted-package original suite exposed one additional Chrome116 harness race: guided recording created its workspace tab while the genuine first-install options navigation was still pending, and Chrome reused that tab. The fixture now waits for the actual onboarding page and DOMContentLoaded before creating work tabs. Onboarding remains enabled and asserted, no runtime behavior is bypassed. Track the final rerun logs before reporting the original suite as passing.

Final extracted-package original release suites now pass10/10 each on current Chromium and actualChrome116 after the harness synchronization, with zero skips.


## Final automated acceptance — 2026-10-19

Remote corrected source019e0a12a2cf1d23ad770b8d178922cd757cc0e9 (exact tree864d2041d6fb75d749e6bfe6d8295093a2c36b27, localc373673) passed run39202716289. All13 verification jobs succeeded; release skipped. Actual logs confirm52 service tests in each of six OS/Node combinations;29 team scenarios on each of Windows/macOS/Linux, including the previously failing language-order case; each Windows package suite has179 core passes+one Linux-specific skip and10 original browser passes. Container/non-root startup and Linux verification passed. Local current/actual116 interoperation was rerun on corrected source:6/6 each. Core180, team29 each and exact extracted-package original10 each also pass.

The final requirements audit is docs/TEAM-COMPLETION-AUDIT.md, with machine-readable exact CI/asset evidence in docs/evidence/team-final-cross-platform-2026-10-19.json. All previous bounded-publication runtime fingerprints/control tests still match; only the separately executed opt-in constrained browser harness changed. The rich primary fixture was root-reviewed and independently rerun. This closes the authorized automated optimization work; it does not claim the expressly deferred native permissions, physical two-device NAS/HTTPS deployment or team statistics. Official v1.2.0 asset digests were fetched and rechecked unchanged; local installation ZIP matches its published digest. No new formal release/main merge/store submission occurred. Subsequent documentation-only audit commits do not change these tested runtime bytes.


## v1.3.0 local history candidate — 2026-10-19

User authorized retained-version viewing on top of1.2.0 as1.3.0. Work is on codex/version-history-130, preserving the intervening tested development hardening and the published1.2.0 assets. Settings now opens the native extension folder library (library.html), with validated category/search/50-row pagination and retained history. The work-page side panel and team library show explicit historical read-only state and return-current. Historical text/title/notice/location/URL, combined report+approval points and exact screenshots/marks are preserved. Historical display cannot become edit/publish/rating/statistics provenance. Unknown dates stay unknown; no roles/approval/restore was added.

SOPFolderHistory follows bounded publication-event links, validates exact immutable documents and assets, and fences source changes/cancellation. Legacy previous bodies/baseline events are retained before advancing catalog pointers without repacking existing data. UI20/API50 entries perpage;200 linkedversions displaycap is explicit and never deletes older files. Earlier overwritten/missing history cannot be reconstructed. The previous two-device/native/TLS/statistics deferrals remain explicit.

Final local checks: core190, service52, team29 and original10 perbrowser; eight newhistory scenarios perbrowser. Exact extracted WebStore runtime70files byte-equal tosource passed15 history/library/image scenarios on currentChromium151 and actualChrome116 each. Four ZIP integrity checks, build and service package generation passed. New CI history-browser script is added to the existing OS browser matrix, but newremote1.3 CI was not run or claimed in this task. Read docs/RELEASE-REVIEW-1.3.0.md and docs/evidence/version-history-1.3.0-2026-10-19.json for actual evidence and remaining limits.

Installation candidate is dist/running-sop-extension-v1.3.0.zip; WebStore ZIP has manifest.json atroot and is separate. The user previously preferred installing/checking a candidate before public release; no1.3 GitHub/store publication or mainmerge is implied. A documentation-only rebuild may change the sourceZIP digest without changing tested runtime files. Keep dist/output artifacts outofGit; the existing untracked output directory is unrelated and mustnotbe removed.

Local1.3.2 verification completed:199 core,52 service,51 broader source browser scenarios per baseline browser; delivered extraction verified with20 relevant scenarios plus two publication-fault scenarios per browser. Review and fingerprints: docs/RELEASE-REVIEW-1.3.2.md and docs/evidence/interactions-1.3.2-2026-10-19.json. Native OS/two-device/HTTPS checks remain unaccepted; no upload performed.

## Local v1.3.2 publication cleanup follow-up — 2026-10-19

User requested deleting the local draft after successful publication and immediately showing published steps. Verified folder/team acknowledgement now triggers atomic unchanged-draft deletion, with newer concurrent edits and uncertain/failed writes preserved. Both runtime files must be replaced, then the extension reloaded. Final source and exact reconstructed-package publication tests pass4/4 per browser (current Chromium151 and actualChrome116); core199 and isolated build pass. See docs/RELEASE-REVIEW-1.3.2-PUBLISH-CLEANUP.md. Patch: dist/running-sop-v1.3.2-publish-cleanup-fix.zip. Version unchanged; no upload, new public release or native/two-device acceptance claimed.

## Local v1.3.3 package — 2026-10-19

User requested skipping cleared steps during publication and packaging as1.3.3. Empty drafts are refused; content-bearing incomplete steps still require valid instructions. Retained addresses/location alone do not count as content. Both folder/team publication use the same filtered guide and consecutive numbering. The previous publication cleanup/read fix is included. Version metadata is1.3.3 with unchanged permissions/minimumChrome116. Delivery is local: dist/running-sop-extension-v1.3.3.zip, not a GitHub/store upload. See docs/RELEASE-REVIEW-1.3.3.md for executed verification and remaining acceptance limits.

Local v1.3.3 editor toolbar follow-up: user requested three icon groups with vertical separators and slightly wider spacing, no cancel button, Save notes and Exit only. Seven-file replacement ZIP: dist/running-sop-v1.3.3-editor-toolbar-fix.zip. Includes the previous left-inset CSS. The fallback editor has grouped icon tools and Exit as well. Version unchanged; Exit retains the previous discard behavior. Evidence: docs/evidence/editor-toolbar-patch-1.3.3-2026-10-19.json. Original full v1.3.3 ZIP is preserved; applying all seven replacement files to it gives the current runtime.

## Scheduled v1.3.3 distribution — 2026-10-20

The user explicitly authorized beginning at03:15 Asia/Shanghai to integrate all current1.3.3 fixes, generate complete packages and update GitHub. Latest runtime baseline is62a87c1; follow-up release edits are packaging/documentation only. Current scheduled local core199/service52 and source browser52 per currentChromium151/actualChrome116 pass. Fix the old hardcoded1.2.0 media naming using package.json version before building. The publish workflow is triggered by a main-branch push and gates publication on all verification jobs; it preserves published version assets and validates upload readback. Existing output/ is unrelated and remains untouched. No Chrome Web Store submission or full native/two-device/HTTPS acceptance is authorized or claimed.

Scheduled package extraction passed25 browser cases per currentChromium151/actualChrome116, zero skips/failures. All72 installed/WebStore runtime entries match source; five ZIP integrity checks pass. Local evidence is docs/evidence/scheduled-release-1.3.3-2026-10-20.json. Existing release asset fingerprints were recorded before upload. Remote CI/publication must still be verified before reporting completion.

## v1.3.4 category and recovery distribution — 2026-10-20

Settings and the folder overview share category management, including custom names, hierarchy, icons and colors. Per-SOP assignment is in the overview. Changes use separate categories.json, OS read/write permissions, revisioned backups, optimistic conflict checks, read-back verification and source guards through asynchronous writes. There is no administrator role. Source changes close category editors and block pending writes. Offline or invalid category sources cannot be edited. The overview can read verified cached current content with a stale-copy notice, while retained history requires reconnection. Invalid old connection settings are replaceable only after explicit valid selection. Tests use synthetic OPFS plus injected permission denial, not native OS prompt acceptance. See docs/RELEASE-REVIEW-1.3.4.md.
