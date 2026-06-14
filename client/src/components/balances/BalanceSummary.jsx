import { TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react';

export default function BalanceSummary({ balances, onSelectMember, stats }) {
  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-card p-4">
          <p className="text-xs text-gray-500 mb-1">Total Expenses</p>
          <p className="text-2xl font-bold text-white">{stats.totalExpenses}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-gray-500 mb-1">Settlements Made</p>
          <p className="text-2xl font-bold text-violet-400">{stats.totalSettlements}</p>
        </div>
      </div>

      {/* Balance table */}
      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800/50">
          <h3 className="text-sm font-semibold text-gray-300">Net Balances</h3>
          <p className="text-xs text-gray-600 mt-0.5">Click a row to see expense breakdown</p>
        </div>
        <div className="divide-y divide-gray-800/30">
          {balances.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              No balance data available
            </div>
          ) : (
            balances.map((b) => {
              const isPositive = b.balance > 0.01;
              const isNegative = b.balance < -0.01;
              const isZero = !isPositive && !isNegative;
              return (
                <button
                  key={b.userId}
                  onClick={() => onSelectMember(b.userId)}
                  className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-800/30 transition-colors text-left group"
                >
                  {/* Avatar */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
                      ${isPositive ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : ''}
                      ${isNegative ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20' : ''}
                      ${isZero ? 'bg-gray-800 text-gray-400 border border-gray-700' : ''}
                    `}
                  >
                    {b.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>

                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{b.name}</p>
                    <p className="text-xs text-gray-500 truncate">{b.email}</p>
                  </div>

                  {/* Paid / Owed */}
                  <div className="hidden sm:block text-right">
                    <p className="text-xs text-gray-500">
                      Paid: ₹{b.totalPaid?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-500">
                      Owed: ₹{b.totalOwed?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  {/* Net balance */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isPositive && <TrendingUp className="w-4 h-4 text-emerald-400" />}
                    {isNegative && <TrendingDown className="w-4 h-4 text-rose-400" />}
                    {isZero && <Minus className="w-4 h-4 text-gray-500" />}
                    <span
                      className={`text-sm font-bold tabular-nums
                        ${isPositive ? 'text-emerald-400' : ''}
                        ${isNegative ? 'text-rose-400' : ''}
                        ${isZero ? 'text-gray-500' : ''}
                      `}
                    >
                      {isPositive ? '+' : ''}₹
                      {Math.abs(b.balance).toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>

                  <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-brand-400 transition-colors flex-shrink-0" />
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
