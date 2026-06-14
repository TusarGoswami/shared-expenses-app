import { useState } from 'react';
import { ArrowRight, Check, Handshake, Loader2 } from 'lucide-react';
import { createExpense } from '../../api/expenses';
import toast from 'react-hot-toast';

export default function SettlementSuggestions({ settlements, groupId, onSettled }) {
  const [settling, setSettling] = useState(null);

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

  const getAvatarColor = (name) => {
    const colors = [
      'bg-nebula-primary/20 text-nebula-primary border-nebula-primary/30',
      'bg-nebula-accent/20 text-nebula-accent border-nebula-accent/30',
      'bg-nebula-gold/20 text-nebula-gold border-nebula-gold/30',
      'bg-nebula-positive/20 text-nebula-positive border-nebula-positive/30',
      'bg-purple-500/20 text-purple-300 border-purple-500/30',
      'bg-pink-500/20 text-pink-300 border-pink-500/30',
      'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30',
      'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      'bg-violet-500/20 text-violet-300 border-violet-500/30'
    ];
    if (!name) return colors[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  if (settlements.length === 0) {
    return (
      <div className="nebula-card p-10 text-center border border-nebula-positive/15">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-nebula-positive/10 border border-nebula-positive/20 flex items-center justify-center mb-4 shadow-inner">
          <Check className="w-7 h-7 text-nebula-positive" />
        </div>
        <h3 className="text-xl font-bold text-white mb-1 tracking-wide">All Settled!</h3>
        <p className="text-nebula-muted text-sm leading-relaxed">No outstanding debts remaining in this group</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Handshake className="w-5 h-5 text-nebula-primary" />
        <h3 className="text-base font-bold text-white tracking-wide">
          Suggested Settlements ({settlements.length} transactions)
        </h3>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {settlements.map((s, idx) => {
          const isSettling =
            settling &&
            settling.from.userId === s.from.userId &&
            settling.to.userId === s.to.userId;

          const fromAvatarColor = getAvatarColor(s.from.name);
          const toAvatarColor = getAvatarColor(s.to.name);

          return (
            <div
              key={idx}
              className="nebula-card p-5 flex flex-col justify-between gap-4 hover:-translate-y-1 hover:shadow-nebula-sm transition-all duration-300 border-t-2 border-t-nebula-primary/45"
            >
              <div className="flex items-center justify-between gap-2">
                {/* Debtor */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm border flex-shrink-0 ${fromAvatarColor}`}>
                    {s.from.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-white truncate block">
                      {s.from.name}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-nebula-negative tracking-wider">Owes</span>
                  </div>
                </div>

                <div className="flex flex-col items-center flex-shrink-0">
                  <ArrowRight className="w-4 h-4 text-nebula-subtle animate-pulse" />
                </div>

                {/* Creditor */}
                <div className="flex items-center gap-2.5 min-w-0 text-right">
                  <div className="min-w-0">
                    <span className="text-sm font-bold text-white truncate block">
                      {s.to.name}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-nebula-positive tracking-wider">Receives</span>
                  </div>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm border flex-shrink-0 ${toAvatarColor}`}>
                    {s.to.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                </div>
              </div>

              {/* Transaction Amount and Mark Settled Action */}
              <div className="flex items-center justify-between border-t border-nebula-border/60 pt-4 mt-2">
                <div>
                  <span className="text-nebula-primary font-bold text-base mr-1 font-mono">₹</span>
                  <span className="text-xl font-extrabold text-white amount-mono">
                    {s.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <button
                  onClick={() => handleMarkSettled(s)}
                  disabled={!!settling}
                  className="nebula-button-primary text-xs px-4 py-2 flex items-center gap-1.5"
                >
                  {isSettling ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" /> Mark Settled
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
