# Historical internal release review · 2026-10-16

Internal development identifier: 2.5.13. Public releases use the separately assigned release version.

Automated checks: 68 core tests, 5 isolated Chrome flows, 52 JavaScript syntax checks, 24 localized-status assertions. Screenshot review covered 320/390 px panels, a 1280 px desktop settings page, six languages and light/dark reading.

Fixed published-image edit failure; content/image/statistics readback integrity; catalog-source and revision concurrency; screenshot isolation and session authorization; annotation target identity; editable-descendant label leakage; untitled-step selection; dynamic status localization.

Remaining manual gates: real Chrome screen chooser, native folder permissions, existing-profile upgrade with backup, real shared-storage two-device check, and store disclosures/review. The file-based shared folder does not provide distributed transactions; coordinate simultaneous edits. No GitHub upload, store submission or review approval was performed.

See [release checklist](RELEASE-CHECKLIST.md).
