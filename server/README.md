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

Use Ctrl+C to stop an interactive instance. A managed installation should deliver a normal termination signal and wait for exit before starting another process against the same database. A trusted Node parent may launch the CLI with an IPC channel and send `{type:"shutdown"}` for graceful shutdown, including Windows. Parent-channel disconnection also closes the managed service; this adds no HTTP shutdown endpoint. Sending `child.kill("SIGTERM")` on Windows is an abrupt termination and must not be used as a graceful-stop mechanism. See the [Node process documentation](https://nodejs.org/download/release/latest-v24.x/docs/api/child_process.html#subprocesskillsignal).

Run a single service writer process; process clustering and multiple independent writable replicas are not supported.

## Container option

From the repository root:

```sh
docker compose -f server/compose.yaml up --build -d
docker compose -f server/compose.yaml logs running-sop
docker compose -f server/compose.yaml stop
```

Set `ALLOW_ORIGINS` before starting Compose. The provided configuration publishes the backend only on host loopback and uses a persistent named volume for `/data`. Put an independently configured HTTPS reverse proxy in front of it for team access. Container logs include the first-launch join code; limit access. Do not use `down -v` unless intentionally deleting the data volume. The container build and non-root startup passed the GitHub Ubuntu runner check recorded below; native NAS deployment and trusted HTTPS remain deployment acceptance items.

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


## Cross-platform CI checkpoint

The initial experimental CI run on commit `88f047ce8289ef13686b6ca7a2dc52ad39cbd4d8` passed service tests on Ubuntu and macOS (Node 24/26), team browser scenarios on Ubuntu/Windows Server 2022/macOS, and a container build plus non-root startup. Windows service tests exposed a real backup bug: flushing a read-only descriptor fails because [Windows FlushFileBuffers requires write access](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-flushfilebuffers). The snapshot now opens its already-owned temporary file with read/write access before flushing; it does not suppress file-flush errors. A trusted-parent IPC shutdown path handles Windows process management. Slow-response tests now control response completion rather than assuming a fixed TCP-buffer capacity. The fixes passed all six service OS/Node combinations in run [39127823019](https://github.com/monsterkahn/RunningSOP/actions/runs/39127823019) at commit `2810dac7aa0f6c15097b208f8db4f25a5c5911ed`, including Windows Server 2022 with Node 24/26. All three OS browser jobs and container build/non-root startup passed. Earlier failed checks remain failure evidence. This does not establish Windows desktop native prompts, physical NAS, or old-hardware acceptance.

An explicitly generated source distribution is available with `npm run build:team-service`; see [experimental package instructions](../docs/TEAM-SERVICE-PACKAGE.md). It bundles the service and required data-validation modules, not a Node runtime or a production installer.


## Development transfer limits

The development branch adds size-aware time budgets for complete SOP transfers. This is not a change to previously published installation assets. Ordinary headers and small/control request bodies retain their 15-second service deadline. Authenticated create/publish bodies with a known Content-Length over 256 KiB receive `15 seconds + bytes / 64 KiB per second`, capped at 120 seconds, with a separate 15-second idle limit. Chunked/unknown-length bodies and explicit nondefault operator deadlines remain strict. Successful complete-guide replies receive the same bounded size-based service budget; metadata, selected-image and error responses do not. Existing byte/concurrency/admission limits remain in force. GET and OPTIONS endpoints reject unexpected request bodies.

The matching development client budgets a large canonical publication for both upload and its full verified reply, capped at 180 seconds; successful response bodies retain an 8-second idle deadline. These are bounded reference-rate budgets, not guarantees for every network or proxy configuration. A nearly expired edit lease is refreshed before a large first upload if needed. Custom short leases can still expire in transit; stale writes must be rejected. A publication with an uncertain response is never automatically repeated or given a replacement lease: explicit retry preserves the exact original payload and idempotency key, including after a commit has released its lease.

Reproduce ordinary slow transport and lost-confirmation acceptance with `node --test tests/team-slow-publish-browser.cjs`, also included in `npm run test:team-browser`. To exercise a valid near-limit 100-step guide with 148 JPEG images, set `RUNTIME_SOP_MAX_TRANSFER=1` and run `node --test --test-name-pattern="completes through slow" tests/team-slow-publish-browser.cjs`. This optional case takes about two minutes on the tested synthetic 64 KiB/s link. `RUNTIME_SOP_CHROME` may select an actual Chrome 116 executable. Native permission approval is mocked; these simulations do not replace production HTTPS, physical-device or NAS acceptance.
