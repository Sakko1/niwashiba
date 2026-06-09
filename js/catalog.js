/* =========================================================
   汎用カタログ（一覧 + 絞り込み + 並び替え + 比較選択）
   カテゴリーに依存しない。設定は categories.js の CAT から取得。
========================================================= */

const DATA_PATH = '../data/' + CAT.dataPath;
let allProducts = [];
let compareIds = getCompareList();

document.addEventListener('DOMContentLoaded', init);

async function init() {
  // 画像フォールバックの絵文字をカテゴリーに合わせる
  document.documentElement.style.setProperty('--thumb-emoji', `"${CAT.emoji}"`);

  buildToolbar();
  buildFilterUI();

  try {
    const res = await fetch(DATA_PATH);
    const data = await res.json();
    allProducts = data.products || [];
  } catch (e) {
    document.getElementById('productsCount').textContent = 'データの読み込みに失敗しました。';
    console.error(e);
    return;
  }

  populateListFilters();
  bindEvents();
  applyFilters();
  updateCompareBar();
}

/* --- 並び替えセレクトを生成 --- */
function buildToolbar() {
  const sel = document.getElementById('sortSelect');
  if (sel) sel.innerHTML = CAT.sorts.map(s => `<option value="${s.value}">${s.label}</option>`).join('');
}

/* --- 絞り込みUIを設定から生成 --- */
function buildFilterUI() {
  const box = document.getElementById('filters');
  if (!box) return;
  let html = `<div class="filters-head"><h2>絞り込み</h2>
    <button type="button" class="filters-reset" id="filterReset">リセット</button></div>`;
  CAT.filters.forEach(f => {
    html += `<div class="filter-group"><h3>${f.label}</h3>`;
    if (f.type === 'range') {
      html += `<div class="filter-options" data-filter="${f.key}" data-type="range">` +
        f.ranges.map(([v, l]) => `<label><input type="checkbox" value="${v}">${l}</label>`).join('') + `</div>`;
    } else if (f.type === 'bool') {
      f.items.forEach(it => {
        html += `<div class="filter-options" data-filter="${it.key}" data-type="bool">` +
          `<label><input type="checkbox" value="true">${it.label}</label></div>`;
      });
    } else if (f.type === 'tags') { // 部分一致（光色など）
      html += `<div class="filter-options" data-filter="${f.key}" data-type="tags">` +
        f.tags.map(([v, l]) => `<label><input type="checkbox" value="${v}">${l}</label>`).join('') + `</div>`;
    } else { // list（データから後で options 充填）
      html += `<div class="filter-options" data-filter="${f.key}" data-type="list"></div>`;
    }
    html += `</div>`;
  });
  box.innerHTML = html;
}

/* --- list型フィルタの選択肢をデータから生成（バリエーション値も含める） --- */
function populateListFilters() {
  const order = CAT.sizeOrder || [];
  document.querySelectorAll('.filter-options[data-type="list"]').forEach(boxEl => {
    const key = boxEl.dataset.filter;
    const set = new Set();
    allProducts.forEach(p => valuesOf(p, key).forEach(v => { if (!isUnknown(v)) set.add(v); }));
    let values = [...set];
    // 既知の並び順があれば適用（サイズ・台数など）
    if (values.every(v => order.includes(v))) values.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    boxEl.innerHTML = values.map(v => `<label><input type="checkbox" value="${v}">${v}</label>`).join('');
  });
}

function bindEvents() {
  document.getElementById('filters').addEventListener('change', applyFilters);
  document.getElementById('sortSelect').addEventListener('change', applyFilters);
  document.getElementById('filterReset').addEventListener('click', resetFilters);
  document.getElementById('compareClear').addEventListener('click', clearCompare);
}

function getActiveFilters() {
  const filters = {};
  document.querySelectorAll('.filter-options').forEach(box => {
    const key = box.dataset.filter;
    const type = box.dataset.type;
    const checked = [...box.querySelectorAll('input:checked')].map(i => i.value);
    if (checked.length) filters[key] = { type, values: checked };
  });
  return filters;
}

// バリエーション商品はサイズ別の値、通常は単一値
function valuesOf(p, key) {
  if (Array.isArray(p.variants) && p.variants.length && p.variants.some(v => key in v)) {
    const vals = p.variants.map(v => v[key]).filter(x => !isUnknown(x));
    return vals.length ? vals : [p[key]];
  }
  return [p[key]];
}

function applyFilters() {
  const filters = getActiveFilters();
  let result = allProducts.filter(p => {
    for (const key in filters) {
      const { type, values } = filters[key];
      if (type === 'range') {
        const cand = valuesOf(p, key);
        const ok = cand.some(num => !isUnknown(num) && values.some(r => {
          const [min, max] = r.split('-').map(Number); return num >= min && num <= max;
        }));
        if (!ok) return false;
      } else if (type === 'bool') {
        if (!values.includes(String(p[key]))) return false;
      } else if (type === 'tags') {
        // 選択タグのいずれかを値が含めばOK（部分一致）
        const cand = valuesOf(p, key);
        if (!cand.some(v => values.some(tag => String(v).includes(tag)))) return false;
      } else {
        const cand = valuesOf(p, key);
        if (!cand.some(v => values.includes(String(v)))) return false;
      }
    }
    return true;
  });
  result = sortProducts(result);
  renderProducts(result);
}

function sortProducts(list) {
  const mode = document.getElementById('sortSelect').value;
  const conf = CAT.sorts.find(s => s.value === mode);
  const arr = [...list];
  if (conf && conf.num) {
    arr.sort((a, b) => ((a[conf.num] ?? Infinity * -conf.dir) - (b[conf.num] ?? Infinity * -conf.dir)) * conf.dir);
  }
  return arr;
}

function renderProducts(list) {
  const grid = document.getElementById('productGrid');
  const empty = document.getElementById('productsEmpty');
  document.getElementById('productsCount').textContent = `${list.length} 件の商品`;
  empty.hidden = list.length > 0;

  grid.innerHTML = list.map(p => {
    const hasVariants = Array.isArray(p.variants) && p.variants.length > 0;
    const specs = CAT.cardSpecs.map(key => {
      const field = fieldByKey(key);
      let val = formatField(field, p[key]);
      if (hasVariants && key === 'price' && p.price) val += '〜';
      if (hasVariants && key === 'size_type') val = p.size_type;
      return `<div class="spec-row"><span class="spec-label">${field.label}</span><span class="spec-value">${val}</span></div>`;
    }).join('');

    const checked = compareIds.includes(p.id) ? 'checked' : '';
    const detailUrl = `${CAT.detailPage}?id=${encodeURIComponent(p.id)}`;
    const credit = (p.image_credit && p.image_credit !== '') ? `<span class="product-credit">${p.image_credit}</span>` : '';
    const affiliate = (p.affiliate_url && p.affiliate_url !== '')
      ? `<a class="product-buy" href="${p.affiliate_url}" target="_blank" rel="nofollow sponsored noopener">${affiliateLabel(p.affiliate_provider)} ↗</a>` : '';

    return `
      <article class="product-card">
        <a class="product-thumb" href="${detailUrl}">
          <img src="${imageSrc(p, '../')}" alt="${p.name}" loading="lazy" onerror="this.style.display='none';">
          ${p.maker ? `<span class="product-maker">${p.maker}</span>` : ''}
          ${credit}
        </a>
        <div class="product-body">
          <h3 class="product-name"><a href="${detailUrl}">${p.name}</a></h3>
          <div class="product-specs">${specs}</div>
          <div class="product-foot">
            <label class="compare-check"><input type="checkbox" data-id="${p.id}" ${checked}> 比較に追加</label>
            <a class="product-detail-link" href="${detailUrl}">詳細を見る →</a>
          </div>
          ${affiliate}
        </div>
      </article>`;
  }).join('');

  grid.querySelectorAll('.compare-check input').forEach(cb =>
    cb.addEventListener('change', () => toggleCompare(cb.dataset.id, cb.checked)));
}

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
  compareIds = getCompareList();
  document.getElementById('compareCount').textContent = compareIds.length;
  bar.hidden = compareIds.length === 0;
}
function resetFilters() {
  document.querySelectorAll('.filter-options input:checked').forEach(i => i.checked = false);
  document.getElementById('sortSelect').value = 'default';
  applyFilters();
}
