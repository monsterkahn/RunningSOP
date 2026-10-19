# Shared SOP optimization: final automated acceptance

Recorded 2026-10-19. This audit covers the extension and separately installed team service for an approximately 500-person organization. The primary planning workload is 500 active SOPs and 75 simultaneous readers; the user explicitly replaced the earlier 200,000-SOP primary requirement. That earlier stress evidence is retained, not presented as the realistic image-heavy workload.

The authorized automated development work is complete. This is a developer acceptance record, not production certification. Native permission prompts, trusted HTTPS, actual two-device NAS/SMB deployment and team statistics remain explicitly deferred by the user. No physical-device, hardware-failure or field-concurrency result is claimed.

## Exact verified source

- Local source: `c37367331ffebfa8fb5b5b5469e06fa1ec307bd0`.
- Remote development source: `019e0a12a2cf1d23ad770b8d178922cd757cc0e9`.
- Identical complete source tree: `864d2041d6fb75d749e6bfe6d8295093a2c36b27`.
- [Final GitHub verification](https://github.com/monsterkahn/RunningSOP/actions/runs/39202716289): 13 verification jobs passed, release skipped. Logs were inspected, not inferred from a status badge.
- Later documentation-only audit commits do not change those tested runtime bytes. Published main, tags, official assets and the submitted store package are preserved.

## Requirements and evidence

| Requirement | Inspected evidence | Result and boundary |
| --- | --- | --- |
| Realistic primary collection | `server/tools/primary-rich.cjs`, independently rerun after review; [rich report](evidence/team-completion-audit-supplement-2026-10-19.json) | 500 canonical guides, 3,750 steps, 1,000 pictured issue branches, six departments and 18 business subcategories; all 500 full guides verified through actual SDK/HTTP. The 4,750 image references intentionally reuse one real synthetic JPEG; this is not 4,750 unique screenshots. |
| Concurrent readers | Same rich fixture plus [fresh gradual/cold primary runs](evidence/post120-primary-load-2026-10-19.json) and [latest bounded-publication primary runs](evidence/team-bounded-publication-2026-10-19.json) | 75 independent identities/socket agents, zero incomplete/unexpected failures; 1,500 follow-up reads. Same-host measurements do not establish physical LAN throughput. |
| Effective classification and discovery | Rich fixture asserts exact paged category/search membership and indexed positive/negative work-address matching; actual library UI scenarios | Six category renames and 75 reassignments preserve all 500 stored canonical byte strings, hashes and content revisions. Stable category IDs, bounded tree depth/pages and safe deletion remain separate from SOP content. |
| Exclusive editing and safe publication | 52 service tests per OS/Node combination; 29 real team browser scenarios; actual released/development competing leases | One winner per live SOP lease; stale/expired writers rejected; revision fencing and atomic history preserved. Uncertain writes retain their exact payload/key and require explicit retry, not automatic mutation retry. |
| Recovery | Actual SQLite WAL snapshot/restore, corrupt/live-target rejection, abrupt transaction-process termination; real confirmation-loss/replay browser cases | Committed data/history/hash/session/fencing checks pass. Replay after a real commit and lease expiry creates no extra revision. This does not prove power-loss, disk-failure or unattended failover behavior. |
| Browser versions | Actual Chrome116.0.5845.96 and Chromium151.0.7922.34; local core180, team29 and extracted-package original10 per browser | Real reading, editing, publication, annotations and recovery pass. Native permission approval is simulated and remains deferred. |
| Released/development compatibility | `tests/team-release-interop-browser.cjs`, rerun on corrected source using independently extracted official release source | Six cases pass per actual browser: all four client/service combinations plus competing old/new leases on each service. Older clients keep their existing limits; this is not a promise of every future protocol combination. |
| Different operating systems | Final CI logs: Node24/26 service tests on Windows/macOS/Linux, team browsers on all three, Windows2022/2025 extracted-package checks, Linux build and container | All13 jobs pass. Each service combination passes52; each team browser29. Windows core179 plus one Linux-specific skip, original browser10. These runners are not Windows desktop permission or native NAS acceptance. |
| Constrained configurations | Opt-in actual CDP CPU4 and V8 old-space128MiB runs; separate heap-constrained service500/75 run | Slow publication and lost-confirmation recovery pass2/2 in each browser. Observed total V8 limits are152/224MiB, not machine RAM. Service follow-up1,500 reads has zero unexpected failures. Controlled simulation is not old-hardware certification. |
| Large images and slow transport | [Selected-image UI](evidence/team-sidebar-images-ui-2026-10-19.json), [complete reads](evidence/team-progressive-read-2026-10-19.json), [bounded publication](evidence/team-bounded-publication-2026-10-19.json) | Two active image jobs, closed issue deferral, cancellation/identity guards and full canonical Edit. Actual64KiB/s+120ms transport publishes a726KB guide and a4,129,408-byte/100-step/148-JPEG guide once. Absolute and idle limits stay bounded. Server view generation still reconstructs full guides; no eliminated reconstruction-cost claim. |
| Understandable multilingual UI | Real library/sidebar/settings scenarios; forced delayed preference read and seven manual language choices | Corrected the macOS-discovered language-order race. Old runtime fails the forced-order regression; corrected source passes. Narrow layouts, category/history navigation and retained drafts are tested; this is not a user usability study. |
| Existing local/folder behavior | Core180 and exact extracted-package original10 in each actual browser; fresh-install tests | No shared endpoint or synchronization enabled on fresh installation. Team sharing remains opt-in; folder mode is not given a cross-device transaction-lock guarantee. |
| Installable artifacts | Isolated build, four ZIP integrity checks, all66 Web Store runtime files byte-equal to source; original10+picker package checks | Extension and experimental service artifacts are reviewable. Service runs separately under Node24+ or a container, with its SQLite database on local server disk. No brand-specific NAS plugin or automatic network mounting is implied. |
| Privacy and security invariants | ManifestV3/CSP, recorder input exclusions, strict validation/hash/origin/session/cache/admission tests and public scan | Bundled executable code, no developer analytics or remote executable imports, no recorded typed field values, explicitly triggered single-frame screenshots. UI language changes add no permissions or network calls. Sensitive screenshots/notes still require author review. |

## Failure evidence was retained

The previous [run39184422081](https://github.com/monsterkahn/RunningSOP/actions/runs/39184422081) had 12 passing jobs and a macOS team-browser language initialization failure, not a successful matrix. Private connection and language reads completed in different orders. The correction repaints status and captions after the language is applied; a deliberate held-preference regression reproduces the old failure without increasing timeouts. The final macOS log confirms29/29 and the exact formerly failing case passes.

The final Chrome116 package run also exposed a test harness navigating before genuine install onboarding finished. The guided fixture now waits for the actual options page and DOMContentLoaded before creating work tabs; onboarding is still enabled and asserted. The corrected extracted-package original suites pass10/10 in each browser.

Earlier complete-read and publication timeouts, partial Edit provenance, stale revision races, the80-versus100-step mismatch and Windows backup-flush failures are recorded in the linked evidence and design ledger. Their passing replacements are tied to source fingerprints; a verifier finishing is never treated as success if clients remain incomplete.

## What is delivered

The development branch contains the optimizations, isolated reproducible fixtures, regression tests, package tooling and English operations documentation. [Machine-readable final platform evidence](evidence/team-final-cross-platform-2026-10-19.json) records exact source, job IDs/counts and unchanged official asset digests.

The published [official v1.2.0 release](https://github.com/monsterkahn/RunningSOP/releases/tag/v1.2.0) remains available. This development audit does not replace its binaries, merge main, change the submitted Chrome Web Store package or certify the deferred deployment work. A future formal version should package the reviewed development changes under a new version number rather than silently replacing already published v1.2.0 files.
