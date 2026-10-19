# v1.3.2 reading-selection replacement

The original v1.3.2 installation archives remain unchanged. This local replacement ZIP contains only workspace.js and is applied to an installed v1.3.2 runtime; it is not a version bump, GitHub publication or store submission.

A local editing copy with the same linked workflow ID and verified revision SHA is merged into the corresponding published reading choice. Team association additionally requires the same endpoint and actor. The current published SOP opens automatically after fresh launch/refresh and the editing copy remains accessible through View draft. A title or URL alone never merges identities. Distinct SOPs, unrelated same-title drafts and older-SHA uncertain publication recovery remain separate choices.

Current checks on macOS arm64:199 core tests passed;11 affected folder/team/history browser scenarios passed per browser using current Chromium and actual Chrome116;2 focused team scenarios per browser additionally check fresh-launch reading and uncertain response recovery. Counts overlap. Patch integrity and source bytes were verified, and the original v1.3.2 installation ZIP hash is unchanged. See [evidence](evidence/reading-selection-fix-1.3.2-2026-10-19.json).

The user screenshot demonstrates a candidate list, not an established document-read failure. No real user SOPs or native profile were accessed; reproduction used synthetic native folder handles and a real local team service. Native authorization prompts and real two-device storage acceptance remain outside this check.
