import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getGroup, addMember, updateMember } from '../api/groups';
import { getExpenses, deleteExpense } from '../api/expenses';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  Users, Receipt, BarChart3, Upload, Plus, Trash2, X,
  ArrowRight, Calendar, UserPlus, UserMinus, IndianRupee,
  DollarSign, Filter, ChevronDown,
} from 'lucide-react';
import ExpenseForm from '../components/expenses/ExpenseForm';

const TABS = [
  { id: 'members', label: 'Members', icon: Users },
  { id: 'expenses', label: 'Expenses', icon: Receipt },
  { id: 'balances', label: 'Balances', icon: BarChart3 },
  { id: 'import', label: 'Import', icon: Upload },
];

export default function GroupPage() {
  const { groupId } = useParams();
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [activeTab, setActiveTab] = useState('members');
  const [loading, setLoading] = useState(true);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(null);
  const [memberForm, setMemberForm] = useState({ name: '', email: '', joinDate: '' });
  const [leaveDate, setLeaveDate] = useState('');
  const [filters, setFilters] = useState({ paidBy: '', splitType: '', startDate: '', endDate: '' });
  const [showFilters, setShowFilters] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [groupRes, expRes] = await Promise.all([
        getGroup(groupId),
        getExpenses(groupId),
      ]);
      setGroup(groupRes.data.group);
      setMembers(groupRes.data.members || []);
      setExpenses(expRes.data.expenses || []);
    } catch {
      toast.error('Failed to load group data');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddMember = async (e) => {
    e.preventDefault();
    try {
      await addMember(groupId, {
        name: memberForm.name,
        email: memberForm.email,
        joinDate: memberForm.joinDate || new Date().toISOString(),
      });
      toast.success('Member added!');
      setShowAddMember(false);
      setMemberForm({ name: '', email: '', joinDate: '' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add member');
    }
  };

  const handleSetLeaveDate = async () => {
    if (!showLeaveModal || !leaveDate) return;
    try {
      await updateMember(groupId, showLeaveModal.userId._id || showLeaveModal.userId, {
        leaveDate,
      });
      toast.success('Leave date updated');
      setShowLeaveModal(null);
      setLeaveDate('');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
    }
  };

  const handleDeleteExpense = async (expId) => {
    if (!confirm('Delete this expense? It can be recovered later.')) return;
    try {
      await deleteExpense(groupId, expId);
      toast.success('Expense deleted');
      fetchData();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const filteredExpenses = expenses.filter((exp) => {
    if (filters.paidBy && String(exp.paidBy._id || exp.paidBy) !== filters.paidBy) return false;
    if (filters.splitType && exp.splitType !== filters.splitType) return false;
    if (filters.startDate && new Date(exp.date) < new Date(filters.startDate)) return false;
    if (filters.endDate && new Date(exp.date) > new Date(filters.endDate)) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!group) {
    return <div className="text-center py-20 text-gray-500">Group not found</div>;
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">{group.name}</h1>
          {group.description && (
            <p className="text-gray-500 mt-1">{group.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Link to={`/groups/${groupId}/balances`} className="btn-secondary text-sm">
            <BarChart3 className="w-4 h-4" /> Balances
          </Link>
          <Link to={`/groups/${groupId}/import`} className="btn-secondary text-sm">
            <Upload className="w-4 h-4" /> Import CSV
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-900/60 rounded-xl border border-gray-800/50 mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap
              ${
                activeTab === tab.id
                  ? 'bg-brand-500/15 text-brand-300 border border-brand-500/20'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
              }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* --- MEMBERS TAB --- */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-200">
              Members ({members.length})
            </h2>
            <button onClick={() => setShowAddMember(true)} className="btn-primary text-sm">
              <UserPlus className="w-4 h-4" /> Add Member
            </button>
          </div>

          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-800/50">
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-3">Name</th>
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-3">Email</th>
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-3">Joined</th>
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-3">Left</th>
                    <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-3">Status</th>
                    <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/30">
                  {members.map((m) => {
                    const isActive = !m.leaveDate || new Date(m.leaveDate) >= new Date();
                    return (
                      <tr key={m._id} className="hover:bg-gray-800/20 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-white">
                          {m.userId?.name || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-400">
                          {m.userId?.email || '—'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-400">
                          {m.joinDate ? format(new Date(m.joinDate), 'MMM d, yyyy') : '—'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-400">
                          {m.leaveDate ? format(new Date(m.leaveDate), 'MMM d, yyyy') : '—'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={isActive ? 'badge-emerald' : 'badge-gray'}>
                            {isActive ? 'Active' : 'Left'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {isActive && (
                            <button
                              onClick={() => { setShowLeaveModal(m); setLeaveDate(''); }}
                              className="text-xs text-gray-400 hover:text-rose-400 flex items-center gap-1 ml-auto transition-colors"
                            >
                              <UserMinus className="w-3.5 h-3.5" /> Set leave date
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add Member Modal */}
          {showAddMember && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowAddMember(false)} />
              <div className="relative glass-card p-6 w-full max-w-md animate-scale-in">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-white">Add Member</h2>
                  <button onClick={() => setShowAddMember(false)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleAddMember} className="space-y-4">
                  <div>
                    <label className="label-text">Name</label>
                    <input type="text" value={memberForm.name} onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })} placeholder="Member name" required className="input-field" />
                  </div>
                  <div>
                    <label className="label-text">Email</label>
                    <input type="email" value={memberForm.email} onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })} placeholder="member@example.com" required className="input-field" />
                  </div>
                  <div>
                    <label className="label-text">Join Date</label>
                    <input type="date" value={memberForm.joinDate} onChange={(e) => setMemberForm({ ...memberForm, joinDate: e.target.value })} className="input-field" />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setShowAddMember(false)} className="btn-secondary flex-1">Cancel</button>
                    <button type="submit" className="btn-primary flex-1"><UserPlus className="w-4 h-4" /> Add</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Leave Date Modal */}
          {showLeaveModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowLeaveModal(null)} />
              <div className="relative glass-card p-6 w-full max-w-sm animate-scale-in">
                <h2 className="text-lg font-bold text-white mb-4">
                  Set Leave Date for {showLeaveModal.userId?.name}
                </h2>
                <input type="date" value={leaveDate} onChange={(e) => setLeaveDate(e.target.value)} className="input-field mb-4" />
                <div className="flex gap-3">
                  <button onClick={() => setShowLeaveModal(null)} className="btn-secondary flex-1">Cancel</button>
                  <button onClick={handleSetLeaveDate} disabled={!leaveDate} className="btn-danger flex-1">
                    <UserMinus className="w-4 h-4" /> Confirm
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- EXPENSES TAB --- */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-200">
              Expenses ({filteredExpenses.length})
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`btn-secondary text-sm ${showFilters ? 'border-brand-500/40 text-brand-300' : ''}`}
              >
                <Filter className="w-4 h-4" /> Filters
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </button>
              <button onClick={() => setShowExpenseForm(true)} className="btn-primary text-sm">
                <Plus className="w-4 h-4" /> Add Expense
              </button>
            </div>
          </div>

          {/* Filters panel */}
          {showFilters && (
            <div className="glass-card p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 animate-slide-down">
              <div>
                <label className="label-text text-xs">Paid By</label>
                <select value={filters.paidBy} onChange={(e) => setFilters({ ...filters, paidBy: e.target.value })} className="input-field text-sm">
                  <option value="">All</option>
                  {members.map((m) => (
                    <option key={m.userId._id || m.userId} value={m.userId._id || m.userId}>
                      {m.userId.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-text text-xs">Split Type</label>
                <select value={filters.splitType} onChange={(e) => setFilters({ ...filters, splitType: e.target.value })} className="input-field text-sm">
                  <option value="">All</option>
                  <option value="EQUAL">Equal</option>
                  <option value="EXACT">Exact</option>
                  <option value="PERCENTAGE">Percentage</option>
                  <option value="SHARES">Shares</option>
                </select>
              </div>
              <div>
                <label className="label-text text-xs">From</label>
                <input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="input-field text-sm" />
              </div>
              <div>
                <label className="label-text text-xs">To</label>
                <input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="input-field text-sm" />
              </div>
            </div>
          )}

          {/* Expenses list */}
          <div className="space-y-2">
            {filteredExpenses.length === 0 ? (
              <div className="glass-card p-10 text-center text-gray-500">
                <Receipt className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                No expenses found
              </div>
            ) : (
              filteredExpenses.map((exp) => (
                <div key={exp._id} className="glass-card p-4 flex items-center gap-4 hover:border-gray-700/60 transition-colors">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                    ${exp.isSettlement ? 'bg-violet-500/15 border border-violet-500/20' : 'bg-brand-500/15 border border-brand-500/20'}`}
                  >
                    {exp.currency === 'USD' ? (
                      <DollarSign className="w-5 h-5 text-brand-400" />
                    ) : (
                      <IndianRupee className="w-5 h-5 text-brand-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium text-white truncate">{exp.description}</p>
                      {exp.isSettlement && <span className="badge-indigo text-[10px]">Settlement</span>}
                    </div>
                    <p className="text-xs text-gray-500">
                      Paid by <span className="text-gray-300">{exp.paidBy?.name || 'Unknown'}</span>
                      {' · '}
                      {format(new Date(exp.date), 'MMM d, yyyy')}
                      {' · '}
                      <span className="text-gray-400">{exp.splitType}</span>
                    </p>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-white">
                      ₹{exp.amountInINR?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                    {exp.currency === 'USD' && (
                      <p className="text-xs text-gray-500">${exp.amount?.toFixed(2)}</p>
                    )}
                  </div>

                  <button
                    onClick={() => handleDeleteExpense(exp._id)}
                    className="p-2 text-gray-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* --- BALANCES TAB --- */}
      {activeTab === 'balances' && (
        <div className="text-center py-10">
          <BarChart3 className="w-12 h-12 mx-auto text-gray-600 mb-3" />
          <p className="text-gray-400 mb-4">View detailed balances and settlement suggestions</p>
          <Link to={`/groups/${groupId}/balances`} className="btn-primary">
            <ArrowRight className="w-4 h-4" /> Open Balance Page
          </Link>
        </div>
      )}

      {/* --- IMPORT TAB --- */}
      {activeTab === 'import' && (
        <div className="text-center py-10">
          <Upload className="w-12 h-12 mx-auto text-gray-600 mb-3" />
          <p className="text-gray-400 mb-4">Import expenses from a CSV file with smart anomaly detection</p>
          <Link to={`/groups/${groupId}/import`} className="btn-primary">
            <ArrowRight className="w-4 h-4" /> Open Import Page
          </Link>
        </div>
      )}

      {/* Expense Form Modal */}
      {showExpenseForm && (
        <ExpenseForm
          groupId={groupId}
          members={members}
          onClose={() => setShowExpenseForm(false)}
          onCreated={fetchData}
        />
      )}
    </div>
  );
}
