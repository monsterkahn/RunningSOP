# Experimental team service package

Run `npm run build:team-service` to create an opt-in, dependency-free source ZIP in the ignored `dist/` directory. Its name uses the current formal extension package version followed by `-experimental`; a neighboring `.sha256` file records the ZIP checksum.

The archive contains the server runtime, the shared validation and image modules it imports, the service README, Dockerfile, Compose file, and the root MIT license. The explicit file allowlist excludes tests, development tools other than the documented backup utility, local configuration, databases, and generated output. It bundles no Node.js executable or third-party runtime packages.

This package is an experimental source distribution. Its existence does not establish operating-system, container, network, security, or production acceptance. Follow `server/README.md` and the acceptance record in `docs/TEAM-SERVICE-DESIGN.md` before evaluating deployment.
