# Release checklist

Run this checklist from a clean checkout before preparing a public release.

## Verify the source

- Confirm `package.json` and `extension/manifest.json` use the same release version.
- Review the release notes and confirm `PRIVACY.md`, `SECURITY.md`, `LICENSE`, and installation instructions still describe the shipped behavior.
- Check the change set and public scan for real workflows, screenshots, internal hostnames or addresses, credentials, personal paths, and local machine files. Use synthetic examples only.
- Confirm every local extension HTML asset exists and every extension file needed at runtime is included in the extension package. In particular, keep `extension/locale-data.js` in the package.

## Build and inspect

- Run `npm test` and `npm run build` with the supported Node.js version.
- Inspect all three generated archives and use each for its intended path:
  - `running-sop-extension-v<VERSION>.zip` is the developer install package. It contains an `extension/` folder and the user-facing license, privacy, and installation documents. Extract it and choose its `extension/` directory in Chrome's developer-mode loader.
  - `running-sop-github-v<VERSION>.zip` is the source archive. It contains the explicit source allowlist, with no `.DS_Store`, `node_modules`, build output, or old release archives.
  - `running-sop-webstore-v<VERSION>.zip` is only for the Chrome Web Store upload selector. Confirm `manifest.json` is at the ZIP root and that the archive contains only extension runtime files. Do not upload the developer install package by mistake.
- For the complete GitHub distribution, also generate the optional experimental service and versioned media ZIPs; verify `dist/SHA256SUMS.txt` lists all five archives for the current package version and that each checksum matches its archive.
- Load the developer install package's `extension/` directory in Chrome and perform the release smoke check documented in `README.md` before publishing.

## Publish

- Before any Chrome Web Store submission, complete the manual gates in the Web Store dashboard: check the privacy/data-use disclosures against `PRIVACY.md` and actual behavior; review the listing text, screenshots, icons, and support details; use the upload selector to choose `running-sop-webstore-v<VERSION>.zip`; and inspect the selected filename and version. Submission and approval are separate steps; this checklist does not claim the extension was submitted, reviewed, or approved.
- For a GitHub release, attach the current developer install archive, source archive, Web Store upload archive, optional experimental service source, versioned introduction media, and checksum file. Compare uploaded archive checksums with `dist/SHA256SUMS.txt` after upload.
- Do not include real internal SOPs, user data, screenshots, or local `dist/` history in the source repository.
