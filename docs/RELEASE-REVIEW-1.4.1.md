# Running SOP 1.4.1 local candidate review

The candidate adds missing-only installation of index.html and relationships.html
to an explicitly selected, writable SOP library. Settings provides open-dashboard
and retry-installation controls. The extension's dashboard can reuse the selected
authorized folder; it does not enable polling or request permission on load.

The trusted package-local JSON bundle contains empty standalone pages and content
hashes. It never embeds a user's SOP snapshot. Strict names, schema, size and hash
validation precede filesystem access. Installation checks source guards and
permissions, preserves existing files, and reads newly written bytes back.

Existing files of any version, including manually edited or empty files, are
preserved. This operation does not upgrade existing shared pages. Partial failures
do not delete files; users must inspect an interrupted empty entry before removing
it manually. It never modifies catalog.json, SOP bodies, images, categories or
relations.json. Origin Web Locks do not provide a cross-device transaction lock;
the final check and commit cannot be atomic against a separate physical writer.

The media archive contains actual extension screenshots only, in the retained
pale-blue brand style. Dashboard, index and graph screenshots are excluded. The user subsequently approved neutral 15px reading cards, 12px spacing, no connectors or content indent, and no repeated reading address. The implementation retains the hidden internal address for matching and feedback; recording addresses remain editable. A clipped 16:6 reading viewport preserves the original image/annotation scale and uses unchanged image data for full viewing. Next step is inside an equal-width card.

## Verification

Appearance follow-up (2026-10-22): core 241 passed. Two appearance scenarios passed on current Chromium and actual Chrome 116: extension persistence, same-origin cross-page synchronization, native root color-scheme, system changes and reset, keyboard selection, blocked localStorage, and unchanged node/text data; standalone pages contain their theme code before styles and request no external assets. Both browsers also passed five existing language, graph/save, overview and deployment regressions. Light/dark screenshots were visually reviewed for dashboard and graph. The theme uses package-local code, CSS variables and Chrome-116-compatible selectors, not light-dark(). Native prompts and physical shared-storage acceptance remain deferred.

Connected-save follow-up (2026-10-22): the relationship editor reuses the selected folder on entry from the overview, without automatic picker/write requests/writes. A new real-browser OPFS scenario passed on current Chromium and actual Chrome 116, covering edits during delayed loading, denied writes, same-folder reconnect, verified saves, concurrent revision conflicts, and pending Save interrupted by a same-ID folder switch. The existing graph/overview/next-SOP regression suite passed 10 cases on each browser. Settings overview/install actions were moved outside the folder card; two Settings/deployment cases passed on each browser, including all seven languages at 320px. Native OS prompts and physical two-device checks remain deferred.

Unified overview follow-up (2026-10-22): core 241 passed. Current Chromium and actual Chrome 116 each passed six folder/history/recovery/deployment/graph/QR regression scenarios, plus seven-language and unified-navigation integration scenarios. The integration verifies home statistics plus searchable SOP rows and step counts, exact retained-history handoff and return, relationship return source, no startup network/picker/polling/permission requests, immediate source-change clearing, and refusal of a category write delayed across a source switch. CSS uses blue interface accents, neutral 15px cards and 12px spacing. Original image/annotation proportions remain intact in the full viewer. Native operating-system prompts and physical shared-storage checks remain deferred.

Approved reading-card follow-up: core 241 tests passed. Current Chromium and actual
Chrome 116 each passed 18 reading/navigation/publication/history/feedback cases,
one guided recording case and 16 team-sidebar image cases. New tests cover
portrait and ultra-wide synthetic images, exact 16:6 preview geometry, unchanged
original and annotation proportions, neutral borders, 15px corners, 12px gaps,
no content indent/connectors, an equal-width next card, hidden internal reading
address and retained visible editing URL. Media was recaptured from this runtime.

- Core: `npm test` passed 241 tests, including 14 deployment-engine scenarios,
  explicit write-selection/read-only fallback and deterministic empty-page bundling.
- Current Chromium and actual Chrome 116 each passed the storage-page deployment,
  standalone relationship editor and dashboard six-language checks (3 scenarios).
- Explicit retry requests write permission in its click before filesystem reads;
  its repair/read-only recovery scenario passed on both browsers.
- Existing public extension, folder selection and category/settings browser
  regression checks passed on both browsers (9 scenarios each).
- Listing media contains five plugin-only 1280 x 800 opaque 24-bit RGB PNGs plus
  440 x 280 and 1400 x 560 brand images. Raw captures, provenance and checksums
  are retained. No dashboard, index or relationship editor image is included.

Build and the public-content scan passed. Installation, flat Web Store and source
ZIPs passed CRC, version, bundled-page hash and complete source-byte comparisons.
The extracted installation passed seven public/deployment browser scenarios on
actual Chrome 116. Checks use synthetic files and isolated profiles, replacing
only the native picker/permission result; they do not test an OS permission dialog.

## Deferred acceptance

Native OS permission prompts, physical two-device NAS/SMB installation, HTTPS
deployment and team statistics remain unverified in the user's environment. This
is local packaging, not GitHub publication, Chrome Web Store submission, Google
certification or completed deployment acceptance. Minimum Chrome 116, Manifest V3,
existing permission declarations and privacy boundaries are retained.
