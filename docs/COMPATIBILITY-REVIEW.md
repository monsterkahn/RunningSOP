# Cross-platform stability review

Reviewed: 2026-10-18. These changes are on `codex/windows-stability`; no published release attachment or store submission is replaced. The manifest minimum remains Chrome 116. This is automated compatibility evidence, not certification for every Windows desktop or old computer.

## Changes

- Discover native catalog identity with `isSameEntry()`, so case-insensitive `SOP` / `sop` aliases do not produce a false multiple-library error. Truly distinct libraries remain ambiguous.
- Keep Git text checkouts at LF on every platform. Windows CRLF conversion had invalidated SHA-256 checks of committed example documents. Include `.gitattributes` in source packages.
- Bound publication reads before allocating content: catalog 512 KiB; document, image and immutable-file verification 4 MiB each. Verify actual byte lengths too, decode text as strict UTF-8, and preserve the catalog on rejection.
- Verify Windows drive and UNC file URL matching, encoded Unicode/spaces, and separation of drives/servers.
- Run the packaged runtime in Windows Server 2022 and 2025 on every push/PR, from a path containing Unicode and spaces. Browser scenarios execute sequentially. Workflow has read-only repository access and no publication action.
- Use per-file copying in isolated browser fixtures instead of Node native recursive copying, which aborted on the Windows Unicode-path run. The upstream Node issue describes a matching failure: https://github.com/nodejs/node/issues/59636. Attribution to that issue is an inference; this workaround is test infrastructure only.
- Restore the work tab to the foreground and explicitly select the annotation tool before pointer input; first-install settings may otherwise steal focus in older browser automation.

## Evidence

Runtime changes were tested from extracted store ZIP files, not only the source directory. All 58 packaged runtime files matched the source bytes; ZIP CRC and root manifest were checked.

| Environment | Core tests | Browser scenarios | Build |
| --- | --- | --- | --- |
| macOS, Chromium 151.0.7922.34 | 115 passed | 10 passed | Passed |
| macOS, Chrome for Testing 116.0.5845.96 | Same core suite above | 10 passed | Same verified runtime |
| Windows Server 2022, Chromium 151.0.7922.34 | 114 passed, 1 skipped | 10 passed | Passed |
| Windows Server 2025, Chromium 151.0.7922.34 | 114 passed, 1 skipped | 10 passed | Passed |
| Ubuntu 24.04 CI | Passed | All existing browser jobs passed | Passed |

Windows runtime evidence: https://github.com/donkimxote/RunningSOP/actions/runs/39087590643
Linux evidence: https://github.com/donkimxote/RunningSOP/actions/runs/39087590641

The Windows skip is the Linux-only Bash release-description test, not an extension scenario. No browser scenarios were skipped. The subsequent foreground-input test adjustment was also verified on both local browser versions; runtime bytes did not change.

## Remaining acceptance work

- Native OS folder and display-capture permission prompts, cancellation and permission restoration. Folder automation substitutes only the picker result with a native OPFS handle; it does not select an actual Windows shared drive.
- Actual Windows 10/11 desktop profiles, old hardware, OS display scaling, managed browser policies and remote-desktop capture behavior. Server VMs are not these devices.
- Two physical devices publishing to a real NAS/SMB share, including disconnects during writes. Existing optimistic conflict/read-back protections are not distributed transactions.
- Interrupted creation can leave an empty catalog or incomplete immutable file. Existing invalid content is rejected; this patch does not automatically overwrite or delete it because another device may be writing. Recovery requires checking the affected file and restoring a verified backup. Do not advertise automatic recovery for this case.

No new permissions, vendor telemetry, remote executable code or runtime dependencies were added. Modern Web Guidance was searched for native file-handle identity and bounded reads; no matching guide applied. Chrome extension guidance and native API compatibility were reviewed.
