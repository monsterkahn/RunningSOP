# Archived development history

These entries describe internal development builds, not official public release versions. They are retained as historical engineering records. Current product information is in the repository README and official changelog.


### 2.5.18 · 2026-10-16

- Replaced the icon set with transparent PNGs, removing the white margin around the rounded blue mark.
- Added soft highlights and edge depth to the blue base, with a slightly raised white check line while retaining small-size readability.

### 2.5.17 · 2026-10-16

- Added six-language selection to the standalone index dashboard, initially following the browser and persisting the choice locally.
- Navigation, statistics labels, category management, QR tools, and CSV headings follow the selected language; original SOPs, category names, and feedback remain unchanged.
- The dashboard remains available offline, without network translation services or automatically enabled statistics synchronization.

### 2.5.16 · 2026-10-16

- Changed SOP storage settings to centered side-by-side cards for storage, the current computer, and their connection.
- Connection lines and text reflect actual catalog checks, source matching, and read permission. Animation runs briefly only during checks and respects reduced motion.
- Local/network location is an explicit user label tied to the current library; changing libraries does not reuse the old label.
- Retained folder, catalog-file, and legacy-address connection methods; completed six-language coverage and verified narrow layouts and failure states.

### 2.5.15 · 2026-10-16

- Prioritized Select SOP folder in settings, collapsing file and legacy-address choices and removing the need to type file paths manually.
- Folder reading uses native handles for local or system-mounted shared directories; this stage initially requested read permission only.
- Selecting a catalog file also requires authorization for its containing folder. Identity mismatches, invalid catalogs, or cancellation do not replace the original connection.
- Reading and publishing share the same folder. Cross-page handle access no longer retains stale selections; write permission was still requested at publishing at this stage.
- Added manual refresh when automatic checks are disabled, isolated source changes and caches, and added folder-permission/native-handle integration tests.

### 2.5.14 · 2026-10-16

- Added per-SOP QR generation based on stable workflow IDs, with individual SVG output and batch-print labels.
- Added an HTTP(S) read-only reader that resolves the current catalog and document by ID and displays steps, annotated images, report/approval points, and exception handling.
- Added plain-HTTP reader support while retaining local SHA-256 verification, same-origin path constraints, and read-size limits.
- Rejected invalid reader destinations, including file URLs, and withheld QR generation when no website address was configured.
- QR encoding runs entirely locally, without a CDN, remote scanning service, or additional extension permissions.

### 2.5.13 · 2026-10-16

- Pre-release review fixed editing failures in published documents containing images and added read-back verification for documents, images, and statistics.
- Isolated concurrent caches by storage source and catalog revision to avoid mixing results after an address change.
- Screenshots are viewed and edited in an isolated extension-origin surface; work pages cannot read them directly. Restricted pages use a safe side-panel view.
- Bound annotations to their original step, fixing writes to the wrong step after switching; recording labels exclude nested editable content.
- Fixed blank-title step highlighting and multilingual status messages; increased Screenshot/Add image button height to 42px.
- Improved public-distribution cleanup, checksums, and the store-upload package.

### 2.5.12 · 2026-10-16

- Expanded About by default and reduced spacing.
- Added Spanish, Russian, Korean, and Japanese; follows browser language automatically and falls back to English for unsupported languages.
- Manual selection overrides the automatic choice. SOP content and user input are not translated; all language packs are bundled for offline use.

### 2.5.11 · 2026-10-16

- Centered About content while keeping release-note entries aligned for readability.

### 2.5.10 · 2026-10-16

- Renamed settings labels to SOP storage address and local-network storage.

### 2.5.9 · 2026-10-16

- Combined settings into one page, changed language selection to Chinese/English buttons, and expanded About within the page.
- Disabled selection of static recording instructions while preserving input editing.

### 2.5.8 · 2026-10-16

- Renamed the extension to Running SOP while retaining compatibility with existing configuration, drafts, and storage directories.

### 2.5.7 · 2026-10-15

- Gave Screenshot and Add image equal shares of their row, matching report/approval button widths and improving English-label display.

### 2.5.6 · 2026-10-15

- Put the step name and STEP number inside the same border, allowing blank names.

### 2.5.5 · 2026-10-15

- Increased step-description text by 2px and added an icon and rounded border to report points for readability.

### 2.5.4 · 2026-10-15

- Made expected results and acceptance criteria optional; publishing does not require helper fields in collapsed sections.
- Validation errors identify the STEP and preserve actual results without filling them automatically.

### 2.5.3 · 2026-10-15

- Placed Next step and Publish to storage side by side at equal width; removed move-forward, move-back, and delete-step actions.
- Step-by-step recording can enter publishing confirmation directly, validating and saving before ending recording. Validation failures preserve the current editing state.

### 2.5.2 · 2026-10-15

- Moved Screenshot and Add image below the editor; added consistent icons to report, approval, and screenshot-attachment actions.

### 2.5.1 · 2026-10-15

- Simplified editing: mutually exclusive report/approval choices, consistent screenshot-button widths, and thumbnail display.
- Removed duplicate Add step, Save this step, and image-display controls; widened Next step and made it save the current step.

### 2.5.0 · 2026-10-15

- Recording opens the first step directly and allows editing the SOP name. Next step saves current content before continuing; ending recording preserves all steps.
- Step titles may be blank. Added report/approval points and requirements throughout backup, publishing, reading, and dashboard views.
- Step mode retains the latest webpage action as a reference instead of creating a step for every click.
- These points express workflow requirements, not proof that a report was submitted or approval granted. Readers used by colleagues must be updated for the new fields.

### 2.4.3 · 2026-10-15

- Fully updated the screenshot viewer and replaced old injected scripts in already-open pages to prevent use of an outdated viewer after an extension update.
- Preserved existing screenshots, annotations, and drafts without changing storage formats.

### 2.4.2 · 2026-10-15

- Fixed missing annotations when enlarging an image after saving edits. Reads existing annotations without modifying the original image or record.

### 2.4.1 · 2026-10-15

- First portable GitHub edition, licensed under MIT.
- No preconfigured storage host, personal path, real SOP, or screenshot.
- Local recording, screenshot annotations, backup, and URL-based SOP matching.
- Optional shared storage, categories, anonymous statistics, and dashboard.
- About page: don Kimxote, gwangphug@gmail.com.
