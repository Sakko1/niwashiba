/* =========================================================
   候補CSV(data/_candidates-carport.csv) → carport.json へ取り込み
   - シリーズ別の確実なスペックを付与（SERIES_SPECS）
   - 商品名から 寸法・形状・柱・耐雪 を解析
   - ノイズ除外、1モデル1行で重複排除（既存データとも照合）
   - price/image/link は空のまま → 後で refresh-rakuten.js が補完
========================================================= */
const fs = require('fs');
const path = require('path');
const { parseCSV } = require('./sheet-schema');

const ROOT = path.resolve(__dirname, '..');
const JSON_PATH = path.join(ROOT, 'data', 'carport.json');
const CSV_PATH = path.join(ROOT, 'data', '_candidates-carport.csv');

const MAKER_SLUG = { 'LIXIL': 'lixil', 'YKK AP': 'ykkap', '三協アルミ': 'sankyo', '四国化成': 'shikoku' };
const SERIES_SLUG = {
  'アーキフラン': 'archfran', 'カーポートSC': 'sc', 'カーポートST': 'st', 'カーポートSW': 'sw',
  'ネスカ': 'nesca', 'フーゴ': 'fugo', 'プレシオ': 'presio', 'スピーネ': 'spine', 'テリオスポート': 'terios',
  'アリュース': 'alus', 'エフルージュ': 'efluge', 'ジーポート': 'gport',
  'レイナツインポート': 'reynatwin', 'レイナポート': 'reyna',
  'スカイリード': 'skyreed', 'セルフィ': 'selfy', 'ダブルフェース': 'doubleface',
  'マイポート': 'myport',
};
const SIZE_SLUG = { '1台用': '1', '2台用': '2', '3台用以上': '3', '': 'x' };

// シリーズ別の確実なスペック（公式・定番知識ベース。null=商品により変動→不明 or 名前解析で補う）
const SERIES_SPECS = {
  'カーポートSC':   { roof: 'アルミ形材', shape: 'フラット', support: '片側支持', wind: 46, heat: false, warranty: 2 },
  'カーポートSW':   { roof: 'アルミ形材', shape: 'フラット', support: '片側支持', wind: 46, heat: false, warranty: 2 },
  'カーポートST':   { roof: 'ポリカーボネート', shape: 'フラット', support: null, wind: null, heat: false, warranty: 2 },
  'ネスカ':         { roof: 'ポリカーボネート', shape: null, support: '片側支持', wind: 42, heat: false, warranty: 2 },
  'フーゴ':         { roof: 'ポリカーボネート', shape: null, support: '片側支持', wind: 42, heat: false, warranty: 2 },
  'アーキフラン':   { roof: 'ポリカーボネート', shape: 'フラット', support: null, wind: 42, heat: false, warranty: 2 },
  'プレシオ':       { roof: 'ポリカーボネート', shape: 'フラット', support: null, wind: 42, heat: false, warranty: 2 },
  'アリュース':     { roof: 'ポリカーボネート', shape: null, support: '片側支持', wind: 42, heat: false, warranty: 2 },
  'エフルージュ':   { roof: 'ポリカーボネート', shape: 'フラット', support: '片側支持', wind: 42, heat: false, warranty: 2 },
  'ジーポート':     { roof: '折板', shape: 'フラット', support: '両側支持', wind: null, heat: false, warranty: 2 },
  'レイナツインポート': { roof: '熱線遮断ポリカーボネート', shape: 'アール', support: '両側支持', wind: 42, heat: true, warranty: 2 },
  'レイナポート':   { roof: '熱線遮断ポリカーボネート', shape: 'アール', support: '片側支持', wind: 42, heat: true, warranty: 2 },
  'スカイリード':   { roof: 'ポリカーボネート', shape: 'フラット', support: null, wind: 46, heat: false, warranty: 2 },
  'セルフィ':       { roof: 'ポリカーボネート', shape: 'フラット', support: '片側支持', wind: 46, heat: false, warranty: 2 },
  'ダブルフェース': { roof: 'アルミ形材', shape: 'フラット', support: '両側支持', wind: 46, heat: false, warranty: 2 },
  'マイポート':     { roof: '折板', shape: 'フラット', support: '両側支持', wind: null, heat: false, warranty: 2 },
};

// 明らかに車用カーポートでない/ノイズの名前
const NOISE = /(サイクルポート|駐輪|自転車|ミニ\b)/;

function intOr(v) { return v === '' || v == null ? null : parseInt(v, 10); }

// 商品名からスペックを解析
function parseFromName(name) {
  const r = {};
  // 寸法 W◯◯◯×L◯◯◯
  let m = name.match(/W\s*([0-9]{3,5})\s*[×x]\s*L\s*([0-9]{3,5})/i);
  if (m) { r.width = +m[1]; r.depth = +m[2]; }
  // ◯◯-◯◯型 → 間口×奥行（×100）
  if (!r.width) {
    m = name.match(/\b([0-9]{2,3})-([0-9]{2,3})型/);
    if (m) { r.width = +m[1] * 100; r.depth = +m[2] * 100; }
  }
  // 耐積雪
  m = name.match(/(?:耐)?積雪\s*([0-9]{2,3})\s*cm/);
  if (m) r.snow = +m[1];
  // 形状（F=フラット / R・A=アール）
  if (/(ネスカF|フーゴF|エフルージュ.*FLAT|フラット)/.test(name)) r.shape = 'フラット';
  else if (/(ネスカR|フーゴR|フーゴA|アール)/.test(name)) r.shape = 'アール';
  // 柱支持
  if (/両側支持/.test(name)) r.support = '両側支持';
  else if (/(片側支持|片流れ)/.test(name)) r.support = '片側支持';
  // 熱線遮断
  if (/熱線遮断/.test(name)) r.heat = true;
  return r;
}

function main() {
  const d = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const rows = parseCSV(fs.readFileSync(CSV_PATH, 'utf8')).slice(1);

  // 既存の重複防止：item_code と モデルキー(メーカー|シリーズ|台数)
  const existingCodes = new Set(d.products.map(p => p.rakuten_item_code).filter(Boolean));
  const seenModel = new Set();
  // 既存商品のモデルキーも登録（名前からシリーズ推定）
  const SERIES_LIST = Object.keys(SERIES_SLUG).sort((a, b) => b.length - a.length);
  for (const p of d.products) {
    const s = SERIES_LIST.find(k => (p.name || '').includes(k) || (p.name || '').replace('F', '').replace('R', '').includes(k));
    if (s) seenModel.add([p.maker, s, p.size_type].join('|'));
  }

  let added = 0, skipped = 0;
  for (const c of rows) {
    const [, maker, series, size, snowCol, , , itemCode, name] = c;
    if (NOISE.test(name)) { skipped++; continue; }
    if (existingCodes.has(itemCode)) { skipped++; continue; }
    const modelKey = [maker, series, size].join('|');
    if (seenModel.has(modelKey)) { skipped++; continue; }   // 1モデル1行
    if (!SERIES_SLUG[series] || !MAKER_SLUG[maker]) { skipped++; continue; }

    const spec = SERIES_SPECS[series] || {};
    const np = parseFromName(name);
    const id = `${MAKER_SLUG[maker]}-${SERIES_SLUG[series]}-${SIZE_SLUG[size]}${added}`;
    const snow = np.snow ?? intOr(snowCol) ?? null;

    const prod = {
      id,
      maker,
      name: `${series}${size ? ' ' + size : ''}`.trim(),
      size_type: size || '',
      width_mm: np.width ?? null,
      depth_mm: np.depth ?? null,
      height_mm: null,
      clearance_mm: null,
      roof_material: spec.roof ?? '',
      roof_shape: np.shape ?? spec.shape ?? '',
      support_type: np.support ?? spec.support ?? '',
      snow_resist_cm: snow,
      wind_resist_mps: spec.wind ?? null,
      heat_shield: np.heat ?? spec.heat ?? false,
      lighting: false,
      color: '',
      warranty_years: spec.warranty ?? null,
      price: null,
      rakuten_item_code: itemCode,
      image_real: '', affiliate_url: '', image_credit: '', affiliate_provider: '',
      image: `images/carport/${id}.svg`,
      url: maker === 'LIXIL' ? 'https://www.lixil.co.jp/' :
        maker === 'YKK AP' ? 'https://www.ykkap.co.jp/' :
        maker === '三協アルミ' ? 'https://alumi.st-grp.co.jp/' : 'https://kenzai.shikoku.co.jp/',
    };
    d.products.push(prod);
    seenModel.add(modelKey);
    added++;
  }

  d.updated = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(JSON_PATH, JSON.stringify(d, null, 2) + '\n', 'utf8');
  console.log(`取り込み ${added} 件 / 除外 ${skipped} 件 / 合計 ${d.products.length} 件`);
}
main();
