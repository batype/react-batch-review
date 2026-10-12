import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BatchReview } from '../src/BatchReview';
import type { ReviewColumn, Proposal } from '../src/types';

type Row = { id: string; name: string; price: number };
const base: Row[] = [{ id: 'a', name: 'Keyboard', price: 100 }];
const columns: ReviewColumn<Row>[] = [{ key: 'name', label: 'Name' }, { key: 'price', label: 'Price' }];
const proposals: Proposal<Row>[] = [{ id: 'up', kind: 'update', rowId: 'a', changes: { price: 90 } }];
const render = (data = base, changes = proposals) => renderToStaticMarkup(createElement(BatchReview<Row>, { base: data, proposals: changes, columns, getRowLabel: row => row.name }));

test('review controls cannot accidentally submit a surrounding business form', () => {
  const html = render();
  const buttons = html.match(/<button\b[^>]*>/g) ?? [];
  assert.ok(buttons.length > 10);
  assert.ok(buttons.every(button => button.includes('type="button"')));
});
test('invalid batch renders an alert without approval or export controls', () => {
  const html = render(base, [{ id: 'bad', kind: 'delete', rowId: 'missing' }]);
  assert.match(html, /role="alert"/);
  assert.match(html, /Record does not exist/);
  assert.doesNotMatch(html, /Export approved/);
});
test('record labels and user data are escaped when rendered', () => {
  const html = render([{ id: 'a', name: '<img src=x onerror=alert(1)>', price: 100 }]);
  assert.match(html, /&lt;img/);
  assert.doesNotMatch(html, /<img/);
});
