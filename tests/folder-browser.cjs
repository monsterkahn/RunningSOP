'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require(process.env.RUNTIME_SOP_PLAYWRIGHT || 'playwright');
const root = path.resolve(__dirname, '..');
const extension = path.join(root, 'extension');

function fixtureFiles(directory, prefix = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const relative = prefix + entry.name;
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? fixtureFiles(absolute, relative + '/') : [{ path: relative, base64: fs.readFileSync(absolute).toString('base64') }];
  });
}

// Picker return values are native FileSystemHandles. No fake chrome, mocked IDB,
// or production read/publish implementation is used. OPFS cannot exercise OS dialogs.
test('folder selection reads native persisted handles without writing and keeps the same publication target', { timeout: 90000 }, async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-sop-folder-'));
  let context;
  try {
    context = await chromium.launchPersistentContext(profile, {
      channel: 'chromium',
      headless: true,
      ...(process.env.RUNTIME_SOP_CHROME ? { executablePath: process.env.RUNTIME_SOP_CHROME } : {}),
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--no-first-run', '--no-default-browser-check']
    });
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const id = new URL(worker.url()).host;
    await worker.evaluate(() => chrome.storage.local.set({ 'runtime-sop-workspace-preferences-v1': { language: 'zh', guided: false } }));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`chrome-extension://${id}/options.html`);
    await page.waitForFunction(() => typeof SOPStorageSource !== 'undefined');
    await page.waitForFunction(() => document.querySelector('#source-connection')?.dataset.state === 'unconfigured');
    assert.deepEqual(await page.locator('#source-kind option').evaluateAll(options => options.map(option => option.value)), ['unspecified', 'network', 'local']);
    assert.equal(await page.locator('#source-kind').inputValue(), 'unspecified');
    assert.equal(await page.locator('#source-other').evaluate(element => element.open), false);
    assert.equal(await page.locator('#legacy-source').evaluate(element => element.open), false);
    assert.equal(await page.locator('#choose-sop-folder').isVisible(), true);
    assert.equal(await page.locator('#catalog-url').isVisible(), false);
    assert.deepEqual(await worker.evaluate(() => CatalogSync.getSettings()), { enabled: false, endpoint: '' });

    await page.evaluate(async files => {
      const storage = await navigator.storage.getDirectory();
      const container = await storage.getDirectoryHandle('synthetic-shared', { create: true });
      const selected = await container.getDirectoryHandle('SOP', { create: true });
      const other = await storage.getDirectoryHandle('synthetic-other', { create: true });
      for (const destination of [selected, other]) {
        for (const file of files) {
          const parts = file.path.split('/');
          let directory = destination;
          for (const part of parts.slice(0, -1)) directory = await directory.getDirectoryHandle(part, { create: true });
          const handle = await directory.getFileHandle(parts.at(-1), { create: true });
          const writer = await handle.createWritable();
          await writer.write(Uint8Array.from(atob(file.base64), char => char.charCodeAt(0)));
          await writer.close();
        }
      }
      window.folderFixture = { container, selected, other, pickerCalls: [] };
      window.showDirectoryPicker = async options => {
        folderFixture.pickerCalls.push(options);
        if (folderFixture.cancel) throw new DOMException('Synthetic cancel', 'AbortError');
        return folderFixture.returnOther ? other : container;
      };
      window.showOpenFilePicker = async () => [await selected.getFileHandle('catalog.json')];
      window.snapshotFixture = async () => {
        const files = {};
        async function scan(directory, prefix) {
          for await (const [name, handle] of directory.entries()) {
            const key = prefix + name;
            if (handle.kind === 'directory') await scan(handle, key + '/');
            else files[key] = Array.from(new Uint8Array(await (await handle.getFile()).arrayBuffer()));
          }
        }
        await scan(storage, '');
        return files;
      };
    }, fixtureFiles(path.join(root, 'examples/storage')));
    const before = await page.evaluate(() => snapshotFixture());
    await page.locator('#auto-sync').uncheck();
    await page.locator('#choose-sop-folder').click();
    await page.waitForFunction(() => document.querySelector('#source-count').textContent.includes('1 份 SOP'));
    await page.waitForFunction(() => document.querySelector('#source-connection').dataset.state === 'ready');
    assert.equal(await page.locator('#source-kind').inputValue(), 'unspecified', 'choosing a directory must not infer whether its storage is local or networked');
    assert.equal(await page.locator('#source-bridge-label').isVisible(), true);
    assert.equal(await page.locator('#source-device-state').isVisible(), true);
    assert.deepEqual(await page.locator('#source-connection').evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running').map(animation => animation.effect.getTiming().iterations)), [], 'a verified connection must not animate');
    assert.equal(await page.locator('#source-name').textContent(), 'SOP');
    const endpoint = (await worker.evaluate(() => CatalogSync.getSettings())).endpoint;
    assert.match(endpoint, /^sop-directory:\/\//);
    assert.deepEqual(await worker.evaluate(() => CatalogSync.getSettings()), { endpoint, enabled: false });
    assert.equal(await page.evaluate(() => folderFixture.pickerCalls[0].mode), 'read');
    assert.equal(await page.evaluate(async () => (await NASPublisher.getDirectoryHandle()).isSameEntry(folderFixture.selected)), true);
    assert.equal(await worker.evaluate(async () => Boolean(await chrome.alarms.get('runtime-sop-catalog-check-v1'))), false);
    assert.equal(((await page.evaluate(() => chrome.runtime.sendMessage({ type: 'catalog-check' }))).status).state, 'ready');
    const workflow = await worker.evaluate(() => CatalogSync.loadWorkflow('demo-work'));
    assert.equal(workflow.workflowId, 'demo-work');
    assert.equal(workflow.steps.length, 2);
    assert.match(workflow.steps[0].image, /^data:image\/jpeg;base64,/);
    assert.deepEqual(await page.evaluate(() => snapshotFixture()), before, 'selection, directory/body/image reads must not mutate shared files');

    // File selection alone is pending and cannot replace the active source.
    await page.locator('#source-other > summary').click();
    await page.locator('#choose-catalog-file').click();
    await page.locator('#grant-catalog-folder').waitFor({ state: 'visible' });
    assert.equal((await worker.evaluate(() => CatalogSync.getSettings())).endpoint, endpoint);
    await page.evaluate(() => { folderFixture.returnOther = true; });
    await page.locator('#grant-catalog-folder').click();
    await page.waitForFunction(() => !document.querySelector('#grant-catalog-folder').disabled);
    assert.equal(await page.locator('#pending-file').isVisible(), true);
    assert.equal((await worker.evaluate(() => CatalogSync.getSettings())).endpoint, endpoint);
    assert.equal(await page.evaluate(async () => (await NASPublisher.getDirectoryHandle()).isSameEntry(folderFixture.selected)), true);
    assert.match(await page.locator('#catalog-status').textContent(), /文件夹|目录/);
    await page.evaluate(() => { folderFixture.returnOther = false; });
    await page.locator('#grant-catalog-folder').click();
    await page.waitForFunction(() => document.querySelector('#pending-file').hidden);
    // A second valid library replaces the cached publisher handle as well.
    await page.evaluate(() => { folderFixture.returnOther = true; });
    await page.locator('#choose-sop-folder').click();
    await page.waitForFunction(() => document.querySelector('#source-name').textContent === 'synthetic-other');
    const alternateEndpoint = (await worker.evaluate(() => CatalogSync.getSettings())).endpoint;
    assert.notEqual(alternateEndpoint, endpoint);
    assert.equal(await page.evaluate(async () => (await NASPublisher.getDirectoryHandle()).isSameEntry(folderFixture.other)), true);
    assert.equal(((await page.evaluate(() => chrome.runtime.sendMessage({ type: 'catalog-check' }))).status).state, 'ready');
    await page.evaluate(() => { folderFixture.returnOther = false; });
    await page.locator('#choose-sop-folder').click();
    await page.waitForFunction(() => document.querySelector('#source-name').textContent === 'SOP');
    assert.equal(await page.evaluate(async () => (await NASPublisher.getDirectoryHandle()).isSameEntry(folderFixture.selected)), true);
    const confirmedEndpoint = (await worker.evaluate(() => CatalogSync.getSettings())).endpoint;
    await page.locator('#source-kind').selectOption('network');
    await page.waitForFunction(async () => (await chrome.storage.local.get('runtime-sop-workspace-preferences-v1'))['runtime-sop-workspace-preferences-v1'].sourceLocationKind === 'network');
    await page.evaluate(() => { folderFixture.cancel = true; });
    await page.locator('#choose-sop-folder').click();
    await page.waitForFunction(() => !document.querySelector('#choose-sop-folder').disabled);
    assert.equal((await worker.evaluate(() => CatalogSync.getSettings())).endpoint, confirmedEndpoint);
    assert.deepEqual(await page.evaluate(() => snapshotFixture()), before);

    // Recreate the page globals, proving the handle comes back from IndexedDB.
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#source-name').textContent === 'SOP');
    assert.equal(await page.locator('#source-kind').inputValue(), 'network', 'the location label is a saved user choice');
    assert.equal((await worker.evaluate(() => SOPStorageSource.info())).endpoint, confirmedEndpoint);
    assert.equal(await page.locator('#auto-sync').isChecked(), false);
    // Hold only the delivery of the real check request. Reads, handle persistence,
    // and the background's verification remain the production implementations.
    await page.evaluate(() => {
      const originalSend = chrome.runtime.sendMessage.bind(chrome.runtime);
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      window.releaseCatalogCheck = () => release();
      window.restoreCatalogMessages = () => { chrome.runtime.sendMessage = originalSend; };
      chrome.runtime.sendMessage = (...args) => {
        if (args[0]?.type === 'catalog-check') {
          gate.then(() => originalSend(...args));
          return;
        }
        return originalSend(...args);
      };
    });
    await page.locator('#check-catalog').click();
    await page.waitForFunction(() => document.querySelector('#source-connection').dataset.state === 'checking');
    assert.equal(await page.locator('#check-catalog').isDisabled(), true);
    const pulse = await page.locator('.source-pulse').evaluate(element => {
      const style = getComputedStyle(element);
      return { name: style.animationName, iterations: Number(style.animationIterationCount) };
    });
    assert.notEqual(pulse.name, 'none', 'only an active check displays the connection pulse');
    assert.equal(Number.isFinite(pulse.iterations) && pulse.iterations > 0, true, 'checking animation must stop after a finite number of passes');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('.source-pulse').evaluate(element => getComputedStyle(element).animationName), 'none');
    assert.equal(await page.locator('#source-connection').getAttribute('data-state'), 'checking', 'reduced motion must preserve the connection state');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.waitForTimeout(150);
    assert.equal(await page.locator('#source-connection').getAttribute('data-state'), 'checking', 'the UI must keep checking until the actual request resolves');
    await page.evaluate(() => releaseCatalogCheck());
    await page.waitForFunction(() => document.querySelector('#source-connection').dataset.state === 'ready');
    await page.evaluate(() => restoreCatalogMessages());
    await page.waitForFunction(() => document.querySelector('#source-count').textContent.includes('1 份 SOP'));
    assert.equal((await worker.evaluate(() => CatalogSync.loadWorkflow('demo-work'))).steps.length, 2);

    // An actual failed native catalog read must supersede a previously ready state.
    await page.evaluate(async () => {
      const storage = await navigator.storage.getDirectory();
      const selected = await (await storage.getDirectoryHandle('synthetic-shared')).getDirectoryHandle('SOP');
      window.catalogRestore = { selected, bytes: await (await (await selected.getFileHandle('catalog.json')).getFile()).arrayBuffer() };
      await selected.removeEntry('catalog.json');
    });
    await page.locator('#check-catalog').click();
    await page.waitForFunction(() => document.querySelector('#source-connection').dataset.state === 'offline');
    assert.equal((await worker.evaluate(() => CatalogSync.info())).status.state, 'offline');
    await page.evaluate(async () => {
      const writer = await (await catalogRestore.selected.getFileHandle('catalog.json', { create: true })).createWritable();
      await writer.write(catalogRestore.bytes);
      await writer.close();
    });
    await page.locator('#check-catalog').click();
    await page.waitForFunction(() => document.querySelector('#source-connection').dataset.state === 'ready');
    for (const language of ['zh', 'en', 'es', 'ru', 'ko', 'ja']) {
      await page.locator('#language-' + language).click();
      await page.waitForFunction(code => document.querySelector('#language-' + code).getAttribute('aria-pressed') === 'true', language);
      assert.equal((await page.evaluate(() => chrome.storage.local.get('runtime-sop-workspace-preferences-v1')))['runtime-sop-workspace-preferences-v1'].sourceLocationKind, 'network', 'language changes must preserve the location annotation');
      if (language !== 'zh') {
        assert.notEqual(await page.locator('#source-kind option[value=network]').textContent(), '局域网', `${language} must translate the location choice`);
        assert.notEqual(await page.locator('#source-device-state').textContent(), '可读取 SOP', `${language} must translate the dynamic device state`);
        assert.notEqual(await page.locator('[data-i18n="当前电脑"]').textContent(), '当前电脑', `${language} must translate the computer name`);
      }
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${language} ${width}px settings must fit the viewport`);
        assert.equal(await page.locator('#choose-sop-folder').isVisible(), true);
        assert.equal(await page.locator('#source-device-state').isVisible(), true);
        if (process.env.RUNTIME_SOP_AUDIT_DIR) {
          fs.mkdirSync(process.env.RUNTIME_SOP_AUDIT_DIR, { recursive: true });
          await page.screenshot({ path: path.join(process.env.RUNTIME_SOP_AUDIT_DIR, `folder-settings-${language}-${width}.png`), fullPage: true });
        }
      }
    }
    assert.deepEqual(errors, []);
  } finally {
    if (context) await context.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
});
