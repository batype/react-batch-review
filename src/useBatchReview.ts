import { useMemo, useReducer, useState } from 'react';
import {
  buildReview,
  countReview,
  createReviewResult,
  decisionReducer,
  filterReview,
  initialDecisionState,
  schemaFingerprint,
} from './core';
import type { ChangeKind, Decision, Identified, ReviewOptions, ReviewStatus } from './types';

/** Input changes invalidate decisions synchronously, including in-place changes to JSON values. */
export function useBatchReview<T extends Identified>(options: ReviewOptions<T>) {
  let dataKey = '';
  let serializationError: Error | null = null;

  try {
    dataKey = JSON.stringify([
      options.base,
      options.proposals,
      schemaFingerprint(options.columns),
      options.rules?.map(rule => rule.id),
    ]);
  } catch {
    serializationError = new Error('Review input must contain flat JSON records.');
  }

  const model = useMemo(() => {
    if (serializationError) return { items: [], error: serializationError };
    try {
      return { items: buildReview(options), error: null };
    } catch (error) {
      return {
        items: [],
        error: error instanceof Error ? error : new Error('Invalid review input'),
      };
    }
    // dataKey also detects in-place mutations of caller-owned JSON input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dataKey,
    options.base,
    options.proposals,
    options.columns,
    options.rules,
    Boolean(serializationError),
  ]);

  const fingerprint = `${model.error ? 'invalid' : 'valid'}:${dataKey}`;
  const [savedState, dispatch] = useReducer(decisionReducer, fingerprint, initialDecisionState);

  // Forget the prior batch permanently, even if the caller later restores its data.
  if (savedState.fingerprint !== fingerprint) dispatch({ type: 'invalidate', fingerprint });
  const state =
    savedState.fingerprint === fingerprint ? savedState : initialDecisionState(fingerprint);

  const [status, setStatus] = useState<ReviewStatus>('all');
  const [kind, setKind] = useState<ChangeKind>('all');
  const [query, setQuery] = useState('');

  const visibleItems = filterReview(model.items, state.decisions, { status, kind, query });
  const counts = countReview(model.items, state.decisions);

  const decide = (ids: readonly string[], decision: Decision) => {
    const valid = new Set(model.items.map(item => item.id));
    dispatch({ type: 'decide', fingerprint, ids: ids.filter(id => valid.has(id)), decision });
  };

  return {
    items: model.items,
    visibleItems,
    error: model.error,
    counts,
    decisions: state.decisions as Readonly<Record<string, Decision>>,
    getDecision: (id: string): Decision => state.decisions[id] ?? 'pending',
    decide,
    decideVisible: (decision: Decision) =>
      decide(
        visibleItems.map(item => item.id),
        decision,
      ),
    undo: () => dispatch({ type: 'undo', fingerprint }),
    reset: () => dispatch({ type: 'reset', fingerprint }),
    canUndo: state.history.length > 0,
    canReset: Object.keys(state.decisions).length > 0,
    status,
    setStatus,
    kind,
    setKind,
    query,
    setQuery,
    exportResult: () => createReviewResult(model.items, state.decisions),
    fingerprint,
  };
}

export type BatchReviewController<T extends Identified> = ReturnType<typeof useBatchReview<T>>;
