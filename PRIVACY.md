# Privacy notice

A fresh installation has no preconfigured shared directory. Workflow drafts and recording work locally without a shared directory. Once shared-directory features are enabled, directory reads and statistics synchronization follow the settings the user previously enabled explicitly. This project contains no vendor cloud analytics code.

## Data processed locally

- Workflow matching runs locally, primarily using the current tab URL. Matching does not read page body text or form values.
- Recording reads visible text or `aria-label` from controls the user clicks, label text associated with input controls, active dialog/tab titles, page titles, and sanitized URLs. It does not read field values, passwords, or verification codes. Control names, titles, URL paths, and manually entered work URLs or notes may still contain business information.
- When a matched workflow is viewed, an anonymous device identifier and view counts are first stored locally. Submitted ratings are also stored locally as pending synchronization records.
- Local settings, drafts, recordings, notes, and pending synchronization records are stored in Chrome extension local storage. Workflow categories are an exception: they are stored in `categories.json` in the selected shared directory, separately from workflow bodies.
- Screenshot preview and annotation use an isolated extension-origin view, with sessions validated by tab, operation mode, and expiration. The original webpage DOM does not receive screenshot bytes. Temporary screenshot sessions remove image data after loading and are cleaned up on close. Pages that do not allow injection use the extension side panel for viewing.
- Screenshots use the browser's `getDisplayMedia` selection interface only when explicitly triggered by the user. The extension captures one frame and then stops. The image may include personal information, account identifiers, messages, or other page content. Screenshots and annotations may be saved in local drafts or the user-selected shared directory.

Uninstalling the extension may clear Chrome extension local storage. Before clearing data or uninstalling, publish any SOPs you need to retain to a storage directory you control and verify their contents. The current recording interface has no backup export entry. The extension does not automatically delete history already written to shared directories.

## Optional shared directories and background activity

Users explicitly select shared directories; a fresh installation does not connect automatically. After a directory is selected and permission is granted, the extension performs the following activities according to its settings:

- When automatic directory checks are enabled, it reads published workflows and directory metadata from the selected directory once per minute while the browser is running.
- When the user connects a statistics directory and enables anonymous device statistics synchronization, view and rating records synchronize automatically to the selected directory while the browser is running. Each device uses a separate random identifier. Statistics contain no work URLs, login accounts, or webpage input content.
- When users explicitly trigger publication or similar functions, the corresponding workflow data is written to the selected directory.
- Categories are written to a separate `categories.json` without rewriting workflow bodies.

Automatic directory checks and statistics synchronization are off by default on fresh installations. Choosing a folder triggers a single library check and does not enable these background features automatically. The current settings page no longer exposes automatic-check or statistics configuration controls; updated installations retain settings explicitly enabled in earlier versions. A shared directory may be hosted by the user or an organization, which controls its access, backups, and retention policy. Shared history is not deleted automatically.

## Permissions and network activity

HTTP(S) website origin permissions are requested as needed for recording or screenshot features on the current page. Without permission, the corresponding page injection features are unavailable. Running features on `file://` pages or reading directory files through `file://` URLs requires separately enabling “Allow access to file URLs” in Chrome's extension details. Chrome's folder picker grants File System Access permission for shared folders. The file URL switch and folder read/write permissions are independent.

URL matching and recording data processing happen locally. The extension uses no third-party cloud analytics service and does not send workflow records to the Running SOP developer. User-selected synchronized storage, Chrome, or shared file-system services may have their own network and account activity.

## User controls

Users can use local features without configuring a shared directory. They can revoke website or file access in Chrome's extension management interface, or disable the extension to stop further extension activity. These actions do not delete existing shared-directory data. The current settings interface has no separate statistics synchronization switch; it must not be described as still available in settings.

For privacy questions, contact [gwangphug@gmail.com](mailto:gwangphug@gmail.com).

## Optional QR links

QR links are generated locally from a user-configured HTTP(S) reader URL and a workflow ID; no QR generation service receives the URL. The dashboard may store the reader URL in the current browser's localStorage. Exported QR labels disclose their destination URL and SOP identifier. The linked reader requests the selected catalog, body, and images from the same website using its existing session, without sending ratings, completion records, or view statistics. Any storage web-server access logs are controlled by that server.

## Folder-based library connections

When the user chooses an SOP folder, the extension saves its native directory handle in extension-owned IndexedDB and a random connection identifier with the folder display name in local extension settings. The initial picker requests read access, followed immediately by a read-permission request if needed. If no catalog exists, it requests write access before creating and reading back an empty catalog.json; an invalid existing catalog is not replaced. The same selected directory is used for reading and publishing; publication requests write access when it has not already been granted. Folder display names and icon choices are local metadata and do not rename the actual folder. Existing file URL connections are retained for migration and require Chrome file URL permission, but manual address and catalog-file pickers are no longer exposed in the settings UI. Folder handles are local browser permissions, not credentials transferable to other devices. Library selection does not enable statistics synchronization.
