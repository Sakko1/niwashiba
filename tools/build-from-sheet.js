/* =========================================================
   スプレッドシート（CSV）→ data/carport.json を生成
   --------------------------------------------------------
   使い方:
   ① ローカルCSV:    node tools/build-from-sheet.js
                      （data/products.csv を読む）
   ② パス指定:        node tools/build-from-sheet.js path/to/file.csv
   ③ Googleシート:    node tools/build-from-sheet.js "https://docs.google.com/.../pub?output=csv"
      （またはURLを tools/sheet-source.txt に書いておけば引数不要）
   --------------------------------------------------------
   - 各行 = 1商品。シートに足した行がそのままサイトに反映される
   - 画像リンク(image_real)が空の行は、SVGイラストを自動生成して表示
   - 価格・数値が空なら「不明」表示、真偽は ○/× で記入
========================================================= */

const fs = require('fs');
const path = require('path');
const { COLUMNS, toBool, toInt, genId, parseCSV } = require('./sheet-schema');
const { buildSvg, IMG_DIR } = require('./gen-carport-images');

const ROOT = path.resolve(__dirname, '..');
const JSON_PATH = path.join(ROOT, 'data', 'carport.json');
const LOCAL_CSV = path.join(ROOT, 'data', 'products.csv');
const SOURCE_FILE = path.join(__dirname, 'sheet-source.txt');

async function readSource() {
  let src = process.argv[2];
  if (!src && fs.existsSync(SOURCE_FILE)) {
    src = fs.readFileSync(SOURCE_FILE, 'utf8').trim();
  }
  if (!src) src = LOCAL_CSV;

  if (/^https?:\/\//.test(src)) {
    console.log('読み込み元（URL）:', src);
    const res = await fetch(src);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  }
  console.log('読み込み元（ファイル）:', src);
  return fs.readFileSync(src, 'utf8');
}

function rowToProduct(headerMap, cells) {
  const get = key => {
    const idx = headerMap[key];
    return idx === undefined ? '' : (cells[idx] ?? '').trim();
  };
  const p = {};
  COLUMNS.forEach(col => {
    const raw = get(col.h);
    if (col.t === 'bool') p[col.k] = toBool(raw);
    else if (col.t === 'int') p[col.k] = toInt(raw);
    else p[col.k] = raw;
  });

  // ID補完（空なら maker+name から安定生成）
  if (!p.id) p.id = genId(p.maker, p.name);

  // 派生項目
  p.image = `images/carport/${p.id}.svg`;          // SVGフォールバック
  p.affiliate_provider = p.affiliate_url ? '楽天市場' : '';
  if (p.affiliate_url && !p.image_credit) p.image_credit = '画像・リンク提供：楽天市場';

  return p;
}

function main() {
  return readSource().then(text => {
    const rows = parseCSV(text);
    if (rows.length < 2) throw new Error('データ行がありません（見出し＋1行以上が必要）');

    // 見出し行 → 列名→indexのマップ
    const header = rows[0].map(h => h.trim());
    const headerMap = {};
    header.forEach((h, i) => { headerMap[h] = i; });

    // 必須列チェック
    ['メーカー', '商品名'].forEach(h => {
      if (!(h in headerMap)) throw new Error(`必須の列「${h}」が見出しにありません`);
    });

    const products = rows.slice(1).map(r => rowToProduct(headerMap, r))
      .filter(p => p.name); // 商品名が空の行は無視

    // ID重複チェック
    const seen = new Set();
    products.forEach(p => {
      if (seen.has(p.id)) console.warn(`⚠ IDが重複: ${p.id}（${p.name}）— IDを手動指定してください`);
      seen.add(p.id);
    });

    // carport.json を生成（カテゴリ情報は維持）
    const out = {
      category: 'carport',
      category_label: 'カーポート',
      updated: new Date().toISOString().slice(0, 10),
      products,
    };
    fs.writeFileSync(JSON_PATH, JSON.stringify(out, null, 2) + '\n', 'utf8');
    console.log(`✓ data/carport.json を生成（${products.length}件）`);

    // 画像リンクが無い商品はSVGを生成
    fs.mkdirSync(IMG_DIR, { recursive: true });
    let svgCount = 0;
    products.forEach(p => {
      if (!p.image_real) {
        fs.writeFileSync(path.join(IMG_DIR, `${p.id}.svg`), buildSvg(p), 'utf8');
        svgCount++;
      }
    });
    console.log(`✓ SVGフォールバック画像を ${svgCount} 件生成`);
    console.log('完了。git add -A && git commit && git push で公開できます。');
  });
}

main().catch(e => { console.error('✗', e.message); process.exit(1); });
