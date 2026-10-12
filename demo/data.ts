import type { Proposal, ReviewColumn, ReviewLabels, ReviewRule } from '../src';
export interface Product { id: string; name: string; category: string; price: number; stock: number }
const names = [
  ['K75 机械键盘', '桌面外设', 299], ['Studio 无线耳机', '音频设备', 599],
  ['View 27 寸显示器', '桌面外设', 1699], ['Hub Pro 扩展坞', '数码配件', 249],
  ['Arc 无线鼠标', '桌面外设', 199], ['Desk 桌面音箱', '音频设备', 399],
  ['Nano 氮化镓充电器', '数码配件', 159], ['Glow 桌面台灯', '生活方式', 329],
  ['Orbit 磁吸支架', '数码配件', 129], ['Canvas 桌垫', '桌面外设', 89],
  ['Travel 随行杯', '生活方式', 139], ['Link 编织数据线', '数码配件', 59],
] as const;
export const products: Product[] = Array.from({ length: 100 }, (_, index) => {
  const [name, category, price] = names[index % names.length];
  return { id: `SKU-${String(index + 1).padStart(4, '0')}`, name: index < names.length ? name : `${name} · ${['雾白', '深空灰', '松石绿', '暖沙色'][Math.floor(index / names.length) % 4]} ${Math.floor(index / names.length)}`, category, price, stock: 35 + ((index * 17) % 180) };
});
export const pricingProposals: Proposal<Product>[] = products.map((product, index) => ({
  id: `price-${product.id}`, kind: 'update', rowId: product.id,
  changes: { price: index === 1 ? 59 : index === 2 ? 2599 : index === 6 ? 15 : Math.round(product.price * (.9 + (index % 3) * .02)) },
}));
export const mixedProposals: Proposal<Product>[] = [
  { id: 'mix-price', kind: 'update', rowId: products[0].id, changes: { price: 269, stock: 60 } },
  { id: 'mix-stock', kind: 'update', rowId: products[1].id, changes: { stock: 0 } },
  { id: 'mix-insert', kind: 'insert', after: { id: 'SKU-0101', name: 'Air 便携显示器', category: '桌面外设', price: 899, stock: 50 } },
  { id: 'mix-delete', kind: 'delete', rowId: products[3].id },
  { id: 'mix-normal', kind: 'update', rowId: products[4].id, changes: { price: 179 } },
  { id: 'mix-add', kind: 'insert', after: { id: 'SKU-0102', name: 'Fold 笔记本支架', category: '数码配件', price: 169, stock: 90 } },
  { id: 'mix-large', kind: 'update', rowId: products[2].id, changes: { price: 2599 } },
  { id: 'mix-delete-two', kind: 'delete', rowId: products[9].id },
];
export const columns: ReviewColumn<Product>[] = [
  { key: 'name', label: '商品名称' },
  { key: 'category', label: '分类', hidden: true },
  { key: 'price', label: '价格', render: value => `¥${Number(value).toLocaleString('zh-CN')}` },
  { key: 'stock', label: '库存', render: value => `${value} 件` },
];
export const rules: ReviewRule<Product>[] = [
  { id: 'price-swing', label: '调价异常', evaluate: ({ before, after }) => {
    if (!before || !after || before.price === after.price) return null;
    if (before.price === 0) return after.price === 0 ? null : '原价为 0，请人工确认';
    const percentage = ((after.price - before.price) / before.price) * 100;
    return Math.abs(percentage) > 20 ? `${percentage > 0 ? '+' : ''}${percentage.toFixed(1)}%，超过 20%` : null;
  } },
  { id: 'zero-stock', label: '库存归零', evaluate: ({ before, after }) => before && after && before.stock > 0 && after.stock === 0 ? '将影响商品可售状态' : null },
  { id: 'deletion', label: '删除提醒', evaluate: ({ proposal }) => proposal.kind === 'delete' ? '请确认这条记录可以移除' : null },
];
export const labels: Partial<ReviewLabels> = {
  all: '全部变更', pending: '待审核', accepted: '已接受', rejected: '已拒绝', warning: '需要留意',
  insert: '新增', update: '修改', delete: '删除', accept: '接受', reject: '拒绝',
  search: '搜索商品、SKU 或变更值…', searchLabel: '搜索变更', allKinds: '全部操作', kindLabel: '操作类型',
  acceptVisible: '接受当前', rejectVisible: '拒绝当前', undo: '撤销上一步', reset: '重置审核',
  record: '商品 / 记录', change: '变更预览', decision: '审核决定', before: '修改前', after: '修改后',
  empty: '当前没有需要审核的变更', noMatches: '没有找到符合条件的变更', clearFilters: '清除筛选', clearSearch: '清除搜索', invalid: '无法审核这批数据',
  export: '导出批准项', preview: '最后，再看一眼。', close: '返回审核', download: '下载 JSON', downloadDone: '批准清单已导出', exportError: '导出失败，请重试。',
  deleteDescription: '这条记录将被删除', newRecord: '新增记录', baseline: '已有记录', more: '查看完整 JSON',
  filtered: (visible, total) => `显示 ${visible} / ${total} 项变更`,
  approvalSummary: (accepted, pending) => `已批准 ${accepted} 项，${pending} 项待审核`,
  exportSummary: accepted => `仅导出你批准的 ${accepted} 项操作。待审核和已拒绝的操作不会进入清单；不会执行任何数据修改。`,
  bulkLabel: (action, count) => `${action} ${count} 项`,
};
export const integrationCode = `import { BatchReview } from 'react-batch-review';
import 'react-batch-review/style.css';

<BatchReview
  base={products}
  proposals={[
    {
      id: 'price-001',
      kind: 'update',
      rowId: 'SKU-0001',
      changes: { price: 269 },
    },
  ]}
  columns={columns}
  rules={rules}
  getRowLabel={(row) => row.name}
  onExport={(result) => {
    // Hand approved operations to your app.
    console.log(result.acceptedOperations);
  }}
/>

// Prefer your own UI?
// const review = useBatchReview({ base, proposals, columns, rules });`;
