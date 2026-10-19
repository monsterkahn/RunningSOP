# v1.3.1 installation package review

Recorded 2026-10-19. This is a local installation package, not a GitHub publication or Chrome Web Store submission. Published v1.2.0 assets and prior local packages are preserved.

PayPal initially shows only its logo. Native disclosure activation by pointer, Enter or Space reveals the existing account locally; no external payment or account request is added. The duplicate team collaboration legend is removed while the group remains named by the visible summary. Connect and Disconnect share dimensions and styling; disabled states remain enforced. The v1.3.0 overview and retained history are preserved.

`npm test` passed 190 tests. Ten affected browser scenarios passed on each of Chromium151 and actual Chrome116 on macOS arm64, using the extracted Web Store package. Checks include keyboard disclosure opening/closing, initial account invisibility, single collaboration heading, computed button dimensions/styles, widths320/390/1280, settings languages, folder history, recording/screenshot annotations, team settings and leased publication. Actual packaged screenshots were visually inspected. All70 runtime files match source and ZIP integrity checks passed.

No permissions, storage format or team API changes. Native OS prompts, physical two-device shared storage, native Windows hardware and HTTPS deployment remain outside this local check. See [machine-readable evidence](evidence/settings-1.3.1-2026-10-19.json).
