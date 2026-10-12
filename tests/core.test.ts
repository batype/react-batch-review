import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReview, countReview, createReviewResult, decisionReducer, filterReview, initialDecisionState, ReviewValidationError } from '../src/core';
import type { Proposal, ReviewColumn, ReviewOptions, ReviewRule } from '../src/types';

interface Row { id: string; name: string; price: number; note?: string | null }
const base: Row[] = [{ id: 'a', name: 'Keyboard', price: 100 }, { id: 'b', name: 'Mouse', price: 50 }, { id: 'c', name: 'Monitor', price: 300 }];
const columns: ReviewColumn<Row>[] = [{ key: 'name', label: 'Name' }, { key: 'price', label: 'Price' }, { key: 'note', label: 'Note', required: false }];
const proposals: Proposal<Row>[] = [
  { id: 'up', kind: 'update', rowId: 'a', changes: { price: 90 } },
  { id: 'in', kind: 'insert', after: { id: 'd', name: 'Dock', price: 60 } },
  { id: 'del', kind: 'delete', rowId: 'b' },
];
const options = (patch: Partial<ReviewOptions<Row>> = {}): ReviewOptions<Row> => ({ base, columns, proposals, ...patch });
const invalid = (patch: Partial<ReviewOptions<Row>>, expected: RegExp) => assert.throws(() => buildReview(options(patch)), expected);

test('derives insert/update/delete without inferring deletions from absent proposals', () => {
  const items = buildReview(options());
  assert.deepEqual(items.map(item => [item.kind, item.rowId]), [['update', 'a'], ['insert', 'd'], ['delete', 'b']]);
  assert.equal(items[0].before?.price, 100);
  assert.equal(items[0].after?.price, 90);
  assert.deepEqual(items[0].changes, [{ key: 'price', label: 'Price', before: 100, after: 90 }]);
  assert.equal(items[1].before, null);
  assert.equal(items[2].after, null);
  assert.ok(!items.some(item => item.rowId === 'c'));
});
test('reordering source records does not affect operation matching', () => {
  assert.deepEqual(buildReview(options({ base: [...base].reverse() })), buildReview(options()));
});
test('review snapshots are isolated from caller input mutations', () => {
  const input = structuredClone(options());
  const items = buildReview(input);
  input.base[0].price = 200;
  if (input.proposals[0].kind === 'update') input.proposals[0].changes.price = 250;
  assert.equal(items[0].before?.price, 100);
  assert.equal(items[0].after?.price, 90);
  assert.equal((items[0].proposal as Extract<Proposal<Row>, { kind: 'update' }>).changes.price, 90);
});
test('rejects duplicate baseline IDs', () => invalid({ base: [...base, base[0]] }, /Duplicate base record id/));
test('rejects duplicate operation IDs', () => invalid({ proposals: [...proposals, proposals[0]] }, /Duplicate operation id/));
test('rejects multiple operations for the same record', () => invalid({ proposals: [proposals[0], { id: 'another', kind: 'delete', rowId: 'a' }] }, /Multiple operations/));
test('rejects operations on missing records', () => invalid({ proposals: [{ id: 'missing', kind: 'delete', rowId: 'z' }] }, /does not exist/));
test('rejects insertions over existing records', () => invalid({ proposals: [{ id: 'exists', kind: 'insert', after: base[0] }] }, /existing record/));
test('rejects missing required insertion fields', () => invalid({ proposals: [{ id: 'bad', kind: 'insert', after: { id: 'z', name: 'New' } as Row }] }, /missing required field price/));
test('accepts empty baseline when the insertion satisfies the declared schema', () => {
  assert.equal(buildReview(options({ base: [], proposals: [proposals[1]] }))[0].after?.name, 'Dock');
});
test('rejects unknown updated fields and ID mutations', () => {
  invalid({ proposals: [{ id: 'bad', kind: 'update', rowId: 'a', changes: { id: 'b' } as object }] }, /unknown field id/);
  invalid({ proposals: [{ id: 'bad', kind: 'update', rowId: 'a', changes: { typo: 1 } as object }] }, /unknown field typo/);
});
test('rejects empty and no-op updates', () => {
  invalid({ proposals: [{ id: 'bad', kind: 'update', rowId: 'a', changes: {} }] }, /Empty or invalid/);
  invalid({ proposals: [{ id: 'bad', kind: 'update', rowId: 'a', changes: { price: 100 } }] }, /no changes/);
});
test('rejects non-finite, undefined and nested values', () => {
  for (const price of [NaN, Infinity, undefined, { nested: 1 }]) invalid({ proposals: [{ id: 'bad', kind: 'update', rowId: 'a', changes: { price } as Partial<Row> }] }, /flat JSON value/);
});
test('supports null and omitted optional fields without losing zero values', () => {
  const items = buildReview(options({ proposals: [{ id: 'ok', kind: 'update', rowId: 'a', changes: { price: 0, note: null } }] }));
  assert.equal(items[0].after?.price, 0);
  assert.equal(items[0].after?.note, null);
});
test('rejects duplicate and unsafe schema keys', () => {
  invalid({ columns: [...columns, columns[0]] }, /duplicate column/);
  invalid({ columns: [{ key: '__proto__' as 'name', label: 'Bad' }] }, /Invalid or duplicate column/);
});
test('rules add warnings without deciding or mutating snapshots', () => {
  const rules: ReviewRule<Row>[] = [{ id: 'limit', label: 'Price warning', evaluate: ({ before, after }) => {
    if (after) after.name = 'Mutated by rule';
    return before?.price === 100 ? 'Check this change' : null;
  } }];
  const items = buildReview(options({ rules }));
  assert.equal(items[0].after?.name, 'Keyboard');
  assert.equal(items[0].warnings[0].detail, 'Check this change');
  assert.equal(countReview(items, {}).pending, 3);
});
test('rule failures fail the batch instead of silently hiding warnings', () => {
  invalid({ rules: [{ id: 'failing', label: 'Rule', evaluate: () => { throw new Error('Failure'); } }] }, /Rule failed: failing/);
});
test('filters compose warning, operation kind, search and current decisions', () => {
  const items = buildReview(options({ rules: [{ id: 'flag', label: 'Flag', evaluate: ({ proposal }) => proposal.kind === 'update' ? 'Price check' : null }] }));
  assert.deepEqual(filterReview(items, {}, { status: 'warning', kind: 'all', query: 'KEYBOARD' }).map(item => item.id), ['up']);
  assert.equal(filterReview(items, {}, { status: 'warning', kind: 'insert', query: '' }).length, 0);
  assert.deepEqual(filterReview(items, { up: 'accepted' }, { status: 'pending', kind: 'all', query: '' }).map(item => item.id), ['in', 'del']);
});
test('batch decisions affect exactly the IDs in the filtered result', () => {
  const items = buildReview(options());
  const filtered = filterReview(items, {}, { status: 'all', kind: 'insert', query: '' });
  const state = decisionReducer(initialDecisionState('a'), { type: 'decide', fingerprint: 'a', ids: filtered.map(item => item.id), decision: 'accepted' });
  assert.deepEqual(countReview(items, state.decisions), { total: 3, pending: 2, accepted: 1, rejected: 0, warning: 0, insert: 1, update: 1, delete: 1 });
});
test('undo restores one complete bulk decision, not one row at a time', () => {
  let state = initialDecisionState('a');
  state = decisionReducer(state, { type: 'decide', fingerprint: 'a', ids: ['up', 'in'], decision: 'accepted' });
  state = decisionReducer(state, { type: 'decide', fingerprint: 'a', ids: ['del'], decision: 'rejected' });
  state = decisionReducer(state, { type: 'undo', fingerprint: 'a' });
  assert.equal(state.decisions.up, 'accepted');
  assert.equal(state.decisions.in, 'accepted');
  assert.equal(state.decisions.del, undefined);
  state = decisionReducer(state, { type: 'undo', fingerprint: 'a' });
  assert.deepEqual(Object.keys(state.decisions), []);
});
test('reset is undoable; unchanged decisions do not grow history', () => {
  const initial = initialDecisionState('a');
  assert.equal(decisionReducer(initial, { type: 'reset', fingerprint: 'a' }), initial);
  let state = decisionReducer(initial, { type: 'decide', fingerprint: 'a', ids: ['up'], decision: 'accepted' });
  state = decisionReducer(state, { type: 'decide', fingerprint: 'a', ids: ['up'], decision: 'accepted' });
  assert.equal(state.history.length, 1);
  state = decisionReducer(state, { type: 'reset', fingerprint: 'a' });
  assert.equal(state.decisions.up, undefined);
  assert.equal(decisionReducer(state, { type: 'undo', fingerprint: 'a' }).decisions.up, 'accepted');
});
test('batch invalidation permanently discards decisions and history', () => {
  let state = decisionReducer(initialDecisionState('a'), { type: 'decide', fingerprint: 'a', ids: ['up'], decision: 'accepted' });
  state = decisionReducer(state, { type: 'invalidate', fingerprint: 'b' });
  state = decisionReducer(state, { type: 'invalidate', fingerprint: 'a' });
  assert.equal(state.decisions.up, undefined);
  assert.equal(state.history.length, 0);
});
test('export includes only explicitly accepted operations, with before/after and all decisions', () => {
  const items = buildReview(options());
  const date = new Date('2026-10-12T12:00:00Z');
  const result = createReviewResult(items, { up: 'accepted', in: 'rejected' }, date);
  assert.equal(result.generatedAt, date.toISOString());
  assert.equal(result.schemaVersion, 1);
  assert.deepEqual(result.acceptedOperations.map(op => op.operationId), ['up']);
  assert.equal(result.acceptedOperations[0].before?.price, 100);
  assert.equal(result.acceptedOperations[0].after?.price, 90);
  assert.deepEqual(result.decisions.map(decision => decision.decision), ['accepted', 'rejected', 'pending']);
});
test('exported results are detached from review snapshots', () => {
  const items = buildReview(options());
  const result = createReviewResult(items, { up: 'accepted' });
  result.acceptedOperations[0].after!.price = 999;
  assert.equal(createReviewResult(items, { up: 'accepted' }).acceptedOperations[0].after?.price, 90);
});
test('reserved-looking operation IDs do not pollute decision prototypes', () => {
  const items = buildReview(options({ proposals: [{ id: '__proto__', kind: 'update', rowId: 'a', changes: { price: 90 } }, { id: 'constructor', kind: 'delete', rowId: 'b' }] }));
  const state = decisionReducer(initialDecisionState('a'), { type: 'decide', fingerprint: 'a', ids: ['__proto__'], decision: 'accepted' });
  assert.equal(countReview(items, {}).pending, 2);
  assert.deepEqual(createReviewResult(items, {}).decisions.map(item => item.decision), ['pending', 'pending']);
  assert.equal(Object.getPrototypeOf(state.decisions), null);
  assert.equal(countReview(items, state.decisions).accepted, 1);
  assert.equal(countReview(items, state.decisions).pending, 1);
});
test('collects validation issues and handles an empty batch', () => {
  assert.throws(() => buildReview(options({ base: [base[0], base[0]], proposals: [{ id: 'bad', kind: 'delete', rowId: 'missing' }] })), (error: unknown) => error instanceof ReviewValidationError && error.issues.length >= 2);
  assert.deepEqual(buildReview(options({ base: [], proposals: [] })), []);
});
