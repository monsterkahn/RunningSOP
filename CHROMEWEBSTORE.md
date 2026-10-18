# Chrome Web Store Listing — Running SOP

> Last updated: 2026-10-18. Local review of version 1.1.0; not a store submission or approval.

## Store listing

- Extension name: Running SOP
- English short description: Match SOPs to work pages, record steps, annotate screenshots and publish to a folder you choose. The package retains its existing localized manifest summary.
- Category recommendation: Workflow & Planning (under Productivity); actual dashboard selection must be confirmed before submission.
- Single purpose: Create and follow visual, step-by-step operating procedures beside their configured work webpages.
- Primary listing language: English. UI: simplified Chinese, traditional Chinese, English, Spanish, Russian, Korean and Japanese. Authored SOP text is not translated.

### Detailed description — 1.1.0 draft

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
| Work addresses and page titles | Local matching/selected recording; automatically captured HTTP(S) URLs omit query and fragment | May be present in SOPs explicitly published to chosen shared storage | Select and document the task |
| User activity and control labels | Selected recording page only; no input field values | Only if included in published SOP | Draft the steps |
| Website content | User-initiated single-frame screenshots, labels and manually entered notes | Only when published to chosen storage | Visual instructions |
| Ratings and written feedback | Local anonymous-device records | Only under previously explicitly enabled statistics synchronization | Improve SOPs |
| Identity/health/finance/authentication/communications/location | Not extracted as dedicated data categories; screenshots and user-written notes may incidentally include sensitive information | User-controlled publication can share that content | User must review it before publication |

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
| 1.1.0 | 2026-10-18 | Lightweight finite folder guidance, Chrome 116 directory parser correction, confirmed local draft cleanup, specification/privacy review | Official GitHub release; not submitted to the Chrome Web Store |
| 1.0.0 | 2026-10-17 | First public-version submission | Submitted for review per user; approval not independently checked |

## Review notes and remaining manual gates

- See docs/RELEASE-REVIEW-1.1.0.md for actual tests and package validation.
- Verify native OS folder/screen-sharing dialogs, permission renewal and actual shared-storage behavior on two computers. OPFS and isolated browser tests cannot prove these gates.
- No claim of successful installation on all older hardware, every operating system or every Chrome version between tested endpoints.
- A modern Skill is guidance, not an instruction to raise the browser floor, add permissions or introduce AI. Existing promise queues and transient locks are not mechanically rewritten when persistence and safety are already correct.
- Store screenshots, public privacy URL and live dashboard disclosure must be reviewed again before submitting 1.1.0. No new store action is performed by this audit.

Public documentation convention: GitHub README uses official release numbering only. The Chrome standards statement describes Manifest V3 implementation and developer self-review; it must not be presented as Google certification or store approval.

## Unreleased compatibility hardening — 2026-10-18

The Windows stability branch corrects case-insensitive folder discovery, preserves hashed example bytes across Git checkouts, and bounds shared-storage reads. No permission, privacy disclosure, product description or screenshot change is required for these fixes. This work has not been submitted as a new store package. Automated results and outstanding native/real-device checks are recorded in docs/COMPATIBILITY-REVIEW.md.
