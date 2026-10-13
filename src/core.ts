import type {
  Decision,
  Identified,
  ReviewColumn,
  ReviewItem,
  ReviewOptions,
  ReviewResult,
  ReviewStatus,
  ChangeKind,
  ReviewCounts,
} from './types';

export class ReviewValidationError extends Error {
  constructor(public issues: string[]) {
    super(issues.join('\n'));
    this.name = 'ReviewValidationError';
  }
}

const own = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key);
const dangerousKeys = new Set(['__proto__', 'prototype', 'constructor']);
const plain = (value: unknown): value is Record<string, unknown> =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const validValue = (value: unknown) =>
  value === null ||
  typeof value === 'string' ||
  typeof value === 'boolean' ||
  (typeof value === 'number' && Number.isFinite(value));
const validId = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const getDecision = (decisions: Readonly<Record<string, Decision>>, id: string): Decision => {
  const value = own(decisions, id) ? decisions[id] : 'pending';
  return value === 'accepted' || value === 'rejected' ? value : 'pending';
};

/** Validate the full batch before deriving any reviewable operations. Never mutates its inputs. */
export function buildReview<T extends Identified>({
  base,
  proposals,
  columns,
  rules = [],
}: ReviewOptions<T>): ReviewItem<T>[] {
  const issues: string[] = [];
  const fields = new Set<string>();

  for (const column of columns) {
    if (
      !validId(column.key) ||
      column.key === 'id' ||
      dangerousKeys.has(column.key) ||
      fields.has(column.key)
    ) {
      issues.push(`Invalid or duplicate column: ${column.key}`);
    }
    fields.add(column.key);
  }

  const checkFields = (value: Record<string, unknown>, context: string, partial = false) => {
    for (const key of Object.keys(value)) {
      if (key === 'id' && !partial) continue;
      if (!fields.has(key) || dangerousKeys.has(key)) {
        issues.push(`${context}: unknown field ${key}`);
      }
      if (!validValue(value[key])) {
        issues.push(`${context}: ${key} must be a finite, flat JSON value`);
      }
    }

    if (!partial) {
      for (const column of columns) {
        if (column.required !== false && !own(value, column.key)) {
          issues.push(`${context}: missing required field ${column.key}`);
        }
      }
    }
  };

  const records = new Map<string, T>();
  for (const record of base) {
    if (!plain(record) || !own(record, 'id') || !validId(record.id)) {
      issues.push('Base record requires a non-empty string id');
      continue;
    }
    if (records.has(record.id)) issues.push(`Duplicate base record id: ${record.id}`);
    checkFields(record, `Record ${record.id}`);
    records.set(record.id, record);
  }

  const operationIds = new Set<string>();
  const proposedRecords = new Set<string>();
  for (const proposal of proposals) {
    if (!plain(proposal) || !own(proposal, 'id') || !validId(proposal.id)) {
      issues.push('Proposal requires a non-empty string id');
      continue;
    }
    if (operationIds.has(proposal.id)) issues.push(`Duplicate operation id: ${proposal.id}`);
    operationIds.add(proposal.id);
    const operationId = proposal.id;

    if (proposal.kind !== 'insert' && proposal.kind !== 'update' && proposal.kind !== 'delete') {
      issues.push(`Unknown operation kind: ${operationId}`);
      continue;
    }

    const rowId = proposal.kind === 'insert' ? proposal.after?.id : proposal.rowId;
    if (!validId(rowId)) {
      issues.push(`Operation ${proposal.id}: invalid record id`);
      continue;
    }
    if (proposedRecords.has(rowId)) issues.push(`Multiple operations for record: ${rowId}`);
    proposedRecords.add(rowId);

    if (proposal.kind === 'insert') {
      if (records.has(rowId)) issues.push(`Cannot insert existing record: ${rowId}`);
      if (!plain(proposal.after) || !own(proposal.after, 'id')) {
        issues.push(`Insert ${proposal.id}: invalid record`);
      } else {
        checkFields(proposal.after, `Insert ${proposal.id}`);
      }
    } else {
      if (!records.has(rowId)) issues.push(`Record does not exist: ${rowId}`);
      if (proposal.kind === 'update') {
        if (!plain(proposal.changes) || Object.keys(proposal.changes).length === 0) {
          issues.push(`Empty or invalid update: ${proposal.id}`);
        } else {
          checkFields(proposal.changes, `Update ${proposal.id}`, true);
          const original = records.get(rowId);
          if (
            original &&
            Object.keys(proposal.changes).every(
              key =>
                own(original, key) &&
                Object.is(
                  (original as Record<string, unknown>)[key],
                  (proposal.changes as Record<string, unknown>)[key],
                ),
            )
          ) {
            issues.push(`Update has no changes: ${proposal.id}`);
          }
        }
      }
    }
  }

  const ruleIds = new Set<string>();
  for (const rule of rules) {
    if (!validId(rule.id) || ruleIds.has(rule.id)) {
      issues.push(`Invalid or duplicate rule id: ${rule.id}`);
    }
    ruleIds.add(rule.id);
  }

  if (issues.length) throw new ReviewValidationError(issues);

  return proposals.map(originalProposal => {
    const proposal = clone(originalProposal);
    const rowId = proposal.kind === 'insert' ? proposal.after.id : proposal.rowId;
    const before = proposal.kind === 'insert' ? null : clone(records.get(rowId)!);
    const after =
      proposal.kind === 'delete'
        ? null
        : proposal.kind === 'insert'
          ? clone(proposal.after)
          : ({ ...before!, ...proposal.changes } as T);
    const context = { proposal, before, after };

    const changes = columns
      .filter(column => {
        const key = column.key;
        return before === null || after === null || !Object.is(before[key], after[key]);
      })
      .map(column => ({
        key: column.key,
        label: column.label,
        before: before?.[column.key],
        after: after?.[column.key],
      }));

    const warnings = rules.flatMap(rule => {
      try {
        // Isolate caller-provided rules from the authoritative snapshots.
        const detail = rule.evaluate(clone(context));
        return detail ? [{ id: rule.id, label: rule.label, detail }] : [];
      } catch {
        throw new ReviewValidationError([`Rule failed: ${rule.id}`]);
      }
    });

    return { ...context, id: proposal.id, rowId, kind: proposal.kind, changes, warnings };
  });
}

export interface ReviewFilter {
  status: ReviewStatus;
  kind: ChangeKind;
  query: string;
}

export function filterReview<T extends Identified>(
  items: readonly ReviewItem<T>[],
  decisions: Readonly<Record<string, Decision>>,
  filter: ReviewFilter,
): ReviewItem<T>[] {
  const query = filter.query.trim().toLocaleLowerCase();
  return items.filter(item => {
    const decision = getDecision(decisions, item.id);
    if (filter.status === 'warning' && item.warnings.length === 0) return false;
    if (filter.status !== 'all' && filter.status !== 'warning' && decision !== filter.status) {
      return false;
    }
    if (filter.kind !== 'all' && item.kind !== filter.kind) return false;
    return (
      !query ||
      JSON.stringify([item.rowId, item.before, item.after, item.warnings])
        .toLocaleLowerCase()
        .includes(query)
    );
  });
}

export function countReview<T extends Identified>(
  items: readonly ReviewItem<T>[],
  decisions: Readonly<Record<string, Decision>>,
): ReviewCounts {
  const counts: ReviewCounts = {
    total: items.length,
    pending: 0,
    accepted: 0,
    rejected: 0,
    warning: 0,
    insert: 0,
    update: 0,
    delete: 0,
  };

  for (const item of items) {
    counts[getDecision(decisions, item.id)]++;
    counts[item.kind]++;
    if (item.warnings.length) counts.warning++;
  }

  return counts;
}

export function createReviewResult<T extends Identified>(
  items: readonly ReviewItem<T>[],
  decisions: Readonly<Record<string, Decision>>,
  date = new Date(),
): ReviewResult<T> {
  return clone({
    schemaVersion: 1 as const,
    generatedAt: date.toISOString(),
    acceptedOperations: items
      .filter(item => getDecision(decisions, item.id) === 'accepted')
      .map(item => ({
        operationId: item.id,
        rowId: item.rowId,
        kind: item.kind,
        proposal: item.proposal,
        before: item.before,
        after: item.after,
      })),
    decisions: items.map(item => ({
      operationId: item.id,
      rowId: item.rowId,
      decision: getDecision(decisions, item.id),
    })),
  });
}

export interface DecisionState {
  fingerprint: string;
  decisions: Record<string, Decision>;
  history: Record<string, Decision>[];
}

export type DecisionAction =
  | { type: 'decide'; fingerprint: string; ids: readonly string[]; decision: Decision }
  | { type: 'undo'; fingerprint: string }
  | { type: 'reset'; fingerprint: string }
  | { type: 'invalidate'; fingerprint: string };

export const initialDecisionState = (fingerprint: string): DecisionState => ({
  fingerprint,
  decisions: Object.create(null) as Record<string, Decision>,
  history: [],
});

export function decisionReducer(previous: DecisionState, action: DecisionAction): DecisionState {
  const state =
    previous.fingerprint === action.fingerprint
      ? previous
      : initialDecisionState(action.fingerprint);

  if (action.type === 'invalidate') return initialDecisionState(action.fingerprint);
  if (action.type === 'undo') {
    const decisions = state.history.at(-1);
    return decisions ? { ...state, decisions, history: state.history.slice(0, -1) } : state;
  }

  if (action.type === 'reset') {
    if (!Object.keys(state.decisions).length) return state;
    return {
      ...state,
      decisions: Object.create(null) as Record<string, Decision>,
      history: [...state.history, state.decisions],
    };
  }

  const ids = [...new Set(action.ids)].filter(
    id => (state.decisions[id] ?? 'pending') !== action.decision,
  );
  if (!ids.length) return state;

  const decisions = Object.assign(Object.create(null), state.decisions) as Record<string, Decision>;
  for (const id of ids) {
    Object.defineProperty(decisions, id, {
      value: action.decision,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }

  return { ...state, decisions, history: [...state.history, state.decisions] };
}

export function schemaFingerprint<T extends Identified>(
  columns: readonly ReviewColumn<T>[],
): unknown {
  return columns.map(({ key, required }) => ({ key, required: required !== false }));
}
