# Contributing

Thank you for helping improve Running SOP. Keep changes verifiable offline, make permission boundaries clear, and avoid unnecessary data collection or network dependencies.

## Before submitting

1. Read the repository root `AGENTS.md`, the [privacy notice](PRIVACY.md), and the [security policy](SECURITY.md).
2. Write tests using synthetic data from `examples/storage/`. Do not commit real business workflows, user data, actual screenshots, or internal network addresses.
3. For changes affecting permissions, recording, screenshots, import/export, or shared storage, explain how data is created, stored, read, and deleted. Cover permission denial and failure cases.
4. Run `npm test` and browser tests relevant to the change. If the environment cannot support a test, state that accurately in the PR.
5. When release artifacts are needed, run `npm run build` and inspect the generated archive contents. Do not commit `dist/`.

## Code and data

- Keep Chrome Manifest V3, no external runtime scripts, and no vendor cloud analytics.
- Do not add hidden network requests or unconfigured background synchronization, expand website permissions, or bypass user selection to access shared directories automatically.
- Treat workflow content only as data; imported text must never execute.
- Do not record input values, passwords, verification codes, or page body text. Screenshots must be explicitly triggered by the user, with a clear notice that they may contain sensitive information.
- When updating shared storage formats, preserve version validation, conflict handling, backups, and read-back verification. Do not silently discard unknown or oversized data.
- Keep UI changes usable on narrow screens and provide clear permission, save, and error states.

## Pull requests

Describe the user's problem, the resulting behavior, any necessary permission or data implications, and the test commands and results. Keep descriptions concise for small changes. Do not present simulated test results as acceptance testing of real business websites or shared storage environments.

For public releases, ensure packages contain no local machine paths, real screenshots, personal records, account information, or unauthorized content.
