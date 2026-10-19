# Read retained SOP versions

SOP history reading is included in **v1.3.3**. The previous published **v1.2.0** assets are preserved. A GitHub distribution is separate from Chrome Web Store submission and approval; native-permission and physical two-device acceptance remain unverified.

## Reading history

In Settings, choose **View SOP overview**. The overview follows the enabled team connection, otherwise the explicitly selected and authorized SOP folder. Before connection it displays setup guidance; it does not connect automatically. Select an SOP and open its version history, then choose a retained entry. The historical reader displays a visible historical-version notice and provides an action to return to the latest version. The work-page reader also supports historical reading for the selected SOP.

Historical text, screenshots, exception images and saved image marks belong to the selected version. Returning to latest reads the current version rather than changing any stored publication. A historical reading is not proof that an SOP was correct or that a business action or approval occurred.

Reading does not grant category management, publication, editing, restore or other management permissions. The candidate adds no roles or approval workflow and no version-restore action. Existing separately authorized administrative recovery tools are outside this reading feature.

## Folder retention and catalog backups

Folder history uses retained publication metadata and immutable, content-addressed version documents. Publication records are stored under `publication-history/<workflowId>/<sha256>.json`; version documents use `workflows/<workflowId>/versions/<sha256>.json`. A document references separately retained image assets by their validated paths and hashes. Image marks remain part of that version's structured content.

Folder history pages contain at most 50 entries (the UI requests 20), and linked traversal is bounded to 200 retained entries per history chain. Reaching the display bound is reported; older retained files are not deleted.

The current catalog identifies the current publication. Retained publication links identify earlier versions. Catalog backups are recovery snapshots, not a guarantee that every past SOP version and its images remains available. Historical reading requires the referenced version document and its exact retained assets. It does not manufacture missing publication records or reconstruct history from before the library retained it.

Keep the library's catalog, publication records, version documents and image assets together when backing up. Do not remove old hash-addressed files if their versions must remain readable. A missing, corrupt or mismatched document or image is reported; the reader must not silently substitute the latest content. History is not an independent backup service or a distributed transaction guarantee.

Folder access stays browser-local and requires explicit user selection and read authorization. Reading history does not request write access merely to display a retained version. Reauthorization may be necessary after a browser restart. No arbitrary remote import is added; history is structured SOP data within the selected library, never executable code.

## Team retention and access

Team history uses the configured service and the current authenticated session. Revision identity and content hashes bind the historical result to the requested SOP and revision. Switching account or service invalidates outstanding reading work. The service must retain the requested revision and its assets; a history listing alone does not establish that missing content can be recovered.

The reader does not bypass service authorization or convert ordinary reading into administrative access. Older service compatibility, complete verified reads for editing and existing lease/conflict protection remain in place. No automatic mutation retry is introduced by reading history.

## Candidate scope and verification

The candidate retains the post-v1.2.0 development hardening: verified separate-image reads with older-service fallback; cancellation and account/source guards; bounded progressing full reads and large publications; explicit uncertain-publication replay; complete 100-step editing; and language-initialization corrections. The earlier [team completion audit](TEAM-COMPLETION-AUDIT.md) records the prior development verification and its limitations. Its results do not establish acceptance of the new history paths.

Before distributing the candidate, run the current core and affected browser suites, build it and inspect the generated artifacts. Record actual results against the candidate source; do not infer a pass from an earlier release or development checkpoint.

The extension remains Manifest V3 with Chrome 116 as its minimum. Fresh installations have no shared connection and do not automatically connect, publish or synchronize. No vendor cloud analytics or remote executable code is introduced. Screenshots remain explicit single-frame captures, and notes and screenshots may contain sensitive information.

Native permission prompts, physical two-device NAS/HTTPS acceptance and team statistics remain expressly user-deferred, not passed. Isolated automated checks do not constitute Google certification, Chrome Web Store approval or acceptance on every older computer.

Current candidate results are recorded in [the v1.3.0 review](RELEASE-REVIEW-1.3.0.md).
