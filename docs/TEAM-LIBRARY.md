# Experimental team library

The team library is an extension page for a user-selected team service. It does not replace the existing folder dashboard or connect on a fresh installation. It is development work, not an additional official release.

## Open and find procedures

Connect through **Settings → Team service**, then choose **Open team library**. The page uses this browser's private device session. A disconnected page asks the user to connect in Settings and sends no service requests. A change of account/server invalidates the open page, cancels requests, closes image previews and clears the old view; reopen it for the new connection.

The first page loads at most 50 SOP metadata records. It does not fetch every SOP body. Use **All SOPs**, **Uncategorized**, or a named category. Search requires at least two characters; an empty search lists the chosen category. Previous/Next uses bounded cursor pagination.

## Organize categories

Expand **Manage categories**. Select **New category** or an existing category, then edit its name, parent, one of six colors and one of six icons. Saving changes metadata, not actual filenames, work addresses or SOP identity. The current service permits up to 500 categories and eight levels; these are category limits, not a 500-SOP product limit.

Read an SOP and use its category selector plus **Move** to change its primary category. Choose **Uncategorized** to remove the assignment. A separate category revision prevents two organizers from silently overwriting each other's changes. Classification does not alter published guide bytes, consume the editing lease, or count as a new content revision.

Only empty categories can be deleted. Child categories and assigned SOPs must be moved first. The confirmation does not delete published SOPs. Stale updates fail and reload metadata; typed category names are retained for review before another save.

## Read and inspect history

Choose **Read SOP** to fetch and verify that procedure. **Version history** lists published revisions; choosing a revision reads its immutable content. The side panel on the actual work page remains the editing/recording interface. Reading an old revision does not publish or restore it.

Screenshots retain validated annotations. A thumbnail opens a closeable preview in the same tab. The library defers image decoding/rendering until near the visible area and runs at most two thumbnail decodes together; browsers without IntersectionObserver use the same bounded queue immediately. This reduces display work, **not network bytes**: the current read protocol still downloads the complete selected guide and its image data. The old folder mode and side-panel renderer are unchanged by this library behavior.

The interface supports English, Simplified/Traditional Chinese, Spanish, Russian, Korean and Japanese, following the existing browser preference. User-written SOP/category text is not translated.

## Pending publications

An uncertain publication is saved in extension-origin IndexedDB with its exact idempotency key, guide and lease. It is not placed in work-page DOM or public extension storage. Reopening the original draft/target can replay the same request to determine the committed result.

The private queue permits 50 pending records, each bounded to 4 MiB plus 64 KiB of envelope allowance. An existing record can still be updated at capacity. It never silently evicts uncertain publications. Confirmed publication clears its record. Confirmed deletion of a specific local draft clears only that draft's pending records, including records for other saved targets. No automatic snapshot-based orphan sweep is used because it could race a draft created in another window. A failure of private cleanup does not undo the already completed local-draft deletion and is reported separately.

## Verification and limits

The real-service browser scenario covers metadata-only listing, pagination, search, uncategorized/category filters, category creation/assignment, nonempty-delete rejection, concurrent rename protection, current/history reading, screenshot annotations, offscreen thumbnail deferral and scrolling, a closeable preview, narrow layouts, seven languages, imported markup rendered as text, and disconnection while a preview is open. The workspace scenario also checks the private queue's count limit, preservation of existing entries at capacity and exact-draft cleanup isolation.

Native permission prompts, real shared drives, trusted HTTPS setup and physical two-device acceptance remain separate checks. Team statistics still remain local; the library does not silently use a previous folder statistics target.
