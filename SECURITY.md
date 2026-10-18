# Security policy

## Security boundaries

Running SOP is a local-first Chrome Manifest V3 extension. Workflow matching primarily uses the active tab URL. Recording reads text/`aria-label` from controls the user clicks, associated label text, active dialog or tab titles, page titles, and sanitized URLs, without reading input values. Website access permissions are requested as needed. Screenshots, manually entered URLs and notes, URL paths, and shared-directory content may contain sensitive information.

The extension should read or write only shared directories explicitly selected by the user. Workflow content is data and must not be loaded as executable scripts or remote code. Do not post personal information, real business workflows, access credentials, complete browser profiles, or unsanitized screenshots in issues, discussions, or public test reports.

## Reporting security issues

Do not disclose unfixed vulnerabilities in public issues. Send reproduction steps, scope of impact, affected versions, and safe test samples to [gwangphug@gmail.com](mailto:gwangphug@gmail.com), with the subject “Running SOP security report”. Remove or replace any real user data before sending.

The maintainer will assess reports and coordinate remediation and disclosure timing by email. This mailbox is not a round-the-clock response service. Avoid publishing exploitation details before an issue is confirmed and fixed.

## User security recommendations

- Download only from the project's GitHub Releases and review the release notes.
- Grant only the website and folder access needed for the current task.
- Before using a shared directory, confirm that its access controls meet your organization's requirements.
- Check screenshots, notes, exported files, and diagnostic information for personal or business data before sharing them.

## Release verification limits

The earlier isolated browser regressions documented in the [release review](docs/RELEASE-REVIEW-2.5.13.md) cover screenshot origin isolation, tab-session binding, preservation of existing step annotations, and exclusion of nested editable content from recorded control names. Closing a screenshot does not close the work tab. Temporary data is not written to the public webpage DOM.

Shared directories use file-level validation and optimistic conflict detection, without cross-device transaction locks. Multiple people editing the same SOP or categories should still work sequentially. Statistics or local step state must not be treated as actual approval outcomes. Native screenshot/folder permissions, organizational shared-drive permissions, and Chrome Web Store review require manual acceptance checks according to the release checklist.
