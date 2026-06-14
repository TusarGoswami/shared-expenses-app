import { useState } from 'react';
import { Check, X, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

const ISSUE_COLORS = {
  DUPLICATE_ROW: 'badge-amber',
  NEGATIVE_AMOUNT: 'badge-rose',
  SETTLEMENT_AS_EXPENSE: 'badge-indigo',
  CURRENCY_MISMATCH: 'badge-amber',
  DOLLAR_AS_RUPEE: 'badge-rose',
  MEMBER_NOT_IN_GROUP: 'badge-rose',
  EXPENSE_AFTER_LEAVE: 'badge-amber',
  EXPENSE_BEFORE_JOIN: 'badge-amber',
  MISSING_FIELDS: 'badge-rose',
  INVALID_DATE: 'badge-rose',
  PERCENTAGE_NOT_100: 'badge-rose',
  EXACT_MISMATCH: 'badge-rose',
  ZERO_AMOUNT: 'badge-amber',
  NAME_VARIANT: 'badge-gray',
};

const ISSUE_LABELS = {
  DUPLICATE_ROW: 'Duplicate',
  NEGATIVE_AMOUNT: 'Negative',
  SETTLEMENT_AS_EXPENSE: 'Settlement',
  CURRENCY_MISMATCH: 'Currency',
  DOLLAR_AS_RUPEE: '$ as ₹',
  MEMBER_NOT_IN_GROUP: 'Unknown Member',
  EXPENSE_AFTER_LEAVE: 'After Leave',
  EXPENSE_BEFORE_JOIN: 'Before Join',
  MISSING_FIELDS: 'Missing Fields',
  INVALID_DATE: 'Bad Date',
  PERCENTAGE_NOT_100: 'Bad %',
  EXACT_MISMATCH: 'Split Mismatch',
  ZERO_AMOUNT: 'Zero',
  NAME_VARIANT: 'Name Variant',
};

export default function AnomalyReviewTable({ anomalies, decisions, onDecision, onConfirm, confirming }) {
  const [expandedRow, setExpandedRow] = useState(null);

  const allResolved = anomalies.length > 0 && anomalies.every(
    (a) => decisions[a._id] === 'approved' || decisions[a._id] === 'rejected'
  );

  const approvedCount = Object.values(decisions).filter((d) => d === 'approved').length;
  const rejectedCount = Object.values(decisions).filter((d) => d === 'rejected').length;
  const pendingCount = anomalies.length - approvedCount - rejectedCount;

  const handleApproveAll = () => {
    const updated = { ...decisions };
    anomalies.forEach((a) => { updated[a._id] = 'approved'; });
    // Call onDecision for each
    anomalies.forEach((a) => onDecision(a._id, 'approved'));
  };

  const handleRejectAll = () => {
    anomalies.forEach((a) => onDecision(a._id, 'rejected'));
  };

  if (anomalies.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center mb-4">
          <Check className="w-7 h-7 text-emerald-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">No Anomalies Found</h3>
        <p className="text-gray-500 mb-4">All rows passed validation checks.</p>
        <button onClick={onConfirm} disabled={confirming} className="btn-success">
          {confirming ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Check className="w-4 h-4" /> Confirm Import
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="glass-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-amber-400">
            <AlertTriangle className="w-4 h-4" />
            {anomalies.length} anomalies found
          </span>
          <span className="text-emerald-400">{approvedCount} approved</span>
          <span className="text-rose-400">{rejectedCount} rejected</span>
          {pendingCount > 0 && <span className="text-gray-400">{pendingCount} pending</span>}
        </div>
        <div className="flex gap-2">
          <button onClick={handleApproveAll} className="btn-success text-xs px-3 py-1.5">
            <Check className="w-3.5 h-3.5" /> Approve All
          </button>
          <button onClick={handleRejectAll} className="btn-danger text-xs px-3 py-1.5">
            <X className="w-3.5 h-3.5" /> Reject All
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800/50">
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Row</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Issue Type</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3 hidden lg:table-cell">Description</th>
                <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3 hidden md:table-cell">Suggested Fix</th>
                <th className="text-center text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 py-3">Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/30">
              {anomalies.map((a) => {
                const decision = decisions[a._id];
                const isExpanded = expandedRow === a._id;
                return (
                  <tr
                    key={a._id}
                    className={`transition-colors cursor-pointer
                      ${decision === 'approved' ? 'bg-emerald-500/5' : ''}
                      ${decision === 'rejected' ? 'bg-rose-500/5' : ''}
                      ${!decision ? 'hover:bg-gray-800/20' : ''}
                    `}
                    onClick={() => setExpandedRow(isExpanded ? null : a._id)}
                  >
                    <td className="px-4 py-3 text-sm text-gray-300 font-mono">#{a.rowIndex}</td>
                    <td className="px-4 py-3">
                      <span className={ISSUE_COLORS[a.issueType] || 'badge-gray'}>
                        {ISSUE_LABELS[a.issueType] || a.issueType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 max-w-xs truncate hidden lg:table-cell">
                      {a.description}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate hidden md:table-cell">
                      {a.suggestedAction}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onDecision(a._id, 'approved')}
                          className={`p-1.5 rounded-lg transition-all duration-200
                            ${
                              decision === 'approved'
                                ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40'
                                : 'text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10'
                            }`}
                          title="Approve"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDecision(a._id, 'rejected')}
                          className={`p-1.5 rounded-lg transition-all duration-200
                            ${
                              decision === 'rejected'
                                ? 'bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/40'
                                : 'text-gray-500 hover:text-rose-400 hover:bg-rose-500/10'
                            }`}
                          title="Reject"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirm button */}
      <div className="flex justify-end">
        <button
          onClick={onConfirm}
          disabled={!allResolved || confirming}
          className="btn-success"
        >
          {confirming ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Check className="w-4 h-4" />
              Confirm Import ({approvedCount} approved, {rejectedCount} rejected)
            </>
          )}
        </button>
      </div>
      {!allResolved && (
        <p className="text-xs text-amber-400 text-right flex items-center justify-end gap-1">
          <AlertTriangle className="w-3.5 h-3.5" />
          Resolve all {pendingCount} pending anomalies before confirming
        </p>
      )}
    </div>
  );
}
