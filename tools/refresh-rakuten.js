/* =========================================================
   楽天商品検索APIで「価格・画像・アフィリエイトリンク」を自動取得
   実行: node tools/refresh-rakuten.js
   --------------------------------------------------------
   仕組み:
   - data/carport.json の各商品の "rakuten_item_code"（例 "jyupro:car-csc-kj"）を見て
   - 楽天APIから price / 画像URL / アフィリリンク を取得し、自動で書き込む
   - rakuten_item_code が空の商品はスキップ（手動データのまま）
   --------------------------------------------------------
   事前準備:
   1. https://webservice.rakuten.co.jp/ で「アプリID」を無料発行
   2. tools/rakuten-config.example.json を tools/rakuten-config.json にコピー
   3. applicationId と affiliateId（楽天アフィリエイトID）を記入
========================================================= */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const JSON_PATH = path.join(ROOT, 'data', 'carport.json');
const CONFIG_PATH = path.join(__dirname, 'rakuten-config.json');

// 新・楽天 OpenAPI（applicationId + accessKey の2点認証）
const API = 'https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401';
// 画像のサイズ（楽天画像URLの _ex=◯◯ を差し替えて高画質化）
const IMG_SIZE = '400x400';
// 新APIは Origin/Referer ヘッダーで認証（アプリ設定の「許可されたWebサイト」と一致が必要）
const SITE_ORIGIN = process.env.RAKUTEN_ORIGIN || 'https://sakko1.github.io';

function loadConfig() {
  // ① 環境変数を優先（GitHub Actions などの自動実行用）
  if (process.env.RAKUTEN_APP_ID) {
    return {
      applicationId: process.env.RAKUTEN_APP_ID,
      accessKey: process.env.RAKUTEN_ACCESS_KEY || '',
      affiliateId: process.env.RAKUTEN_AFFILIATE_ID || '',
    };
  }
  // ② ローカル設定ファイル
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('✗ 認証情報がありません。');
    console.error('  ローカル: tools/rakuten-config.json を作成（example をコピー）');
    console.error('  または環境変数 RAKUTEN_APP_ID / RAKUTEN_ACCESS_KEY / RAKUTEN_AFFILIATE_ID を設定してください。');
    process.exit(1);
  }
  const c = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  if (!c.applicationId || c.applicationId.includes('ここに')) {
    console.error('✗ applicationId が未設定です（楽天アプリID）。');
    process.exit(1);
  }
  if (!c.accessKey || c.accessKey.includes('ここに')) {
    console.error('✗ accessKey が未設定です（楽天アクセスキー）。');
    process.exit(1);
  }
  return c;
}

// 1商品分を楽天APIで取得
async function fetchItem(itemCode, cfg) {
  const url = new URL(API);
  url.searchParams.set('applicationId', cfg.applicationId);
  url.searchParams.set('accessKey', cfg.accessKey);
  if (cfg.affiliateId && !cfg.affiliateId.includes('ここに')) {
    url.searchParams.set('affiliateId', cfg.affiliateId);
  }
  url.searchParams.set('itemCode', itemCode);
  url.searchParams.set('format', 'json');
  url.searchParams.set('imageFlag', '1');
  url.searchParams.set('hits', '1');

  const res = await fetch(url, {
    headers: { 'Origin': SITE_ORIGIN, 'Referer': SITE_ORIGIN + '/' },
  });
  const data = await res.json().catch(() => ({}));
  // 新APIのエラー形式 {errors:{errorMessage}} / 旧形式 {error_description} の両対応
  if (data.errors) throw new Error(data.errors.errorMessage || JSON.stringify(data.errors));
  if (data.error) throw new Error(data.error_description || data.error);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (!data.Items || data.Items.length === 0) return null;
  // 新APIは Items[i] が直接商品オブジェクト、旧APIは Items[i].Item の場合あり
  return data.Items[0].Item || data.Items[0];
}

function pickImage(item) {
  const arr = item.mediumImageUrls || item.smallImageUrls || [];
  if (arr.length === 0) return '';
  // 20220601形式は文字列配列 or {imageUrl} のことがある
  let u = typeof arr[0] === 'string' ? arr[0] : (arr[0].imageUrl || '');
  // 高画質化：_ex=◯◯ を差し替え
  return u.replace(/_ex=\d+x\d+/, '_ex=' + IMG_SIZE);
}

async function main() {
  const cfg = loadConfig();
  const d = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));

  let updated = 0, skipped = 0, failed = 0;

  for (const p of d.products) {
    if (!p.rakuten_item_code || p.rakuten_item_code === '') { skipped++; continue; }
    try {
      const item = await fetchItem(p.rakuten_item_code, cfg);
      if (!item) { console.warn(`  ⚠ 見つかりません: ${p.rakuten_item_code} (${p.name})`); failed++; continue; }

      p.price = item.itemPrice ?? p.price;
      const img = pickImage(item);
      if (img) p.image_real = img;
      if (item.affiliateUrl) p.affiliate_url = item.affiliateUrl;
      else if (item.itemUrl) p.affiliate_url = item.itemUrl;
      p.affiliate_provider = '楽天市場';
      if (!p.image_credit) p.image_credit = '画像・リンク提供：楽天市場';

      console.log(`  ✓ ${p.name} → ¥${p.price.toLocaleString()}`);
      updated++;
    } catch (e) {
      console.warn(`  ✗ 取得失敗: ${p.name} (${e.message})`);
      failed++;
    }
    // APIのレート制限に配慮して少し待つ
    await new Promise(r => setTimeout(r, 800));
  }

  d.updated = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(JSON_PATH, JSON.stringify(d, null, 2) + '\n', 'utf8');

  console.log('---');
  console.log(`更新 ${updated} 件 / スキップ ${skipped} 件 / 失敗 ${failed} 件`);
  console.log('data/carport.json を更新しました。');
}

main().catch(e => { console.error(e); process.exit(1); });
