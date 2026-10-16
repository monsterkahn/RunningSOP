'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const I18n = require('../extension/workspace-i18n.js');

function element(attrs = {}, textContent = '') {
  return {
    attrs: {...attrs}, textContent, value:'',
    getAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attrs,name) ? this.attrs[name] : null; },
    setAttribute(name,value) { this.attrs[name] = value; }
  };
}
function fakeRoot(groups) { return {querySelectorAll(selector) { return groups[selector] || []; }}; }

test('language toggles, translates known Chinese and falls back to the original text', () => {
  I18n.setLanguage('zh');
  assert.equal(I18n.getLanguage(),'zh');
  assert.equal(I18n.t('保存草稿'),'保存草稿');
  I18n.setLanguage('en');
  assert.equal(I18n.getLanguage(),'en');
  assert.equal(I18n.t('保存草稿'),'Save draft');
  assert.equal(I18n.t('已连接'),'Connected');
  assert.equal(I18n.t('手动阅读 · 未断定当前页面适用'),'Manual reading · Not confirmed for this page');
  assert.equal(I18n.t('验收标准'),'Acceptance criteria');
  assert.equal(I18n.t('ISSUE 如遇到错误情况…'),'ISSUE · If something goes wrong…');
  assert.equal(I18n.t('未收录的提示'),'未收录的提示');
  assert.throws(()=>I18n.setLanguage('fr'),/Language/);
  I18n.setLanguage('zh');
});

test('apply changes only marked static text and designated placeholder or aria attributes', () => {
  const staticText = element({'data-i18n':'保存草稿'},'保存草稿');
  const placeholder = element({'data-i18n-placeholder':'搜索 SOP',placeholder:'搜索 SOP'},'');
  const aria = element({'data-i18n-aria':'当前工作地址','aria-label':'当前工作地址'},'');
  const authorContent = element({},'作者编写的 SOP 正文');
  const textarea = element({},''); textarea.value = '作者输入内容';
  const image = element({alt:'用户截图'});
  const root = fakeRoot({
    '[data-i18n]':[staticText],
    '[data-i18n-placeholder]':[placeholder],
    '[data-i18n-aria]':[aria]
  });
  I18n.setLanguage('en'); I18n.apply(root);
  assert.equal(staticText.textContent,'Save draft');
  assert.equal(placeholder.attrs.placeholder,'Search SOP');
  assert.equal(aria.attrs['aria-label'],'Current work address');
  assert.equal(authorContent.textContent,'作者编写的 SOP 正文');
  assert.equal(textarea.value,'作者输入内容');
  assert.equal(image.attrs.alt,'用户截图');
  I18n.setLanguage('zh'); I18n.apply(root);
  assert.equal(staticText.textContent,'保存草稿');
  assert.equal(placeholder.attrs.placeholder,'搜索 SOP');
  assert.equal(aria.attrs['aria-label'],'当前工作地址');
});


test('browser language resolution supports six locales and stable fallback',()=>{
 for(const [raw,want]of [['es-MX','es'],['ru-RU','ru'],['ko-KR','ko'],['ja-JP','ja'],['zh-TW','zh'],['en-US','en'],['cy-GB','en']])assert.equal(I18n.resolveLanguage('auto',raw),want);
 assert.equal(I18n.resolveLanguage('ko','es-MX'),'ko');
 const translations=require('../extension/locale-data.js');
 for(const lang of ['es','ru','ko','ja']){
  assert(Object.keys(translations[lang]).length>=168);
  I18n.setLanguage(lang);assert.equal(I18n.t('设置'),translations[lang]['设置']);assert.equal(I18n.t('SOP存储地址'),translations[lang]['SOP存储地址']);
 }
 I18n.setLanguage('auto');assert(I18n.LANGUAGES.includes(I18n.getLanguage()));I18n.setLanguage('zh');
});
