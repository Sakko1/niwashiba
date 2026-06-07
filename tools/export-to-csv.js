/* =========================================================
   現在の data/carport.json を スプレッドシート用CSV に書き出す
   実行: node tools/export-to-csv.js
   出力: data/products.csv（これがマスターシートの初期データになる）
   ※ 通常は最初の1回だけ実行（以後はシート→JSONの方向で運用）
========================================================= */

const fs = require('fs');
const path = require('path');
const { COLUMNS, fromBool, escapeCSV } = require('./sheet-schema');

const ROOT = path.resolve(__dirname, '..');
const JSON_PATH = path.join(ROOT, 'data', 'carport.json');
const CSV_PATH = path.join(ROOT, 'data', 'products.csv');

function cell(p, col) {
  const v = p[col.k];
  if (col.t === 'bool') return fromBool(v);
  if (v === null || v === undefined) return '';
  return v;
}

function main() {
  const d = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const lines = [];
  lines.push(COLUMNS.map(c => escapeCSV(c.h)).join(','));
  d.products.forEach(p => {
    lines.push(COLUMNS.map(c => escapeCSV(cell(p, c))).join(','));
  });
  // ExcelやGoogleで文字化けしないようBOM付きUTF-8で保存
  fs.writeFileSync(CSV_PATH, '﻿' + lines.join('\r\n') + '\r\n', 'utf8');
  console.log('書き出し完了:', CSV_PATH, `(${d.products.length}件)`);
}

main();
