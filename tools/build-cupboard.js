/* =========================================================
   カップボード（食器棚・キッチン収納）のデータを楽天APIから生成
   実行: node tools/build-cupboard.js
   - タイプ別にレビュー数順で収集 → ノイズ除去 → 上位N件
   - 商品名＋説明文から 幅/奥行/高さ・カラー・完成品・コンセント を抽出
   - 追記モード：既存があれば保持し、各タイプ PER_TYPE 件まで追加
========================================================= */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'cupboard.json');
const API = 'https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401';
const ORIGIN = process.env.RAKUTEN_ORIGIN || 'https://sakko1.github.io';
const PER_TYPE = 50, PAGES = 12, MINPRICE = 3000;

const cfg = { a: process.env.RAKUTEN_APP_ID, k: process.env.RAKUTEN_ACCESS_KEY, f: process.env.RAKUTEN_AFFILIATE_ID };

const TYPES = [
  { label: 'キッチンボード',     slug: 'board',   kw: 'キッチンボード レンジボード 食器棚', re: /(キッチンボード|レンジボード|カップボード)/ },
  { label: '食器棚（ハイタイプ）', slug: 'high',   kw: '食器棚 ハイタイプ', re: /食器棚/ },
  { label: '食器棚（ロータイプ）', slug: 'low',    kw: '食器棚 ロータイプ', re: /食器棚/ },
  { label: 'キッチンカウンター', slug: 'counter', kw: 'キッチンカウンター 収納 完成品', re: /カウンター/ },
  { label: 'レンジ台・レンジラック', slug: 'range', kw: 'レンジ台 レンジラック', re: /(レンジ台|レンジラック)/ },
  { label: '隙間収納（スリム）', slug: 'slim',    kw: '隙間収納 キッチン スリム 食器棚', re: /(隙間|すき間|スリム)/ },
  { label: 'ミニ食器棚',         slug: 'mini',    kw: '食器棚 ミニ コンパクト 一人暮らし', re: /食器棚/ },
  { label: '家電収納ラック',     slug: 'rack',    kw: 'キッチンラック 家電収納', re: /(キッチンラック|家電収納|レンジラック)/ },
];

// キッチン収納と無関係なもの・部品類を除外
const NG = /(ゴミ箱|ダストボックス|ダストワゴン|収納ケース|衣類|押入れ|クローゼット|本棚|テレビ台|洗面|ランドリー|部品|取っ手|扉のみ|棚板のみ|補修|シート|フィルム|転倒防止|耐震|マット|中古|サンプル|ステッカー|脚のみ|キャスターのみ)/;

const num = s => parseFloat(String(s).replace(/[,，]/g, ''));

// 寸法抽出（cm。「幅88.8cm」「幅 約90cm」等。mm表記は cm に換算）
function dim(text, label) {
  let m = text.match(new RegExp(label + '\\s*(?:約)?\\s*([0-9]{2,4}(?:\\.[0-9])?)\\s*cm'));
  if (m) { const v = num(m[1]); if (v >= 15 && v <= 300) return v; }
  m = text.match(new RegExp(label + '\\s*(?:約)?\\s*([0-9]{3,4})\\s*mm'));
  if (m) { const v = Math.round(num(m[1]) / 10); if (v >= 15 && v <= 300) return v; }
  return null;
}

const COLORS = ['ホワイト', 'ブラック', 'ナチュラル', 'ブラウン', 'グレー', 'オーク', 'ウォールナット', 'ベージュ', 'ネイビー'];
function colorOf(text) {
  const found = COLORS.filter(c => text.includes(c));
  return found.length ? found.slice(0, 4).join('・') : '';
}

function cleanName(s) {
  return s.replace(/【[^】]*】/g, '').replace(/\[[^\]]*\]/g, '')
    .replace(/[（(][^）)]*(?:クーポン|P\d+倍|ポイント|SALE|セール)[^）)]*[）)]/gi, '')
    .replace(/\s+/g, ' ').trim().slice(0, 48);
}
function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); }

async function fetchPage(kw, page, attempt = 0) {
  const u = new URL(API);
  u.searchParams.set('applicationId', cfg.a); u.searchParams.set('accessKey', cfg.k);
  if (cfg.f) u.searchParams.set('affiliateId', cfg.f);
  u.searchParams.set('keyword', kw); u.searchParams.set('hits', '30'); u.searchParams.set('page', String(page));
  u.searchParams.set('format', 'json'); u.searchParams.set('imageFlag', '1'); u.searchParams.set('sort', '-reviewCount');
  const r = await fetch(u, { headers: { Origin: ORIGIN, Referer: ORIGIN + '/' } });
  if ((r.status === 429 || r.status >= 500) && attempt < 4) { await new Promise(x => setTimeout(x, 1800 * (attempt + 1))); return fetchPage(kw, page, attempt + 1); }
  const d = await r.json().catch(() => ({}));
  if (d.errors && attempt < 4) { await new Promise(x => setTimeout(x, 1800 * (attempt + 1))); return fetchPage(kw, page, attempt + 1); }
  return d;
}

async function buildType(T, seen, need) {
  const out = [];
  for (let p = 1; p <= PAGES && out.length < need; p++) {
    const d = await fetchPage(T.kw, p);
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
        id: 'cb-' + hash(i.itemCode),
        name: cleanName(n), type: T.label, maker: '',
        width_cm: dim(text, '幅'), depth_cm: dim(text, '奥行き?'), height_cm: dim(text, '高さ'),
        color: colorOf(text),
        assembled: /完成品/.test(text) ? true : (/組[み]?立/.test(text) ? false : null),
        outlet: /コンセント/.test(text),
        price: i.itemPrice, rakuten_item_code: i.itemCode,
        image_real: img, image: '', affiliate_url: i.affiliateUrl || i.itemUrl,
        affiliate_provider: '楽天市場', image_credit: '画像・リンク提供：楽天市場', url: '',
      });
    }
    await new Promise(x => setTimeout(x, 900));
  }
  return out;
}

(async () => {
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
  const out = { category: 'cupboard', category_label: 'カップボード', updated: new Date().toISOString().slice(0, 10), products };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(`\n完了: 既存${existing.length} + 新規${added.length} = ${products.length}件`);
})();
