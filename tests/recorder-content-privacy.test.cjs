'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// A deliberately small DOM fixture runs the real recorder event listeners.
class Element {
  constructor(tag, text = '', attrs = {}, children = []) {
    this.tagName = tag.toUpperCase(); this.text = text; this.attrs = attrs;
    this.children = children; this.id = attrs.id || '';
    for (const child of children) child.parent = this;
  }
  get textContent() { return this.text + this.children.map(n => n.textContent).join(''); }
  get isContentEditable() { return this.attrs.contenteditable !== undefined && this.attrs.contenteditable !== 'false'; }
  getAttribute(name) { return this.attrs[name] ?? null; }
  matches(selector) {
    return selector.split(',').some(s => s.startsWith('[role=')
      ? this.attrs.role === s.match(/"([^"]+)"/)[1]
      : s === '[contenteditable]' ? this.attrs.contenteditable !== undefined
      : s === this.tagName.toLowerCase());
  }
  closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector) || null; }
  querySelectorAll(selector) {
    return this.children.flatMap(n => [...(n.matches(selector) ? [n] : []), ...n.querySelectorAll(selector)]);
  }
  cloneNode() { return new Element(this.tagName, this.text, {...this.attrs}, this.children.map(n => n.cloneNode())); }
  remove() { this.parent.children = this.parent.children.filter(n => n !== this); }
}
class Input extends Element {}
class Textarea extends Element {}
class Select extends Element {}
function recorder() {
  const events = [], listeners = {}; let receive;
  const document = {
    documentElement: new Element('html'), querySelector: () => null, querySelectorAll: () => [],
    addEventListener: (type, fn) => { listeners[type] = fn; }
  };
  const source = fs.readFileSync(path.join(__dirname, fs.existsSync(path.join(__dirname, '../extension/recorder-content.js')) ? '../extension/recorder-content.js' : '../recorder-content.js'), 'utf8');
  vm.runInNewContext(source, {
    Element, HTMLInputElement: Input, HTMLTextAreaElement: Textarea, HTMLSelectElement: Select,
    document, CSS: {escape: s => s}, setTimeout: () => {},
    MutationObserver: class { observe() {} },
    chrome: {runtime: {onMessage: {addListener: fn => { receive = fn; }}, sendMessage: data => { events.push(data.event); return Promise.resolve({}); }}}
  });
  receive({type: 'recorder-content-start', token: 'test-token'}, {}, () => {});
  return {events, click: target => listeners.click({target, isTrusted: true})};
}
for (const tag of ['div', 'button', 'a']) test(`recorder ${tag} label excludes editable descendant text`, () => {
  const click = new Element('span', 'Confirm');
  const control = new Element(tag, '', tag === 'div' ? {role: 'button'} : {}, [
    new Element('div', 'SECRET-EDITED', {contenteditable: 'true'}),
    new Element('textarea', 'SECRET-TEXTAREA'), new Element('select', 'SECRET-OPTION'),
    new Element('input', 'SECRET-INPUT'), click
  ]);
  const r = recorder(); r.click(click);
  assert.equal(r.events.length, 1);
  assert.equal(r.events[0].title, 'Confirm');
  assert.equal(r.events[0].action, '点击“Confirm”');
  assert.doesNotMatch(JSON.stringify(r.events), /SECRET/);
  assert.match(control.textContent, /SECRET-EDITED/); // Sanitizing never changes the page.
});
test('recorder keeps explicit accessible labels and skips direct editable clicks', () => {
  const editable = new Element('div', 'SECRET', {contenteditable: 'true'});
  const control = new Element('button', '', {'aria-label': 'Save item'}, [editable]);
  const r = recorder(); r.click(editable); assert.equal(r.events.length, 0);
  r.click(control); assert.equal(r.events[0].title, 'Save item');
});
