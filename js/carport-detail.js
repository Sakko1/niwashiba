/* =========================================================
   カーポート 商品詳細ページ
   - URL の ?id=xxx から商品を特定
   - data/carport.json を読み込んで詳細を描画
========================================================= */

const DATA_PATH = '../data/carport.json';

document.addEventListener('DOMContentLoaded', init);

async function init() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const main = document.getElementById('detailMain');

  if (!id) {
    main.innerHTML = notFound('商品が指定されていません。');
    return;
  }

  let all = [];
  try {
    const res = await fetch(DATA_PATH);
    const data = await res.json();
    all = data.products || [];
  } catch (e) {
    main.innerHTML = notFound('データの読み込みに失敗しました。');
    return;
  }

  const p = all.find(x => x.id === id);
  if (!p) {
    main.innerHTML = notFound('該当する商品が見つかりませんでした。');
    return;
  }

  render(p);
}

function notFound(msg) {
  return `
    <div class="detail-notfound">
      <div class="detail-notfound-mascot"><span>🐔</span><span>🐕</span></div>
      <p>${msg}</p>
      <a href="carport.html" class="btn btn-primary">カーポート一覧へ</a>
    </div>`;
}

function render(p) {
  document.title = `${p.name} | NiwaShiba`;
  document.getElementById('crumbName').textContent = p.name;

  const variants = Array.isArray(p.variants) ? p.variants.filter(v => v.price) : [];
  const hasVar = variants.length > 0;
  // 既定は最安サイズ
  let sel = hasVar ? variants.indexOf(variants.reduce((a, b) => (b.price < a.price ? b : a))) : -1;
  // 表示用：選択variantをモデルに重ねる
  const view = () => hasVar ? Object.assign({}, p, variants[sel]) : p;

  const inCompare = getCompareList().includes(p.id);
  const officialBtn = (p.url && p.url !== '')
    ? `<a href="${p.url}" target="_blank" rel="noopener" class="btn btn-outline">メーカー公式 ↗</a>` : '';
  const creditCaption = (p.image_credit && p.image_credit !== '')
    ? `<p class="detail-image-credit">${p.image_credit}</p>` : '';

  // サイズ選択（台数ごとにグループ表示）
  let selectorHtml = '';
  if (hasVar) {
    const groups = {};
    variants.forEach((v, i) => { (groups[v.size_type] = groups[v.size_type] || []).push({ v, i }); });
    selectorHtml = `<div class="variant-select">
      <div class="variant-select-head">サイズを選ぶ <span>（価格・画像が切り替わります）</span></div>
      ${Object.entries(groups).map(([sz, arr]) => `
        <div class="variant-group">
          <span class="variant-group-label">${sz}</span>
          <div class="variant-btns">
            ${arr.map(({ v, i }) => `<button type="button" class="variant-btn" data-i="${i}">
              ${v.label.replace(/^.+用\s*/, '')}<small>¥${v.price.toLocaleString()}</small></button>`).join('')}
          </div>
        </div>`).join('')}
    </div>`;
  }

  // カラー・オプションの情報表示
  const chip = a => a.map(c => `<span class="chip">${c}</span>`).join('');
  let optionsHtml = '';
  if (p.colors || p.colors_wood || p.options) {
    optionsHtml = `<section class="detail-options">
      ${p.colors ? `<div class="opt-row"><span class="opt-label">カラー（形材色）</span><div>${chip(p.colors)}</div></div>` : ''}
      ${p.colors_wood ? `<div class="opt-row"><span class="opt-label">カラー（木調色）</span><div>${chip(p.colors_wood)}</div></div>` : ''}
      ${p.options ? `<div class="opt-row"><span class="opt-label">オプション</span><div>${chip(p.options)}</div></div>` : ''}
      <p class="detail-note">※ カラー・オプションは楽天の商品ページで選択できます（在庫・価格は構成により異なります）。</p>
    </section>`;
  }

  const main = document.getElementById('detailMain');
  main.innerHTML = `
    <div class="detail-top">
      <div class="detail-image">
        <img id="detailImg" src="${imageSrc(view(), '../')}" alt="${p.name}" onerror="this.style.display='none';">
        ${creditCaption}
      </div>
      <div class="detail-info">
        <span class="detail-maker">${p.maker}</span>
        <h1 class="detail-name">${p.name}</h1>
        <div class="detail-price" id="detailPrice"></div>
        ${selectorHtml}
        <ul class="detail-highlights" id="detailHighlights"></ul>
        <div class="detail-actions">
          <span id="detailBuyWrap"></span>
          <button type="button" class="btn btn-primary" id="compareToggle">
            ${inCompare ? '✓ 比較リストに追加済み' : '比較に追加する'}
          </button>
          ${officialBtn}
        </div>
        <p class="detail-ad-note">※「${affiliateLabel(p.affiliate_provider)}」ボタンはアフィリエイトリンク（広告）です。</p>
      </div>
    </div>

    ${optionsHtml}

    <section class="detail-specs">
      <h2 class="detail-specs-title">詳細スペック</h2>
      <table class="spec-table"><tbody id="detailSpecBody"></tbody></table>
      <p class="detail-note">※「不明」と表示されている項目は情報を確認中です。${hasVar ? '寸法・有効高さは選択中のサイズの値です。' : ''}</p>
    </section>

    <div class="detail-foot">
      <a href="carport.html" class="detail-back">← カーポート一覧に戻る</a>
      <a href="../compare.html" class="btn btn-outline">比較表を見る</a>
    </div>`;

  // 選択中サイズを画面へ反映
  function apply() {
    const v = view();
    document.getElementById('detailImg').src = imageSrc(v, '../');
    document.getElementById('detailPrice').innerHTML = isUnknown(v.price)
      ? '<span class="is-unknown">価格不明</span>'
      : `<span class="detail-price-num">¥${Number(v.price).toLocaleString()}</span><span class="detail-price-tax">（税抜）</span>${hasVar ? '<span class="detail-price-note">選択サイズの価格</span>' : ''}`;
    document.getElementById('detailHighlights').innerHTML = `
      <li><span>サイズ</span>${formatField(fieldByKey('size_type'), v.size_type)}</li>
      <li><span>有効高さ</span>${formatField(fieldByKey('clearance_mm'), v.clearance_mm)}</li>
      <li><span>耐積雪</span>${formatField(fieldByKey('snow_resist_cm'), v.snow_resist_cm)}</li>
      <li><span>屋根材</span>${formatField(fieldByKey('roof_material'), v.roof_material)}</li>`;
    document.getElementById('detailBuyWrap').innerHTML = (v.affiliate_url && v.affiliate_url !== '')
      ? `<a href="${v.affiliate_url}" target="_blank" rel="nofollow sponsored noopener" class="btn btn-buy">${hasVar ? 'このサイズを' : ''}${affiliateLabel(p.affiliate_provider)} ↗</a>` : '';
    document.getElementById('detailSpecBody').innerHTML = CARPORT_FIELDS.map(f => `
      <tr><th>${f.label}</th>
      <td class="${isUnknown(v[f.key]) ? 'is-unknown' : ''}">${formatField(f, v[f.key])}</td></tr>`).join('');
    document.querySelectorAll('.variant-btn').forEach(b =>
      b.classList.toggle('is-active', +b.dataset.i === sel));
  }
  apply();

  document.querySelectorAll('.variant-btn').forEach(b =>
    b.addEventListener('click', () => { sel = +b.dataset.i; apply(); }));

  // 比較トグル
  const btn = document.getElementById('compareToggle');
  btn.addEventListener('click', () => {
    let ids = getCompareList();
    if (ids.includes(p.id)) {
      ids = ids.filter(x => x !== p.id);
      btn.textContent = '比較に追加する';
      btn.classList.remove('is-added');
    } else {
      ids.push(p.id);
      btn.textContent = '✓ 比較リストに追加済み';
      btn.classList.add('is-added');
    }
    setCompareList(ids);
  });
  if (inCompare) btn.classList.add('is-added');
}

function fieldByKey(key) {
  return CARPORT_FIELDS.find(f => f.key === key);
}
