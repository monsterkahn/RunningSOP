# Screenshot mosaic draft

Local v1.3.7-based candidate; no new formal release, GitHub publication or Web Store submission.

Choose Mosaic in either screenshot editor and drag a rectangle. Move adjusts the rectangle with pointer or arrow keys, Shift for ten pixels. Undo and Clear work before saving. Exit discards pending edits. Saving replaces covered pixels with opaque source-independent neutral tiles in a JPEG; it retains editable ordinary annotations but no removable mosaic geometry or hidden original image in the updated draft. Image dimensions and the 200KiB data-URI bound remain enforced. Encode or storage failure preserves the existing draft. ISSUE edits additionally require Save issue. Previously published revisions, immutable assets, backups and other copies remain retained. This feature does not detect personal data or read input values.

Verification: 206 core tests; 13 affected browser scenarios on current Chromium; 12 plus the dedicated 1 publication scenario on actual Chrome 116. Pixel tests verify full-mask output independence from original pixels, partial coverage, retained dimensions and ordinary marks; tests cover real isolated iframe results, rejected expired sessions, undo/cancel, stale image CAS and actual OPFS step/issue publication and byte-equal reload. These are synthetic tests, not native permissions or real two-device acceptance.
