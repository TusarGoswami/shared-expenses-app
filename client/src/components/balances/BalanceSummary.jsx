import { useAuth } from '../../hooks/useAuth';
import { TrendingUp, TrendingDown, Minus, ChevronRight, Receipt, Wallet, Handshake } from 'lucide-react';

export default function BalanceSummary({ balances, onSelectMember, stats }) {
  const { user } = useAuth();

  // Color hash algorithm for avatars based on member name
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

  // Compute stats locally based on balances
  const totalGroupSpend = balances.reduce((sum, b) => sum + (b.totalPaid || 0), 0);
  const myBalanceEntry = balances.find(
    (b) => String(b.userId) === String(user?._id || user?.id)
  );
  const myBalanceVal = myBalanceEntry ? myBalanceEntry.balance : 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-6 sm:grid-cols-3">
        {/* Total Spend Card */}
        <div className="nebula-card p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-nebula-primary to-nebula-accent" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-nebula-muted">Total Spent</span>
            <Receipt className="w-4 h-4 text-nebula-primary opacity-80" />
          </div>
          <h3 className="text-2xl font-bold text-white">
            <span className="text-nebula-primary font-mono mr-1">₹</span>
            <span className="amount-mono">
              {totalGroupSpend.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </h3>
        </div>

        {/* Your Balance Card */}
        <div className="nebula-card p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-nebula-primary to-nebula-accent" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-nebula-muted">Your Balance</span>
            <Wallet className={`w-4 h-4 opacity-80 ${myBalanceVal >= 0 ? 'text-nebula-positive' : 'text-nebula-negative'}`} />
          </div>
          <h3 className={`text-2xl font-bold ${myBalanceVal >= 0 ? 'text-nebula-positive' : 'text-nebula-negative'}`}>
            <span className="font-mono mr-1">{myBalanceVal >= 0 ? '+' : '-'}₹</span>
            <span className="amount-mono">
              {Math.abs(myBalanceVal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </h3>
        </div>

        {/* Settlements Needed Card */}
        <div className="nebula-card p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-nebula-primary to-nebula-accent" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-nebula-muted">Settlements</span>
            <Handshake className="w-4 h-4 text-nebula-accent opacity-80" />
          </div>
          <h3 className="text-2xl font-bold text-white">
            <span className="amount-mono text-nebula-accent">
              {stats.totalSettlements || 0}
            </span> Suggestions
          </h3>
        </div>
      </div>

      {/* Net Balances List */}
      <div className="nebula-card overflow-hidden border border-nebula-border">
        <div className="px-6 py-5 border-b border-nebula-border bg-nebula-card/50 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white tracking-wide">Net Balances</h3>
            <p className="text-xs text-nebula-muted mt-1">Click a member to inspect their expense breakdown</p>
          </div>
        </div>

        <div className="divide-y divide-nebula-border/60">
          {balances.length === 0 ? (
            <div className="p-12 text-center text-nebula-subtle text-sm">
              No balance data available
            </div>
          ) : (
            balances.map((b) => {
              const isPositive = b.balance > 0.01;
              const isNegative = b.balance < -0.01;
              const isZero = !isPositive && !isNegative;
              const avatarColor = getAvatarColor(b.name);

              return (
                <button
                  key={b.userId}
                  onClick={() => onSelectMember(b.userId)}
                  className="w-full flex items-center gap-4 px-6 py-4.5 hover:bg-nebula-primary/5 transition-all duration-200 text-left group border-l-4 border-l-transparent hover:border-l-nebula-primary"
                >
                  {/* Avatar circle */}
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-base border flex-shrink-0 ${avatarColor}`}>
                    {b.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>

                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white group-hover:text-nebula-primary transition-colors">
                      {b.name}
                    </p>
                    <p className="text-xs text-nebula-muted truncate mt-0.5">{b.email}</p>
                  </div>

                  {/* Paid / Owed Breakdown */}
                  <div className="hidden sm:block text-right mr-6">
                    <p className="text-xs text-nebula-muted leading-normal">
                      Paid: <span className="text-nebula-text font-medium font-mono">₹{b.totalPaid?.toFixed(2)}</span>
                    </p>
                    <p className="text-xs text-nebula-muted leading-normal">
                      Share: <span className="text-nebula-text font-medium font-mono">₹{b.totalOwed?.toFixed(2)}</span>
                    </p>
                  </div>

                  {/* Net balance */}
                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    {isPositive && <TrendingUp className="w-4 h-4 text-nebula-positive" />}
                    {isNegative && <TrendingDown className="w-4 h-4 text-nebula-negative" />}
                    {isZero && <Minus className="w-4 h-4 text-nebula-subtle" />}
                    <span
                      className={`text-base font-extrabold amount-mono
                        ${isPositive ? 'text-nebula-positive' : ''}
                        ${isNegative ? 'text-nebula-negative' : ''}
                        ${isZero ? 'text-nebula-subtle' : ''}
                      `}
                    >
                      {isPositive ? '+' : ''}₹
                      {Math.abs(b.balance).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>

                  <ChevronRight className="w-5 h-5 text-nebula-subtle group-hover:text-nebula-primary transition-colors flex-shrink-0 ml-2" />
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
