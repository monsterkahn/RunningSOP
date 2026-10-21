'use strict';
(function (root, factory) {
  const api = factory(root.ImageMarks || (typeof require === 'function' ? require('./image-marks.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ScreenshotRedaction = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (M) {
  const MAX_IMAGE = 200 * 1024, MAX_PIXELS = 40000000;
  const BASE = '#a0a6ad', TILE = '#949ba3';
  function validate(edits) {
    if (edits === undefined) return [];
    if (!Array.isArray(edits) || edits.length > M.constants.MAX_MARKS) throw new TypeError('截图标记格式无效');
    const mosaics = edits.map(edit => {
      if (!edit || typeof edit !== 'object' || Array.isArray(edit) || ![Object.prototype, null].includes(Object.getPrototypeOf(edit))) throw new TypeError('截图标记格式无效');
      if (edit.type === 'mosaic') {
        const keys = Reflect.ownKeys(edit);
        if (keys.length !== 5 || keys.some(key => !['type','x','y','x2','y2'].includes(key))) throw new TypeError('截图标记格式无效');
      }
      return edit.type === 'mosaic';
    });
    const clean = M.validate(edits.map((edit, i) => mosaics[i] ? { ...edit, type:'rect' } : edit));
    return clean.map((edit, i) => mosaics[i]
      ? {type:'mosaic',x:Math.min(edit.x,edit.x2),y:Math.min(edit.y,edit.y2),x2:Math.max(edit.x,edit.x2),y2:Math.max(edit.y,edit.y2)}
      : edit);
  }
  function dimensions(width, height) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || width > 20000 || height > 20000 || width * height > MAX_PIXELS) throw new RangeError('图片尺寸过大，请先缩小后添加。');
  }
  function tileSize(width, height) { return Math.max(8, Math.ceil(Math.sqrt(width * height / 6400))); }
  function bounds(edit, width, height) {
    const x = Math.floor(edit.x * width), y = Math.floor(edit.y * height);
    return {x,y,x2:Math.ceil(edit.x2 * width),y2:Math.ceil(edit.y2 * height)};
  }
  function asMark(edit) { return edit.type === 'mosaic' ? {...edit,type:'rect'} : edit; }
  function renderSvg(edits, width, height, selected) {
    dimensions(width,height);
    const clean = validate(edits), normal = clean.filter(edit => edit.type !== 'mosaic');
    const tile = tileSize(width,height), period = tile * 2;
    const regions = clean.filter(edit => edit.type === 'mosaic').map(edit => {
      const b = bounds(edit,width,height);
      return `<rect x="${b.x}" y="${b.y}" width="${b.x2-b.x}" height="${b.y2-b.y}" fill="url(#sop-redaction-grid)"/>`;
    }).join('');
    const pattern = `<defs><pattern id="sop-redaction-grid" width="${period}" height="${period}" patternUnits="userSpaceOnUse"><rect width="${period}" height="${period}" fill="${BASE}"/><path d="M0 0h${tile}v${tile}H0zM${tile} ${tile}h${tile}v${tile}H${tile}z" fill="${TILE}"/></pattern></defs>`;
    const selection = clean[selected] ? M.editorSvg([asMark(clean[selected])],width,height,0).match(/<rect [^>]*stroke="#146ef5"[^>]*\/>/)?.[0] || '' : '';
    return M.renderSvg(normal,width,height).replace(/(<svg[^>]*>)/, '$1'+pattern+regions).replace('</svg>',selection+'</svg>');
  }
  function hitTest(edits, point, width, height) { return M.hitTest(validate(edits).map(asMark),point,width,height); }
  function translate(edit, dx, dy, width, height) {
    const clean = validate([edit])[0], moved = M.translate(asMark(clean),dx,dy,width,height);
    return clean.type === 'mosaic' ? {...moved,type:'mosaic'} : moved;
  }
  function save(imageElement, edits) {
    const clean = validate(edits), width = imageElement?.naturalWidth, height = imageElement?.naturalHeight;
    dimensions(width,height);
    const regions = clean.filter(edit => edit.type === 'mosaic'), imageMarks = M.validate(clean.filter(edit => edit.type !== 'mosaic'));
    if (!regions.length) return imageMarks;
    if (!/^data:image\/(jpeg|png);base64,/.test(imageElement.currentSrc || imageElement.src || '')) throw new TypeError('请使用 PNG 或 JPEG 图片。');
    const canvas = imageElement.ownerDocument.createElement('canvas');
    try {
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw Error('图片无法读取，请重新选择截图。');
      ctx.fillStyle = '#fff'; ctx.fillRect(0,0,width,height); ctx.drawImage(imageElement,0,0,width,height);
      const tile = tileSize(width,height);
      // Opaque, source-independent tiles remove the selected pixels. No image
      // samples or original bytes are carried in the saved annotation model.
      for (const edit of regions) {
        const b = bounds(edit,width,height);
        ctx.fillStyle = BASE; ctx.fillRect(b.x,b.y,b.x2-b.x,b.y2-b.y);
        for (let y = Math.floor(b.y/tile)*tile; y < b.y2; y += tile) {
          for (let x = Math.floor(b.x/tile)*tile; x < b.x2; x += tile) {
            if ((Math.floor(x/tile)+Math.floor(y/tile)) % 2) continue;
            ctx.fillStyle = TILE;
            const left = Math.max(x,b.x), top = Math.max(y,b.y);
            ctx.fillRect(left,top,Math.min(x+tile,b.x2)-left,Math.min(y+tile,b.y2)-top);
          }
        }
      }
      for (const quality of [.9,.8,.65,.5,.35,.2]) {
        const image = canvas.toDataURL('image/jpeg',quality);
        if (/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(image) && image.length <= MAX_IMAGE) return {image,imageMarks};
      }
      throw Error('压缩后仍超过单图 200 KB，请裁剪截图后重试。');
    } finally { canvas.width = 0; canvas.height = 0; }
  }
  return Object.freeze({validate,renderSvg,editorSvg:renderSvg,hitTest,translate,save});
});
