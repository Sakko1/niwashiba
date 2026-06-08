/* =========================================================
   楽天 自動ディスカバリー（カーポート候補の収集）
   実行: node tools/discover-rakuten.js
   --------------------------------------------------------
   - 楽天APIで「カーポート」を複数ページ収集
   - ノイズ除去（¥1見積り・部品・平板・補修など）
   - 1モデル1行に集約（同一モデルは最安の店を採用）
   - 採用候補を data/_candidates-carport.csv に書き出し（人が承認用にチェック）
   --------------------------------------------------------
   環境変数（任意）:
   DISC_KEYWORD（既定 カーポート） / DISC_PAGES（既定 20） / DISC_MINPRICE（既定 50000）
========================================================= */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const API = 'https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401';
const ORIGIN = process.env.RAKUTEN_ORIGIN || 'https://sakko1.github.io';
const OUT = path.join(ROOT, 'data', '_candidates-carport.csv');

const KEYWORD = process.env.DISC_KEYWORD || 'カーポート';
const MAXPAGES = parseInt(process.env.DISC_PAGES || '20', 10);
const MINPRICE = parseInt(process.env.DISC_MINPRICE || '50000', 10);

// 認証情報（環境変数 or ローカル設定ファイル）
function loadConfig() {
  if (process.env.RAKUTEN_APP_ID) {
    return {
      applicationId: process.env.RAKUTEN_APP_ID,
      accessKey: process.env.RAKUTEN_ACCESS_KEY,
      affiliateId: process.env.RAKUTEN_AFFILIATE_ID || '',
    };
  }
  const p = path.join(__dirname, 'rakuten-config.json');
  if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  console.error('✗ 認証情報がありません（環境変数 or tools/rakuten-config.json）');
  process.exit(1);
}

// 除外したいノイズ（見積り・部品・材料・補修など）
const NG = /(見積|お見積|下見|調査|現地|無料診断|平板|ポリカ[ー]?(板|波板|平板)|波板|フリーカット|オーダーカット|切り?売り|部品|パーツ|交換用|補修|サポート柱のみ|柱のみ|オプションのみ|単品|延長材|サンプル|中古|物置|サイクルポート専用|テラス屋根|ベランダ屋根|連結金具|アンカー|基礎のみ)/;

// シリーズ → メーカー（型名が分かればメーカーも確定できる）
const SERIES_MAKER = {
  'カーポートSC': 'LIXIL', 'カーポートST': 'LIXIL', 'カーポートSW': 'LIXIL',
  'フーゴ': 'LIXIL', 'ネスカ': 'LIXIL', 'アーキフラン': 'LIXIL', 'アーキデュオ': 'LIXIL',
  'プレシオ': 'LIXIL', 'スピーネ': 'LIXIL', 'テリオスポート': 'LIXIL', 'カームスポート': 'LIXIL',
  'ジーポート': 'YKK AP', 'エフルージュ': 'YKK AP', 'レイナツインポート': 'YKK AP',
  'レイナポート': 'YKK AP', 'アリュース': 'YKK AP', 'ヴェクター': 'YKK AP',
  'セルフィ': '三協アルミ', 'エムシェード': '三協アルミ', 'M.シェード': '三協アルミ',
  'シャルポート': '三協アルミ', 'ダブルフェース': '三協アルミ', 'スカイリード': '三協アルミ',
  'マイポート': '四国化成', 'マイポートneo': '四国化成', 'マイポートOrigin': '四国化成',
};
// 検出順（長いものを先に）
const SERIES = Object.keys(SERIES_MAKER).sort((a, b) => b.length - a.length);

function detectMaker(s, series) {
  if (/LIXIL|リクシル/i.test(s)) return 'LIXIL';
  if (/YKK/i.test(s)) return 'YKK AP';
  if (/三協(アルミ)?/.test(s)) return '三協アルミ';
  if (/四国化成/.test(s)) return '四国化成';
  if (/タカショー/.test(s)) return 'タカショー';
  return series ? (SERIES_MAKER[series] || '') : '';   // 型名から補完
}
function detectCount(s) {
  if (/[3３]\s*台/.test(s)) return '3台用以上';
  if (/[2２]\s*台/.test(s)) return '2台用';
  if (/[1１]\s*台/.test(s)) return '1台用';
  return '';
}
function detectSeries(s) {
  for (const k of SERIES) if (s.includes(k)) return k;  // ホワイトリストのみ（誤検出防止）
  return '';
}
function detectSnow(s) {
  const m = s.match(/耐?積雪\s*([0-9０-９]{2,3})\s*cm/);
  return m ? parseInt(m[1].replace(/[０-９]/g, c => '0123456789'['０１２３４５６７８９'.indexOf(c)]), 10) : '';
}

async function fetchPage(page, cfg, attempt = 0) {
  const url = new URL(API);
  url.searchParams.set('applicationId', cfg.applicationId);
  url.searchParams.set('accessKey', cfg.accessKey);
  if (cfg.affiliateId) url.searchParams.set('affiliateId', cfg.affiliateId);
  url.searchParams.set('keyword', KEYWORD);
  url.searchParams.set('hits', '30');
  url.searchParams.set('page', String(page));
  url.searchParams.set('format', 'json');
  url.searchParams.set('imageFlag', '1');
  const res = await fetch(url, { headers: { Origin: ORIGIN, Referer: ORIGIN + '/' } });
  // レート制限(429)や混雑時は待って自動リトライ（最大4回）
  if ((res.status === 429 || res.status >= 500) && attempt < 4) {
    await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    return fetchPage(page, cfg, attempt + 1);
  }
  const d = await res.json().catch(() => ({}));
  if (d.errors && attempt < 4) {
    await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
    return fetchPage(page, cfg, attempt + 1);
  }
  if (d.errors) throw new Error(d.errors.errorMessage);
  return d;
}

function esc(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

async function main() {
  const cfg = loadConfig();
  const models = new Map(); // key -> {maker,series,count,snow,price,itemCode,name,image,url,shops}
  let scanned = 0, kept = 0;

  for (let page = 1; page <= MAXPAGES; page++) {
    let d;
    try { d = await fetchPage(page, cfg); }
    catch (e) { console.warn(`page ${page}: ${e.message}`); break; }
    const items = d.Items || [];
    if (items.length === 0) break;

    for (const w of items) {
      const i = w.Item || w;
      scanned++;
      const name = i.itemName || '';
      if (!name.includes('カーポート')) continue;
      if (NG.test(name)) continue;
      if (!i.itemPrice || i.itemPrice < MINPRICE) continue;

      const series = detectSeries(name);
      const maker = detectMaker(name, series);
      const count = detectCount(name);
      const snow = detectSnow(name);
      // モデルを一意化するキー（メーカー＋シリーズ＋台数＋耐雪）
      const key = [maker, series, count, snow].join('|');
      if (!series) continue; // シリーズ不明はスキップ（後で精査）

      const img = (i.mediumImageUrls && i.mediumImageUrls[0] &&
        (i.mediumImageUrls[0].imageUrl || i.mediumImageUrls[0])) || '';
      const cand = {
        maker, series, count, snow,
        price: i.itemPrice, itemCode: i.itemCode, name,
        image: img.replace(/_ex=\d+x\d+/, '_ex=400x400'),
        url: i.affiliateUrl || i.itemUrl, shops: 1,
      };
      const cur = models.get(key);
      if (!cur) { models.set(key, cand); kept++; }
      else {
        cur.shops++;
        if (cand.price < cur.price) { // 最安を採用
          Object.assign(cur, { price: cand.price, itemCode: cand.itemCode, name: cand.name, image: cand.image, url: cand.url, shops: cur.shops });
        }
      }
    }
    await new Promise(r => setTimeout(r, 600));
    process.stdout.write(`\r収集中… page ${page}/${MAXPAGES}  走査${scanned} / 候補${models.size}   `);
  }
  process.stdout.write('\n');

  // CSV出力（採用列を先頭に。人が ○ を入れて承認）
  const rows = [...models.values()].sort((a, b) =>
    (a.maker + a.series).localeCompare(b.maker + b.series) || a.price - b.price);
  const header = ['採用', 'メーカー', 'モデル', '台数', '耐積雪cm', '最安価格', '出品数', 'itemCode', '商品名', '画像URL', 'リンク'];
  const lines = [header.join(',')];
  for (const m of rows) {
    lines.push([''/*採用*/, m.maker, m.series, m.count, m.snow, m.price, m.shops, m.itemCode, m.name, m.image, m.url].map(esc).join(','));
  }
  fs.writeFileSync(OUT, '﻿' + lines.join('\r\n') + '\r\n', 'utf8');

  console.log(`\n候補 ${rows.length} モデルを書き出し: ${path.relative(ROOT, OUT)}`);
  console.log('メーカー別:', Object.entries(rows.reduce((a, m) => { const k = m.maker || '不明'; a[k] = (a[k] || 0) + 1; return a; }, {})).map(([k, v]) => `${k}:${v}`).join(' / '));
}

main().catch(e => { console.error(e); process.exit(1); });
