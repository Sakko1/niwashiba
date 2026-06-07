/* =========================================================
   スプレッドシート（CSV）の列定義 ＆ 変換ヘルパー
   export-to-csv.js と build-from-sheet.js の両方で使う共通モジュール
========================================================= */

// シートの列（順番＝CSVの列順）。h=見出し, k=JSONキー, t=型
const COLUMNS = [
  { h: 'ID',               k: 'id',                t: 'string' },
  { h: 'メーカー',         k: 'maker',             t: 'string' },
  { h: '商品名',           k: 'name',              t: 'string' },
  { h: 'タイプ',           k: 'size_type',         t: 'string' },
  { h: '間口mm',           k: 'width_mm',          t: 'int' },
  { h: '奥行mm',           k: 'depth_mm',          t: 'int' },
  { h: '高さmm',           k: 'height_mm',         t: 'int' },
  { h: '有効高さmm',       k: 'clearance_mm',      t: 'int' },
  { h: '屋根材',           k: 'roof_material',     t: 'string' },
  { h: '屋根形状',         k: 'roof_shape',        t: 'string' },
  { h: '柱',               k: 'support_type',      t: 'string' },
  { h: '耐積雪cm',         k: 'snow_resist_cm',    t: 'int' },
  { h: '耐風圧mps',        k: 'wind_resist_mps',   t: 'int' },
  { h: '熱線遮断',         k: 'heat_shield',       t: 'bool' },
  { h: '天井照明',         k: 'lighting',          t: 'bool' },
  { h: 'カラー',           k: 'color',             t: 'string' },
  { h: '保証年',           k: 'warranty_years',    t: 'int' },
  { h: '価格',             k: 'price',             t: 'int' },
  { h: '楽天商品コード',   k: 'rakuten_item_code', t: 'string' },
  { h: '画像リンク',       k: 'image_real',        t: 'string' },
  { h: 'アフィリエイトリンク', k: 'affiliate_url', t: 'string' },
  { h: '公式URL',          k: 'url',               t: 'string' },
  { h: '画像クレジット',   k: 'image_credit',      t: 'string' },
];

// 真偽値 → シート表記
function fromBool(v) {
  return v === true ? '○' : (v === false ? '×' : '');
}
// シート表記 → 真偽値
function toBool(s) {
  const t = String(s).trim().toLowerCase();
  if (['○', '◯', 'o', 'true', '1', 'あり', 'yes', 'y'].includes(t)) return true;
  if (['×', 'x', 'false', '0', 'なし', 'no', 'n', ''].includes(t)) return false;
  return false;
}
// シート文字列 → 数値（空なら null＝不明）
function toInt(s) {
  const t = String(s).replace(/[,，\s¥円]/g, '').trim();
  if (t === '') return null;
  const n = parseInt(t, 10);
  return Number.isNaN(n) ? null : n;
}

// 文字列から安定したID（maker+nameのハッシュ）。IDが空の行で使用
function genId(maker, name) {
  const str = (maker || '') + '|' + (name || '');
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return 'p-' + h.toString(36);
}

// CSV文字列 → 2次元配列（ダブルクオート/カンマ/改行に対応）
function parseCSV(text) {
  text = text.replace(/^﻿/, ''); // BOM除去
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* skip */ }
      else field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.length && r.some(c => c.trim() !== ''));
}

// 1フィールドをCSV用にエスケープ
function escapeCSV(v) {
  const s = (v === null || v === undefined) ? '' : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

module.exports = { COLUMNS, fromBool, toBool, toInt, genId, parseCSV, escapeCSV };
