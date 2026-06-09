/* =========================================================
   カテゴリー定義レジストリ ＆ 共通ヘルパー
   ---------------------------------------------------------
   新カテゴリーを追加するには、CATEGORIES に1ブロック足すだけ。
   各ページは <script>window.NIWA_CATEGORY='carport'</script> で
   対象カテゴリーを指定する（既定は carport）。
========================================================= */

const UNKNOWN_LABEL = '不明';

const CATEGORIES = {
  /* ====================== カーポート ====================== */
  carport: {
    id: 'carport',
    label: 'カーポート',
    emoji: '🚗',
    dataPath: 'carport.json',                 // data/ からの相対
    storageKey: 'niwashiba_compare_carport',
    listPage: 'carport.html',
    detailPage: 'carport-detail.html',
    lead: 'メーカー・価格・サイズ・耐久性などで絞り込み、気になる商品を比較できます。',

    // 比較表・詳細スペックの全項目（表示順）
    fields: [
      { key: 'maker',           label: 'メーカー' },
      { key: 'price',           label: '価格（税込）', format: v => '¥' + Number(v).toLocaleString() },
      { key: 'size_type',       label: 'サイズ・台数' },
      { key: 'width_mm',        label: '間口（幅）',     format: v => v + ' mm' },
      { key: 'depth_mm',        label: '奥行',           format: v => v + ' mm' },
      { key: 'height_mm',       label: '全体の高さ',     format: v => v + ' mm' },
      { key: 'clearance_mm',    label: '有効高さ（桁下）', format: v => v + ' mm' },
      { key: 'roof_material',   label: '屋根材' },
      { key: 'roof_shape',      label: '屋根形状' },
      { key: 'support_type',    label: '柱の支持' },
      { key: 'snow_resist_cm',  label: '耐積雪',         format: v => v + ' cm' },
      { key: 'wind_resist_mps', label: '耐風圧',         format: v => v + ' m/s' },
      { key: 'heat_shield',     label: '熱線遮断',       format: v => (v ? 'あり' : 'なし') },
      { key: 'lighting',        label: '天井照明',       format: v => (v ? 'あり' : 'なし') },
      { key: 'color',           label: 'カラー' },
      { key: 'warranty_years',  label: 'メーカー保証',   format: v => v + ' 年' },
    ],

    // 一覧カードに出す抜粋・詳細ページのハイライト
    cardSpecs:  ['price', 'size_type', 'clearance_mm', 'snow_resist_cm'],
    highlights: ['size_type', 'clearance_mm', 'snow_resist_cm', 'roof_material'],

    // 比較表で範囲表示する項目（バリエーション商品）
    rangeKeys: ['price', 'size_type', 'width_mm', 'depth_mm', 'height_mm', 'clearance_mm', 'snow_resist_cm'],
    sizeOrder: ['1台用', '2台用', '3台用以上'],

    // 比較表の「最良値◎」判定
    bestValue: {
      minBetter: ['price'],
      maxBetter: ['snow_resist_cm', 'wind_resist_mps', 'warranty_years', 'clearance_mm'],
    },

    // 絞り込み（list=データから自動生成 / range=価格帯等 / bool=ありなし）
    filters: [
      { key: 'maker',          label: 'メーカー',      type: 'list' },
      { key: 'size_type',      label: 'サイズ・台数',  type: 'list' },
      { key: 'price',          label: '価格帯',        type: 'range', ranges: [
        ['0-200000', '〜20万円'], ['200000-400000', '20〜40万円'],
        ['400000-600000', '40〜60万円'], ['600000-99999999', '60万円〜'] ] },
      { key: 'roof_material',  label: '屋根材',        type: 'list' },
      { key: 'roof_shape',     label: '屋根形状',      type: 'list' },
      { key: 'snow_resist_cm', label: '耐積雪',        type: 'range', ranges: [
        ['0-20', '〜20cm'], ['21-50', '21〜50cm'], ['51-100', '51〜100cm'], ['101-9999', '100cm超（豪雪地）'] ] },
      { key: 'features',       label: '機能',          type: 'bool', items: [
        { key: 'heat_shield', label: '熱線遮断あり' }, { key: 'lighting', label: '天井照明あり' } ] },
    ],

    sorts: [
      { value: 'default',    label: 'おすすめ順' },
      { value: 'price-asc',  label: '価格が安い順', num: 'price', dir: 1 },
      { value: 'price-desc', label: '価格が高い順', num: 'price', dir: -1 },
      { value: 'snow-desc',  label: '耐積雪が高い順', num: 'snow_resist_cm', dir: -1 },
    ],
  },

  /* ====================== 照明 ====================== */
  lighting: {
    id: 'lighting',
    label: '照明',
    emoji: '💡',
    dataPath: 'lighting.json',
    storageKey: 'niwashiba_compare_lighting',
    listPage: 'lighting.html',
    detailPage: 'lighting-detail.html',
    lead: 'タイプ・メーカー・適用畳数・明るさ・調光調色などで絞り込み、気になる照明を比較できます。',

    fields: [
      { key: 'price',        label: '価格（税込）', format: v => '¥' + Number(v).toLocaleString() },
      { key: 'type',         label: 'タイプ' },
      { key: 'tatami',       label: '適用畳数',   format: v => '〜' + v + '畳' },
      { key: 'lumen',        label: '明るさ',     format: v => Number(v).toLocaleString() + ' lm' },
      { key: 'light_color',  label: '光色' },
      { key: 'light_source', label: '光源' },
      { key: 'power_w',      label: '消費電力',   format: v => v + ' W' },
      { key: 'remote',       label: 'リモコン',   format: v => (v ? '付属' : 'なし') },
      { key: 'mount',        label: '取付方式' },
    ],

    cardSpecs:  ['price', 'type', 'tatami', 'light_color'],
    highlights: ['type', 'tatami', 'lumen', 'light_color'],

    rangeKeys: ['price', 'tatami', 'lumen'],
    sizeOrder: [],

    bestValue: { minBetter: ['price'], maxBetter: ['lumen', 'tatami'] },

    filters: [
      { key: 'type',         label: 'タイプ',    type: 'list' },
      { key: 'price',        label: '価格帯',    type: 'range', ranges: [
        ['0-3000', '〜3,000円'], ['3000-7000', '3,000〜7,000円'],
        ['7000-15000', '7,000〜1.5万円'], ['15000-99999999', '1.5万円〜'] ] },
      { key: 'tatami',       label: '適用畳数',  type: 'range', ranges: [
        ['0-6', '〜6畳'], ['7-8', '〜8畳'], ['9-12', '〜12畳'], ['13-99', '14畳以上'] ] },
      { key: 'light_color',  label: '光色',      type: 'tags', tags: [
        ['調光', '調光（明るさ調整）'], ['調色', '調色（色切替）'],
        ['電球色', '電球色'], ['昼白色', '昼白色'], ['昼光色', '昼光色'] ] },
      { key: 'light_source', label: '光源',      type: 'list' },
      { key: 'features',     label: '機能',      type: 'bool', items: [
        { key: 'remote', label: 'リモコン付き' } ] },
    ],

    sorts: [
      { value: 'default',    label: 'おすすめ順' },
      { value: 'price-asc',  label: '価格が安い順', num: 'price', dir: 1 },
      { value: 'price-desc', label: '価格が高い順', num: 'price', dir: -1 },
      { value: 'lumen-desc', label: '明るい順',     num: 'lumen', dir: -1 },
      { value: 'tatami-desc',label: '広い部屋向け順', num: 'tatami', dir: -1 },
    ],
  },
};

// 現在のカテゴリー設定
function currentCategory() {
  return CATEGORIES[(typeof window !== 'undefined' && window.NIWA_CATEGORY) || 'carport'] || CATEGORIES.carport;
}
const CAT = currentCategory();
const FIELDS = CAT.fields;
function fieldByKey(key) { return FIELDS.find(f => f.key === key); }

/* ---------- 共通ヘルパー ---------- */
function isUnknown(value) { return value === null || value === undefined || value === ''; }

function formatField(field, value) {
  if (isUnknown(value)) return UNKNOWN_LABEL;
  return field.format ? field.format(value) : String(value);
}

function imageSrc(p, prefix) {
  prefix = prefix || '';
  if (p.image_real && p.image_real !== '') {
    return /^https?:\/\//.test(p.image_real) ? p.image_real : prefix + p.image_real;
  }
  return prefix + (p.image || '');
}

function affiliateLabel(provider) {
  if (!provider) return '販売ページを見る';
  if (provider.includes('楽天')) return '楽天で見る';
  if (provider.includes('Amazon') || provider.includes('アマゾン')) return 'Amazonで見る';
  if (provider.includes('Yahoo') || provider.includes('ヤフー')) return 'Yahoo!で見る';
  return provider + 'で見る';
}

/* ---------- 比較リスト（カテゴリー別に保存） ---------- */
function getCompareList() {
  try { return JSON.parse(localStorage.getItem(CAT.storageKey)) || []; }
  catch (e) { return []; }
}
function setCompareList(ids) { localStorage.setItem(CAT.storageKey, JSON.stringify(ids)); }
