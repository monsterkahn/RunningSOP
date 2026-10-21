# Privacy notice

Last reviewed for the local v1.4.1 installation candidate on 2026-10-21. A fresh installation has no preconfigured shared directory or team-service connection. Workflow drafts and recording work locally without shared storage. Existing folder-based statistics synchronization runs only when previously enabled explicitly; it is separate from the experimental team service. This project contains no vendor cloud analytics code.

## Data processing and local storage

- Folder relationships are stored separately in relations.json with SOP identifiers, node positions, connection labels and revision metadata. Saving retains prior relationship revisions in relation-history. Geometry does not determine workflow order. No relationship data is sent to a developer service.
- A short OS-prefix and random suffix form a browser-local device display name. It is not a hardware hostname or Chrome account name, and adds no account access permission. Users can change the team display name.

- Folder-based workflow matching runs locally, primarily using the current tab URL. In team-service mode, the extension sends the current work URL to the configured service in a `POST /v1/matches` request. HTTP(S) query strings and fragments are removed; a `file://` URL is sent in full. Neither mode reads page body text or form values for matching.
- Recording reads visible text or `aria-label` from controls the user clicks, label text associated with input controls, active dialog/tab titles, page titles, and sanitized URLs. It does not read field values, passwords, or verification codes. Control names, titles, URL paths, and manually entered work URLs or notes may still contain business information.
- In folder-based mode, viewing a matched workflow stores an anonymous device identifier and view count locally. Submitted ratings are stored locally; older installations may also have explicitly enabled synchronization of these records to their selected statistics directory. Team-service mode retains feedback locally and does not upload ratings or provide team statistics.
- Local settings, drafts, recordings, notes, and pending synchronization records are stored in Chrome extension local storage. Workflow categories are an exception: they are stored in `categories.json` in the selected shared directory, separately from workflow bodies.
- Team-service session tokens and uncertain pending publication records are stored in private extension-origin IndexedDB, separate from `chrome.storage.local`. Pending publication records can contain a draft, screenshots, and lease/idempotency data so a user can recover an uncertain publication.
- Screenshot preview and annotation use an isolated extension-origin view, with sessions validated by tab, operation mode, and expiration. The original webpage DOM does not receive screenshot bytes. Temporary screenshot sessions remove image data after loading and are cleaned up on close. Pages that do not allow injection use the extension side panel for viewing.
- Screenshots use the browser's `getDisplayMedia` selection interface only when explicitly triggered by the user. The extension captures one frame and then stops. The image may include personal information, account identifiers, messages, or other page content. Screenshots and annotations may be saved in local drafts or the user-selected shared directory.

Uninstalling the extension may clear Chrome extension local storage. Before clearing data or uninstalling, publish any SOPs you need to retain to a storage directory you control and verify their contents. The current recording interface has no backup export entry. The extension does not automatically delete history already written to shared directories.

A user-initiated folder selection with write authorization can install missing
index.html and relationships.html from the extension's trusted package-local
bundle. These pages contain no embedded user SOPs or browser handles. Existing
HTML files are preserved. Settings can retry explicitly; startup does not deploy
files in the background. This operation does not edit SOP or relationship data.

## Folder-based shared directories and background activity

Users explicitly select shared directories; a fresh installation does not connect automatically. After a directory is selected and permission is granted, the extension performs the following activities according to its settings:

- When automatic directory checks are enabled, it reads published workflows and directory metadata from the selected directory once per minute while the browser is running.
- When the user connects a statistics directory and enables anonymous device statistics synchronization, view and rating records synchronize automatically to the selected directory while the browser is running. Each device uses a separate random identifier. Statistics contain no work URLs, login accounts, or webpage input content.
- When users explicitly trigger publication or similar functions, the corresponding workflow data is written to the selected directory.
- Categories are written to a separate `categories.json` without rewriting workflow bodies.

Automatic directory checks and statistics synchronization are off by default on fresh installations. Choosing a folder triggers a single library check and does not enable these background features automatically. The current settings page no longer exposes automatic-check or statistics configuration controls; updated installations retain settings explicitly enabled in earlier versions. A shared directory may be hosted by the user or an organization, which controls its access, backups, and retention policy. Shared history is not deleted automatically.

## Optional experimental team service

The team service is separate from folder-based storage and is not configured or contacted by a fresh extension installation. An administrator must install and run it separately with Node.js 24 or later, configure allowed extension origins, and provide a service address and join code to users. Connecting sends the join code and chosen display name to that service; the display name is used to identify the actor on team edits, and the join code is cleared from the settings form and not saved by the extension. For matching, the service receives the sanitized work URL: HTTP(S) addresses include origin and path but omit query and fragment; a `file://` address is sent in full, including its path, query, and fragment. The service stores published SOP content and images, revisions, categories, audit/co-ordination records, and protected device-session data in its SQLite database. Local drafts remain in the browser. Team ratings stay on the device; the service does not receive uploaded ratings or provide team statistics.

The service's built-in listener uses unencrypted HTTP. Anyone able to observe that network traffic may read or alter it, including SOPs and authentication material. For network use, an administrator must configure a trusted HTTPS reverse proxy, restrict backend access to that proxy, and verify TLS on clients. This project's HTTPS deployment has not been verified. The service does not add encryption at rest; backups contain the same sensitive SOP and history data and require equivalent access controls. See [team-service operations](server/README.md) for setup, backup and restore behavior. Native system permissions and real two-device access have not been acceptance-tested.

## Permissions and network activity

HTTP(S) website origin permissions are requested as needed for recording or screenshot features on the current page. Without permission, the corresponding page injection features are unavailable. Running features on `file://` pages or reading directory files through `file://` URLs requires separately enabling “Allow access to file URLs” in Chrome's extension details. Chrome's folder picker grants File System Access permission for shared folders. The file URL switch and folder read/write permissions are independent.

In folder mode, URL matching and recording processing happen locally. In team-service mode, the configured service receives sanitized matching URLs and any SOP data the user chooses to publish or edit there. The extension uses no third-party cloud analytics service and does not send workflow records to the Running SOP developer. Chrome, user-selected storage, service hosts, HTTPS proxies, or shared file systems may have their own network, account, and logging activity.

## User controls

Users can use local features without configuring a shared directory. They can revoke website or file access in Chrome's extension management interface, or disable the extension to stop further extension activity. These actions do not delete existing shared-directory data. The current settings interface has no separate statistics synchronization switch; it must not be described as still available in settings.

For privacy questions, contact [gwangphug@gmail.com](mailto:gwangphug@gmail.com).

## Optional QR links

QR links are generated locally from a user-configured HTTP(S) reader URL and a workflow ID; no QR generation service receives the URL. The dashboard may store the reader URL in the current browser's localStorage. Exported QR labels disclose their destination URL and SOP identifier. The linked reader requests the selected catalog, body, and images from the same website using its existing session, without sending ratings, completion records, or view statistics. Any storage web-server access logs are controlled by that server.

## Folder-based library connections

When the user chooses an SOP folder, the extension saves its native directory handle in extension-owned IndexedDB and a random connection identifier with the folder display name in local extension settings. The initial picker requests read access, followed immediately by a read-permission request if needed. If no catalog exists, it requests write access before creating and reading back an empty catalog.json; an invalid existing catalog is not replaced. The same selected directory is used for reading and publishing; publication requests write access when it has not already been granted. Folder display names and icon choices are local metadata and do not rename the actual folder. Existing file URL connections are retained for migration and require Chrome file URL permission, but manual address and catalog-file pickers are no longer exposed in the settings UI. Folder handles are local browser permissions, not credentials transferable to other devices. Library selection does not enable statistics synchronization.

## Saved team-service addresses

The optional service picker saves up to 20 service names and addresses in a separate extension-origin IndexedDB database on this browser. It saves no join code, session token or password. Selecting, editing or deleting a saved address makes no network request and does not change the active connection. Users explicitly click Connect and authorize the chosen origin before connection requests. A successful connection may remember its address metadata. Saved addresses persist after Disconnect and can be deleted from the picker. This feature does not discover or scan LAN devices.

## Per-step feedback

Feedback on a published SOP passage is saved only in this browser under a separate, bounded local format. Each entry contains the SOP identifier, exact displayed folder revision hash or team revision, step identifier, passage kind, optional exception identifier, issue type, timestamp and an optional manually entered note (up to2,000 characters). A SHA-256 source fingerprint distinguishes libraries/accounts without storing their raw endpoint in the feedback record. The interface does not copy page inputs or surrounding page text into feedback. There is no automatic upload to the developer, folder or team service. Users may explicitly export these records to JSON and share them with the responsible person; notes and identifiers in that export can be sensitive. Historical versions and local drafts do not offer these passage controls.

## Screenshot redaction

The screenshot editor offers a user-drawn Mosaic tool. Selected regions are previewed with opaque, source-independent gray tiles. Saving burns these tiles into a replacement JPEG, preserving ordinary annotation geometry separately. The saved draft and subsequent publication use the replacement image, not an original image underneath a removable mask. This feature does not inspect input values or automatically detect sensitive text. Before Save, Undo and Exit may restore the original local editing image. After a successful edit, the current draft image is replaced; previously published revisions, shared history, backups, exports or copies on other devices are not purged. ISSUE edits require Save issue to commit their updated screenshot to the draft.

The overview and relationship pages store an optional Light/Dark appearance preference in browser-local storage. System mode removes the override. This preference is not sent to a server or saved in the SOP library.
