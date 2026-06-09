/* =========================================================
   照明カテゴリーのデータを楽天APIから生成（個別商品）
   実行: node tools/build-lighting.js
   - タイプ別にレビュー数順で収集 → ノイズ除去 → 上位N件
   - 商品名＋説明文から 畳数・明るさ(lm)・光色・光源・リモコン・メーカー を抽出
   - data/lighting.json を生成（価格・画像・リンクは楽天提供）
========================================================= */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'lighting.json');
const API = 'https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401';
const ORIGIN = process.env.RAKUTEN_ORIGIN || 'https://sakko1.github.io';
const PER_TYPE = 24, PAGES = 6, MINPRICE = 1500;

const cfg = { a: process.env.RAKUTEN_APP_ID, k: process.env.RAKUTEN_ACCESS_KEY, f: process.env.RAKUTEN_AFFILIATE_ID };

const TYPES = [
  { label: 'シーリングライト', slug: 'ceiling',    kw: 'シーリングライト LED', re: /シーリングライト/ },
  { label: 'ペンダントライト', slug: 'pendant',    kw: 'ペンダントライト LED 照明', re: /ペンダント/ },
  { label: 'スポットライト',   slug: 'spot',       kw: 'スポットライト LED 天井 照明', re: /スポットライト/ },
  { label: 'ダウンライト',     slug: 'down',       kw: 'ダウンライト LED', re: /ダウンライト/ },
  { label: 'ブラケットライト', slug: 'bracket',    kw: 'ブラケットライト LED 壁', re: /ブラケット/ },
  { label: 'テープライト',     slug: 'tape',       kw: 'LEDテープライト 照明', re: /テープライト|テープ ?LED/ },
  { label: 'シャンデリア',     slug: 'chandelier', kw: 'シャンデリア LED 照明', re: /シャンデリア/ },
  { label: 'フロアライト',     slug: 'floor',      kw: 'フロアライト フロアスタンド LED 照明', re: /フロア(ライト|スタンド)/ },
  { label: 'テーブルライト',   slug: 'table',      kw: 'テーブルライト デスクライト LED 照明', re: /(テーブルライト|デスクライト|スタンドライト)/ },
  { label: '間接照明',         slug: 'indirect',   kw: '間接照明 LED ライン照明', re: /間接照明|ラインライト/ },
  { label: 'ベースライト',     slug: 'base',       kw: 'ベースライト LED 照明 直付', re: /ベースライト/ },
  { label: 'フットライト',     slug: 'foot',       kw: 'フットライト LED 照明', re: /フットライト/ },
];

const NG = /(電球のみ|ランプのみ|交換用|スペア|替え|部品|パーツ|リモコンのみ|リモコン単品|工事|取付金具|適合確認|延長コード|本体のみ|カバーのみ|セードのみ|シェードのみ|中古|訳あり|福袋|まとめ買い|セット販売|電池|乾電池)/;

const MAKERS = [
  ['アイリスオーヤマ', /アイリスオーヤマ|IRIS ?OHYAMA|アイリス/i],
  ['パナソニック', /パナソニック|Panasonic/i],
  ['オーデリック', /オーデリック|ODELIC/i],
  ['大光電機', /大光電機|DAIKO/i],
  ['コイズミ照明', /コイズミ|KOIZUMI/i],
  ['ホタルクス', /ホタルクス|HotaluX|NEC/i],
  ['日立', /日立|HITACHI/i],
  ['東芝', /東芝|TOSHIBA/i],
  ['タキズミ', /タキズミ|TAKIZUMI/i],
  ['ニトリ', /ニトリ|NITORI/i],
  ['山田照明', /山田照明|YAMADA/i],
  ['ドウシシャ', /ドウシシャ|DOSHISHA|ルミナス/i],
  ['山善', /山善|YAMAZEN/i],
  ['バルミューダ', /バルミューダ|BALMUDA/i],
];

function detectMaker(s) { for (const [n, re] of MAKERS) if (re.test(s)) return n; return ''; }
function maxMatch(s, re) { let m, max = null; while ((m = re.exec(s))) { const v = +m[1]; if (v && (max === null || v > max)) max = v; } return max; }
function tatamiOf(s) { const v = maxMatch(s, /(\d{1,2})\s*畳/g); return (v && v <= 40) ? v : null; }
function lumenOf(s) { const v = maxMatch(s, /([0-9]{3,5})\s*(?:lm|LM|ｌｍ|ルーメン)/g); return v; }
function lightColor(s) {
  const dim = /調光/.test(s), col = /調色/.test(s) || /調光調色/.test(s);
  if (dim && col) return '調光・調色';
  if (col) return '調色';
  if (dim) return '調光';
  const fixed = ['電球色', '昼白色', '昼光色', '温白色', '白色'].filter(c => s.includes(c));
  return fixed.length ? fixed.join('・') : '';
}
function mountOf(s) {
  if (/引[っ]?掛(け)?シーリング|引掛/.test(s)) return '引掛シーリング';
  if (/ダクトレール|配線ダクト/.test(s)) return 'ダクトレール';
  if (/埋[め]?込/.test(s)) return '埋込';
  if (/直[付取]/.test(s)) return '直付け';
  if (/クリップ/.test(s)) return 'クリップ式';
  return '';
}
function cleanName(s) {
  return s.replace(/【[^】]*】/g, '').replace(/\[[^\]]*\]/g, '').replace(/[（(][^）)]*P\d+倍[^）)]*[）)]/g, '')
    .replace(/\s+/g, ' ').trim().slice(0, 48);
}
function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); }

async function fetchPage(kw, page, sort, attempt = 0) {
  const u = new URL(API);
  u.searchParams.set('applicationId', cfg.a); u.searchParams.set('accessKey', cfg.k);
  if (cfg.f) u.searchParams.set('affiliateId', cfg.f);
  u.searchParams.set('keyword', kw); u.searchParams.set('hits', '30'); u.searchParams.set('page', String(page));
  u.searchParams.set('format', 'json'); u.searchParams.set('imageFlag', '1'); u.searchParams.set('sort', sort);
  const r = await fetch(u, { headers: { Origin: ORIGIN, Referer: ORIGIN + '/' } });
  if ((r.status === 429 || r.status >= 500) && attempt < 4) { await new Promise(x => setTimeout(x, 1800 * (attempt + 1))); return fetchPage(kw, page, sort, attempt + 1); }
  const d = await r.json().catch(() => ({}));
  if (d.errors && attempt < 4) { await new Promise(x => setTimeout(x, 1800 * (attempt + 1))); return fetchPage(kw, page, sort, attempt + 1); }
  return d;
}

async function buildType(T, seen, need) {
  const out = [];
  for (let p = 1; p <= PAGES && out.length < need; p++) {
    const d = await fetchPage(T.kw, p, '-reviewCount');
    if (d.errors) { console.warn(`  ${T.label}: ${d.errors.errorMessage}`); break; }
    for (const w of (d.Items || [])) {
      if (out.length >= need) break;
      const i = w.Item || w; const n = i.itemName || ''; const cap = i.itemCaption || '';
      const text = n + ' ' + cap;
      if (!T.re.test(n) || NG.test(n) || !i.itemPrice || i.itemPrice < MINPRICE) continue;
      if (seen.has(i.itemCode)) continue;
      seen.add(i.itemCode);
      const img = ((i.mediumImageUrls && i.mediumImageUrls[0] && (i.mediumImageUrls[0].imageUrl || i.mediumImageUrls[0])) || '').replace(/_ex=\d+x\d+/, '_ex=400x400');
      out.push({
        id: 'light-' + hash(i.itemCode),
        maker: detectMaker(text), name: cleanName(n), type: T.label,
        tatami: tatamiOf(text), lumen: lumenOf(text), light_color: lightColor(text),
        light_source: /LED/i.test(text) ? 'LED' : '', power_w: null, lifespan_h: null,
        remote: /リモコン/.test(text) && !/リモコン別売/.test(text), mount: mountOf(text), diameter_mm: null,
        price: i.itemPrice, rakuten_item_code: i.itemCode,
        image_real: img, image: '', affiliate_url: i.affiliateUrl || i.itemUrl,
        affiliate_provider: '楽天市場', image_credit: '画像・リンク提供：楽天市場', url: '',
        color: '',
      });
    }
    await new Promise(x => setTimeout(x, 900));
  }
  return out;
}

(async () => {
  // 追記モード：既存があれば保持し、各タイプ PER_TYPE 件になるまで新規を追加
  let existing = [];
  if (fs.existsSync(OUT)) { try { existing = JSON.parse(fs.readFileSync(OUT, 'utf8')).products || []; } catch (e) {} }
  const seen = new Set(existing.map(p => p.rakuten_item_code));
  const countByType = {};
  existing.forEach(p => { countByType[p.type] = (countByType[p.type] || 0) + 1; });

  let added = [];
  for (const T of TYPES) {
    const need = Math.max(0, PER_TYPE - (countByType[T.label] || 0));
    if (need === 0) { console.log(`  - ${T.label}: 既に${countByType[T.label]}件（追加なし）`); continue; }
    const items = await buildType(T, seen, need);
    added = added.concat(items);
    console.log(`  ✓ ${T.label}: +${items.length}件（計${(countByType[T.label] || 0) + items.length}）`);
    await new Promise(x => setTimeout(x, 1500));
  }
  const products = existing.concat(added);
  const out = { category: 'lighting', category_label: '照明', updated: new Date().toISOString().slice(0, 10), products };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(`\n完了: 既存${existing.length} + 新規${added.length} = ${products.length}件`);
})();
