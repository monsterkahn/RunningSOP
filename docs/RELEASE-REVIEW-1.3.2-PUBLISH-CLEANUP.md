# Local publication cleanup patch — v1.3.2

Successful, verified publication removes only the corresponding unchanged local draft and opens the exact published SOP steps. Other drafts and published history remain intact. Failed or uncertain writes retain the draft. A serialized recorder compare-and-delete protects changes made by another panel; an acknowledged older retry payload cannot remove newer editing work. Source/account fences remain enforced before reading. Cleanup errors are reported as local cleanup warnings, not as failed publication.

The patch contains `workspace.js` and `recorder-runtime.js`, to replace both files in an existing v1.3.2 extension directory before reloading the extension. Version numbering is unchanged; earlier distribution ZIPs remain preserved.

Verification: 199 core checks passed, including conditional deletion and other-draft preservation. Final publication/team source checks passed 4/4 on Chromium 151 and actual Chrome 116. The original installation ZIP was extracted, both patch files applied, and every runtime byte compared with current source; the same 4 checks passed per browser on this reconstructed installation. These include failed folder writes, source switches, concurrent editing, successful cleanup, fresh re-editing, lost HTTP acknowledgement and idempotent recovery. An isolated full build and ZIP integrity checks passed.

Broader publication, sidebar images, slow-network recovery and historical reading regressions also ran during development. Final focused checks above followed the last folder-source recheck and fixture refinement. Native permission prompts and physical two-device/HTTPS acceptance remain unperformed. No remote release or store submission was made.

Fingerprints: `docs/evidence/publish-cleanup-fix-1.3.2-2026-10-19.json`.
