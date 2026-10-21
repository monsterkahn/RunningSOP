'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.RUNTIME_SOP_PLAYWRIGHT || 'playwright');

const root = path.resolve(__dirname, '..');
const dashboardURL = pathToFileURL(path.join(root, 'dist/dashboard.html')).href;
const languages = ['zh', 'zh-TW', 'en', 'es', 'ru', 'ko', 'ja'];
const ratingKeys = ['非常不满意', '不满意', '一般', '满意', '非常满意'];

test('standalone dashboard translates seven languages and preserves authored SOP content', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({
    headless: !process.env.RUNTIME_SOP_CHROME,
    args: process.env.RUNTIME_SOP_CHROME ? ['--headless=new'] : [],
    ...(process.env.RUNTIME_SOP_CHROME ? { executablePath: process.env.RUNTIME_SOP_CHROME } : {})
  });
  const errors = [];
  const screenshotDir = process.env.RUNTIME_SOP_DASHBOARD_SCREENSHOTS
    ? path.join(os.tmpdir(), 'running-sop-dashboard-languages') : null;
  if (screenshotDir) fs.mkdirSync(screenshotDir, { recursive: true });

  async function open(locale) {
    const context = await browser.newContext({ locale, viewport: { width: 390, height: 844 } });
    // An isolated browser profile can never request or modify a real shared directory.
    await context.addInitScript(() => {
      window.testDirectoryPickerCalls = 0;
      window.showDirectoryPicker = async () => {
        window.testDirectoryPickerCalls++;
        throw new Error('Directory access is forbidden in the language test');
      };
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(dashboardURL);
    await page.locator('#sop-rows .sop-name').first().waitFor({ state: 'attached' });
    return { context, page };
  }

  async function translated(page, selector, key, attribute) {
    const expected = await page.evaluate(key => DashboardI18n.t(key), key);
    const language = await page.locator('#dashboard-language').inputValue();
    if (!['zh', 'zh-TW'].includes(language)) assert.notEqual(expected, key, `${language}: missing translation for ${key}`);
    const actual = attribute
      ? await page.locator(selector).getAttribute(attribute)
      : await page.locator(selector).textContent();
    assert.equal(actual.trim(), expected, `${language}: ${selector}`);
  }

  try {
    // Unsupported browser languages fall back to English; supported Chinese resolves directly.
    const chinese = await open('zh-CN');
    assert.equal(await chinese.page.locator('html').getAttribute('lang'), 'zh-CN');
    assert.equal(await chinese.page.locator('#dashboard-language').inputValue(), 'zh');
    assert.equal(await chinese.page.locator('#page-title').textContent(), 'SOP 总表');
    assert.equal(await chinese.page.evaluate(() => window.testDirectoryPickerCalls), 0);
    await chinese.context.close();
    const traditional = await open('zh-HK');
    assert.equal(await traditional.page.locator('html').getAttribute('lang'), 'zh-TW');
    assert.equal(await traditional.page.locator('#dashboard-language').inputValue(), 'zh-TW');
    assert.equal(await traditional.page.locator('#page-title').textContent(), 'SOP 總表');
    await traditional.context.close();

    const { page } = await open('fr-FR');
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    assert.equal(await page.locator('#dashboard-language').inputValue(), 'en');
    assert.deepEqual(await page.locator('#dashboard-language option').evaluateAll(options => options.map(option => option.value)), languages);
    assert.equal(await page.locator('#dashboard-language').evaluate(node => /[\u{1F1E6}-\u{1F1FF}]/u.test(node.textContent)), false, 'language choices must not contain country flags');

    const authored = await page.evaluate(() => {
      const payload = JSON.parse(document.getElementById('dashboard-data').textContent);
      const item = payload.workflows.find(item => item.workflow.viewer === 'guide');
      return { id: item.workflow.id, title: item.workflow.title, summary: item.workflow.summary,
        stepTitles: item.guide.steps.map(step => step.title), actions: item.guide.steps.flatMap(step => step.actions || []) };
    });
    assert.match(authored.title, /[\u3400-\u9fff]/, 'the built dashboard must contain the synthetic Chinese SOP');
    assert(authored.actions.some(action => /[\u3400-\u9fff]/.test(action)));

    for (const language of languages) {
      await page.goto(dashboardURL + '#overview');
      await page.locator('#dashboard-language').selectOption(language);
      const htmlLanguage = language === 'zh' ? 'zh-CN' : language;
      await page.waitForFunction(lang => document.documentElement.lang === lang, htmlLanguage);
      await translated(page, '#page-title', 'SOP 总表');
      assert.equal(await page.locator('#sops').isVisible(), true, 'unified home must show the SOP table with dashboard metrics');
      await translated(page, '#sops th:nth-child(2)', '步骤数量');
      await translated(page, '.privacy-notice', '截图和备注可能包含敏感信息，分享前请核对。');
      await page.locator('main').evaluate(n=>n.scrollTop=0);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      await translated(page, '#search', '名称、说明或 ID', 'placeholder');
      await translated(page, '#ratings-overview h2', '五档评价统计');
      for (const [index, key] of ratingKeys.entries()) {
        await translated(page, `#rating-chart .chart-column:nth-child(${index + 1}) > span`, key);
        await translated(page, `#rating-summary .rating-total:nth-child(${index + 1}) > span`, key);
        await translated(page, `th.rating-${index + 1}`, key);
      }
      if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, `${language}-overview-390.png`), fullPage: true });

      await page.locator('nav a[href="#sops"]').click();
      await page.waitForFunction(() => location.hash === '#sops' && !document.getElementById('sops').hidden && document.getElementById('overview').hidden);
      await translated(page, '#page-title', 'SOP 内容库');
      await translated(page, '#sops h2', 'SOP 内容库');
      assert.equal(await page.locator('#overview').isVisible(), false);
      await translated(page, '#new-category', '分类设置', 'aria-label');
      await page.locator('#new-category').click();
      await page.locator('#category-dialog').waitFor({ state: 'visible' });
      for (const [selector, key] of [
        ['#category-dialog-title', '新建分类'], ['label[for="category-name"]', '分类名称'],
        ['label[for="category-parent"]', '上级分类'], ['#save-category', '创建分类'],
        ['#cancel-category', '取消'], ['#category-parent option[value=""]', '无，作为一级分类']
      ]) await translated(page, selector, key);
      await translated(page, '#close-category', '关闭', 'aria-label');
      await translated(page, '#category-colors', '分类颜色', 'aria-label');
      await translated(page, '#category-icons', '分类图标', 'aria-label');
      if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, `${language}-category-390.png`), fullPage: true });
      await page.locator('#close-category').click();
      assert.equal(await page.locator('#category-dialog').isVisible(), false);

      await page.locator(`#sop-rows a[href="#sop=${encodeURIComponent(authored.id)}"]`).click();
      await page.locator('#detail').waitFor({ state: 'visible' });
      await translated(page, '#page-title', 'SOP 工作内容');
      assert.equal(await page.locator('#detail-title').textContent(), authored.title);
      assert.equal(await page.locator('#detail-summary').textContent(), authored.summary);
      const detailText = await page.locator('#detail-body').textContent();
      for (const value of [...authored.stepTitles, ...authored.actions].filter(Boolean)) {
        assert(detailText.includes(value), `${language}: authored content must remain unchanged: ${value}`);
      }
      if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, `${language}-detail-390.png`), fullPage: true });

      await page.reload();
      await page.locator('#detail').waitFor({ state: 'visible' });
      assert.equal(await page.locator('html').getAttribute('lang'), htmlLanguage);
      assert.equal(await page.locator('#dashboard-language').inputValue(), language);
      await translated(page, '#page-title', 'SOP 工作内容');
      assert.equal(await page.locator('#detail-title').textContent(), authored.title);
      assert.equal(await page.evaluate(() => window.testDirectoryPickerCalls), 0);
    }
    assert.deepEqual(errors, [], 'standalone dashboard must have no uncaught script errors');
  } finally {
    await browser.close();
  }
});
