# Running SOP project handoff

Current status updated: 2026-10-19. The latest published GitHub release is **v1.2.0**. Publication and all five ZIP assets were verified at release commit `ad9ca7ac2383e9b67febe260548674dc0759285f`; GitHub workflow `39144707756` passed all jobs, including release asset read-back checks. Further capacity-verification work is isolated on `codex/post120-capacity-verification` and does not alter that published release. The preceding published release was **v1.1.1**. The user explicitly authorized publishing **v1.2.0** with the current tested team-service feature marked experimental, while deferring team statistics, HTTPS deployment verification, native permissions and physical two-device acceptance. The local v1.2.0 review package was delivered. On 2026-10-19, the user explicitly authorized publishing the current v1.2.0 version and updating GitHub. That publication is complete; preserve published assets during subsequent work. Recorded documentation baseline before the English-only update: `5c02d06b3b8788ef35ff7e6fd31339c96e701b28`. According to the user, v1.0.0 is awaiting Chrome Web Store review; v1.1.0 has not been submitted to the store. GitHub publication does not establish store approval or completion of the outstanding native-permission and two-device acceptance checks.

This folder contains synthetic examples, with no real SOPs, internal addresses, or browser data. Repository: https://github.com/monsterkahn/RunningSOP; local `origin` is configured.

The original handoff was dated 2026-10-16, when v1.0.0 became the public distribution baseline by renumbering the complete feature set. The sections below preserve development history and evidence from that time onward. Historical statements about uploads, branches, layouts, and release readiness describe their recorded stage; the current status above takes precedence. The 2.x numbers are archived internal development identifiers, not current public releases.

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
