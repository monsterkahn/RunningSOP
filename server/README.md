# Experimental team service operations

This is an opt-in coordination service, separate from the extension's existing folder storage. It uses Node.js 24 or newer and built-in SQLite, with no runtime package dependencies. It is an experimental foundation, not a completed public release or a claim that physical LAN, old hardware, operating-system permissions, or production deployment has passed acceptance. See [the design and acceptance record](../docs/TEAM-SERVICE-DESIGN.md).

## Install and start

Obtain this repository on the server computer and install a supported Node.js 24+ runtime. Run commands below from the repository root. No `npm install` is required for the service itself. Keep the database on a local disk of the server computer; clients connect to the service rather than opening SQLite on a shared drive. SQLite's WAL mode [requires processes using the database to be on the same host](https://sqlite.org/wal.html).

On macOS or Linux:

```sh
export SOP_DATA_DIR="$HOME/.running-sop-team"
export ALLOW_ORIGINS="chrome-extension://YOUR_EXTENSION_ID"
node server/cli.cjs
```

On Windows PowerShell:

```powershell
$env:SOP_DATA_DIR = Join-Path $env:USERPROFILE '.running-sop-team'
$env:ALLOW_ORIGINS = 'chrome-extension://YOUR_EXTENSION_ID'
node server/cli.cjs
```

Replace `YOUR_EXTENSION_ID` with the actual 32-letter extension ID, using only letters a–p. Registration is exact; there is no wildcard origin. For multiple approved origins use a comma-separated list. An empty list permits authenticated tools without an Origin header but does not permit browser-origin requests.

The default listener is `127.0.0.1:8787`. The first launch creates `config.json` and prints the generated join code once. Protect that code and the configuration; do not put them in source control or screenshots. `JOIN_CODE` can override the saved code and must contain at least 16 characters. Changing it affects future joins, not existing device sessions. `DB_PATH` optionally selects a different database file; its parent directory must already exist. `HOST` and `PORT` override the listener. Setting `HOST` to a LAN interface is an explicit administrative action.

The HTTP listener does not encrypt traffic. For team use, configure a trusted HTTPS reverse proxy and firewall, keep the backend reachable only by that proxy, and verify certificates on each client. Direct HTTP is for trusted isolated tests. This repository does not automatically configure TLS, DNS, firewall rules, operating-system service registration, or remote access. Proxy access logs can contain private SOP IDs or query strings; configure logging appropriately. The application does not log request contents or device tokens.

Use Ctrl+C to stop an interactive instance. A managed installation should deliver a normal termination signal and wait for exit before starting another process against the same database. Run a single service writer process; process clustering and multiple independent writable replicas are not supported.

## Container option

From the repository root:

```sh
docker compose -f server/compose.yaml up --build -d
docker compose -f server/compose.yaml logs running-sop
docker compose -f server/compose.yaml stop
```

Set `ALLOW_ORIGINS` before starting Compose. The provided configuration publishes the backend only on host loopback and uses a persistent named volume for `/data`. Put an independently configured HTTPS reverse proxy in front of it for team access. Container logs include the first-launch join code; limit access. Do not use `down -v` unless intentionally deleting the data volume. The container definition is supplied for review; a container deployment has not been verified in this development environment.

## Back up a running or stopped service

Create the backup directory beforehand and choose a new filename for every snapshot:

```sh
node server/tools/backup.cjs backup PATH_TO_TEAM_DATABASE PATH_TO_NEW_SNAPSHOT
node server/tools/backup.cjs verify PATH_TO_NEW_SNAPSHOT
```

These commands accept ordinary quoted filesystem paths on Windows, macOS, and Linux. The tool uses the [Node.js SQLite backup API available in Node 24](https://nodejs.org/download/release/v24.0.0/docs/api/sqlite.html#sqlitebackupsourceDb-path-options), so committed data in a live WAL is included. It supports an online source as well as a stopped source. Concurrent writes may restart SQLite's backup work; schedule backups during quieter periods. There is no automated schedule or retention policy.

Before publishing a snapshot, the tool checks SQLite integrity, foreign keys, current revision references, and every stored guide hash. It writes a private temporary file in the destination directory, flushes it, and publishes it with an exclusive hard link. The output is a standalone database file; it needs no WAL or SHM sidecar. The destination directory must permit hard links and have enough free space. Existing destinations and SQLite sidecars are refused. A process killed during backup can leave a private `.sop-backup-*` temporary directory; inspect and remove such abandoned directories only after confirming no backup process is running. A published destination is never deliberately replaced.

Do not copy only a live `team.sqlite` file with filesystem tools: committed records may still be in `team.sqlite-wal`. Keep verified snapshots on independent protected storage, test restoration regularly, and define retention and recovery objectives for your team. Snapshots contain SOPs, screenshots embedded in guides, historical revisions, device-session hashes, and coordination data. They require the same access controls as the live database. POSIX file permissions are restricted; Windows administrators must configure directory ACLs. No encryption at rest or off-site upload is added by this tool.

`config.json` is separate from the database snapshot. Preserve it separately in protected storage if you need the same join code, or configure a new join code for future joins. A normal backup does not revoke existing device sessions.

## Restore to a new path

1. Stop the service, stop client editing, and confirm the old process has exited. Preserve the original database and all its sidecars for investigation.
2. Choose a fresh local directory/path. The restore tool always refuses an existing database or sidecar, including a live database. There is no overwrite switch.
3. Verify and restore:

   ```sh
   node server/tools/backup.cjs verify PATH_TO_SNAPSHOT
   node server/tools/backup.cjs restore PATH_TO_SNAPSHOT PATH_TO_NEW_DATABASE
   node server/tools/backup.cjs verify PATH_TO_NEW_DATABASE
   ```

4. Set `DB_PATH` to the new database path, start one service instance, and have clients reconnect and reload the current revision before editing. Validate representative guides and history before reopening team access. Keep the old database until acceptance and retention requirements are met.

The restore preserves the sessions, revision hashes, history, and fencing state **present in the snapshot**. Writes and fence numbers created after the snapshot cannot be recovered from that snapshot. A historical restore is a rollback of service state; it must be a coordinated maintenance event, not an unnoticed live replacement or a second active server. This tool does not provide point-in-time recovery, automatic failover, or replication.

## Verification evidence and limits

The isolated tests cover a live source with committed WAL records and an incomplete transaction, standalone snapshots, restore/restart, guide hashes, history, sessions, preserved fencing, rejection of corrupt/occupied destinations, and forced worker termination during an incomplete transaction. Run them with:

```sh
node --test server/tests/backup.test.cjs
```

Development checks ran on macOS with Node 26. The implementation uses APIs documented for Node 24, but Windows, Linux, Node 24 execution, filesystem hard-link behavior on alternative storage, actual power loss, disk failure, and container operations require deployment acceptance. A killed-process test demonstrates transaction recovery under that test, not protection against every hardware failure.
