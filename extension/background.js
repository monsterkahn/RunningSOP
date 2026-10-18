'use strict';
importScripts('image-marks.js','sync-engine.js','sync-runtime.js','catalog-engine.js','sop-assets.js','storage-source.js','catalog-runtime.js','recorder-runtime.js','nas-publisher.js','stats-engine.js','stats-runtime.js');
// Chrome requires the user to open the panel. Once open, the panel follows tabs.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') chrome.runtime.openOptionsPage().catch(console.error);
});
// Legacy bundle verification remains available; no legacy background synchronization is enabled.

CatalogSync.registerBackground();

SOPRecorder.registerBackground();

SOPStats.registerBackground();
