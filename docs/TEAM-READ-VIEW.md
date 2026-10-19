# Experimental separate-image reading

Development work after the published v1.2.0 baseline. These interfaces and capability-gated reading in both the team library and work-page side panel are implemented in the development branch. **Editing still requires complete, canonical guides**. No new release is implied, and the published v1.2.0 assets remain unchanged. The SDK benchmark below is not a measurement of many concurrent browser UIs.

## Compatibility and boundaries

Protocol 1 and database schema 6 remain unchanged. Existing complete-guide reads, publication, leases, backup and history retain their formats. New services advertise `read-view-images` in `/v1/capabilities`; old services do not. The team library negotiates that feature on its first explicit SOP read; the configured side panel negotiates it on its first matching team read. Both retain complete reads for old services. A failure or corrupt response from a service advertising the feature must not silently bypass verification through a different route.

`TeamClient.readView(id, options)` and `readImage(id, reference, options)` are explicit, read-only additions. They do not connect on construction, add permissions, fetch arbitrary URLs, populate the complete-guide offline cache, or modify SOPs. A partial view is never a valid publication draft. Editing and full archival verification must continue through the complete-guide path.

## Requests

All requests require a device session and `X-Running-SOP-Protocol: 1`, with the same origin/rate/admission controls as existing SOP reads. Tokens remain in the Authorization header, never in image URLs.

- `GET /v1/sops/:id/view`: current published revision. Optional `?revision=N` selects a historical revision.
- `GET /v1/sops/:id/images/:step?revision=N`: one step image.
- `GET /v1/sops/:id/images/:step/issues/:issue?revision=N`: one issue image.

Image requests require an exact positive revision. Step and issue indices are zero-based and bounded by the current guide schema. There is no global asset-hash endpoint. Bodies remain bounded JSON with validated JPEG data URLs, not executable resources or external image URLs.

A view returns the SOP identity, revision, original full-guide `sha256`, stripped `guide`, `images` descriptors and `viewSha256`. Each descriptor specifies `step`, optional `issue`, the SHA-256 of the **exact image data-URL string**, and optional image time/annotations. The stripped guide contains text and structure without image bytes, image timestamps or annotation arrays. Those latter fields belong to the corresponding descriptor. `viewSha256` covers exactly `JSON.stringify({guide, images})`.

The server constructs each view from a fully reconstructed, canonical, hash-verified revision before stripping images. The SDK validates the stripped guide, descriptor positions, uniqueness and annotation schemas, then checks the view hash. This is a derived read view, not a claim that the stripped guide itself has the original full-guide hash. Hashes are integrity checks, not authentication signatures; a trusted HTTPS deployment remains necessary outside isolated testing.

Selective image reads verify only the chosen compact reference, decoded asset bytes, size, suffix encoding and digest; legacy inline revisions use full reconstruction as a fallback. They do not reconstruct every other image. Therefore the SDK **must compare the returned exact image hash against the descriptor from its verified view**, in addition to checking identity, exact revision, slot and JPEG data. This rejects an otherwise valid replacement asset reference that does not match the selected manifest. Full-guide hashes remain authoritative for complete reads and editing.

Admission currently uses the full revision's conservative response estimate before reconstruction. This preserves the existing safety gate but can reject a small individual image while other requests occupy the budget. No admission limits were raised. View creation still reconstructs all images on the server; its CPU/reconstruction cost has not been removed.

## Measured comparison

Run `node server/tools/read-view-load.cjs --clients 75 --out dist/team-read-view-load.json` with Node 24 or later. It uses separate temporary fixture processes for each mode, warmed independent sockets, actual extension-client validation and no read cache. Images are synthetic JPEG-shaped bytes, not photographs. All readers must finish successfully. A text-view phase must issue zero image requests before explicit selection.

The 2026-10-19 macOS/arm64 Node 26 experiment is recorded in `evidence/team-read-view-75-readers-2026-10-19.json` with source fingerprints:

| Work per reader | Total HTTP body bytes, 75 readers | Completion time | Sampled server peak RSS |
| --- | ---: | ---: | ---: |
| Complete guide, all 12 images | 236,133,810 | 3.54 s | 269,959,168 bytes |
| Text view, then one selected image | 19,924,437 | 1.08 s | 190,758,912 bytes |

The second mode transferred about 91.6% fewer bytes because it fetched one image rather than twelve. Its text phase alone transferred 251,475 bytes across all 75 readers and took about 1.03 seconds. There were 93 intermediate busy responses in the complete mode and none in the view mode during this experiment. This is not an equal-all-images speed comparison, a LAN guarantee, or proof for older machines. Peak RSS is sampled, not a universal upper bound. Browser rendering and decoding are absent from the load generator.

Real Chrome extension tests separately cover authenticated current/historical views, selecting step/issue images and rendering historical annotations in current Chromium and Chrome 116. Native permission approval is mocked; physical devices, production TLS and NAS deployment remain outside these tests.

## Next acceptance work

The development library now negotiates capabilities and uses a two-job image fetch/decode queue. IntersectionObserver starts nearby thumbnails; without it, a bounded immediate queue loads open content. Closed issue sections wait until expanded in both paths. Preview clicks reuse verified thumbnails. Switching SOP, revision or account aborts old reads and closes old previews. Decoding happens in a detached container, with a persisted account recheck before nodes enter the page. Advertised corrupt views fail without a full-read fallback.

The side-panel now uses the same capability boundary for reading. Before editing a team SOP, it fetches the full guide, compares its revision and original canonical hash with the reading identity, and copies that complete result into the local draft. Existing lease acquisition rechecks the current revision. A partial view cannot become a publication draft, including during refresh or screenshot-viewer navigation. The new browser tests inspect actual UI network routes and concurrency, but do not replace multi-browser load or physical-network measurements. Server-side manifest reconstruction remains a separate optimization candidate if measured CPU or memory warrants it.

Checkpoint validation: 157 core tests and 46 service tests passed. All five affected team-browser scenarios passed on each of current Chromium and actual Chrome 116, including the new read-view/render scenario. The standalone new scenario was also run before the combined suite. These are local development results; no new cross-platform CI run or release is claimed for these changes.


## Library UI acceptance — 2026-10-19

The development library now exercises these endpoints through its normal reading UI. The source-fingerprinted record is `evidence/team-library-images-ui-2026-10-19.json`: 157 core tests passed, and all 11 affected team-browser scenarios passed in both Chromium 151.0.7922.34 and actual Chrome 116.0.5845.96. New scenarios assert actual route selection, a two-request maximum, closed-issue deferral, no-observer fallback, historical annotations, preview reuse, cancellation, corrupt-view rejection and private-account changes during decoding.

An independent regression experiment copied the extension into a temporary directory and restored unsafe direct-to-live thumbnail decoding without the postdecode persisted-identity check. The same regression failed with exit 1. The repaired implementation passed; no mutation was made to the working runtime or published assets. Tests coordinate the browser's native first-install options tab rather than racing it with a second navigation. These checks do not prove physical deployment acceptance or many concurrent browser UIs.


## Sidebar reading and edit boundary — 2026-10-19

The sidebar requests a verified view only when the connected service advertises the feature. It fetches nearby images only for steps matching the current work address, with a two-job queue. An issue image is requested only after its branch is chosen; the current article reuses at most one picture holder per issue slot instead of retaining a new detached figure on each selection. Without IntersectionObserver, the same bounded queue loads eligible content. Reading does not modify category assignment, leases, publication or statistics.

Work address, tab, SOP and account changes cancel obsolete image jobs. Decode occurs in detached staging, then the persisted team identity is checked before pixels are inserted. Enlarged screenshot viewing accepts an optional cancellation/identity guard around native access, session storage, overlay mounting and sidebar fallback; legacy unguarded viewing/editing remains compatible. Cancellation applies to the matching guarded view, not every screenshot in the extension.

Refresh keeps the provenance of a displayed partial view until it can atomically clear both content and identity. Edit independently rejects a team source without matching loaded identity, and uses the newly fetched complete guide rather than cloning the stripped display guide. Tests cover a held tab lookup and the screenshot-viewer early-return path. A changed server revision stops Edit without creating a partial draft; unseen step and issue images remain present when editing is allowed.

The new sidebar browser scenarios inspect real HTTP request routes, response validation, full-draft image preservation, cancellation and repeated issue selections. They do not establish many-browser throughput, a production deployment or older hardware performance. No published assets or store submission were changed.


## Released-version interoperation and slow transport — 2026-10-19

`tests/team-release-interop-browser.cjs` uses the actual independently verified official v1.2.0 source archive, rather than simulating an older service. Six scenarios passed in each of current Chromium and Chrome 116: all four released/development extension/service combinations plus competing old/new SDK lease acquisition on each server. Reading renders annotations; Edit retains unseen issue and other-address images; leased publication produces an exact revision-2 guide and SHA-256 independently reread by the opposite SDK. Exactly one competing editor acquires a lease. These tests require `RUNTIME_SOP_RELEASE_ROOT` to point at an independently verified extracted official source archive and never download it automatically. Run `node --test tests/team-release-interop-browser.cjs` with that environment variable; optionally set `RUNTIME_SOP_CHROME` to a Chrome 116 executable.

The side-panel suite exercises actual browser CDP transport throttling with no response interception, SDK timeout override or substituted capabilities. At 64 KiB/s in each direction and 120 ms minimum response latency, the 24-step/26-image full guide hit the unchanged 8-second read deadline. The verified text view plus one selected image completed in about 0.81 seconds on current Chromium and 0.82 seconds on Chrome 116. These are different image coverage, not an all-images speed comparison. Browser simulation is not a real LAN, older hardware or many-browser load result.

Offline publication preserved the entire edited draft, including unseen images. Restoring the network did not publish; an explicit retry created exactly one new matching revision and released its lease. The stronger 2.5-second restored-network observation was rerun separately, passing on both browsers. Current checks: 162 core tests and all 26 team-browser scenarios per browser, plus six interoperability scenarios per browser. Evidence and fingerprints: `evidence/team-interop-network-2026-10-19.json`. No runtime, public package, schema or protocol changes were made in this checkpoint.

**Remaining actionable gap:** opening a complete image-heavy guide for editing on a slow link can still time out. Selected-image reading does not fix that path. Next evaluate separate bounded connection/stall and total-transfer deadlines for complete authenticated reads, preserving body-size limits, cancellation/account fencing and no automatic write retry. Verify a progressing slow stream separately from a stalled/never-ending response. Do not globally lengthen every timeout or treat partial reading views as editable complete guides.


## Progressing complete reads — 2026-10-19

The slow-read gap above is fixed in the development SDK. Successful authenticated `getSop` responses now keep an 8-second connection/idle deadline and a separate 120-second absolute deadline per attempt. Valid successful headers and nonempty response chunks reset only the idle timer. Metadata, image/view reads, anonymous requests, error bodies and mutations retain their original total deadline. Timeouts do not automatically retry; mutation retry/idempotency rules, body-size limits and canonical hash validation remain unchanged. Every request aborts its remaining response on exit. Cancellation is checked again after asynchronous full-guide hashing and before complete-cache insertion.

Real HTTP-stream tests distinguish continued progress, a stalled response/headers, unlimited dribbling, explicit cancellation, corrupt hashes, anonymous/authenticated metadata/error/write deadlines and configuration limits. A scaled fixture guard ensures a broken timeout implementation cannot leave the test process running indefinitely. A temporary complete extension copy restored the pre-fix SDK; the progress and hash-cancellation regressions both failed for their intended reasons. All 27 SDK tests pass with the fix.

The same actual-browser slow-link fixture (64 KiB/s each direction, 120 ms latency) now verifies all 24 step images and both unseen issue images through complete Edit. Current Chromium full read: 11.22 seconds; Chrome 116: 11.24 seconds. Text plus one selected image remains about 0.80/0.83 seconds. Complete Edit takes about 23 seconds because its initial copy and lock setup currently download two complete guides. Reducing that duplicate transfer is a separate measured opportunity, with lease base-revision/identity checks preserved. These timings are one synthetic workload, not physical LAN guarantees or equivalent-all-images speed comparisons.

Evidence: `evidence/team-progressive-read-2026-10-19.json`. Core170/service46 passed. Current Chromium and actual Chrome116 each passed team26, original-browser10 and real released/development interoperability6 scenarios. Isolated build and ZIP inspection passed; all 66 Web Store runtime entries match current runtime bytes. No published assets or store submission changed. Remote cross-platform checks must be refreshed for this runtime. The slow-read test does not prove slow large publication succeeds; mutation timing remains unchanged and should be measured separately.


## Reusing one canonical Edit read — 2026-10-19

Fresh Edit now passes its just-fetched, fully verified canonical SDK result into lease setup, removing a second identical full-guide transfer. The result stays within that single Edit operation; it is neither a partial reading view nor a persisted/shared cache. Lease setup rechecks the persisted account/target, workflow ID, revision and canonical hash. Its real acquired lease must still have the same base revision; a publication racing the initial copy rejects Edit, releases the acquired lease and leaves the complete local draft intact. Reopening a saved draft without a fresh complete result still reads the service anew.

The real browser suite asserts exactly one full Edit read. A new race publishes a newer revision immediately before the real lease request: stale Edit is rejected in both browsers. In a temporary complete runtime copy, removing only that lease-base comparison makes the same regression fail because the old Edit opens. Current Chromium and Chrome116 each pass all27 team scenarios and six released/development interoperability scenarios; core170 passes. Under the unchanged64KiB/s/120ms simulation, complete Edit decreased from ~23 seconds/two full transfers to ~11.95/11.92 seconds/one transfer. One synthetic observation is not an unconditional timing guarantee.

**Measured remaining publication gap:** the independent actual-UI test `node --test tests/team-slow-publish-browser.cjs` characterizes a726,338-byte publication at the same bandwidth. Both tested browsers hit the unchanged8-second mutation deadline before this upload commits. The UI reports an unknown response, preserves the complete draft and exact private pending payload/key, and does not automatically publish again. After transport is restored, explicit retry with the same key commits exactly one revision and clears pending state and lease. This characterization passing does not mean slow publication succeeded; it is intentionally separate from the normal team script and should become a successful-upload assertion after a fix. Evaluate bounded large-guide transfer budgets with lease expiry/server body deadlines; retain strict validation, manual retry and fencing.

Evidence: `evidence/team-edit-reuse-publish-gap-2026-10-19.json`. Isolated build, three ZIP integrity checks and all66 byte-equal runtime entries passed. Published v1.2.0 packages remain unchanged. Remote OS CI for the newest runtime and goal-wide completion audit remain outstanding.


## Bounded complete publication — 2026-10-19

The publication gap above is fixed in development. Large authenticated canonical create/publish requests over 256 KiB receive a client end-to-end budget for upload plus the full verified echo, capped at 180 seconds. After successful headers, nonempty chunks keep the existing 8-second idle timer alive; an error body receives one short deadline. Other operations retain their normal timing. The service allows size-based, capped 120-second phases only for large authenticated known-length guide uploads and successful full-guide replies, preserving 15-second upload idle/headers and ordinary control deadlines. Unknown-length bodies and explicit nondefault service timeouts remain strict. Byte/admission limits are unchanged. Because Node has one global body parser deadline, it now allows 120 seconds; per-route application deadlines still apply. Public GET/OPTIONS reject unexpected bodies so those success routes cannot drain a slow unadmitted body for the longer parser window.

A large first publication conditionally renews a lease that has insufficient estimated upload time left. Draft persistence and renewal share the controller busy/epoch guard; failed refresh never sends a publication or calls it an uncertain commit. Healthy leases avoid an extra request. Uncertain manual replay deliberately retains its original lease/payload/key and does not renew. The SDK rechecks cancellation after canonical write hashing. Tests distinguish real slow successful transport from explicitly injected confirmation loss after an actual commit, verifying the replay creates no second revision even after lease expiry.

Boundary testing also exposed an existing schema mismatch: canonical guides allowed 100 steps while local recording/editing accepted only 80. The local limit now matches 100, with the existing 4 MiB total draft budget unchanged and limit messages updated. The identical valid near-limit guide now opens complete Edit and publishes in current Chromium and Chrome 116. Older published clients retain their original local editing/transfer limits; this does not retrofit their binaries.

Current development evidence: core 180, service 52, original-browser 10 and real released/development interoperability 6 per tested browser; extracted packaged runtime team 29 per browser. Both browsers completed a 726 KB guide in about 22.4 seconds on actual CDP 64 KiB/s upload/download with 120 ms latency. The optional near-limit case transferred a4,129,408-byte canonical 100-step guide with 148 JPEG images and verified one exact publication in about 126 seconds each. A real 16-second HTTP upload separately crosses the former 15-second service deadline. Negative tests restore the old SDK or remove the new public-body guard; each fails its targeted regression for the intended reason.

`evidence/team-bounded-publication-2026-10-19.json` records source fingerprints, exact results and refreshed 500-SOP/75-client load (zero unexpected failures, 1,500 follow-up reads). Extension and experimental-service packaging were inspected in an isolated directory; published v1.2.0 assets remain unchanged. The latest runtime still requires refreshed remote OS/Node verification and an objective-wide acceptance audit. Synthetic same-host tests do not establish physical LAN/TLS/native-permission or older-hardware acceptance.
