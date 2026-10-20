# Running SOP v1.3.4 — GitHub distribution review

Review date: 2026-10-20. The user explicitly authorized Settings category management, custom category icons/colors, the v1.3.4 package and GitHub publication. Earlier local v1.3.4 ZIPs were review candidates, not published GitHub assets. The existing deployment acceptance deferrals remain in force.

## Included behavior

Settings and the folder SOP overview share a category editor with names, hierarchy, icons, colors and live preview. Per-SOP assignment and removal of assignment are available in the overview; only empty categories can be deleted. Category metadata stays separate from SOP content. Filesystem permissions govern access; no administrator role, ownership system or distributed lock is added.

Saving requests write permission in the user action. It preserves category revision backups, optimistic conflict protection, read-back verification and endpoint/handle guards before shared writes and after verification. A source switch closes the editor and rejects pending operations. Denied permission or a concurrent change preserves the editor input. Names are rendered as text, while icons and colors come from fixed allowlists. Settings initialization reads saved metadata only, without connecting, polling, synchronizing or writing by default.

The overview can display a verified cached catalog and cached current SOPs while folder reads fail. A visible warning identifies the potentially outdated copy. Before and after reading cached content, the selected source and publication hash are rechecked; changed content prompts refresh. History requires reconnection. Editing is disabled for offline or invalid sources. Explicit folder reselection and text-only error details provide recovery; a validated new choice can replace malformed old settings without enabling automatic checks.

The package retains previous publication, annotation, history and local-feedback behavior, Chrome 116, Manifest V3, multilingual UI and existing permissions/privacy boundaries. Introduction media includes an actual Settings category-editor screenshot using synthetic data.

## Executed verification

- Core: 202 tests passed. Service: 52 tests passed locally.
- Complete browser suites: 55 passed on current bundled Chromium and 55 on actual Chrome 116, without skips or failures. These cover recording/privacy, shared/team editing and source fencing, publication/cleanup, annotations, local feedback, retained history, folder recovery and category management.
- Extracted installation: 5 affected folder/category/history/recovery scenarios passed per browser on current Chromium and Chrome 116. All 74 runtime files matched source byte-for-byte. See docs/evidence/release-1.3.4-2026-10-20.json.
- The category tests cover creation, rename, icons/colors, assignment/clear, empty-only deletion, shared refresh visibility, denied write permission, concurrent-change rejection, preserved SOP bytes, backups, seven languages, narrow layouts, offline disabling and changed-source cancellation.
- Category-store regressions exercise source changes during backup verification, final reads, staged writes and post-commit verification. They do not simulate a distributed transaction lock.
- Packaging must pass ZIP integrity, manifest/root layout, exact runtime-file comparison and checksums. The release job independently downloads and verifies uploaded bytes.

Native operating-system permission dialogs, physical two-device NAS/SMB behavior, HTTPS deployment and team statistics remain unperformed and explicitly user-deferred. Synthetic OPFS storage and injected errors do not validate native dialogs or every network mount. The screenshot that triggered the repair does not establish the precise failure in the user's original folder. No real SOPs, browser profiles or private endpoints enter verification or packages.

## Publication

GitHub publication is gated by Linux verification, two Windows package jobs, six OS/Node service jobs, three OS team/history/category/interaction browser jobs and a non-root container startup check. Remote workflow completion and release download readback must be verified before reporting publication complete. Existing published tags and binary assets remain untouched. No Chrome Web Store submission is performed.
