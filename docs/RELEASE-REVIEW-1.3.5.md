# Running SOP v1.3.5 review

The overview places Category settings beside the Categories heading. Simplified Chinese uses 分类设置 and Traditional Chinese uses 分類設定. Both Settings and overview editors show six color swatches and six SVG icons, with a check indicator, localized accessible names and native radio keyboard behavior. Source metadata format, write permission flow, history, conflict protection and read-back verification are unchanged. Chrome 116, MV3 and permissions remain unchanged.

## Current automated evidence

- Core: 202 passed, zero failures or skips.
- Affected category browser scenarios: 2 passed on current Chromium and 2 on actual Chrome 116, zero failures or skips. Coverage includes mouse and arrow-key selection, persisted color/icon values, language changes, source fencing, permission denial, optimistic conflicts, and all seven languages at narrow and desktop widths.
- Synthetic overview dialog screenshot inspected: swatches, SVG controls, selected check marks and adjacent category settings visible.

All five distribution ZIP checksums and integrity passed. The installation (77 files), flat Web Store (74 files) and source package entries match the working source byte for byte. Extracted installation runtime passed both affected browser scenarios on current Chromium and actual Chrome 116, zero failures or skips. The refreshed 1280×800 category settings image was visually inspected. Cross-platform GitHub workflow results must be inspected separately; previous v1.3.4 results do not validate v1.3.5.

## Acceptance limits

Native operating-system permission prompts, physical two-device NAS/SMB, HTTPS deployment and team statistics remain user-deferred, not passed. No Chrome Web Store submission. Older published assets must not be overwritten. The optional team service remains experimental. These are developer verification statements, not Google certification.
