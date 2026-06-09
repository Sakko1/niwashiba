/* =========================================================
   照明データのスペックを楽天の商品説明文から強化（正確な値のみ）
   実行: node tools/enrich-lighting.js
   - 各タイプを再検索して itemCode→説明文 を集める
   - ラベル付きで明記された値だけを抽出し、空欄(不明)のみ補完
   - 既存の値は上書きしない／曖昧なものは不明のまま
========================================================= */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const JSON_PATH = path.join(ROOT, 'data', 'lighting.json');
const API = 'https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401';
const ORIGIN = process.env.RAKUTEN_ORIGIN || 'https://sakko1.github.io';
const cfg = { a: process.env.RAKUTEN_APP_ID, k: process.env.RAKUTEN_ACCESS_KEY, f: process.env.RAKUTEN_AFFILIATE_ID };

const KWS = [
  'シーリングライト LED', 'ペンダントライト LED 照明', 'スポットライト LED 天井 照明',
  'ダウンライト LED', 'ブラケットライト LED 壁', 'LEDテープライト 照明',
  'シャンデリア LED 照明', 'フロアライト フロアスタンド LED 照明',
  'テーブルライト デスクライト LED 照明', '間接照明 LED ライン照明',
  'ベースライト LED 照明 直付', 'フットライト LED 照明',
];

const MAKERS = [
  ['アイリスオーヤマ', /アイリスオーヤマ|IRIS ?OHYAMA/i], ['パナソニック', /パナソニック|Panasonic/i],
  ['オーデリック', /オーデリック|ODELIC/i], ['大光電機', /大光電機|DAIKO/i],
  ['コイズミ照明', /コイズミ(照明)?|KOIZUMI/i], ['ホタルクス', /ホタルクス|HotaluX/i],
  ['日立', /日立|HITACHI/i], ['東芝', /東芝ライテック|東芝|TOSHIBA/i], ['タキズミ', /タキズミ|TAKIZUMI/i],
  ['ニトリ', /ニトリ|NITORI/i], ['山田照明', /山田照明|YAMADA/i], ['遠藤照明', /遠藤照明|ENDO/i],
  ['ドウシシャ', /ドウシシャ|ルミナス/i], ['山善', /山善|YAMAZEN/i], ['アイリスプラザ', /アイリスプラザ/i],
  ['瀧住電機', /瀧住|TAKIZUMI/i], ['ヤザワ', /ヤザワ|YAZAWA/i], ['オーム電機', /オーム電機|OHM/i],
];

const num = s => parseInt(String(s).replace(/[,，]/g, ''), 10);
const maxOf = (text, re) => { let m, mx = null; while ((m = re.exec(text))) { const v = num(m[1]); if (v && (mx === null || v > mx)) mx = v; } return mx; };

// 正確抽出（ラベル付きのみ）
function extract(text) {
  const out = {};
  // 消費電力（「消費電力」ラベル必須・90W超はソケット容量の誤りとして除外）
  let m = text.match(/消費電力[\s\S]{0,10}?([0-9]{1,3}(?:\.[0-9])?)\s*[wWＷ]/);
  if (m) { const v = parseFloat(m[1]); if (v > 0 && v <= 90) out.power_w = v; }
  // 寿命（「寿命」ラベル必須）
  m = text.match(/(?:設計寿命|定格寿命|LED寿命|寿命)[\s\S]{0,8}?([0-9]{1,2}[,，]?[0-9]{3,4}|[0-9]{4,6})\s*時間/);
  if (m) { const v = num(m[1]); if (v >= 1000 && v <= 100000) out.lifespan_h = v; }
  // サイズ径（直径/外径/Φ + mm 必須）
  m = text.match(/(?:直径|外径|セード径|シェード径|本体径|傘径|Φ|φ|⌀)[\s\S]{0,4}?([0-9]{2,4})\s*(?:mm|ｍｍ)/);
  if (m) { const v = num(m[1]); if (v >= 30 && v <= 800) out.diameter_mm = v; }
  // 明るさ（lm/ルーメン 必須）
  const lm = maxOf(text, /([0-9][0-9,]{2,6})\s*(?:lm|LM|ｌｍ|ルーメン)/g);
  if (lm && lm >= 100 && lm <= 60000) out.lumen = lm;
  // 適用畳数（「畳」必須）
  const ta = maxOf(text, /([0-9]{1,2})\s*畳/g);
  if (ta && ta <= 40) out.tatami = ta;
  // 光色
  const dim = /調光/.test(text), col = /調色|調光調色/.test(text);
  if (dim && col) out.light_color = '調光・調色';
  else if (col) out.light_color = '調色';
  else if (dim) out.light_color = '調光';
  else { const fx = ['電球色', '昼白色', '昼光色', '温白色'].filter(c => text.includes(c)); if (fx.length) out.light_color = fx.join('・'); }
  // 光源
  if (/LED/i.test(text)) out.light_source = 'LED';
  // 取付方式
  if (/引[っ]?掛(け)?シーリング|引掛ローゼット|ローゼット/.test(text)) out.mount = '引掛シーリング';
  else if (/ダクトレール|配線ダクト/.test(text)) out.mount = 'ダクトレール';
  else if (/埋[め]?込/.test(text)) out.mount = '埋込';
  else if (/直[付取]/.test(text)) out.mount = '直付け';
  else if (/クリップ/.test(text)) out.mount = 'クリップ式';
  else if (/コンセント|電源プラグ/.test(text)) out.mount = 'コンセント式';
  // メーカー（既知ブランドのみ。曖昧な抽出はしない＝不明のまま）
  for (const [n, re] of MAKERS) if (re.test(text)) { out.maker = n; break; }
  return out;
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
  // itemCode → 本文（name+caption）を収集
  const cap = new Map();
  for (const kw of KWS) {
    for (let p = 1; p <= 2; p++) {
      const d = await fetchPage(kw, p);
      if (d.errors) break;
      for (const w of (d.Items || [])) { const i = w.Item || w; cap.set(i.itemCode, (i.itemName || '') + ' ' + (i.itemCaption || '')); }
      await new Promise(x => setTimeout(x, 900));
    }
  }
  console.log('説明文を収集:', cap.size, '件');

  const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const KEYS = ['power_w', 'lifespan_h', 'diameter_mm', 'lumen', 'tatami', 'light_color', 'light_source', 'mount', 'maker'];
  const before = {}, after = {};
  KEYS.forEach(k => { before[k] = data.products.filter(p => p[k] != null && p[k] !== '').length; });

  let enriched = 0;
  for (const p of data.products) {
    const text = cap.get(p.rakuten_item_code);
    if (!text) continue;
    const ex = extract(text);
    let changed = false;
    for (const k of KEYS) {
      // 空欄(不明)のみ補完。既存値は維持
      if ((p[k] == null || p[k] === '') && ex[k] != null && ex[k] !== '') { p[k] = ex[k]; changed = true; }
    }
    if (changed) enriched++;
  }
  KEYS.forEach(k => { after[k] = data.products.filter(p => p[k] != null && p[k] !== '').length; });

  data.updated = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');

  console.log('補完した商品:', enriched, '件 / 全' + data.products.length);
  console.log('項目別の充足（前→後）/144:');
  KEYS.forEach(k => console.log('  ' + k.padEnd(13) + ' ' + before[k] + ' → ' + after[k]));
})();
