/* =========================================================
   共通定義：商品フィールドのラベルと表示フォーマット
   一覧ページ・比較ページの両方から参照します。
========================================================= */

// 値が無い（null / undefined / 空文字）場合に表示する文字
const UNKNOWN_LABEL = '不明';

// カーポートの全フィールド定義（表示順）
const CARPORT_FIELDS = [
  { key: 'maker',          label: 'メーカー' },
  { key: 'price',          label: '価格（税抜）', format: v => '¥' + Number(v).toLocaleString() },
  { key: 'size_type',      label: 'サイズ・台数' },
  { key: 'width_mm',       label: '間口（幅）',    format: v => v + ' mm' },
  { key: 'depth_mm',       label: '奥行',          format: v => v + ' mm' },
  { key: 'height_mm',      label: '全体の高さ',    format: v => v + ' mm' },
  { key: 'clearance_mm',   label: '有効高さ（桁下）', format: v => v + ' mm' },
  { key: 'roof_material',  label: '屋根材' },
  { key: 'roof_shape',     label: '屋根形状' },
  { key: 'support_type',   label: '柱の支持' },
  { key: 'snow_resist_cm', label: '耐積雪',        format: v => v + ' cm' },
  { key: 'wind_resist_mps',label: '耐風圧',        format: v => v + ' m/s' },
  { key: 'heat_shield',    label: '熱線遮断',      format: v => (v ? 'あり' : 'なし') },
  { key: 'color',          label: 'カラー' },
  { key: 'warranty_years', label: 'メーカー保証',  format: v => v + ' 年' },
];

// 値が無いかどうか
function isUnknown(value) {
  return value === null || value === undefined || value === '';
}

// フィールド値を表示用文字列に整形（不明なら「不明」を返す）
function formatField(field, value) {
  if (isUnknown(value)) return UNKNOWN_LABEL;
  return field.format ? field.format(value) : String(value);
}

// 表示する画像パスを返す
//  image_real（提携先発行の正規ライセンス画像URL）があればそれを、
//  無ければ SVG フォールバック（image）を使う。
//  prefix は相対パス調整用（一覧・詳細は '../'、トップは ''）
function imageSrc(p, prefix) {
  prefix = prefix || '';
  if (p.image_real && p.image_real !== '') {
    // 正規画像URL（http... の絶対URL想定。相対パスならprefixを付与）
    return /^https?:\/\//.test(p.image_real) ? p.image_real : prefix + p.image_real;
  }
  return prefix + p.image;
}

// アフィリエイトのボタン文言（提供元別）
function affiliateLabel(provider) {
  if (!provider) return '販売ページを見る';
  if (provider.includes('楽天')) return '楽天で見る';
  if (provider.includes('Amazon') || provider.includes('アマゾン')) return 'Amazonで見る';
  if (provider.includes('Yahoo') || provider.includes('ヤフー')) return 'Yahoo!で見る';
  return provider + 'で見る';
}

// localStorage の比較リスト用キー
const COMPARE_STORAGE_KEY = 'niwashiba_compare_carport';

function getCompareList() {
  try {
    return JSON.parse(localStorage.getItem(COMPARE_STORAGE_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function setCompareList(ids) {
  localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(ids));
}
