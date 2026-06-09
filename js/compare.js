/* =========================================================
   比較ページ
   - localStorage に保存された比較対象IDを読み込み
   - data/carport.json から該当商品を取得し、表で比較
========================================================= */

const DATA_PATH = 'data/' + CAT.dataPath;

let products = [];

document.addEventListener('DOMContentLoaded', init);

async function init() {
  const ids = getCompareList();

  if (ids.length === 0) {
    showEmpty();
    return;
  }

  let all = [];
  try {
    const res = await fetch(DATA_PATH);
    const data = await res.json();
    all = data.products || [];
  } catch (e) {
    console.error(e);
    showEmpty();
    return;
  }

  // 選択順を保ちつつ該当商品を抽出
  products = ids.map(id => all.find(p => p.id === id)).filter(Boolean);

  if (products.length === 0) {
    showEmpty();
    return;
  }

  renderTable();
}

function showEmpty() {
  document.getElementById('compareEmpty').hidden = false;
  document.getElementById('compareTableWrap').hidden = true;
}

function renderTable() {
  document.getElementById('compareEmpty').hidden = true;
  document.getElementById('compareTableWrap').hidden = false;

  const table = document.getElementById('compareTable');

  // ヘッダー行（商品名 + 削除ボタン）
  let html = '<thead><tr><th class="compare-th-label">項目</th>';
  products.forEach(p => {
    html += `
      <th class="compare-th-product">
        <div class="compare-prod-head">
          <div class="compare-prod-thumb">
            <img src="${imageSrc(p, '')}" alt="${p.name}"
                 onerror="this.style.display='none';">
          </div>
          <div class="compare-prod-name">${p.name}</div>
          <button type="button" class="compare-remove" data-id="${p.id}" title="削除">× 削除</button>
        </div>
      </th>`;
  });
  html += '</tr></thead><tbody>';

  // 各フィールド行
  FIELDS.forEach(field => {
    // この行で最良値を強調（価格は最安、耐雪・耐風・保証・有効高さは最大）
    const best = getBestValue(field.key);

    html += `<tr><th class="compare-row-label">${field.label}</th>`;
    products.forEach(p => {
      const cell = cellInfo(p, field);   // {display, unknown, isRange}
      const isBest = !cell.isRange && best !== null && !isUnknown(p[field.key]) && p[field.key] === best;
      const cls = (cell.unknown ? ' is-unknown' : '') + (isBest ? ' is-best' : '');
      html += `<td class="compare-cell${cls}">${cell.display}${isBest ? '<span class="best-badge">◎</span>' : ''}</td>`;
    });
    html += '</tr>';
  });

  // 公式リンク行
  html += '<tr><th class="compare-row-label">詳細</th>';
  products.forEach(p => {
    const link = (p.url && p.url !== '')
      ? `<a href="${p.url}" target="_blank" rel="noopener" class="btn btn-primary btn-sm">公式サイト</a>`
      : '<span class="is-unknown">不明</span>';
    html += `<td class="compare-cell">${link}</td>`;
  });
  html += '</tr>';

  html += '</tbody>';
  table.innerHTML = html;

  // 削除ボタン
  table.querySelectorAll('.compare-remove').forEach(btn => {
    btn.addEventListener('click', () => removeProduct(btn.dataset.id));
  });
}

// 範囲表示の対象フィールド（バリエーション商品のとき min〜max で表示）
const RANGE_KEYS = CAT.rangeKeys;
const SIZE_ORDER = CAT.sizeOrder;

// 1セルの表示内容を返す（バリエーション商品は範囲、それ以外は単一）
function cellInfo(p, field) {
  const variants = Array.isArray(p.variants) ? p.variants : [];
  // バリエーション商品 かつ 範囲対象フィールド
  if (variants.length && RANGE_KEYS.includes(field.key)) {
    if (field.key === 'size_type') {
      const sizes = [...new Set(variants.map(v => v.size_type).filter(Boolean))]
        .sort((a, b) => SIZE_ORDER.indexOf(a) - SIZE_ORDER.indexOf(b));
      if (sizes.length === 0) return { display: '不明', unknown: true, isRange: false };
      const txt = sizes.length === 1 ? sizes[0] : `${sizes[0]}〜${sizes[sizes.length - 1]}`;
      return { display: txt, unknown: false, isRange: sizes.length > 1 };
    }
    // 数値フィールド：variant値（無ければモデル値）から min/max
    let nums = variants.map(v => v[field.key]).filter(x => !isUnknown(x) && typeof x === 'number');
    if (nums.length === 0 && !isUnknown(p[field.key])) nums = [p[field.key]];
    if (nums.length === 0) return { display: '不明', unknown: true, isRange: false };
    const min = Math.min(...nums), max = Math.max(...nums);
    const disp = min === max ? formatField(field, min) : `${formatField(field, min)}〜${formatField(field, max)}`;
    return { display: disp, unknown: false, isRange: min !== max };
  }
  // 通常
  const raw = p[field.key];
  return { display: formatField(field, raw), unknown: isUnknown(raw), isRange: false };
}

// 強調表示用：項目ごとの「最良値」を返す（対象外フィールドは null）
function getBestValue(key) {
  const minBetter = CAT.bestValue.minBetter;
  const maxBetter = CAT.bestValue.maxBetter;

  let nums = products.map(p => p[key]).filter(v => !isUnknown(v) && typeof v === 'number');
  if (nums.length < 2) return null;  // 比較対象が1つ以下なら強調しない

  if (minBetter.includes(key)) return Math.min(...nums);
  if (maxBetter.includes(key)) return Math.max(...nums);
  return null;
}

function removeProduct(id) {
  let ids = getCompareList().filter(x => x !== id);
  setCompareList(ids);
  products = products.filter(p => p.id !== id);
  if (products.length === 0) {
    showEmpty();
  } else {
    renderTable();
  }
}
