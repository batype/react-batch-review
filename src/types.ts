import type { ReactNode } from 'react';

export type Identified = { id: string };
export type Proposal<T extends Identified> =
  | { id: string; kind: 'insert'; after: T }
  | { id: string; kind: 'update'; rowId: string; changes: Partial<Omit<T, 'id'>> }
  | { id: string; kind: 'delete'; rowId: string };
export type Decision = 'pending' | 'accepted' | 'rejected';
export type ReviewStatus = 'all' | Decision | 'warning';
export type ChangeKind = 'all' | Proposal<Identified>['kind'];

export interface ReviewColumn<T extends Identified> {
  key: Exclude<Extract<keyof T, string>, 'id'>;
  label: string;
  /** Fields are required by default. Optional fields may be omitted, but never set to undefined. */
  required?: boolean;
  render?: (value: unknown, record: T) => ReactNode;
  /** Keep the field in the schema without displaying it. */
  hidden?: boolean;
}
export interface FieldChange { key: string; label: string; before: unknown; after: unknown }
export interface ReviewWarning { id: string; label: string; detail: string }
export interface ReviewContext<T extends Identified> {
  proposal: Proposal<T>;
  before: T | null;
  after: T | null;
}
export interface ReviewRule<T extends Identified> {
  id: string;
  label: string;
  evaluate: (context: ReviewContext<T>) => string | null | undefined;
}
export interface ReviewItem<T extends Identified> extends ReviewContext<T> {
  id: string;
  rowId: string;
  kind: Proposal<T>['kind'];
  changes: FieldChange[];
  warnings: ReviewWarning[];
}
export interface ReviewOptions<T extends Identified> {
  base: readonly T[];
  proposals: readonly Proposal<T>[];
  columns: readonly ReviewColumn<T>[];
  rules?: readonly ReviewRule<T>[];
}
export interface AcceptedOperation<T extends Identified> extends ReviewContext<T> {
  operationId: string;
  rowId: string;
  kind: Proposal<T>['kind'];
}
export interface ReviewResult<T extends Identified> {
  schemaVersion: 1;
  generatedAt: string;
  acceptedOperations: AcceptedOperation<T>[];
  decisions: { operationId: string; rowId: string; decision: Decision }[];
}
export interface ReviewCounts {
  total: number; pending: number; accepted: number; rejected: number; warning: number;
  insert: number; update: number; delete: number;
}
