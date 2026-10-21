# Running SOP 2.0.0 Web Store package review

Review date: 2026-10-22. This record covers the prepared 2.0.0 candidate, not a GitHub publication or a confirmed Chrome Web Store submission. Store approval is not established.

## Scope

The candidate accumulates the local work after 1.3.7: screenshot mosaic masking; empty-step filtering and unchanged-draft cleanup after verified publication; exact published-SOP reading; neutral reading cards with 16:6 previews and original-proportion full viewing; a unified statistics/category/search overview and standalone index; a separate relationship graph and next-SOP navigation; connected-folder read reuse with write access requested on Save; missing-only shared-page installation; local Light/Dark/System appearance; seven flag-free languages; and stable browser-local device display names.

Relationships remain separate from SOP bodies. Saving retains revision/source guards, history backups and read-back verification. Page installation requires explicit folder selection and write authorization and preserves every existing page, including older or customized files. Theme changes do not modify shared data. Masking replaces the edited image bytes, but does not purge earlier publications, history or backups.

Manifest V3, Chrome 116 minimum, existing permission declarations and privacy boundaries are retained. The release requires no breaking data migration or settings reset. Same-identity extension updates retain local data; native folder permissions may require reauthorization. Fresh installations require explicit storage selection and do not connect, publish or synchronize by default. The English short description remains exactly as approved in CHROMEWEBSTORE.md.

## Verification status

- Core: 241/241 passed on the final 2.0.0 sources.
- Current Chromium and actual Chrome 116.0.5845.96: each passed 59/59 browser scenarios across 21 files, including publication, history, recovery, masking, categories, graph saves, next-SOP navigation, appearance, shared-page installation and bounded team-sidebar images.
- Extracted flat Web Store ZIP on actual Chrome 116: 20/20 passed across public UI, appearance, connected graph saves, deployment, next-SOP reading and publication.
- Build/public scan passed. The 85-entry Web Store archive has manifest.json at its root, Manifest V3, version 2.0.0, minimum Chrome 116 and the unchanged approved 118-character description. It contains no source/test/docs directories or browser profiles.
- Installation, Web Store and source ZIP CRCs, safe paths and every archived byte matched their intended inputs. Bundled standalone pages have matching hashes and version 2.0.0.
- Five actual-plugin 1280 x 800 RGB screenshots plus 440 x 280 and 1400 x 560 RGB promotions were generated from runtime 2.0.0 with isolated synthetic data. The media archive passed CRC, member-byte and image-dimension/color-mode checks; no dashboard/index/graph screenshot is included.

Checks use synthetic examples and isolated profiles. Browser tests replace native folder-picker/permission outcomes and do not establish OS-prompt or physical cross-device acceptance.

## Deferred acceptance and publication status

Native operating-system folder/screen-sharing prompts, real physical two-device NAS/SMB behavior, HTTPS deployment and team statistics remain user-deferred. Isolated OPFS tests and injected permission outcomes do not validate native prompts or cross-device transactions. No claim is made for every Chrome version, operating system or older hardware configuration.

A built ZIP and listing text do not establish upload, submission, review approval or Google certification. Record actual dashboard actions separately if performed. This task does not update the GitHub homepage or publish a GitHub release. Keep generated dist/ artifacts out of Git.
