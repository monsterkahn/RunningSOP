# Chrome Web Store Listing — Running SOP

> Last updated: 2026-10-20. Current GitHub distribution: v1.3.3. This document is preparation material, not a Chrome Web Store submission or approval.

Version 1.3.3 includes read-only retained-version viewing and the Settings SOP overview. Publication skips cleared empty steps, renumbers retained steps, rejects empty SOPs, deletes only the corresponding unchanged draft after verified publication and opens the exact published reader. Failed or uncertain writes preserve the draft.

The screenshot editor uses bundled SVG icons with localized accessible names and hover hints. Zoom, annotation and undo/clear groups have vertical separators and extra spacing. Save notes and Exit replace the previous cancel/save/close layout; Exit discards unsaved marks. Rounded boxes and numbered marks support drag/keyboard adjustment, and version-bound step feedback stays local. PayPal account details expand on demand beside two inactive coffee placeholders. Fresh installations do not connect or synchronize automatically, and permissions remain unchanged.

The current verification record is docs/RELEASE-REVIEW-1.3.3.md. Use the newly generated v1.3.3 images for store preparation; no existing store listing or package is submitted or replaced by this GitHub release. Native permissions, physical two-device storage and HTTPS acceptance remain deferred.

## Store listing

- Extension name: Running SOP
- English short description: Create step-by-step guides with screenshots, follow them beside your work, and share SOPs through a folder you choose.
- Category recommendation: Workflow & Planning (under Productivity); actual dashboard selection must be confirmed before submission.
- Single purpose: Create and follow visual, step-by-step operating procedures beside their configured work webpages.
- Primary listing language: English. UI: simplified Chinese, traditional Chinese, English, Spanish, Russian, Korean and Japanese. Authored SOP text is not translated.

### Detailed description

Running SOP brings step-by-step instructions to the webpage where you work. Create visual operating procedures, follow them beside your task, and publish them to a folder you choose.

Match procedures to their configured work addresses. Read instructions, enlarge annotated screenshots, and check reporting requirements, approval points and exception-handling guidance. Address matching recommends a procedure; it does not verify that a business action or approval has been completed.

Start recording, name your procedure and create it one step at a time. Add instructions and screenshots with numbered markers, arrows and boxes. Next step saves the current step. Publish after reviewing the result. Unpublished drafts stay in this browser. When the 10-draft limit is reached, you can review and confirm deletion of unwanted local drafts without deleting published SOPs.

Choose a local or mounted shared folder for your library. An empty library can be initialized after write permission is granted. Colleagues must select and authorize the same shared library on their own computers. A standalone dashboard can organize procedures and display available statistics. New installations do not enable background synchronization automatically.

No Running SOP account is required. Screenshots are initiated by you using the browser's screen-sharing chooser and capture a single frame. Recording does not read input field values, passwords or verification codes. Labels, page titles, work addresses, screenshots and manually entered notes can still contain sensitive information; review them before publishing. Workflow records are not sent to the developer.

Requires desktop Chrome 116 or later. Some browser pages restrict extension access; file pages require Chrome's file URL permission. Folder permissions are local to each browser and may require reauthorization. Low-end hardware and organizational storage permissions should be tested in the intended environment.

Source: https://github.com/monsterkahn/RunningSOP
Support: https://github.com/monsterkahn/RunningSOP/issues

This is proposed 1.1.0 text only. Previously submitted 1.0.0 listing materials have not been edited or resubmitted. Removed backup/export controls must not be advertised for 1.1.0.

## Graphics and assets

| Asset | Dimensions | Local state |
| --- | --- | --- |
| Store icon | 128 × 128 PNG | extension/assets/icons/icon-128.png; inspect packaged dimensions |
| Screenshots | 1280 × 800 or 640 × 400 | 1.0.0 assets frozen; refresh for 1.1.0 before submission |
| Small tile | 440 × 280 | Existing 1.0.0 material; review before reuse |
| Marquee | 1400 × 560 | Existing 1.0.0 material; review before reuse |

Only real rendered extension UI and synthetic workflows should appear in store screenshots. Do not add fictional controls or mobile mockups. Folder animation is a progressive enhancement, not required to select the folder.

## Permissions justification

| Permission | Type | User-facing reason |
| --- | --- | --- |
| sidePanel | permissions | Display SOP reading, recording and editing beside the current task. Toolbar action opens the panel. |
| tabs | permissions | Read the current tab's address/title to recommend matching SOPs and follow the selected recording tab. Not used to send browsing history to the developer. |
| storage | permissions | Retain local preferences, drafts, verified library cache, feedback and isolated temporary screenshot sessions. Directory handles use extension-owned IndexedDB. |
| alarms | permissions | Restore previously user-enabled library checks and optional statistics synchronization. Uses one-minute periods compatible with Chrome 116; new installations do not enable these jobs. |
| activeTab | permissions | Temporary user-initiated access when the extension toolbar action is invoked; side-panel recording separately requests the current website's optional origin permission. Screenshots use the browser chooser rather than silent tab capture. |
| scripting | permissions | Inject bundled recording controls and the isolated screenshot overlay on a user-authorized work page. Imported SOPs are never scripts. |
| file:///* | host_permissions | Support SOP matching/recording on local or mounted file webpages and legacy file-based library reads. Chrome's separate file URL access switch must be granted by the user. Native folder handles use a separate folder permission. |
| https://*/* and http://*/* | optional_host_permissions | Support arbitrary user-selected public, enterprise and home webpages, including private domains. Requested for the current origin on explicit recording/overlay actions, not granted globally at install. |

The all-URL match in web_accessible_resources exposes only screenshot-viewer.html, not the screenshots. The viewer authenticates its tab, random session token, mode and expiry before reading a screenshot. No externally_connectable endpoint, remote scripts, eval or arbitrary imported execution is used.

## Privacy and data use

Data is processed for the SOP function; "the developer does not receive data" must not be misrepresented as "no data is processed."

| Data category | Processing | Off-device | Use |
| --- | --- | --- | --- |
| Work addresses and page titles | Folder-based matching is local; team-service matching sends a sanitized address to the configured service. HTTP(S) omits query and fragment; `file://` is sent in full. Recording is user-selected. | May be included in procedures explicitly published to selected folder storage or the configured team service | Select and document the task |
| User activity and control labels | Selected recording page only; no input field values | Only if included in published SOP | Draft the steps |
| Website content | User-initiated single-frame screenshots, labels and manually entered notes | Only when published to selected folder storage or the configured team service | Visual instructions |
| Ratings and written feedback | Local anonymous-device records | Folder-based mode may synchronize records only under a previously explicitly enabled setting; team-service mode keeps ratings local and has no team statistics | Improve SOPs |
| Service join code, display name and session | Join code and display name are sent when the user connects; session token is stored in private extension-origin IndexedDB | Join code and display name go to the configured team service; the service returns a session token stored in the browser | Authenticate the device and attribute team edits |
| Other identity/health/finance/authentication/communications/location data | Not extracted as dedicated categories; screenshots and user-written notes may incidentally include sensitive information | User-controlled publication can share that content | User must review it before publication |

- No sale of user data.
- No developer analytics or vendor cloud collection.
- No use for unrelated advertising, creditworthiness or lending.
- No chrome.storage.sync usage. No remote executable code.
- Folder handles are browser-local permissions, not portable login credentials.
- Selecting a library does not opt into statistics synchronization; new setup makes a single library check. Existing explicitly enabled settings are retained on update.
- Current settings no longer expose statistics or background-check toggles. Stop extension activity through Chrome's extension controls if needed; historical shared files remain.

Privacy policy source: PRIVACY.md. Public repository link: https://github.com/monsterkahn/RunningSOP/blob/main/PRIVACY.md . The policy source is published in this repository. Recheck the live URL and match its contents to the submitted package before any store submission.

## Distribution and developer

- Repository: https://github.com/monsterkahn/RunningSOP
- Author: don Kimxote
- Contact: gwangphug@gmail.com
- License: MIT (LICENSE)
- Visibility/regions: confirm in developer dashboard; this local build changes no store distribution settings.
- PayPal support information is optional. No license gate or payment processor is added to this build.

## Version history

| Version | Date | Changes | Status |
| --- | --- | --- | --- |
| 1.3.2 | 2026-10-19 | Publication returns to SOP reading; graphic, movable screenshot marks; local step feedback | Local installation candidate; no GitHub/store upload |
| 1.3.0 | 2026-10-19 | Read-only retained SOP history; post-release performance and compatibility hardening | Local candidate only; not published to GitHub or submitted to the store |
| 1.2.0 | 2026-10-19 | Optional experimental team service and library; existing folder mode remains default | GitHub release; not submitted to the Chrome Web Store |
| 1.1.1 | 2026-10-18 | Case-insensitive library discovery, bounded shared reads, Windows package verification | GitHub update; not submitted to the Chrome Web Store |
| 1.1.0 | 2026-10-18 | Lightweight finite folder guidance, Chrome 116 directory parser correction, confirmed local draft cleanup, specification/privacy review | Official GitHub release; not submitted to the Chrome Web Store |
| 1.0.0 | 2026-10-17 | First public-version submission | Submitted for review per user; approval not independently checked |

## Review notes and remaining manual gates

- See docs/RELEASE-REVIEW-1.2.0.md for current test results and limitations.
- Verify native OS folder/screen-sharing dialogs, permission renewal and actual shared-storage behavior on two computers. OPFS and isolated browser tests cannot prove these gates.
- No claim of successful installation on all older hardware, every operating system or every Chrome version between tested endpoints.
- A modern Skill is guidance, not an instruction to raise the browser floor, add permissions or introduce AI. Existing promise queues and transient locks are not mechanically rewritten when persistence and safety are already correct.
- The experimental service uses unencrypted HTTP by default. HTTPS deployment, native permission prompts, and real two-device access remain unverified. The v1.2.0 GitHub release does not submit a store package or claim store approval.

Public documentation convention: GitHub README uses official release numbering only. The Chrome standards statement describes Manifest V3 implementation and developer self-review; it must not be presented as Google certification or store approval.

## Unreleased compatibility hardening — 2026-10-18

The Windows stability branch corrects case-insensitive folder discovery, preserves hashed example bytes across Git checkouts, and bounds shared-storage reads. No permission, privacy disclosure, product description or screenshot change is required for these fixes. This work has not been submitted as a new store package. Automated results and outstanding native/real-device checks are recorded in docs/COMPATIBILITY-REVIEW.md.


## Post-release development review notes

The development branch adds capability-gated separate-image reading to the team library and side panel. It retains complete reads for older team services and obtains a complete, hash-verified guide before editing. Screenshot reading guards cancel stale account/reading requests without changing recording capture behavior. No new permission, remote executable code, vendor analytics or collection purpose is added. Product listing descriptions above are unchanged; these implementation notes do not describe a newly submitted store package. Rebuild and inspect the next proposed package, and complete the deferred native-permission/deployment acceptance before making broader compatibility claims.

## Local v1.3.0 candidate review

The local candidate adds read-only historical SOP viewing in the team library and an explicitly authorized folder. The selected version retains its text, images and annotations, with a historical notice and return to latest action. Reading history grants no category, publishing, restore or other management permission and adds no roles or approval process. No arbitrary remote imports, executable resources, new permission or analytics purpose is introduced. Fresh installations still require explicit storage selection and do not connect or synchronize automatically. See [Version history](docs/VERSION-HISTORY.md) for retained-file and validation limits.

Keep the listing’s exact English short description unchanged. This document prepares review material; it does not claim that a v1.3.0 package has been uploaded, submitted or approved. Preserve published v1.2.0 assets. Native permission prompts, physical two-device NAS/HTTPS acceptance and team statistics remain user-deferred. Inspect the newly built candidate and its actual checks before making submission or compatibility claims.

Local settings-only replacement (2026-10-19, version unchanged): three equal support-method slots in one row, two empty placeholders, and a48px collapsed PayPal control. Only options.html and options.css are distributed in the replacement ZIP; no new release or submission. Core190 tests and six public browser scenarios passed; three-slot widths320/390/1280 and local disclosure were also checked in current Chromium and actual Chrome116.

The v1.3.2 support area retains three equal48px slots: PayPal account disclosure and two inactive light-gray coffee-cup placeholders. These placeholders neither accept payments nor imply another payment method is available.

Local v1.3.2 reading-selection replacement (2026-10-19): folds a verified same-ID/same-hash local editing copy into its published SOP reading choice, retaining View draft. Team copies also require the same service and actor. Unrelated same-title drafts and uncertain publication recovery remain separate. Delivered as workspace.js replacement; existing installation archives and version numbers remain unchanged. Core199 and affected folder/team/history browser checks passed on current Chromium and actual Chrome116; no upload or store submission.
