import { useState } from 'react';
import { ArrowRight, Check, Handshake, Loader2 } from 'lucide-react';
import { createExpense } from '../../api/expenses';
import toast from 'react-hot-toast';

export default function SettlementSuggestions({ settlements, groupId, onSettled }) {
  const [settling, setSettling] = useState(null); // Track which settlement is being processed

  const handleMarkSettled = async (settlement) => {
    setSettling(settlement);
    try {
      await createExpense(groupId, {
        description: `Settlement: ${settlement.from.name} → ${settlement.to.name}`,
        amount: settlement.amount,
        currency: 'INR',
        date: new Date().toISOString().split('T')[0],
        paidBy: settlement.from.userId,
        splitType: 'EXACT',
        splitDetails: [
          { userId: settlement.to.userId, amount: settlement.amount },
        ],
        isSettlement: true,
        notes: 'Auto-generated settlement from suggestion',
      });
      toast.success(
        `Settlement recorded: ${settlement.from.name} → ${settlement.to.name}`
      );
      onSettled?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record settlement');
    } finally {
      setSettling(null);
    }
  };

  if (settlements.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center mb-4">
          <Check className="w-7 h-7 text-emerald-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-1">All Settled!</h3>
        <p className="text-sm text-gray-500">No outstanding debts in this group</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Handshake className="w-5 h-5 text-violet-400" />
        <h3 className="text-sm font-semibold text-gray-300">
          Suggested Settlements ({settlements.length} transactions)
        </h3>
      </div>

      <div className="space-y-2">
        {settlements.map((s, idx) => {
          const isSettling =
            settling &&
            settling.from.userId === s.from.userId &&
            settling.to.userId === s.to.userId;

          return (
            <div
              key={idx}
              className="glass-card p-4 flex items-center gap-4 hover:border-violet-500/20 transition-all"
            >
              {/* From */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-full bg-rose-500/15 border border-rose-500/20 flex items-center justify-center text-sm font-bold text-rose-400 flex-shrink-0">
                  {s.from.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <span className="text-sm font-medium text-white truncate">
                  {s.from.name}
                </span>
              </div>

              {/* Arrow + amount */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <ArrowRight className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-bold text-brand-300 tabular-nums whitespace-nowrap">
                  ₹{s.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
                <ArrowRight className="w-4 h-4 text-gray-500" />
              </div>

              {/* To */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-9 h-9 rounded-full bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center text-sm font-bold text-emerald-400 flex-shrink-0">
                  {s.to.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <span className="text-sm font-medium text-white truncate">
                  {s.to.name}
                </span>
              </div>

              {/* Mark settled */}
              <button
                onClick={() => handleMarkSettled(s)}
                disabled={!!settling}
                className="btn-success text-xs px-3 py-1.5 flex-shrink-0"
              >
                {isSettling ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" /> Settle
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
