/* =========================================================
   カーポート商品のSVG画像を自動生成するスクリプト
   実行: node tools/gen-carport-images.js
   - data/carport.json を読み、商品ごとに images/carport/<id>.svg を生成
   - 屋根形状・カラー・台数をイラストに反映
   - 生成後、JSON の image パスを .svg に更新
========================================================= */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const JSON_PATH = path.join(ROOT, 'data', 'carport.json');
const IMG_DIR = path.join(ROOT, 'images', 'carport');

// カラー名 → 屋根/柱の色
const COLOR_MAP = {
  'シャイングレー':       '#BCC1C6',
  'ナチュラルシルバー':   '#CDD2D7',
  'プラチナステン':       '#AEB4BB',
  'ブラック':             '#2C2E31',
  'アースグレー':         '#8A8D8F',
  'ステンカラー':         '#B2B7BC',
  'シルバー':             '#C6CACE',
  'カームブラック':       '#33363A',
};

function colorOf(name) {
  return COLOR_MAP[name] || '#B0B5BA';
}

function carsOf(sizeType) {
  if (sizeType && sizeType.includes('3')) return 3;
  if (sizeType && sizeType.includes('2')) return 2;
  return 1;
}

// 車のシルエット（淡色）
function carSvg(x) {
  return `
    <g transform="translate(${x},150)">
      <rect x="6" y="14" width="68" height="20" rx="8" fill="#D7E5C4"/>
      <path d="M16 14 Q24 2 40 2 Q56 2 64 14 Z" fill="#E4EED6"/>
      <circle cx="22" cy="36" r="7" fill="#9DB87A"/>
      <circle cx="58" cy="36" r="7" fill="#9DB87A"/>
    </g>`;
}

function buildSvg(p) {
  const W = 400, H = 300;
  const roof = colorOf(p.color);
  const pillar = roof;
  const cars = carsOf(p.size_type);

  // 台数に応じた屋根幅
  const baseW = 120;
  const roofW = cars === 1 ? 180 : cars === 2 ? 280 : 340;
  const roofX = (W - roofW) / 2;
  const roofTopY = 70;
  const roofH = 26;

  // 屋根（フラット or アール）
  let roofShape;
  if (p.roof_shape === 'アール') {
    roofShape = `
      <path d="M${roofX} ${roofTopY + roofH}
               Q${W / 2} ${roofTopY - 28} ${roofX + roofW} ${roofTopY + roofH}
               L${roofX + roofW} ${roofTopY + roofH}
               Q${W / 2} ${roofTopY + roofH - 6} ${roofX} ${roofTopY + roofH} Z"
            fill="${roof}"/>
      <path d="M${roofX} ${roofTopY + roofH}
               Q${W / 2} ${roofTopY - 28} ${roofX + roofW} ${roofTopY + roofH}"
            fill="none" stroke="${roof}" stroke-width="10" stroke-linecap="round"/>`;
  } else {
    roofShape = `<rect x="${roofX}" y="${roofTopY}" width="${roofW}" height="${roofH}" rx="5" fill="${roof}"/>`;
  }

  // 半透明パネル（屋根下の屋根材イメージ）
  const panel = `<rect x="${roofX + 6}" y="${roofTopY + roofH}" width="${roofW - 12}" height="6" rx="3" fill="${roof}" opacity="0.35"/>`;

  // 柱（両側支持なら左右、片側支持なら片側）
  const pillarY = roofTopY + roofH;
  const groundY = 250;
  const bothSides = p.support_type === '両側支持';
  let pillars = `<rect x="${roofX + 4}" y="${pillarY}" width="12" height="${groundY - pillarY}" rx="3" fill="${pillar}"/>`;
  if (bothSides) {
    pillars += `<rect x="${roofX + roofW - 16}" y="${pillarY}" width="12" height="${groundY - pillarY}" rx="3" fill="${pillar}"/>`;
  }

  // 車を並べる
  let carsSvg = '';
  const carW = 80;
  const totalCarsW = cars * carW;
  let cx = (W - totalCarsW) / 2;
  for (let i = 0; i < cars; i++) {
    carsSvg += carSvg(cx + i * carW);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#F3FAE8"/>
  <!-- 地面 -->
  <rect x="0" y="${groundY}" width="${W}" height="${H - groundY}" fill="#E2EFD0"/>
  <line x1="0" y1="${groundY}" x2="${W}" y2="${groundY}" stroke="#CADDB3" stroke-width="2"/>
  ${pillars}
  ${roofShape}
  ${panel}
  ${carsSvg}
  <!-- メーカー＆台数ラベル -->
  <text x="20" y="34" font-family="sans-serif" font-size="18" font-weight="700" fill="#5A9E30">${p.maker}</text>
  <text x="${W - 20}" y="34" text-anchor="end" font-family="sans-serif" font-size="14" fill="#7DC44C">${p.size_type}</text>
</svg>`;
}

function main() {
  const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  fs.mkdirSync(IMG_DIR, { recursive: true });

  data.products.forEach(p => {
    const svg = buildSvg(p);
    const file = path.join(IMG_DIR, `${p.id}.svg`);
    fs.writeFileSync(file, svg, 'utf8');
    // JSONのimageパスを更新
    p.image = `images/carport/${p.id}.svg`;
    console.log('generated', file);
  });

  fs.writeFileSync(JSON_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('updated', JSON_PATH);
}

main();
