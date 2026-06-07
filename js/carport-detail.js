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

  // 全スペック行
  const specRows = CARPORT_FIELDS.map(field => `
    <tr>
      <th>${field.label}</th>
      <td class="${isUnknown(p[field.key]) ? 'is-unknown' : ''}">${formatField(field, p[field.key])}</td>
    </tr>`).join('');

  const inCompare = getCompareList().includes(p.id);

  const officialBtn = (p.url && p.url !== '')
    ? `<a href="${p.url}" target="_blank" rel="noopener" class="btn btn-outline">メーカー公式 ↗</a>`
    : '';

  const affiliateBtn = (p.affiliate_url && p.affiliate_url !== '')
    ? `<a href="${p.affiliate_url}" target="_blank" rel="nofollow sponsored noopener" class="btn btn-buy">${affiliateLabel(p.affiliate_provider)} ↗</a>`
    : '';

  const creditCaption = (p.image_credit && p.image_credit !== '')
    ? `<p class="detail-image-credit">${p.image_credit}</p>` : '';

  const main = document.getElementById('detailMain');
  main.innerHTML = `
    <div class="detail-top">
      <div class="detail-image">
        <img src="${imageSrc(p, '../')}" alt="${p.name}" onerror="this.style.display='none';">
        ${creditCaption}
      </div>
      <div class="detail-info">
        <span class="detail-maker">${p.maker}</span>
        <h1 class="detail-name">${p.name}</h1>
        <div class="detail-price">
          ${isUnknown(p.price) ? '<span class="is-unknown">価格不明</span>'
            : `<span class="detail-price-num">¥${Number(p.price).toLocaleString()}</span><span class="detail-price-tax">（税抜）</span>`}
        </div>

        <ul class="detail-highlights">
          <li><span>サイズ</span>${formatField(fieldByKey('size_type'), p.size_type)}</li>
          <li><span>有効高さ</span>${formatField(fieldByKey('clearance_mm'), p.clearance_mm)}</li>
          <li><span>耐積雪</span>${formatField(fieldByKey('snow_resist_cm'), p.snow_resist_cm)}</li>
          <li><span>屋根材</span>${formatField(fieldByKey('roof_material'), p.roof_material)}</li>
        </ul>

        <div class="detail-actions">
          ${affiliateBtn}
          <button type="button" class="btn btn-primary" id="compareToggle">
            ${inCompare ? '✓ 比較リストに追加済み' : '比較に追加する'}
          </button>
          ${officialBtn}
        </div>
        ${affiliateBtn ? `<p class="detail-ad-note">※「${affiliateLabel(p.affiliate_provider)}」ボタンはアフィリエイトリンク（広告）です。</p>` : ''}
      </div>
    </div>

    <section class="detail-specs">
      <h2 class="detail-specs-title">詳細スペック</h2>
      <table class="spec-table">
        <tbody>${specRows}</tbody>
      </table>
      <p class="detail-note">※「不明」と表示されている項目は情報を確認中です。</p>
    </section>

    <div class="detail-foot">
      <a href="carport.html" class="detail-back">← カーポート一覧に戻る</a>
      <a href="../compare.html" class="btn btn-outline">比較表を見る</a>
    </div>`;

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
