import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { useBatchReview } from './useBatchReview';
import type { BatchReviewController } from './useBatchReview';
import type { Decision, Identified, ReviewColumn, ReviewItem, ReviewOptions, ReviewResult, ReviewStatus } from './types';

export interface ReviewLabels {
  all: string; pending: string; accepted: string; rejected: string; warning: string;
  insert: string; update: string; delete: string; accept: string; reject: string;
  search: string; searchLabel: string; allKinds: string; kindLabel: string;
  acceptVisible: string; rejectVisible: string; undo: string; reset: string;
  record: string; change: string; decision: string; before: string; after: string;
  empty: string; noMatches: string; clearFilters: string; clearSearch: string; invalid: string;
  export: string; preview: string; close: string; download: string; downloadDone: string; exportError: string;
  deleteDescription: string; newRecord: string; baseline: string; more: string;
  filtered: (visible: number, total: number) => string;
  approvalSummary: (accepted: number, pending: number) => string;
  exportSummary: (accepted: number) => string;
  bulkLabel: (action: string, count: number) => string;
}
const defaults: ReviewLabels = {
  all: 'All changes', pending: 'Pending', accepted: 'Accepted', rejected: 'Rejected', warning: 'Flagged',
  insert: 'Insert', update: 'Update', delete: 'Delete', accept: 'Accept', reject: 'Reject',
  search: 'Search records, values…', searchLabel: 'Search changes', allKinds: 'All operations', kindLabel: 'Operation type',
  acceptVisible: 'Accept visible', rejectVisible: 'Reject visible', undo: 'Undo', reset: 'Reset review',
  record: 'Record', change: 'Proposed changes', decision: 'Decision', before: 'Before', after: 'After',
  empty: 'No changes to review.', noMatches: 'No changes match your filters.', clearFilters: 'Clear filters', clearSearch: 'Clear search', invalid: 'Unable to review this batch',
  export: 'Export approved', preview: 'Review your export', close: 'Close', download: 'Download JSON', downloadDone: 'Export completed', exportError: 'Export failed. Please try again.',
  deleteDescription: 'This record will be deleted', newRecord: 'New record', baseline: 'Existing record', more: 'Full JSON preview',
  filtered: (visible, total) => `${visible} of ${total} changes`,
  approvalSummary: (accepted, pending) => `${accepted} approved · ${pending} pending`,
  exportSummary: accepted => `Only ${accepted} approved operations will be exported. No changes are executed.`,
  bulkLabel: (action, count) => `${action} (${count})`,
};

export interface BatchReviewViewProps<T extends Identified> {
  controller: BatchReviewController<T>;
  columns: readonly ReviewColumn<T>[];
  labels?: Partial<ReviewLabels>;
  getRowLabel?: (record: T) => string;
  getRowCaption?: (record: T) => string;
  renderRowIcon?: (record: T) => ReactNode;
  onExport?: (result: ReviewResult<T>) => void | Promise<void>;
  className?: string;
}
export type BatchReviewProps<T extends Identified> = ReviewOptions<T> & Omit<BatchReviewViewProps<T>, 'controller'>;

function displayValue<T extends Identified>(column: ReviewColumn<T>, value: unknown, record: T | null): ReactNode {
  if (value === undefined) return '—';
  if (record && column.render) return column.render(value, record);
  if (value === null) return 'null';
  if (value === '') return '""';
  return String(value);
}

function ReviewRow<T extends Identified>({ item, controller, columns, labels, getRowLabel, getRowCaption, renderRowIcon }: BatchReviewViewProps<T> & { item: ReviewItem<T>; labels: ReviewLabels }) {
  const record = item.after ?? item.before!;
  const decision = controller.getDecision(item.id);
  const title = getRowLabel ? getRowLabel(record) : item.rowId;
  const visibleChanges = item.changes.filter(change => !columns.find(column => column.key === change.key)?.hidden);
  return <article className={`br-row br-row-${decision} ${item.warnings.length ? 'br-row-flagged' : ''}`} aria-label={title} data-operation-id={item.id}>
    <div className="br-record">
      <div className={`br-record-icon br-icon-${item.kind}`}>{renderRowIcon ? renderRowIcon(record) : <Icon name="box" size={23} />}</div>
      <div className="br-record-text"><strong>{title}</strong><span>{getRowCaption ? getRowCaption(record) : item.rowId}</span><span className={`br-kind br-kind-${item.kind}`}><Icon name={item.kind === 'insert' ? 'plus' : item.kind === 'delete' ? 'minus' : 'edit'} size={11} />{labels[item.kind]}</span></div>
    </div>
    <div className="br-diff">
      {visibleChanges.map(change => {
        const column = columns.find(column => column.key === change.key)!;
        return <div className="br-field" key={change.key}>
          <span className="br-field-label">{change.label}</span>
          <div className="br-field-values">
            <span className={`br-value br-value-before ${item.kind === 'insert' ? 'br-value-empty' : ''}`}><span className="br-sr-only">{labels.before}: </span>{displayValue(column, change.before, item.before)}</span>
            <Icon name="arrow" size={14} />
            <span className={`br-value br-value-after ${item.kind === 'delete' ? 'br-value-empty' : ''}`}><span className="br-sr-only">{labels.after}: </span>{displayValue(column, change.after, item.after)}</span>
          </div>
        </div>;
      })}
      {item.kind === 'delete' && <span className="br-delete-note">{labels.deleteDescription}</span>}
      {item.warnings.map(warning => <span className="br-warning" key={warning.id}><Icon name="warning" size={13} /><span><b>{warning.label}</b> · {warning.detail}</span></span>)}
    </div>
    <div className="br-decision">
      {decision !== 'pending' && <span className={`br-decision-label br-decision-${decision}`}><Icon name={decision === 'accepted' ? 'check' : 'x'} size={13} />{labels[decision]}</span>}
      <div className="br-decision-buttons">
        <button type="button" className={`br-icon-button br-reject ${decision === 'rejected' ? 'is-selected' : ''}`} aria-pressed={decision === 'rejected'} aria-label={`${labels.reject} ${title}`} title={labels.reject} onClick={() => controller.decide([item.id], decision === 'rejected' ? 'pending' : 'rejected')}><Icon name="x" size={16} /></button>
        <button type="button" className={`br-icon-button br-accept ${decision === 'accepted' ? 'is-selected' : ''}`} aria-pressed={decision === 'accepted'} aria-label={`${labels.accept} ${title}`} title={labels.accept} onClick={() => controller.decide([item.id], decision === 'accepted' ? 'pending' : 'accepted')}><Icon name="check" size={16} /></button>
      </div>
    </div>
  </article>;
}

function downloadResult<T extends Identified>(result: ReviewResult<T>) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `batch-review-${result.generatedAt.slice(0, 10)}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ExportDialog<T extends Identified>({ controller, labels, onExport, onClose, onSuccess }: { controller: BatchReviewController<T>; labels: ReviewLabels; onExport?: BatchReviewViewProps<T>['onExport']; onClose: () => void; onSuccess: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [result] = useState(controller.exportResult);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { dialog.current?.showModal(); }, []);
  const submit = async () => {
    setBusy(true); setError('');
    try {
      if (onExport) await onExport(result); else downloadResult(result);
      onSuccess();
    } catch { setError(labels.exportError); }
    finally { setBusy(false); }
  };
  return <dialog ref={dialog} className="br-dialog" aria-labelledby={titleId} onCancel={event => { if (busy) event.preventDefault(); }} onClose={onClose}>
    <div className="br-dialog-head"><span className="br-dialog-icon"><Icon name="download" size={22} /></span><button type="button" className="br-icon-button" aria-label={labels.close} disabled={busy} onClick={() => dialog.current?.close()}><Icon name="x" /></button></div>
    <h2 id={titleId}>{labels.preview}</h2><p>{labels.exportSummary(result.acceptedOperations.length)}</p>
    <div className="br-export-list">{result.acceptedOperations.map(op => <div key={op.operationId}><span className={`br-kind br-kind-${op.kind}`}>{labels[op.kind]}</span><code>{op.rowId}</code><Icon name="check" size={15} /></div>)}</div>
    <details className="br-json-details"><summary>{labels.more}</summary><pre>{JSON.stringify(result, null, 2)}</pre></details>
    {error && <p role="alert" className="br-error-message">{error}</p>}
    <div className="br-dialog-actions"><button type="button" className="br-button" disabled={busy} onClick={() => dialog.current?.close()}>{labels.close}</button><button type="button" className="br-button br-button-primary" disabled={busy} onClick={submit}><Icon name="download" size={16} />{busy ? '…' : labels.download}</button></div>
  </dialog>;
}

export function BatchReviewView<T extends Identified>(props: BatchReviewViewProps<T>) {
  const { controller, className = '' } = props;
  const labels = { ...defaults, ...props.labels };
  const [exportOpen, setExportOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const priorFingerprint = useRef(controller.fingerprint);
  useEffect(() => {
    if (priorFingerprint.current !== controller.fingerprint) { setExportOpen(false); setAnnouncement(''); }
    priorFingerprint.current = controller.fingerprint;
  }, [controller.fingerprint]);
  const counts = controller.counts;
  const statuses: ReviewStatus[] = ['all', 'pending', 'accepted', 'rejected', 'warning'];
  const decideVisible = (decision: Decision) => controller.decideVisible(decision);
  if (controller.error) return <section className={`br-root ${className}`}><div role="alert" className="br-invalid"><Icon name="warning" size={28} /><h3>{labels.invalid}</h3><pre>{controller.error.message}</pre></div></section>;
  return <section className={`br-root ${className}`} aria-label="Batch review">
    <div className="br-panel">
      <div className="br-panel-tabs" role="group" aria-label={labels.decision}>{statuses.map(status => <button type="button" key={status} className={`br-tab ${controller.status === status ? 'is-active' : ''} ${status === 'warning' ? 'br-tab-warning' : ''}`} aria-pressed={controller.status === status} onClick={() => controller.setStatus(status)}>{status === 'warning' && <Icon name="warning" size={14} />}{labels[status]}<span>{status === 'all' ? counts.total : counts[status]}</span></button>)}</div>
      <div className="br-toolbar">
        <label className="br-search"><Icon name="search" size={16} /><input value={controller.query} onChange={event => controller.setQuery(event.target.value)} placeholder={labels.search} aria-label={labels.searchLabel} />{controller.query && <button type="button" className="br-search-clear" aria-label={labels.clearSearch} onClick={() => controller.setQuery('')}><Icon name="x" size={13} /></button>}</label>
        <select aria-label={labels.kindLabel} value={controller.kind} onChange={event => controller.setKind(event.target.value as typeof controller.kind)}><option value="all">{labels.allKinds}</option><option value="insert">{labels.insert}</option><option value="update">{labels.update}</option><option value="delete">{labels.delete}</option></select>
        <div className="br-toolbar-spacer" />
        <button type="button" className="br-icon-button" aria-label={labels.undo} title={labels.undo} onClick={controller.undo} disabled={!controller.canUndo}><Icon name="undo" size={16} /></button>
        <button type="button" className="br-icon-button" aria-label={labels.reset} title={labels.reset} onClick={controller.reset} disabled={!controller.canReset}><Icon name="reset" size={16} /></button>
      </div>
      <div className="br-bulk-toolbar"><span>{labels.filtered(controller.visibleItems.length, counts.total)}</span><div><button type="button" className="br-button br-button-small" disabled={!controller.visibleItems.length} onClick={() => decideVisible('rejected')}><Icon name="x" size={13} />{labels.bulkLabel(labels.rejectVisible, controller.visibleItems.length)}</button><button type="button" className="br-button br-button-small br-button-subtle" disabled={!controller.visibleItems.length} onClick={() => decideVisible('accepted')}><Icon name="check" size={13} />{labels.bulkLabel(labels.acceptVisible, controller.visibleItems.length)}</button></div></div>
      <div className="br-table-head"><span>{labels.record}</span><span>{labels.change}</span><span>{labels.decision}</span></div>
      <div className="br-rows">{controller.visibleItems.map(item => <ReviewRow {...props} labels={labels} key={item.id} item={item} />)}
        {!controller.visibleItems.length && <div className="br-empty"><Icon name={counts.total ? 'search' : 'check'} size={30} /><h3>{counts.total ? labels.noMatches : labels.empty}</h3>{counts.total > 0 && <button type="button" className="br-button" onClick={() => { controller.setQuery(''); controller.setKind('all'); controller.setStatus('all'); }}>{labels.clearFilters}</button>}</div>}
      </div>
    </div>
    <div className="br-footer"><div className="br-footer-icon"><Icon name="shield" size={21} /></div><div className="br-footer-summary"><strong aria-live="polite">{labels.approvalSummary(counts.accepted, counts.pending)}</strong><div className="br-progress" aria-hidden="true"><i style={{ width: `${counts.total ? (counts.accepted / counts.total) * 100 : 0}%` }} /><i style={{ width: `${counts.total ? (counts.rejected / counts.total) * 100 : 0}%` }} /></div></div><button type="button" className="br-button br-button-primary" disabled={!counts.accepted} onClick={() => { setAnnouncement(''); setExportOpen(true); }}>{labels.export} <span>{counts.accepted}</span><Icon name="arrow" size={16} /></button></div>
    <span className="br-sr-only" role="status">{announcement}</span>
    {exportOpen && <ExportDialog key={controller.fingerprint} controller={controller} labels={labels} onExport={props.onExport} onClose={() => setExportOpen(false)} onSuccess={() => { setExportOpen(false); setAnnouncement(labels.downloadDone); }} />}
  </section>;
}

export function BatchReview<T extends Identified>(props: BatchReviewProps<T>) {
  const controller = useBatchReview(props);
  return <BatchReviewView {...props} controller={controller} />;
}
