# @batype/react-batch-review

**批量修改，先审再提交。**

为商品调价、导入更新、AI 批量编辑提供可嵌入 React 的变更审核界面。传入原始数据和提议操作，逐项接受或拒绝，输出明确批准的操作。

当前版本：v0.1.0。

[在线演示](https://batype.github.io/react-batch-review/) · [GitHub](https://github.com/batype/react-batch-review) · [问题反馈](https://github.com/batype/react-batch-review/issues)

![变更审核工作台](https://raw.githubusercontent.com/batype/react-batch-review/main/docs/preview.jpg)

## 体验演示

打开[在线演示](https://batype.github.io/react-batch-review/)即可体验。运行 `npm run build` 后，也可用现代浏览器打开生成的 `demo.html`；这个自包含页面包含脚本、样式和预置数据，不需要登录或 API Key。

开发预览需要 Node.js 22.12+：

```sh
npm ci
npm run dev
```

打开终端输出的本地地址，默认 `http://127.0.0.1:5173/`。

演示包括 100 项商品调价和 8 项混合操作。先筛选 3 项异常并拒绝，再切到待审核列表接受其余 97 项，导出 JSON 即可检查批准清单。切换场景或刷新页面会重新开始审核。

## 能力

- 行与字段差异预览，支持新增、修改和显式删除。
- 按行或按当前筛选结果接受、拒绝；重复点击已选决定会恢复待审核。
- 每次批量决定可整体撤销，重置操作也可撤销。
- 待审核、已接受、已拒绝、异常、操作类型和关键词组合筛选。
- 自定义异常规则、字段格式、行标题、图标和界面文案。
- 导出前预览批准清单和完整 JSON；仅批准操作进入 `acceptedOperations`。
- 输入变化后立即清空旧审核状态和撤销历史。
- `useBatchReview` 提供无界面逻辑，`BatchReviewView` 支持外部控制器。
- React + TypeScript，桌面与手机布局，键盘操作和原生模态对话框。

## 在另一个项目中安装

```sh
npm install @batype/react-batch-review
```

如需从源码生成本地包，运行 `npm run build` 和 `npm pack --ignore-scripts`，再安装生成的 `batype-react-batch-review-0.1.0.tgz`。

安装包包含 ESM 构建、TypeScript 声明和独立样式。组件的运行时 peer dependency 为 React 18 或 19；本次演示和浏览器验证使用 React 19。

## 最小接入

```tsx
'use client';

import { BatchReview } from '@batype/react-batch-review';
import type { Proposal, ReviewColumn } from '@batype/react-batch-review';
import '@batype/react-batch-review/style.css';

type Product = { id: string; name: string; price: number; stock: number };

const base: Product[] = [
  { id: 'SKU-0001', name: '机械键盘', price: 299, stock: 35 },
];

const proposals: Proposal<Product>[] = [
  {
    id: 'operation-001',
    kind: 'update',
    rowId: 'SKU-0001',
    changes: { price: 269 },
  },
];

const columns: ReviewColumn<Product>[] = [
  { key: 'name', label: '商品' },
  { key: 'price', label: '价格', render: value => `¥${value}` },
  { key: 'stock', label: '库存' },
];

export default function PriceReview() {
  return (
    <BatchReview
      base={base}
      proposals={proposals}
      columns={columns}
      getRowLabel={row => row.name}
    />
  );
}
```

默认导出按钮下载本地 JSON。提供 `onExport(result)` 可接管导出，支持异步处理与失败提示；调用方自行处理保存或提交，也可覆盖 `labels.download` 等文案。完整中文文案及异常规则见 `demo/data.ts`。

## 数据约定

业务记录 ID `row.id` 与操作 ID `proposal.id` 都是非空字符串，分别必须唯一。每条记录每批只允许一个操作。

```ts
type Proposal<T extends { id: string }> =
  | { id: string; kind: 'insert'; after: T }
  | { id: string; kind: 'update'; rowId: string;
      changes: Partial<Omit<T, 'id'>> }
  | { id: string; kind: 'delete'; rowId: string };
```

`columns` 同时声明字段 schema，必须声明所有数据字段（`id` 除外）。用 `hidden: true` 声明不在界面展示的字段；用 `required: false` 声明允许省略的字段。字段值限字符串、有限数字、布尔或 null，不能嵌套或设为 undefined。更新不支持改变记录 ID 或删除字段。

文件中缺少记录不代表删除；删除必须通过 `kind: 'delete'` 明确提出。记录顺序变化不生成修改。重复 ID、未知字段、无效插入、空更新、无变化更新和不存在的记录会阻止整批审核。

## 自定义异常规则

```tsx
import type { ReviewRule } from '@batype/react-batch-review';

const rules: ReviewRule<Product>[] = [{
  id: 'price-swing',
  label: '调价异常',
  evaluate: ({ before, after }) => {
    if (!before || !after || before.price === after.price) return null;
    if (before.price === 0) return '原价为 0，请人工确认';
    const delta = (after.price - before.price) / before.price;
    return Math.abs(delta) > 0.2 ? '价格变化超过 20%' : null;
  },
}];
```

规则只标注提醒，不自动批准或拒绝；返回 null 或 undefined 表示无提醒。规则异常会阻止审核。每个规则接收独立数据副本，不能修改审核快照。

## 自行设计界面

```tsx
const review = useBatchReview({ base, proposals, columns, rules });

review.visibleItems;                  // 当前筛选结果
review.counts;                        // 全批统计
review.getDecision('operation-001');  // pending / accepted / rejected
review.decide(['operation-001'], 'accepted');
review.decideVisible('rejected');      // 只影响调用时的筛选结果
review.setStatus('warning');
review.setKind('update');
review.setQuery('SKU-0001');
review.undo();
review.reset();
review.exportResult();
```

`BatchReviewView` 可直接接收这个 controller，演示中的侧栏和统计卡片即通过同一个 controller 驱动。无界面 Hook 不依赖组件渲染方式。纯函数 `buildReview`、`filterReview`、`countReview`、`createReviewResult` 也可单独使用。

## 导出结构

```ts
{
  schemaVersion: 1,
  generatedAt: '2026-10-12T12:00:00.000Z',
  acceptedOperations: [{
    operationId: 'operation-001',
    rowId: 'SKU-0001',
    kind: 'update',
    proposal: { /* 原始提议 */ },
    before: { /* 原始记录 */ },
    after: { /* 批准后的记录 */ },
  }],
  decisions: [{
    operationId: 'operation-001',
    rowId: 'SKU-0001',
    decision: 'accepted',
  }],
}
```

`decisions` 包含所有操作的审核状态，`acceptedOperations` 只包含明确接受的操作。插入的 before 为 null，删除的 after 为 null。导出结果与输入、内部快照相互隔离。

提交到业务系统时，由调用方验证当前记录是否仍与 `before` 一致，并完成权限、业务约束和并发检查。本组件没有服务端执行或授权能力。

## 样式与本地化

通过 `labels` 覆盖文案，通过外层 CSS 变量替换配色：

```css
.my-review {
  --batch-accent: #2e563e;
  --batch-accent-soft: #eef5e9;
  --batch-surface: #fff;
  --batch-ink: #26362d;
  --batch-line: #e8eae5;
}
```

相关变量及移动布局见 `src/style.css`。演示附带浅色和深色切换。

## 开发与检查

```sh
npm test
npm run typecheck
npm run build
```

`build` 生成 `lib/` 组件包、`dist/` 演示站点和自包含的 `demo.html`。已完成的检查与限制见 `VALIDATION.md`。

首版不包含 CSV/XLSX 解析、嵌套数据、单元格独立批准、多人审核、持久存储或虚拟列表。数据量尚未进行性能基准测试。

## 发布与部署

GitHub Actions 在推送到 `main` 时运行测试、构建并部署 `dist/` 到 GitHub Pages。Pull Request 通过独立的 Check 工作流验证，不触发部署。

npm 包的仓库、问题反馈和在线演示地址已配置。发布前运行 `npm test`、`npm run build` 和 `npm pack --dry-run`，确认安装包只包含组件构建、样式、类型声明、README 和许可证。

MIT © react-batch-review contributors
