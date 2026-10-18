# Team service: design and acceptance ledger

Status: experimental development, not a published product release. The user revised the planning workload on 2026-10-18: approximately 500 people in an organization, about 500 active SOPs, and an assumed 15% novice population (75 people). Use 75 simultaneous readers as the primary burst test, not as a measured concurrency value or an enforced product cap. Existing folder mode remains the default. The earlier 200,000-SOP/500-connection results remain historical stress evidence; they are no longer the primary acceptance workload. A working foundation alone is not completion.

## Decision process

1. Form a hypothesis and specify failure conditions before testing.
2. Implement the smallest useful end-to-end behavior that advances the full target.
3. Verify it independently through unit, HTTP, multi-process, browser and load tests.
4. Record limitations and resource usage, not just successful response counts.
5. Revise the design when evidence contradicts a hypothesis. Do not raise limits to hide errors or silently narrow the workload.

## Initial architecture hypothesis

One service owns a local transactional SQLite database, exposed through a versioned HTTP API. Clients never mount or open that database. WAL, full durability and indexed queries are initial choices to test, not claims that every NAS meets the target. SQLite WAL requires same-host storage; a network-mounted database is unsupported. A NAS can host the service and its local data volume, or an ordinary computer can host it. Deployment must not depend on a NAS brand.

Reference: https://sqlite.org/wal.html and https://sqlite.org/useovernet.html.

Published guide revisions and their images are transactional in the same database. The asset layout introduced in schema 4 stores decoded images once by SHA-256 and keeps immutable references in revision envelopes, reconstructing the original canonical API guide and checking its hash on read. Legacy inline revisions remain readable without a startup rewrite. This gives consistent backups and avoids repeating images across history; it does not yet provide independently streamed network images. Large-image transfer memory and overload behavior require separate verification. The public API must not expose physical database/file paths.

Classification is metadata, separate from stable SOP identity and work-address matching. Moving a category must not break an SOP reference. Large-library listing uses bounded keyset pagination; title search must use an index, including Chinese two-character searches. Shared categories have stable IDs, paged metadata, eight-level cycle-checked hierarchies, colors/icons, optimistic updates and an audit trail. The opt-in team library now exposes creation, changes, safe deletion and SOP assignment. SOP category changes use a separate revision and do not alter content identity or consume the editing lease. The initial category cap is 500; bulk migration and larger hierarchies still require evaluation. Tags were considered and deferred for the revised 500-SOP workload; they are not a required feature.

## Coordination invariants

- One live editing lease per SOP; other users can read the published revision.
- Every lease has an unguessable token and a monotonically increasing fencing number. Release, renewal and publication check actor, token, fence, expiry and base revision transactionally.
- Disconnection never grants publication permission. The local draft remains editable for recovery, but cannot overwrite a successor's published revision.
- Publishing the same request again after losing its response returns the original result. Reusing its idempotency key for different content fails.
- Historical published revisions remain readable. An edit does not alter the published view until successful commit.
- Server time and lease duration accompany leases; client clock settings cannot be trusted for lease safety. The server is authoritative at publication time.
- Sharing is opt-in. A first installation sends nothing to any team service. Joining uses a user-provided service address and join code, then a device session. No additional per-SOP permission model is implied.
- Tokens and join codes are never included in URLs or request logs. HTTP is for isolated tests; LAN credentials require a trusted HTTPS deployment before field acceptance.

## Required evidence

| Requirement | Evidence required before completion | Current state |
| --- | --- | --- |
| Primary catalog: about 500 active SOPs | Matching, classification, pagination, realistic steps/issues/images; count historical revisions separately | 500-SOP/75-client fixture passes; realistic taxonomy/UX pending |
| 500-person organization, 75-reader planning burst | Separate-process requests with 75 independent identities and sockets; retain prior 500-client stress evidence | 75-reader text/image workloads pass with bounded read retries; field concurrency unmeasured |
| Reliable editing lock | Competing clients, expiry/takeover, stale release, lost-response retry and restart tests | Foundation tests |
| Mixed client versions | Protocol negotiation, unsupported-version failures and data migration tests | Foundation tests |
| Chrome 116 and current | Real extension connection, reading, editing, publication and recovery in both browsers | Pending integration |
| Windows/macOS/Linux | Service tests and actual packaged extension flows on OS matrix | macOS Node 24/26 verified; new OS/container CI defined but not run |
| Classification at scale | Category CRUD, movement, stable IDs and indexed filters | Store/API and real-service library UI verified; aggregate counts and bulk operations remain optional evaluation |
| UI understandable | Compact settings, owner/busy status, reconnect and preserved drafts; seven UI languages | In progress |
| Storage efficiency | Separate assets, immutable revisions, integrity checks, measured large-image memory | Pending |
| Recovery | Consistent backup/restore, migration rollback, interrupted publication and process termination | Verified snapshot/restore, live WAL and killed-process tests; browser recovery in progress |
| Installation | Versioned service artifacts, container/desktop instructions, clean-start and upgrade tests | In progress |
| Existing folder mode | Existing core/browser tests remain green with team mode disabled | 144 core tests and 12 browser scenarios each on current Chromium and Chrome 116 pass |
| Privacy/security | Least privilege, bounded input/cache, trusted origins, sessions, no remote execution or vendor telemetry | In progress |
| Real deployments | Native permission dialogs, representative hardware, HTTPS/NAS/SMB and two-device checks | Not yet verified |

## Initial workload specification

Use synthetic data and temporary databases only. Start with 200,000 distinct SOP records, indexed work addresses and mixed-script titles. Record seeding time, database size, process memory, latency percentiles, response sizes and unexpected failures. Run 500 independent authenticated clients against a separate service process, including exact matching, selective and broad searches, listing, reads, competing locks and publication. A synthetic one-step fixture tests catalog scale, not the storage footprint of 200,000 image-heavy workflows; test larger guides separately.

Initial experimental acceptance targets: zero lost/incorrect publications; exactly one winner for a contested live lease; stale writers always rejected; bounded response/page/cache sizes; no unbounded accumulation under overload. Target p95 below one second on the recorded reference machine for indexed matching and selective reads; broad search and sustained editing require separate results. These are proposed engineering thresholds, not measured LAN guarantees.

Further development and external release are separate. Successful local tests do not establish native authorization, physical hardware or production readiness.

## Measured iteration — 2026-10-18

These are local synthetic experiments on macOS/arm64, Node 26; they are not physical LAN or older-hardware certification. Generated full JSON reports stay in ignored `dist/`.

- Initial 200,000 one-step SOP / 500-user workload using a 32-socket pool passed correctness checks, but broad Chinese substring search had p95 **76,224 ms**. FTS retrieval followed by sorting nearly the entire matching library blocked the service. This invalidated the initial search design.
- The revised query uses indexed recent-order candidates for common terms and retains the complete FTS fallback whenever the bounded window cannot prove the exact first page. A bounded term-frequency cache is invalidated on local or external database writes. A regression compares ordering and pagination, including rare phrases whose individual bigrams are common.
- Under the same 32-socket workload, broad search p95 became **113 ms**. No page result cap was reduced to achieve it. Source report: `dist/team-scale-optimized-pooled.json`.
- A separate run established **500 independent sockets** in explicit batches of 32, then sent 500 simultaneous requests per phase. Match p95: **16.4 ms**; read: **17.1 ms**; selective title search: **354 ms**; broad search: **107 ms**; publication: **2,771 ms**. All 500 independent publications reached revision 2; one contested lease had exactly one winner. A further **10,000 reads** passed, p95 **27.9 ms**. End-of-run RSS was **87,474,176 bytes**, not a peak-memory claim. Source report: `dist/team-scale-final.json`. Later schema/image changes must be rerun before final acceptance.
- A cold burst of 500 brand-new sockets failed on this host. An independent minimal HTTP server reproduced 129 successes and 371 connection resets; the host accept-queue limit is 128 even when the application requests a larger backlog. No host setting was changed. Gradual connection establishment is recorded explicitly, not hidden as a retry or counted as cold-burst success.
- A second reset cause was application-owned: contention responses discarded unread lock-request bodies and closed connections. Consuming the bounded body keeps those normal conflicts reusable; its socket regression passes. Valid device traffic is now rate-limited per actor rather than sharing an anonymous IP allowance, so a NAT/proxy does not aggregate 500 users into one normal-use budget.
- New snapshots include committed WAL data, exclude incomplete transactions, verify revision/asset integrity, and refuse existing restore destinations. Forced process termination tests prove the tested rollback/restart behavior, not every power-loss or storage failure.
- A synthetic ten-version example reusing a 60,000-byte image twice per revision reduced revision/image payload from **1,605,141 bytes** to **66,781 bytes**. This excludes SQLite pages/WAL and is not a whole-production-library compression claim.

The next acceptance work remains image-heavy traffic, real extension/server recovery, OS/container execution, integrated classification, installation artifacts and representative physical deployments. No new official version has been published by this work.

## Follow-up verification — image traffic and recovery

The second pass found another scale defect: replacing URL matches during publication lacked an index on workflow ID. Schema 5 adds `matches_workflow`; the 200,000-record run then reduced 500-publish p95 from roughly 2.8 seconds to 148 ms. Deep listing now seeks the equal-time and older-time index ranges separately rather than scanning all records before a mixed-order cursor. Schema 6 records canonical response size so full-guide admission happens **before** image reconstruction. The HTTP layer also retains connection reuse for bodyless GET failures and bounds slow-response lifetime.

Current reference evidence is recorded as JSON under `docs/evidence/`, with source file fingerprints and explicit synthetic-workload limits:

- `team-scale-local-2026-10-18.json`: schema 6, 200,000 records, 500 independent connections, 500 publications, deep pagination and 10,000 follow-up reads. No unexpected failures. Publication p95 137 ms, deep page p95 55 ms, broad search p95 113 ms.
- `team-image-read-local-2026-10-18.json`: a 12-image guide around 3 MiB, 500 consuming readers. Without retries only 10 completed immediately; admission rejected 490 rather than reconstructing and queuing every full guide. A benchmark retry phase completed all 500. The final phase ran the **actual extension client**, verifying canonical data and hashes with its cache disabled: all 500 completed in 9.84 seconds, with 625 intermediate 503 responses and no terminal failures. This phase uses a streaming Node HTTP adapter over per-reader sockets, not 500 real browsers. The separate service process used a 256 MiB heap limit; observed RSS peaked around 341 MiB, which is not a promise for smaller NAS devices.

Authenticated GETs and matching requests retry only transient connection loss or explicit service-busy responses, with jitter, cancellation, a maximum attempt count and a total scheduling budget. Publications, new SOP creation and editing-lock actions never retry automatically. Permissions, malformed content, hash failures and conflicts do not enter the retry path. This handles measured overload but does not replace a smaller reading protocol: currently the wire response still includes the whole guide and its images. Network image loading by visible step remains pending.

Real HTTP browser tests now cover settings connection, matching, reading, exclusive editing and publication; a commit followed by a deliberately dropped response, panel reload and private durable replay; and changing accounts at the same server without reusing the previous edit session. These pass in current Chromium and Chrome 116. The native host-permission prompt is mocked in automation and remains a separate acceptance item. Team-mode feedback is currently retained locally and does not silently write to a previously configured folder statistics target; a dedicated team statistics protocol/dashboard still requires implementation.

Final local checks for this checkpoint: 144 core tests; 42 service tests on Node 26 and Node 24.22.0; 10 existing plus 2 team browser scenarios on each of Chromium 151 and Chrome 116; build and ZIP content inspection. OS/container CI and physical deployment remain unverified.

## User workload revision — 2026-10-18

The user described roughly 100 business steps from lead to cash, two or three issue cases per step, reusable common procedures, and approximately 500 SOPs as a practical planning ceiling. These are planning assumptions, not organization-wide measured limits. An issue case remains part of its parent SOP/step; it does not become a separate SOP merely to fill a directory. A full procedure can contain multiple steps. Reusable procedures should have stable references rather than copies for every department.

500 people × 15% = 75 potential novice users. This calculation does **not** establish simultaneous requests, simultaneous editors, or an upper bound on experienced-user access. The primary stress scenario is now a conservative 75-reader burst. Keep the application free of a hard 500-SOP or 75-user cap. Maintain separate published, draft, archived and historical-revision counts.

Reproduce the revised workloads:

```sh
node server/tools/scale.cjs --sops 500 --clients 75 --out dist/team-scale-500-sops-75-readers.json
node server/tools/real-large-read.cjs --clients 75 --out dist/team-images-75-readers.json
```

These are also the new load-tool defaults. Explicit `--sops 200000 --clients 500` and `--clients 500` retain the earlier stress experiments; old results are not replaced or presented as the current workload.

The local primary run passed all matching, reading, listing, search, lock-contention and publication checks: read p95 5.3 ms, broad search p95 29 ms, publication p95 20 ms, with 1,500 additional successful reads. The actual extension-client phase completed all 75 image-heavy reads (approximately 3 MiB each) in 3.34 seconds with bounded retries and zero terminal failures. Immediate requests still encountered explicit capacity responses; this is eventual completion, not a claim that every initial request succeeded. The machine, loopback transport and synthetic images remain limitations.

Design priority now shifts toward finding the correct procedure, readable issue branches, clear ownership/classification, reliable exclusive editing, version recovery, and straightforward cross-platform installation. Preserve the existing bounded queries, lease safety, hashes and backup checks. Do not add clustering, distributed databases, an external search service, or a complex deployment stack to satisfy an obsolete workload. Image-on-demand remains a potential UX improvement; assess it against this primary workload and real network measurements rather than treating the former extreme burst as the only success criterion.

## Team-library and bounded-recovery checkpoint — 2026-10-18

Added the opt-in team library described in `TEAM-LIBRARY.md`. It keeps sidebar recording controls unchanged and supplies a separate management view for the connected service. Categories and metadata are bounded; full bodies are fetched only after a procedure is chosen. An explicit uncategorized filter is distinct from all categories, including cursor/search combinations. Historical published guides remain read-only and preserve annotations.

Long-guide thumbnail decoding is deferred with IntersectionObserver and a two-job queue, with a lightweight immediate-queue fallback. This does not yet solve whole-guide wire payloads. Account changes abort requests and clear old metadata, guide content and any open screenshot dialog. Private uncertain publications now have count/byte bounds and exact-draft cleanup after confirmed local deletion; no potentially racy automatic orphan sweep was added.

See `tests/team-library-browser.cjs` and `tests/team-workspace-browser.cjs` for real HTTP scenarios. The new OS/container workflow is being prepared for execution on the isolated development branch; do not treat its definition as passing evidence.
