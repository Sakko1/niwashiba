/* =========================================================
   カーポート一覧ページ
   - data/carport.json を読み込み
   - 絞り込み / 並び替え / 比較選択
========================================================= */

const DATA_PATH = '../data/carport.json';

let allProducts = [];       // 全商品
let compareIds = getCompareList();

// 主要スペック（カード上に出す抜粋）
const CARD_SPECS = ['price', 'size_type', 'clearance_mm', 'snow_resist_cm'];

document.addEventListener('DOMContentLoaded', init);

async function init() {
  try {
    const res = await fetch(DATA_PATH);
    const data = await res.json();
    allProducts = data.products || [];
  } catch (e) {
    document.getElementById('productsCount').textContent = 'データの読み込みに失敗しました。';
    console.error(e);
    return;
  }

  buildDynamicFilters();
  bindEvents();
  applyFilters();
  updateCompareBar();
}

/* --- 動的フィルタ（メーカー・台数・屋根材・屋根形状）を商品から自動生成 --- */
function buildDynamicFilters() {
  const dynamicKeys = ['maker', 'size_type', 'roof_material', 'roof_shape'];
  dynamicKeys.forEach(key => {
    const box = document.querySelector(`.filter-options[data-filter="${key}"]`);
    if (!box) return;
    const values = [...new Set(allProducts.map(p => p[key]).filter(v => !isUnknown(v)))];
    box.innerHTML = values.map(v =>
      `<label><input type="checkbox" value="${v}">${v}</label>`
    ).join('');
  });
}

function bindEvents() {
  document.getElementById('filters').addEventListener('change', applyFilters);
  document.getElementById('sortSelect').addEventListener('change', applyFilters);
  document.getElementById('filterReset').addEventListener('click', resetFilters);
  document.getElementById('compareClear').addEventListener('click', clearCompare);
}

/* --- 選択中フィルタの収集 --- */
function getActiveFilters() {
  const filters = {};
  document.querySelectorAll('.filter-options').forEach(box => {
    const key = box.dataset.filter;
    const checked = [...box.querySelectorAll('input:checked')].map(i => i.value);
    if (checked.length) filters[key] = checked;
  });
  return filters;
}

/* --- フィルタ適用 → 並び替え → 描画 --- */
function applyFilters() {
  const filters = getActiveFilters();

  let result = allProducts.filter(p => {
    for (const key in filters) {
      const values = filters[key];
      if (key === 'price' || key === 'snow_resist_cm') {
        // 範囲フィルタ
        const num = p[key];
        if (isUnknown(num)) return false;
        const inRange = values.some(range => {
          const [min, max] = range.split('-').map(Number);
          return num >= min && num <= max;
        });
        if (!inRange) return false;
      } else if (key === 'heat_shield' || key === 'lighting') {
        if (!values.includes(String(p[key]))) return false;
      } else {
        if (!values.includes(String(p[key]))) return false;
      }
    }
    return true;
  });

  result = sortProducts(result);
  renderProducts(result);
}

function sortProducts(list) {
  const mode = document.getElementById('sortSelect').value;
  const arr = [...list];
  switch (mode) {
    case 'price-asc':  arr.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity)); break;
    case 'price-desc': arr.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity)); break;
    case 'snow-desc':  arr.sort((a, b) => (b.snow_resist_cm ?? -Infinity) - (a.snow_resist_cm ?? -Infinity)); break;
  }
  return arr;
}

/* --- 商品カード描画 --- */
function renderProducts(list) {
  const grid = document.getElementById('productGrid');
  const empty = document.getElementById('productsEmpty');
  const count = document.getElementById('productsCount');

  count.textContent = `${list.length} 件の商品`;
  empty.hidden = list.length > 0;

  grid.innerHTML = list.map(p => {
    const specs = CARD_SPECS.map(key => {
      const field = CARPORT_FIELDS.find(f => f.key === key);
      return `<div class="spec-row">
                <span class="spec-label">${field.label}</span>
                <span class="spec-value">${formatField(field, p[key])}</span>
              </div>`;
    }).join('');

    const checked = compareIds.includes(p.id) ? 'checked' : '';

    const detailUrl = `carport-detail.html?id=${encodeURIComponent(p.id)}`;

    const credit = (p.image_credit && p.image_credit !== '')
      ? `<span class="product-credit">${p.image_credit}</span>` : '';

    const affiliate = (p.affiliate_url && p.affiliate_url !== '')
      ? `<a class="product-buy" href="${p.affiliate_url}" target="_blank" rel="nofollow sponsored noopener">${affiliateLabel(p.affiliate_provider)} ↗</a>`
      : '';

    return `
      <article class="product-card">
        <a class="product-thumb" href="${detailUrl}">
          <img src="${imageSrc(p, '../')}" alt="${p.name}" loading="lazy"
               onerror="this.style.display='none';">
          <span class="product-maker">${p.maker}</span>
          ${credit}
        </a>
        <div class="product-body">
          <h3 class="product-name"><a href="${detailUrl}">${p.name}</a></h3>
          <div class="product-specs">${specs}</div>
          <div class="product-foot">
            <label class="compare-check">
              <input type="checkbox" data-id="${p.id}" ${checked}> 比較に追加
            </label>
            <a class="product-detail-link" href="${detailUrl}">詳細を見る →</a>
          </div>
          ${affiliate}
        </div>
      </article>`;
  }).join('');

  // 比較チェックのイベント
  grid.querySelectorAll('.compare-check input').forEach(cb => {
    cb.addEventListener('change', () => toggleCompare(cb.dataset.id, cb.checked));
  });
}

/* --- 比較リスト操作 --- */
function toggleCompare(id, on) {
  compareIds = getCompareList();
  if (on && !compareIds.includes(id)) compareIds.push(id);
  if (!on) compareIds = compareIds.filter(x => x !== id);
  setCompareList(compareIds);
  updateCompareBar();
}

function clearCompare() {
  compareIds = [];
  setCompareList([]);
  document.querySelectorAll('.compare-check input').forEach(cb => cb.checked = false);
  updateCompareBar();
}

function updateCompareBar() {
  const bar = document.getElementById('compareBar');
  const count = document.getElementById('compareCount');
  compareIds = getCompareList();
  count.textContent = compareIds.length;
  bar.hidden = compareIds.length === 0;
}

/* --- リセット --- */
function resetFilters() {
  document.querySelectorAll('.filter-options input:checked').forEach(i => i.checked = false);
  document.getElementById('sortSelect').value = 'default';
  applyFilters();
}
