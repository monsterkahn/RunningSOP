# Storage dashboard and SOP relationships

Version 1.4.1 adds missing-page deployment from Settings. After explicitly
selecting a SOP folder and granting write access, the extension fills missing
`index.html` and `relationships.html` entries. Existing pages are preserved,
including older or manually edited files; this does not upgrade shared pages.
Use **Install missing dashboard pages** to retry after granting write access.
**Open dashboard** opens the extension-owned dashboard using the currently
authorized SOP folder, without polling or a new permission prompt on page load.

The installed standalone pages contain no embedded SOPs. Each browser explicitly
selects its library when using these standalone files. Browser handles are not
portable and are never embedded into HTML. Opening the Settings entry can reuse
the current browser's existing authorized handle. Existing SOP data remains
readable if the optional HTML deployment cannot obtain write permission.

Deployment verifies package-local content hashes and checks the selected folder
before each operation. Newly written files are read back. No catalog, SOP,
category or relationship data is modified by page installation. Browser-origin
locks do not provide a cross-device atomic create operation. Interrupted empty
files are preserved for inspection rather than deleted or overwritten.

Version 1.4.0 includes an installation folder named `extension/` and standalone
storage pages at the ZIP root. Open `index.html` for the existing dashboard;
its relationship-map entry opens `relationships.html`. Keep those pages in
the same directory. The dashboard's category, search, rating and available
usage features remain separate from relationship editing.

Choose the same SOP library folder that the extension uses. Selection and
permission are local to each browser. A new installation does not connect,
read a shared folder, write a relationship file or enable polling by default.
The graph's shared-save operation requires explicit write permission.

The relationship map shows SOP titles and step counts, without a body preview.
It opens at 100% zoom. Drag a node's grip to move it, or use its arrow-key and
position controls. Drag from an outgoing port to another SOP, or click the
source and target ports. Select a line to delete it with the button or Delete
key. Undo can restore recent edits. Layout does not define business order:
the direction of the authored connections does.

Each SOP can have one outgoing `next` connection. Those connections cannot
form a cycle. An `issue` connection has an explicit condition and may describe
a return. The graph does not judge whether a real task or approval succeeded.
Light flow animation is limited to four cycles and 32 connections per render;
it can be disabled, respects reduced-motion preferences,
and pauses when the page is hidden.

## Shared data

`relations.json` is separate from `catalog.json`, SOP bodies, screenshots,
categories and anonymous statistics. Its versioned schema contains a display
name, revision, timestamp, node positions keyed by workflow ID, and directed
connections. Titles and step counts come from the currently verified library;
they are not authoritative copies inside the relationship file.

Reading a missing relationship file means no configured relationships; it
does not create one. Invalid or oversized files are rejected and preserved.
Saving checks the prior revision and complete data, preserves the previous
revision under `relation-history/`, verifies the source again, and reads the
write back. Browser-origin locking serializes local writers where supported.
These safeguards are not a distributed NAS lock or an administrator role;
physical two-device acceptance is still required for the target deployment.

## Next SOP in the side panel

For a fresh, verified folder library, the reading panel can show a `next step`
label after the final STEP and before satisfaction feedback. The card names
the configured next SOP. A user click opens that SOP and its configured work
address. If no work address is available, only the SOP changes and the panel
explains that no address was set. URL access still follows existing browser
and site-permission restrictions. The action does not imply completion of the
current task and never sends an approval.

No next card is inferred from visual proximity or table sorting. Missing,
invalid, unavailable or stale relationship context must not cause navigation.
Historical reads and the experimental team service do not provide a shared
folder relationship context in this release. Their existing functions remain
available, without a fabricated next-SOP relationship.

## Updates and acceptance

Update the same extension installation to retain browser-local settings and
the selected SOP address. Reinstalling under another extension ID does not
migrate its data. Browser-managed folder permissions may require renewal.

This is a local 1.4.0 distribution. It is not a GitHub publication, Chrome Web
Store submission, Google certification, or a claim that native prompts,
physical two-device shared storage, HTTPS deployments and team statistics
have passed acceptance in the user's environment.
