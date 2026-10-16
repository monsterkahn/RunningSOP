'use strict';
(() => {
  if (globalThis.__sopRecorderContentInstalled) return;
  globalThis.__sopRecorderContentInstalled = true;
  let token = null;
  let recording = false;
  let trustedActionAt = 0;
  let lastSemantic = '';
  let semanticBefore = new Set();
  const edited=new WeakSet();
  const clean = (value, max = 160) => String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  // Labels may wrap editable regions. Never use their current text as a
  // control label, even when the click lands on a different child.
  const labelText = (element) => {
    const copy = element.cloneNode(true);
    copy.querySelectorAll('input,textarea,select,[contenteditable]').forEach(node => node.remove());
    return clean(copy.textContent);
  };
  const labelFor = (element) => {
    if (!element || !(element instanceof Element)) return '';
    const labelled = element.getAttribute('aria-label') || element.getAttribute('title');
    if (labelled) return clean(labelled);
    if (element.id) {
      const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      if (label) return labelText(label);
    }
    const parentLabel = element.closest('label');
    if (parentLabel) return labelText(parentLabel);
    const field=element.matches('input,textarea,select,[contenteditable]');
    return clean((field ? '' : labelText(element)) || element.getAttribute('name') || element.tagName.toLowerCase());
  };
  const sensitive = (element) => {
    const type = String(element.type || '').toLowerCase();
    const descriptor = `${type} ${element.name || ''} ${element.id || ''} ${element.autocomplete || ''} ${element.getAttribute('aria-label') || ''}`.toLowerCase();
    return ['password', 'hidden', 'file', 'checkbox', 'radio', 'submit', 'button', 'reset', 'image'].includes(type)
      || /pass(word)?|验证码|verification|otp|token|secret|credit.?card|cvv|security.?code/.test(descriptor);
  };
  const send = (event) => {
    if (!recording || !token) return;
    chrome.runtime.sendMessage({ type: 'recorder-event', token, event }).then(r=>{if(r?.error)recording=false;}).catch(() => {recording=false;});
  };
  const semanticNodes = () => [...document.querySelectorAll('[role="dialog"],dialog[open],[role="tab"][aria-selected="true"],[aria-expanded="true"]')];
  const semanticKey = node => `${node.tagName}:${node.getAttribute('role')||''}:${node.id||''}:${node.getAttribute('aria-selected')||''}:${node.getAttribute('aria-expanded')||''}:${clean(node.getAttribute('aria-label')||node.getAttribute('title')||'',100)}`;
  const semanticActivation = () => {
    if (!recording || !trustedActionAt || Date.now() - trustedActionAt > 1500) return;
    const node = semanticNodes().map(n=>({node:n,key:semanticKey(n)})).find(x=>!semanticBefore.has(x.key))?.node;
    if (!node) return;
    const role = node.getAttribute('role') || (node.tagName.toLowerCase() === 'dialog' ? 'dialog' : node.getAttribute('aria-expanded') === 'true' ? 'expanded section' : 'control');
    const label = clean(node.getAttribute('aria-label') || node.getAttribute('title') || role, 100);
    const key = `${role}:${label}`;
    if (key === lastSemantic) return;
    lastSemantic = key;
    send({ type:'manual', title:`界面变化：${label}`, where:role, action:`激活${role}“${label}”`, expected:'界面已切换到对应区域' });
  };
  const onClick = (event) => {
    if (!recording || !event.isTrusted) return;
    trustedActionAt = Date.now();
    semanticBefore = new Set(semanticNodes().map(semanticKey));
    const target = event.target instanceof Element ? event.target.closest('button,a,[role="button"],[role="tab"]') : null;
    if (!target || target.isContentEditable || event.target.closest('input,textarea,select,[contenteditable]')) return;
    const title = labelFor(target);
    send({ type: 'click', title: title || '点击页面控件', where: clean(target.getAttribute('aria-label') || target.tagName.toLowerCase()), action: `点击“${title || '页面控件'}”` });
    setTimeout(semanticActivation, 0);
  };
  const onChange = (event) => {
    if (!recording || !event.isTrusted) return;
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) return;
    if (sensitive(target)) return;
    const title = labelFor(target);
    send({ type: 'field', title: title || '表单字段', where: title || target.tagName.toLowerCase(), action: `填写“${title || '表单字段'}”` });
  };
  const onEditInput=event=>{if(!recording||!event.isTrusted)return;const target=event.target instanceof Element?event.target.closest('[contenteditable]'):null;if(target?.isContentEditable&&!sensitive(target))edited.add(target);};
  const onEditBlur=event=>{if(!recording||!event.isTrusted)return;const target=event.target instanceof Element?event.target.closest('[contenteditable]'):null;if(!target||!edited.has(target))return;edited.delete(target);if(sensitive(target))return;const title=labelFor(target)||'编辑区域';send({type:'field',title,where:title,action:`填写“${title}”（未记录输入内容）`});};
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (!message || typeof message !== 'object') return undefined;
    if (message.type === 'recorder-content-start' && typeof message.token === 'string') {
      token = message.token; recording = true; respond({ ok: true });
    } else if (message.type === 'recorder-content-pause' || message.type === 'recorder-content-stop') {
      if (!message.token || message.token === token) { recording = false; if (message.type === 'recorder-content-stop') token = null; }
      respond({ ok: true });
    }
    return undefined;
  });
  document.addEventListener('click', onClick, true);
  document.addEventListener('change', onChange, true);
  document.addEventListener('input',onEditInput,true);
  document.addEventListener('focusout',onEditBlur,true);
  new MutationObserver(records => {
    if (!trustedActionAt || Date.now() - trustedActionAt > 1500) return;
    if (records.some(r => r.type === 'attributes' || r.type === 'childList')) semanticActivation();
  }).observe(document.documentElement, { subtree:true, childList:true, attributes:true, attributeFilter:['open','aria-expanded','aria-selected','role','aria-label','title'] });
})();
