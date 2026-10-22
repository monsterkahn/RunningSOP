# Running SOP v1.2.0 release review

Date: 2026-10-19. Scope: documentation and automated evidence for the local v1.2.0 candidate. The user explicitly authorized GitHub publication of this version on 2026-10-19. Chrome Web Store submission and production deployment are separate. The user consciously authorized this release while deferring native permission and real two-device acceptance, and HTTPS deployment verification.

## Release summary

Create step-by-step guides with screenshots, follow them beside your work, and share SOPs through a folder you choose.

The existing folder-based library remains the default. This release also provides an optional experimental team service and library. The service requires Node.js 24 or later, runs separately from the extension, and is not contacted by a fresh installation. Its coordination model uses exclusive per-SOP editing leases, revision history, and account/session fencing. Backup and recovery tools operate on the service database. Team ratings stay local and team statistics are not included.

The service listener uses unencrypted HTTP. An administrator must configure a trusted HTTPS reverse proxy before network use. This project's HTTPS deployment has not been verified. Automated evidence below does not establish physical network, native permission, two-device, or production acceptance.

## Automated evidence

| Check | Result | Evidence and limits |
| --- | --- | --- |
| Core tests | 153 passed | Synthetic local tests; no real SOPs or browser profile used. |
| Team-service tests | 44 passed on Node.js 24 and 26 | Includes service API, lock/fence behavior, account isolation, history and backup/recovery cases. |
| Browser scenarios | 14 passed on Chrome 116; 14 passed on the current tested Chromium | Isolated test profiles and synthetic data. Browser automation does not exercise native operating-system permission prompts or real two-device access. |
| Team-service CI | All 10 team OS jobs passed in [run 39128728309](https://github.com/donkimxote/RunningSOP/actions/runs/39128728309) | Runtime commit `fb70640f689e00c801d4d86c45fda36444119445`; includes Node 24/26 service checks, browser scenarios, extracted-package startup, and container startup in the listed runners. These results do not verify an HTTPS deployment or physical NAS. |
| Windows package checks | Both passed in [run 39128728341](https://github.com/donkimxote/RunningSOP/actions/runs/39128728341) | Automated package checks on Windows runners; not acceptance on every Windows desktop or older computer. |

The release workflow will rerun its configured checks for the release commit. A result from a different commit or workflow is not represented as that release run.

## Known limits and deferred acceptance

- Native Chrome and operating-system folder, screen-sharing, and permission-renewal prompts have not been accepted manually.
- Shared-library and team-service behavior across two real devices has not been accepted. Automated concurrency tests do not establish real network filesystem or LAN behavior.
- HTTPS reverse-proxy setup, certificate verification, firewalling, and deployment operation have not been verified for this project. The built-in service listener is unencrypted HTTP; do not expose it directly to an untrusted network.
- No claim is made for every old computer, operating system, or Chrome build. Chrome 116 is the declared minimum; passing tests at Chrome 116 and the current tested version does not establish hardware performance or Google certification.
- The experimental service has no built-in team ratings/statistics feature. Team ratings stay local. Existing folder-mode statistics settings from older installations remain a distinct, explicitly enabled legacy behavior.
- The v1.2.0 Web Store ZIP is a package artifact only. This review does not submit it or claim Chrome Web Store approval.

See [team-service operations](../server/README.md), [the team-service design and acceptance ledger](TEAM-SERVICE-DESIGN.md), [privacy notice](../PRIVACY.md), and [Chrome Web Store metadata](../CHROMEWEBSTORE.md) for additional boundaries.

## Local candidate package inspection

The exact v1.2.0 Web Store runtime ZIP was extracted into an isolated verification directory and tested in current Chromium and actual Chrome 116: each passed all 14 existing/team/picker browser scenarios. The packaged manifest reports version 1.2.0, minimum Chrome 116, and the exact user-requested English summary (118 characters). All five ZIPs passed ZIP integrity and SHA256 verification. Introduction screenshots are 1280×800 RGB PNGs; promotional exports are 440×280, 1400×560 and 1280×640 RGB PNGs, with the transparent 128×128 icon provided separately. These are local candidate results, not a v1.2.0 GitHub CI run or a store submission.

The 2026-10-19 local candidate includes the saved-service chooser. Five pure metadata tests and the real browser case cover credential exclusion, invalid imports, normalized URL deduplication, CRUD, capacity, concurrent IndexedDB writes from two instances, cancel/Escape, literal text rendering, seven languages and 390px layout. Selection and address management perform no HTTP request and preserve the active session. The user gave explicit publication confirmation on 2026-10-19; the release pipeline must pass before publication.
