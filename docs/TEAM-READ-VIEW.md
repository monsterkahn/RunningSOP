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
