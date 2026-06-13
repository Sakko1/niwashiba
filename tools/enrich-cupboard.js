/* =========================================================
   カップボードのスペックを楽天の商品説明文から強化（正確な値のみ）
   実行: node tools/enrich-cupboard.js
   - 各タイプを再検索して itemCode→説明文 を集める
   - 「幅×奥行×高さ」まとめ表記や W×D×H(mm) にも対応して寸法を抽出
   - 空欄(不明)のみ補完。既存値は維持
========================================================= */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const JSON_PATH = path.join(ROOT, 'data', 'cupboard.json');
const API = 'https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401';
const ORIGIN = process.env.RAKUTEN_ORIGIN || 'https://sakko1.github.io';
const cfg = { a: process.env.RAKUTEN_APP_ID, k: process.env.RAKUTEN_ACCESS_KEY, f: process.env.RAKUTEN_AFFILIATE_ID };

const KWS = [
  'キッチンボード レンジボード 食器棚', '食器棚 ハイタイプ', '食器棚 ロータイプ',
  'キッチンカウンター 収納 完成品', 'レンジ台 レンジラック', '隙間収納 キッチン スリム 食器棚',
  '食器棚 ミニ コンパクト 一人暮らし', 'キッチンラック 家電収納',
];

const COLORS = ['ホワイト', 'ブラック', 'ナチュラル', 'ブラウン', 'グレー', 'オーク', 'ウォールナット', 'ベージュ', 'ネイビー'];

// 寸法抽出（cm。まとめ表記・W×D×H(mm)・個別ラベルに対応）
function extractDims(text) {
  const out = {};
  const X = '[×xＸ✕・]';
  // 1) 幅A×奥行B×高さC（末尾に cm/mm が1回だけのことが多い）
  let m = text.match(new RegExp('幅\\s*約?\\s*([\\d.]+)\\s*' + X + '\\s*奥行(?:き)?\\s*約?\\s*([\\d.]+)\\s*' + X + '\\s*高さ\\s*約?\\s*([\\d.]+)\\s*(cm|mm|ｃｍ|ｍｍ|センチ)?'));
  if (m) {
    const unit = m[4] || '';
    const mm = /mm|ｍｍ/.test(unit);
    const conv = v => { v = parseFloat(v); if (mm || (!unit && v > 260)) v = Math.round(v / 10); return v; };
    assign(out, conv(m[1]), conv(m[2]), conv(m[3]));
  }
  // 2) W900×D450×H1800 など（英字ラベル）
  if (out.width_cm == null) {
    m = text.match(new RegExp('W\\s*([\\d]+)\\s*' + X + '\\s*D\\s*([\\d]+)\\s*' + X + '\\s*H\\s*([\\d]+)', 'i'));
    if (m) { const conv = v => { v = parseInt(v, 10); if (v > 260) v = Math.round(v / 10); return v; }; assign(out, conv(m[1]), conv(m[2]), conv(m[3])); }
  }
  // 3) 個別ラベル（ラベル＋数値＋cm/mm を厳格に）
  if (out.width_cm == null) out.width_cm = single(text, '幅', 15, 300);
  if (out.depth_cm == null) out.depth_cm = single(text, '奥行(?:き)?', 15, 120);
  if (out.height_cm == null) out.height_cm = single(text, '高さ', 15, 260);
  // 不正値の除去
  if (!(out.width_cm >= 15 && out.width_cm <= 300)) delete out.width_cm;
  if (!(out.depth_cm >= 15 && out.depth_cm <= 120)) delete out.depth_cm;
  if (!(out.height_cm >= 15 && out.height_cm <= 260)) delete out.height_cm;
  return out;
}
function assign(out, w, d, h) {
  if (w >= 15 && w <= 300) out.width_cm = w;
  if (d >= 15 && d <= 120) out.depth_cm = d;
  if (h >= 15 && h <= 260) out.height_cm = h;
}
function single(text, label, min, max) {
  let m = text.match(new RegExp(label + '\\s*約?\\s*([\\d.]+)\\s*cm'));
  if (m) { const v = parseFloat(m[1]); if (v >= min && v <= max) return v; }
  m = text.match(new RegExp(label + '\\s*約?\\s*([\\d]{3,4})\\s*mm'));
  if (m) { const v = Math.round(parseInt(m[1], 10) / 10); if (v >= min && v <= max) return v; }
  return null;
}
function extractColor(text) {
  const f = COLORS.filter(c => text.includes(c));
  return f.length ? f.slice(0, 4).join('・') : '';
}

async function fetchPage(kw, page, attempt = 0) {
  const u = new URL(API);
  u.searchParams.set('applicationId', cfg.a); u.searchParams.set('accessKey', cfg.k);
  if (cfg.f) u.searchParams.set('affiliateId', cfg.f);
  u.searchParams.set('keyword', kw); u.searchParams.set('hits', '30'); u.searchParams.set('page', String(page));
  u.searchParams.set('format', 'json'); u.searchParams.set('sort', '-reviewCount');
  const r = await fetch(u, { headers: { Origin: ORIGIN, Referer: ORIGIN + '/' } });
  if ((r.status === 429 || r.status >= 500) && attempt < 4) { await new Promise(x => setTimeout(x, 1800 * (attempt + 1))); return fetchPage(kw, page, attempt + 1); }
  const d = await r.json().catch(() => ({}));
  if (d.errors && attempt < 4) { await new Promise(x => setTimeout(x, 1800 * (attempt + 1))); return fetchPage(kw, page, attempt + 1); }
  return d;
}

(async () => {
  const cap = new Map();
  for (const kw of KWS) {
    for (let p = 1; p <= 3; p++) {
      const d = await fetchPage(kw, p);
      if (d.errors) break;
      for (const w of (d.Items || [])) { const i = w.Item || w; cap.set(i.itemCode, (i.itemName || '') + ' ' + (i.itemCaption || '')); }
      await new Promise(x => setTimeout(x, 900));
    }
  }
  console.log('説明文を収集:', cap.size, '件');

  const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const KEYS = ['width_cm', 'depth_cm', 'height_cm', 'color', 'assembled'];
  const before = {}; KEYS.forEach(k => before[k] = data.products.filter(p => p[k] != null && p[k] !== '').length);

  let enriched = 0;
  for (const p of data.products) {
    const text = cap.get(p.rakuten_item_code);
    if (!text) continue;
    const dims = extractDims(text);
    let changed = false;
    for (const k of ['width_cm', 'depth_cm', 'height_cm']) {
      if (p[k] == null && dims[k] != null) { p[k] = dims[k]; changed = true; }
    }
    if ((p.color == null || p.color === '')) { const c = extractColor(text); if (c) { p.color = c; changed = true; } }
    if (p.assembled == null) {
      if (/完成品/.test(text)) { p.assembled = true; changed = true; }
      else if (/組[み]?立/.test(text)) { p.assembled = false; changed = true; }
    }
    if (changed) enriched++;
  }
  const after = {}; KEYS.forEach(k => after[k] = data.products.filter(p => p[k] != null && p[k] !== '').length);

  data.updated = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');

  console.log('補完した商品:', enriched, '件 / 全' + data.products.length);
  console.log('充足（前→後）/' + data.products.length + ':');
  KEYS.forEach(k => console.log('  ' + k.padEnd(11) + ' ' + before[k] + ' → ' + after[k]));
})();
