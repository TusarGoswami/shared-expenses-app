import { useState } from 'react';
import { Check, X, AlertTriangle, CheckCircle } from 'lucide-react';

const ISSUE_COLORS = {
  DUPLICATE_ROW: 'bg-nebula-negative/15 text-nebula-negative border border-nebula-negative/30',
  NEGATIVE_AMOUNT: 'bg-nebula-negative/15 text-nebula-negative border border-nebula-negative/30',
  SETTLEMENT_AS_EXPENSE: 'bg-nebula-accent/15 text-nebula-accent border border-nebula-accent/30',
  CURRENCY_MISMATCH: 'bg-nebula-gold/15 text-nebula-gold border border-nebula-gold/30',
  DOLLAR_AS_RUPEE: 'bg-nebula-gold/15 text-nebula-gold border border-nebula-gold/30',
  MEMBER_NOT_IN_GROUP: 'bg-nebula-primary/15 text-nebula-primary border border-nebula-primary/30',
  EXPENSE_AFTER_LEAVE: 'bg-nebula-negative/15 text-nebula-negative border border-nebula-negative/30',
  EXPENSE_BEFORE_JOIN: 'bg-nebula-negative/15 text-nebula-negative border border-nebula-negative/30',
  MISSING_FIELDS: 'bg-nebula-negative/15 text-nebula-negative border border-nebula-negative/30',
  INVALID_DATE: 'bg-nebula-negative/15 text-nebula-negative border border-nebula-negative/30',
  PERCENTAGE_NOT_100: 'bg-nebula-negative/15 text-nebula-negative border border-nebula-negative/30',
  EXACT_MISMATCH: 'bg-nebula-negative/15 text-nebula-negative border border-nebula-negative/30',
  ZERO_AMOUNT: 'bg-nebula-border/15 text-nebula-muted border border-nebula-border/30',
  NAME_VARIANT: 'bg-nebula-primary/15 text-nebula-primary border border-nebula-primary/30',
};

const ISSUE_LABELS = {
  DUPLICATE_ROW: 'Duplicate Row',
  NEGATIVE_AMOUNT: 'Negative Amount',
  SETTLEMENT_AS_EXPENSE: 'Settlement as Expense',
  CURRENCY_MISMATCH: 'Currency Mismatch',
  DOLLAR_AS_RUPEE: 'Dollar as Rupee',
  MEMBER_NOT_IN_GROUP: 'Member Not in Group',
  EXPENSE_AFTER_LEAVE: 'Expense After Leave',
  EXPENSE_BEFORE_JOIN: 'Expense Before Join',
  MISSING_FIELDS: 'Missing Fields',
  INVALID_DATE: 'Invalid Date',
  PERCENTAGE_NOT_100: 'Percentages Sum Error',
  EXACT_MISMATCH: 'Splits Mismatch',
  ZERO_AMOUNT: 'Zero Amount',
  NAME_VARIANT: 'Name Variant Spelling',
};

export default function AnomalyReviewTable({ anomalies, decisions, onDecision, onConfirm, confirming }) {
  const [expandedRow, setExpandedRow] = useState(null);

  const totalCount = anomalies.length;
  const approvedCount = Object.values(decisions).filter((d) => d === 'approved').length;
  const rejectedCount = Object.values(decisions).filter((d) => d === 'rejected').length;
  const resolvedCount = approvedCount + rejectedCount;
  const pendingCount = totalCount - resolvedCount;
  const allResolved = totalCount > 0 && resolvedCount === totalCount;
  const resolutionPercentage = totalCount > 0 ? (resolvedCount / totalCount) * 100 : 100;

  const handleApproveAll = () => {
    anomalies.forEach((a) => onDecision(a._id, 'approved'));
  };

  const handleRejectAll = () => {
    anomalies.forEach((a) => onDecision(a._id, 'rejected'));
  };

  return (
    <div className="space-y-6">
      {/* Progress & Quick Stats Card */}
      <div className="nebula-card p-6 border-t border-t-nebula-primary/15">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-nebula-gold" />
              Resolve CSV Anomalies
            </h3>
            <p className="text-nebula-muted text-xs mt-1">
              Select an action for each flagged transaction to clean your ledger
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold text-nebula-muted">
            <span className="text-nebula-positive bg-nebula-positive/10 px-2.5 py-1 rounded-full border border-nebula-positive/20">
              {approvedCount} Approved
            </span>
            <span className="text-nebula-negative bg-nebula-negative/10 px-2.5 py-1 rounded-full border border-nebula-negative/20">
              {rejectedCount} Rejected
            </span>
            {pendingCount > 0 && (
              <span className="text-nebula-primary bg-nebula-primary/10 px-2.5 py-1 rounded-full border border-nebula-primary/20">
                {pendingCount} Pending
              </span>
            )}
          </div>
        </div>

        {/* Nebula Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-semibold text-nebula-muted">
            <span>Anomalies resolved</span>
            <span className="text-nebula-primary font-bold">{resolvedCount} / {totalCount} ({Math.round(resolutionPercentage)}%)</span>
          </div>
          <div className="w-full bg-nebula-bg rounded-full h-2.5 overflow-hidden border border-nebula-border">
            <div
              className="bg-nebula-primary h-2.5 rounded-full transition-all duration-500 shadow-nebula-sm"
              style={{ width: `${resolutionPercentage}%` }}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-5 pt-4 border-t border-nebula-border justify-end">
          <button onClick={handleApproveAll} className="nebula-button-ghost text-xs px-3.5 py-2 flex items-center gap-1">
            <Check className="w-3.5 h-3.5 text-nebula-positive" /> Approve All
          </button>
          <button onClick={handleRejectAll} className="nebula-button-ghost text-xs px-3.5 py-2 flex items-center gap-1">
            <X className="w-3.5 h-3.5 text-nebula-negative" /> Reject All
          </button>
        </div>
      </div>

      {/* Anomalies List */}
      <div className="space-y-3">
        {anomalies.map((a) => {
          const decision = decisions[a._id];
          const isExpanded = expandedRow === a._id;
          const badgeStyle = ISSUE_COLORS[a.issueType] || 'nebula-badge bg-nebula-border border border-nebula-border text-nebula-muted';
          const badgeLabel = ISSUE_LABELS[a.issueType] || a.issueType;

          return (
            <div
              key={a._id}
              onClick={() => setExpandedRow(isExpanded ? null : a._id)}
              className={`nebula-card p-4 transition-all duration-300 cursor-pointer overflow-hidden border-t-2
                ${decision === 'approved' ? 'border-t-nebula-positive/60 shadow-[inset_0_0_10px_rgba(52,211,153,0.05)] bg-nebula-card/95' : ''}
                ${decision === 'rejected' ? 'border-t-nebula-negative/60 shadow-[inset_0_0_10px_rgba(251,113,133,0.05)] bg-nebula-card/95' : ''}
                ${!decision ? 'border-t-transparent hover:shadow-nebula-sm' : ''}
              `}
            >
              {/* Row Header Row */}
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold font-mono text-nebula-subtle bg-nebula-bg px-2 py-1 rounded">
                    Row #{a.rowIndex}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${badgeStyle}`}>
                    {badgeLabel}
                  </span>
                  <span className="text-sm font-semibold text-white truncate max-w-xs sm:max-w-md">
                    {a.rawRow.Description || '—'}
                  </span>
                </div>

                <div className="flex items-center gap-3 justify-between sm:justify-end">
                  <span className="text-xs font-bold font-mono text-nebula-primary bg-nebula-bg px-2.5 py-1 rounded border border-nebula-border">
                    {a.rawRow.Amount || '—'} {a.rawRow.Currency || ''}
                  </span>

                  {/* Approve/Reject Buttons */}
                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {/* Approve Button */}
                    <button
                      onClick={() => onDecision(a._id, 'approved')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all duration-200 border
                        ${
                          decision === 'approved'
                            ? 'bg-nebula-positive border-nebula-positive text-nebula-bg shadow-nebula-sm'
                            : 'border-nebula-positive/40 text-nebula-positive hover:bg-nebula-positive hover:text-nebula-bg'
                        }`}
                      title="Approve"
                    >
                      <Check className="w-3.5 h-3.5" /> Approve
                    </button>

                    {/* Reject Button */}
                    <button
                      onClick={() => onDecision(a._id, 'rejected')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all duration-200 border
                        ${
                          decision === 'rejected'
                            ? 'bg-nebula-negative border-nebula-negative text-white shadow-accent-sm'
                            : 'border-nebula-negative/40 text-nebula-negative hover:bg-nebula-negative hover:text-white'
                        }`}
                      title="Reject"
                    >
                      <X className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded details block */}
              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-nebula-border grid gap-4 sm:grid-cols-2 text-xs animate-fade-in-up">
                  <div className="space-y-2">
                    <p className="text-nebula-muted leading-relaxed">
                      <strong className="text-white font-semibold">Issue Description:</strong><br />
                      {a.description}
                    </p>
                    <p className="text-nebula-muted leading-relaxed">
                      <strong className="text-white font-semibold">Suggested Fix:</strong><br />
                      {a.suggestedAction}
                    </p>
                  </div>

                  <div className="bg-nebula-bg p-3.5 rounded-xl border border-nebula-border">
                    <h5 className="font-bold mb-2 tracking-wide uppercase text-[10px] text-nebula-primary">Raw Row Values</h5>
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-nebula-muted">
                      <div>Date: <span className="text-white">{a.rawRow.Date || '—'}</span></div>
                      <div>Payer: <span className="text-white">{a.rawRow.PaidBy || '—'}</span></div>
                      <div>Split: <span className="text-white">{a.rawRow.SplitType || '—'}</span></div>
                      <div>Details: <span className="text-white">{a.rawRow.SplitDetails || '—'}</span></div>
                      <div className="col-span-2">Notes: <span className="text-white">{a.rawRow.Notes || '—'}</span></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirm Import Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-nebula-border pt-6">
        <div>
          {!allResolved && (
            <p className="text-xs text-nebula-accent flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="w-4 h-4 animate-pulse" />
              Resolve all {pendingCount} pending anomalies before confirming
            </p>
          )}
        </div>

        <button
          onClick={onConfirm}
          disabled={!allResolved || confirming}
          className={`w-full sm:w-auto px-6 py-3 font-bold text-sm tracking-wide rounded-xl flex items-center justify-center gap-2 transition-all duration-300
            ${
              confirming
                ? 'bg-nebula-card text-nebula-subtle cursor-not-allowed border border-nebula-border'
                : allResolved
                ? 'nebula-button-gradient hover:brightness-110'
                : 'bg-nebula-card text-nebula-subtle border border-nebula-border cursor-not-allowed'
            }`}
        >
          {confirming ? (
            <div className="w-5 h-5 border-2 border-nebula-subtle border-t-nebula-primary rounded-full animate-spin" />
          ) : (
            <>
              <CheckCircle className="w-4 h-4" />
              Confirm & Import ({approvedCount} approved)
            </>
          )}
        </button>
      </div>
    </div>
  );
}
