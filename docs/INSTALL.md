# Installation and first use

## Requirements

- Google Chrome 116 or later.
- A Running SOP release archive downloaded from GitHub Releases.
- Access to the target folder through the folder picker when needed for installation, extension updates, or local storage.

The project currently distributes installation packages through GitHub Releases rather than one-click installation from the Chrome Web Store.

## Installation

1. Download the latest release archive from the project's **Releases** page and extract it to a location you will keep.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Choose **Load unpacked**, then select the `extension/` folder inside the extracted directory.
5. Optionally pin Running SOP in the toolbar's extensions menu. Click the extension icon to open the side panel.

Keep the extension directory in place after installation; moving or deleting it may prevent Chrome from loading the extension. To upgrade, download the new version, replace the contents of the same extension directory, and reload it on the extensions page. To preserve local data, keep the extension installed and retain its storage.

## Permissions

The local v1.4.1 installation archive also includes `index.html`,
`relationships.html` and `sop.html` at its root. Keep these standalone pages
together. Open `index.html` for the storage dashboard and its relationship-map
entry, then explicitly choose your SOP library folder. These pages are separate
from the `extension/` directory selected when loading the browser extension.
In v1.4.1, selecting a writable SOP folder also adds missing index and relationship pages while preserving existing files. Settings provides Open dashboard and Install missing dashboard pages. The internal dashboard can reuse the selected folder; standalone files require their own explicit folder selection.

See [Storage relationships](STORAGE-RELATIONSHIPS.md) for shared saving and
next-SOP navigation.

Local drafts and recording work without a shared folder. HTTP(S) site permissions are requested as needed for functions such as recording or screenshots on the current page. If permission is denied, page injection may be unavailable on that site; other local functions remain usable.

To use functions on `file://` pages or read catalog files through a `file://` address, enable **Allow access to file URLs** in Running SOP's details on Chrome's extensions page. This switch is separate from the shared folder's File System Access read/write authorization. Enable it when needed.

To read or write a shared folder, select the folder in the relevant function and follow Chrome's permission prompts. Selecting a folder performs one check and does not enable background sync by default. The current settings no longer show statistics or automatic-check switches; upgrades retain configurations explicitly enabled in earlier versions. An empty folder receives a `catalog.json` only after write permission is granted. Writing requires read/write access to the folder. See [data and storage](STORAGE.md) for the data involved.

## First launch

1. Settings open automatically on first installation. Click the light-blue folder area to choose an SOP storage folder, or start with local drafts.
2. Open a work page, click the extension icon to open the side panel, start recording, and fill in each step. Screenshots capture one frame after permission is granted through the browser's chooser.
3. To share, publish to the selected folder with write permission. The current interface has no backup export control. Before uninstalling, publish and verify anything you need to keep.
4. Publishing and screenshots are user-triggered. Rating records sync automatically if statistics sync has been enabled. Screenshots and manually entered content may contain sensitive information; review them before saving or sharing.

For development from source, see `CONTRIBUTING.md` in the repository root. Run portable tests with `npm test`; generate release archives with `npm run build`.

## Local draft limit

Up to 10 drafts can be kept locally. At the limit, the side panel shows **Manage drafts**. Publish anything you need to keep, then select and confirm the local drafts to delete. Canceling leaves the content unchanged. Deletion is disabled during recording. This only removes local drafts; published SOPs in storage remain available.
