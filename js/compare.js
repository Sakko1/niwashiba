/* =========================================================
   比較ページ
   - localStorage に保存された比較対象IDを読み込み
   - data/carport.json から該当商品を取得し、表で比較
========================================================= */

const DATA_PATH = 'data/carport.json';

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
  CARPORT_FIELDS.forEach(field => {
    // この行で最良値を強調（価格は最安、耐雪・耐風・保証・有効高さは最大）
    const best = getBestValue(field.key);

    html += `<tr><th class="compare-row-label">${field.label}</th>`;
    products.forEach(p => {
      const raw = p[field.key];
      const display = formatField(field, raw);
      const isBest = best !== null && !isUnknown(raw) && raw === best;
      const unknownClass = isUnknown(raw) ? ' is-unknown' : '';
      const bestClass = isBest ? ' is-best' : '';
      html += `<td class="compare-cell${unknownClass}${bestClass}">${display}${isBest ? '<span class="best-badge">◎</span>' : ''}</td>`;
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

// 強調表示用：項目ごとの「最良値」を返す（対象外フィールドは null）
function getBestValue(key) {
  const minBetter = ['price'];
  const maxBetter = ['snow_resist_cm', 'wind_resist_mps', 'warranty_years', 'clearance_mm'];

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
