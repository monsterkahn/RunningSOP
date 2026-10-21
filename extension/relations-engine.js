(function (root, factory) {
  'use strict';
  const api = factory();
  root.SOPRelations = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const FORMAT = 'runtime-sop-relations', MAX_BYTES = 512 * 1024;
  const BAD = new Set(['__proto__', 'prototype', 'constructor']);
  const WORKFLOW_ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
  const EDGE_ID = /^[a-z0-9][a-z0-9_-]{0,79}$/i;
  const fail = message => { throw new Error(message); };

  // Inspect descriptors before reading values, so imports cannot run getters.
  function assertData(value, depth = 0, budget = {count: 0}) {
    if (++budget.count > 30000 || depth > 12) fail('关系数据过大或嵌套过深。');
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
    if (typeof value === 'number') { if (!Number.isFinite(value)) fail('关系数据含无效数字。'); return; }
    if (typeof value !== 'object') fail('关系数据只能包含 JSON 数据。');
    const array = Array.isArray(value), proto = Object.getPrototypeOf(value);
    if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) fail('关系数据只能使用普通对象和数组。');
    const own = Reflect.ownKeys(value);
    if (own.some(key => typeof key !== 'string')) fail('关系数据不能含符号字段。');
    const keys = own.filter(key => !(array && key === 'length'));
    if (array && (keys.length !== value.length || keys.some((key, index) => key !== String(index)))) fail('关系数组不能包含空项或额外字段。');
    for (const key of keys) {
      if (BAD.has(key)) fail('关系数据含危险字段。');
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) fail('关系数据不能含访问器或隐藏字段。');
      assertData(descriptor.value, depth + 1, budget);
    }
  }
  function keys(value, expected, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(label + '必须是普通对象。');
    const actual = Object.keys(value);
    if (actual.length !== expected.length || actual.some(key => !expected.includes(key))) fail(label + '含未知字段或缺少必要字段。');
  }
  function id(value, pattern, label) {
    if (typeof value !== 'string' || !pattern.test(value) || pattern === EDGE_ID && BAD.has(value)) fail(label + '格式无效。');
    return value;
  }
  function timestamp(value) {
    const parts = typeof value === 'string' && value.length <= 40 && /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.\d{1,9})?(Z|([+-])(\d\d):(\d\d))$/.exec(value);
    if (!parts || !Number.isFinite(Date.parse(value))) fail('关系更新时间必须是有效 ISO 日期时间。');
    const [, year, month, day, hour, minute, second] = parts;
    // Fractional seconds are noncapturing; groups 7/8 are the zone/sign.
    const offsetHour = parts[9], offsetMinute = parts[10];
    const leap = +year % 4 === 0 && (+year % 100 !== 0 || +year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (+month < 1 || +month > 12 || +day < 1 || +day > days[+month - 1] || +hour > 23 || +minute > 59 || +second > 59 || +offsetHour > 23 || +offsetMinute > 59) fail('关系更新时间必须是有效 ISO 日期时间。');
  }
  function empty() {
    return {format: FORMAT, schemaVersion: 1, revision: 0, updatedAt: '1970-01-01T00:00:00.000Z', name: 'SOP relationships', nodes: [], edges: []};
  }
  function validate(input) {
    assertData(input);
    keys(input, ['format', 'schemaVersion', 'revision', 'updatedAt', 'name', 'nodes', 'edges'], '关系数据');
    if (input.format !== FORMAT || input.schemaVersion !== 1) fail('关系数据格式或版本无效。');
    if (!Number.isSafeInteger(input.revision) || input.revision < 0) fail('关系修订号无效。');
    timestamp(input.updatedAt);
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 80) fail('关系图名称必须为 1 到 80 个字符。');
    if (!Array.isArray(input.nodes) || input.nodes.length > 500) fail('关系节点不能超过 500 个。');
    if (!Array.isArray(input.edges) || input.edges.length > 1000) fail('关系连线不能超过 1000 条。');
    const nodeIds = new Set();
    const nodes = input.nodes.map(node => {
      keys(node, ['workflowId', 'x', 'y'], '关系节点');
      const workflowId = id(node.workflowId, WORKFLOW_ID, '流程 ID');
      if (nodeIds.has(workflowId)) fail('关系节点流程 ID 重复。');
      nodeIds.add(workflowId);
      if (![node.x, node.y].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 20 && value <= 3800)) fail('关系节点坐标必须在 20 到 3800 之间。');
      return {workflowId, x: node.x, y: node.y};
    });
    const edgeIds = new Set(), links = new Set(), nextById = new Map();
    const edges = input.edges.map(edge => {
      keys(edge, ['id', 'from', 'to', 'kind', 'label'], '关系连线');
      const edgeId = id(edge.id, EDGE_ID, '连线 ID');
      if (edgeIds.has(edgeId)) fail('关系连线 ID 重复。');
      edgeIds.add(edgeId);
      const from = id(edge.from, WORKFLOW_ID, '起点流程 ID'), to = id(edge.to, WORKFLOW_ID, '终点流程 ID');
      if (!nodeIds.has(from) || !nodeIds.has(to)) fail('关系连线的节点不存在。');
      if (from === to) fail('关系连线不能指向自身。');
      if (edge.kind !== 'next' && edge.kind !== 'issue') fail('关系连线类型无效。');
      if (typeof edge.label !== 'string' || edge.label.length > 50 || edge.kind === 'issue' && !edge.label.trim()) fail('连线说明不能超过 50 个字符，异常连线必须填写说明。');
      const link = JSON.stringify([from, to, edge.kind, edge.label]);
      if (links.has(link)) fail('关系连线重复。');
      links.add(link);
      if (edge.kind === 'next') {
        if (nextById.has(from)) fail('每个流程只能有一条下一步连线。');
        nextById.set(from, to);
      }
      return {id: edgeId, from, to, kind: edge.kind, label: edge.label};
    });
    const checked = new Set();
    for (const start of nodeIds) {
      const path = new Set();
      let current = start;
      while (nextById.has(current) && !checked.has(current)) {
        if (path.has(current)) fail('下一步连线不能形成循环。');
        path.add(current);
        current = nextById.get(current);
      }
      for (const workflowId of path) checked.add(workflowId);
    }
    const result = {format: FORMAT, schemaVersion: 1, revision: input.revision, updatedAt: input.updatedAt, name: input.name, nodes, edges};
    if (new TextEncoder().encode(JSON.stringify(result)).byteLength > MAX_BYTES) fail('关系数据超过 512 KiB。');
    return result;
  }
  function next(data, workflowId, availableIds) {
    const current = validate(data);
    id(workflowId, WORKFLOW_ID, '流程 ID');
    const edge = current.edges.find(value => value.kind === 'next' && value.from === workflowId);
    if (!edge) return null;
    if (availableIds !== undefined) {
      if (!Array.isArray(availableIds) && !(availableIds instanceof Set)) fail('可用流程 ID 必须为数组或集合。');
      const available = availableIds instanceof Set ? availableIds : new Set(availableIds);
      if (!available.has(workflowId) || !available.has(edge.to)) return null;
    }
    return edge.to;
  }
  return Object.freeze({FORMAT, MAX_BYTES, empty, validate, next});
});
