/* =========================================================
   全カーポートモデルを「サイズ別バリエーション + カラー/オプション」に詳細化
   実行: node tools/build-variant-models.js
   - 各モデルを楽天APIで横断収集→サイズ(台数+型)別に最安を採用→variants化
   - 共通スペック(公式精緻化済み)とカラー/オプションを付与
   - 既存のカーポートSC(手組み)はそのまま維持し、他を作り直す
========================================================= */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const JSON_PATH = path.join(ROOT, 'data', 'carport.json');
const API = 'https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401';
const ORIGIN = process.env.RAKUTEN_ORIGIN || 'https://sakko1.github.io';
const PAGES = 4, MINPRICE = 80000, CAP = 14;

const cfg = process.env.RAKUTEN_APP_ID
  ? { a: process.env.RAKUTEN_APP_ID, k: process.env.RAKUTEN_ACCESS_KEY, f: process.env.RAKUTEN_AFFILIATE_ID }
  : (() => { const c = JSON.parse(fs.readFileSync(path.join(__dirname, 'rakuten-config.json'), 'utf8')); return { a: c.applicationId, k: c.accessKey, f: c.affiliateId }; })();

const NG = /(見積|お見積|下見|調査|現地|平板|フリーカット|オーダーカット|切り?売り|部品|パーツ|交換用|補修|サポート柱|補強支柱|柱のみ|単品|サンプル|中古|物置|サイクル|駐輪|テラス|ベランダ|連結金具|連結セット|延長セット|奥行延長|着脱式|アンカー|基礎のみ|ミニ)/;

const C_LIXIL = ['オータムブラウン', 'ナチュラルシルバー', 'シャイングレー', 'ブラック', 'ホワイト'];
const C_YKK = ['カームブラック', 'プラチナステン', 'ブラウン', 'ホワイト'];
const C_SANKYO = ['ブラック', 'アーバングレー', 'ブロンズ', 'サンシルバー', 'アイボリーホワイト'];
const C_SHIKOKU = ['ブラック', 'ブラウン', 'シルバー', 'ホワイト'];
const OPT = ['屋根材カラー選択', 'サイドパネル（オプション）'];
const OPT_LED = ['LED照明（オプション）', '屋根材カラー選択', 'サイドパネル（オプション）'];

const L = 'https://www.lixil.co.jp/', Y = 'https://www.ykkap.co.jp/', S = 'https://alumi.st-grp.co.jp/', K = 'https://kenzai.shikoku.co.jp/';

// シリーズ定義（共通スペックは公式確認値）
const MODELS = [
  { id: 'lixil-nesca-f', maker: 'LIXIL', series: 'ネスカF', match: 'ネスカF', kw: 'ネスカF カーポート LIXIL', sp: { roof_material: 'ポリカーボネート', roof_shape: 'フラット', support_type: '片側支持', wind_resist_mps: 38, heat_shield: false, warranty_years: 2 }, colors: C_LIXIL, options: OPT, url: L },
  { id: 'lixil-nesca-r', maker: 'LIXIL', series: 'ネスカR', match: 'ネスカR', kw: 'ネスカR カーポート LIXIL', sp: { roof_material: 'ポリカーボネート', roof_shape: 'アール', support_type: '片側支持', wind_resist_mps: 38, heat_shield: false, warranty_years: 2 }, colors: C_LIXIL, options: OPT, url: L },
  { id: 'lixil-fugo-f', maker: 'LIXIL', series: 'フーゴF', match: 'フーゴF', kw: 'フーゴF カーポート LIXIL', sp: { roof_material: 'ポリカーボネート', roof_shape: 'フラット', support_type: '片側支持', wind_resist_mps: 42, heat_shield: false, warranty_years: 2 }, colors: C_LIXIL, options: OPT, url: L },
  { id: 'lixil-fugo-r', maker: 'LIXIL', series: 'フーゴR', match: 'フーゴR', kw: 'フーゴR カーポート LIXIL', sp: { roof_material: 'ポリカーボネート', roof_shape: 'アール', support_type: '片側支持', wind_resist_mps: 42, heat_shield: false, warranty_years: 2 }, colors: C_LIXIL, options: OPT, url: L },
  { id: 'lixil-st', maker: 'LIXIL', series: 'カーポートST', match: 'カーポートST', kw: 'カーポートST LIXIL', sp: { roof_material: 'ポリカーボネート', roof_shape: 'フラット', support_type: '', wind_resist_mps: null, heat_shield: false, warranty_years: 2 }, colors: C_LIXIL, options: OPT, url: L },
  { id: 'lixil-sw', maker: 'LIXIL', series: 'カーポートSW', match: 'カーポートSW', kw: 'カーポートSW LIXIL', sp: { roof_material: 'アルミ形材', roof_shape: 'フラット', support_type: '片側支持', wind_resist_mps: 46, heat_shield: false, warranty_years: 2 }, colors: ['オフブラック', 'クリエラスク', 'クリエダーク', 'クリエモカ', 'ナチュラルシルバーF'], options: OPT, url: L },
  { id: 'lixil-archfran', maker: 'LIXIL', series: 'アーキフラン', match: 'アーキフラン', kw: 'アーキフラン カーポート LIXIL', sp: { roof_material: 'ポリカーボネート', roof_shape: 'フラット', support_type: '両側支持', wind_resist_mps: 42, heat_shield: false, warranty_years: 2 }, colors: C_LIXIL, options: OPT, url: L },
  { id: 'lixil-presio', maker: 'LIXIL', series: 'プレシオ', match: 'プレシオ', kw: 'プレシオ カーポート LIXIL', sp: { roof_material: 'ポリカーボネート', roof_shape: 'フラット', support_type: '両側支持', wind_resist_mps: 42, heat_shield: false, warranty_years: 2 }, colors: C_LIXIL, options: OPT, url: L },
  { id: 'ykkap-efluge', maker: 'YKK AP', series: 'エフルージュ', match: 'エフルージュ', kw: 'エフルージュ カーポート YKK', sp: { roof_material: 'ポリカーボネート', roof_shape: 'フラット', support_type: '片側支持', wind_resist_mps: 42, heat_shield: false, warranty_years: 2 }, colors: C_YKK, options: OPT, url: Y },
  { id: 'ykkap-arius', maker: 'YKK AP', series: 'アリュース', match: 'アリュース', kw: 'アリュース カーポート YKK', sp: { roof_material: 'ポリカーボネート', roof_shape: 'アール', support_type: '片側支持', wind_resist_mps: 42, heat_shield: false, warranty_years: 2 }, colors: C_YKK, options: OPT, url: Y },
  { id: 'ykkap-gport', maker: 'YKK AP', series: 'ジーポート', match: 'ジーポート', kw: 'ジーポート カーポート YKK', sp: { roof_material: 'スチール折板', roof_shape: 'フラット', support_type: '両側支持', wind_resist_mps: 46, heat_shield: false, warranty_years: 2 }, colors: C_YKK, options: OPT_LED, url: Y },
  { id: 'ykkap-reyna', maker: 'YKK AP', series: 'レイナポート', match: 'レイナポート', kw: 'レイナポート カーポート YKK', sp: { roof_material: '熱線遮断ポリカーボネート', roof_shape: 'アール', support_type: '片側支持', wind_resist_mps: 42, heat_shield: true, warranty_years: 2 }, colors: C_YKK, options: OPT, url: Y },
  { id: 'sankyo-selfy', maker: '三協アルミ', series: 'セルフィ', match: 'セルフィ', kw: 'セルフィ カーポート 三協アルミ', sp: { roof_material: 'ポリカーボネート', roof_shape: 'フラット', support_type: '片側支持', wind_resist_mps: 34, heat_shield: false, warranty_years: 2 }, colors: C_SANKYO, options: OPT_LED, url: S },
  { id: 'sankyo-skyreed', maker: '三協アルミ', series: 'スカイリード', match: 'スカイリード', kw: 'スカイリード カーポート 三協アルミ', sp: { roof_material: 'ポリカーボネート', roof_shape: 'フラット', support_type: '', wind_resist_mps: 46, heat_shield: false, warranty_years: 2 }, colors: C_SANKYO, options: OPT, url: S },
  { id: 'sankyo-doubleface', maker: '三協アルミ', series: 'ダブルフェース', match: 'ダブルフェース', kw: 'ダブルフェース カーポート 三協アルミ', sp: { roof_material: 'アルミ形材', roof_shape: 'フラット', support_type: '両側支持', wind_resist_mps: 46, heat_shield: false, warranty_years: 2 }, colors: C_SANKYO, options: OPT, url: S },
  { id: 'shikoku-myport', maker: '四国化成', series: 'マイポート', match: 'マイポート', kw: 'マイポート カーポート 四国化成', sp: { roof_material: 'アルミ形材', roof_shape: 'フラット', support_type: '両側支持', wind_resist_mps: null, heat_shield: false, warranty_years: 2 }, colors: C_SHIKOKU, options: OPT, url: K },
];

async function fetchPage(kw, page, attempt = 0) {
  const u = new URL(API);
  u.searchParams.set('applicationId', cfg.a); u.searchParams.set('accessKey', cfg.k);
  if (cfg.f) u.searchParams.set('affiliateId', cfg.f);
  u.searchParams.set('keyword', kw); u.searchParams.set('hits', '30');
  u.searchParams.set('page', String(page)); u.searchParams.set('format', 'json'); u.searchParams.set('imageFlag', '1');
  const r = await fetch(u, { headers: { Origin: ORIGIN, Referer: ORIGIN + '/' } });
  if ((r.status === 429 || r.status >= 500) && attempt < 4) { await new Promise(x => setTimeout(x, 1800 * (attempt + 1))); return fetchPage(kw, page, attempt + 1); }
  const d = await r.json().catch(() => ({}));
  if (d.errors && attempt < 4) { await new Promise(x => setTimeout(x, 1800 * (attempt + 1))); return fetchPage(kw, page, attempt + 1); }
  return d;
}

const cnt = s => /[3３]\s*台/.test(s) ? '3台用以上' : /[2２]\s*台/.test(s) ? '2台用' : /[1１]\s*台/.test(s) ? '1台用' : '';
const snowOf = s => { const m = s.match(/(?:耐)?積雪\s*([0-9]{2,3})\s*cm/); return m ? +m[1] : null; };

async function buildModel(M) {
  const byKey = new Map();
  for (let p = 1; p <= PAGES; p++) {
    const d = await fetchPage(M.kw, p);
    if (d.errors) { console.warn(`  ${M.series}: ${d.errors.errorMessage}`); break; }
    for (const w of (d.Items || [])) {
      const i = w.Item || w; const n = i.itemName || '';
      if (!n.includes(M.match) || NG.test(n) || !i.itemPrice || i.itemPrice < MINPRICE) continue;
      const c = cnt(n); if (!c) continue;
      // サイズトークン（メーカーで形式が異なる）
      let token = '', wmm = null, dmm = null;
      let m = n.match(/([0-9]{2,3})-([0-9]{2,3})型/);          // LIXIL: 24-50型 → 寸法も確定
      if (m) { token = `${m[1]}-${m[2]}`; wmm = +m[1] * 100; dmm = +m[2] * 100; }
      else {
        m = n.match(/(?:[^0-9]|^)([0-9]{2})-([0-9]{2})(?:[^0-9-]|$)/);  // YKK等: 54-60
        if (m) token = `${m[1]}-${m[2]}`;
        else { m = n.match(/(?:[ 　・□])([0-9]{4})(?:[ 　SCLHＳ]|$)/); if (m) token = m[1]; }  // 三協/四国: 5124
      }
      const key = c + '|' + token;
      const img = ((i.mediumImageUrls && i.mediumImageUrls[0] && (i.mediumImageUrls[0].imageUrl || i.mediumImageUrls[0])) || '').replace(/_ex=\d+x\d+/, '_ex=400x400');
      const cand = { label: token ? `${c} ${token}` : c, size_type: c, width_mm: wmm, depth_mm: dmm, clearance_mm: null, snow_resist_cm: snowOf(n), rakuten_item_code: i.itemCode, price: i.itemPrice, image_real: img, affiliate_url: i.affiliateUrl || i.itemUrl };
      const cur = byKey.get(key);
      if (!cur || cand.price < cur.price) byKey.set(key, cand);
    }
    await new Promise(x => setTimeout(x, 1200));
  }
  const sizeOrder = { '1台用': 1, '2台用': 2, '3台用以上': 3 };
  let variants = [...byKey.values()].sort((a, b) => (sizeOrder[a.size_type] - sizeOrder[b.size_type]) || a.width_mm - b.width_mm).slice(0, CAP);
  if (variants.length === 0) return null;
  const cheapest = variants.reduce((a, b) => (b.price < a.price ? b : a));
  const sizes = [...new Set(variants.map(v => v.size_type))];
  return Object.assign({
    id: M.id, maker: M.maker, name: M.series, type: 'model',
    size_type: sizes.length > 1 ? `${sizes[0]}〜${sizes[sizes.length - 1]}` : sizes[0],
    width_mm: null, depth_mm: null, height_mm: null, clearance_mm: null,
    color: '', lighting: false, colors: M.colors, options: M.options, variants,
    price: cheapest.price, image_real: cheapest.image_real, affiliate_url: cheapest.affiliate_url,
    affiliate_provider: '楽天市場', image_credit: '画像・リンク提供：楽天市場',
    rakuten_item_code: '', image: `images/carport/${M.id}.svg`, url: M.url,
  }, M.sp);
}

(async () => {
  const d = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  // 既存の有効モデル（SC・既に生成済みのvariantモデル）は保持
  const keepIds = new Set(['lixil-carport-sc']);
  const kept = d.products.filter(p => keepIds.has(p.id) || (Array.isArray(p.variants) && p.variants.length));
  const have = new Set(kept.map(p => p.id));
  const out = [...kept];
  const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;

  for (const M of MODELS) {
    if (have.has(M.id)) { console.log(`  - ${M.series}: 既存を保持`); continue; }
    if (ONLY && !ONLY.includes(M.id)) continue;
    const model = await buildModel(M);
    if (model) { out.push(model); console.log(`  ✓ ${M.series}: ${model.variants.length}サイズ ¥${model.price.toLocaleString()}〜`); }
    else console.warn(`  ⚠ ${M.series}: 出品が見つからず`);
    await new Promise(x => setTimeout(x, 2500)); // モデル間で待機（レート制限対策）
  }
  // MODELS順に整列
  const order = ['lixil-carport-sc', ...MODELS.map(m => m.id)];
  out.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  d.products = out;
  d.updated = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(JSON_PATH, JSON.stringify(d, null, 2) + '\n', 'utf8');
  console.log(`\n完了: ${out.length} モデル`);
})();
