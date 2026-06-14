import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getGroups, createGroup } from '../api/groups';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import {
  Plus,
  FolderOpen,
  X,
  Wallet,
  Receipt,
  Users,
} from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', description: '' });
  const [creating, setCreating] = useState(false);

  const fetchGroups = async () => {
    try {
      const res = await getGroups();
      setGroups(res.data.groups || []);
    } catch {
      toast.error('Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newGroup.name.trim()) return;
    setCreating(true);
    try {
      await createGroup(newGroup);
      toast.success('Group created!');
      setShowModal(false);
      setNewGroup({ name: '', description: '' });
      fetchGroups();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  const renderMemberAvatars = (count) => {
    const defaultAvatars = [
      { initial: 'A', bg: 'from-purple-500 to-indigo-500' },
      { initial: 'R', bg: 'from-pink-500 to-rose-500' },
      { initial: 'P', bg: 'from-amber-500 to-orange-500' },
      { initial: 'M', bg: 'from-emerald-500 to-teal-500' },
      { initial: 'S', bg: 'from-violet-500 to-purple-500' },
      { initial: 'D', bg: 'from-blue-500 to-cyan-500' },
    ];
    
    return (
      <div className="flex -space-x-2 overflow-hidden">
        {defaultAvatars.slice(0, Math.min(count, 5)).map((av, i) => (
          <div
            key={i}
            className={`w-7 h-7 rounded-full bg-gradient-to-br ${av.bg} border-2 border-nebula-card flex items-center justify-center text-[10px] font-bold text-white shadow-sm`}
          >
            {av.initial}
          </div>
        ))}
        {count > 5 && (
          <div className="w-7 h-7 rounded-full bg-nebula-border border-2 border-nebula-card flex items-center justify-center text-[10px] font-bold text-nebula-primary shadow-sm">
            +{count - 5}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-nebula-primary/30 border-t-nebula-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-wide">
            Hey, {user?.name?.split(' ')[0] || 'Aisha'} 👋
          </h1>
          <p className="text-nebula-muted mt-1 text-sm">
            Here's what's happening with your groups
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="nebula-button-gradient flex items-center gap-1.5">
          <Plus className="w-4 h-4" />
          New Group
        </button>
      </div>

      {/* Groups grid */}
      {groups.length === 0 ? (
        <div className="nebula-card p-12 text-center max-w-xl mx-auto border-t-2 border-t-nebula-primary shadow-nebula-sm">
          <FolderOpen className="w-16 h-16 mx-auto text-nebula-primary mb-4 opacity-80" />
          <h3 className="text-xl font-bold text-white mb-2">
            No groups yet
          </h3>
          <p className="text-nebula-muted mb-6 leading-relaxed text-sm">
            Create your first expense group to start tracking and splitting expenses with your flatmates.
          </p>
          <button onClick={() => setShowModal(true)} className="nebula-button-gradient flex items-center gap-1.5 mx-auto">
            <Plus className="w-4 h-4" />
            Create Your First Group
          </button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group, idx) => (
            <Link
              key={group._id}
              to={`/groups/${group._id}`}
              className="nebula-card p-6 group block relative overflow-hidden animate-fade-in-up hover:-translate-y-1 hover:shadow-nebula-md transition-all duration-300"
              style={{ animationDelay: `${idx * 80}ms` }}
            >
              {/* Gradient top border */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-nebula-gradient" />

              <div className="flex items-start justify-between mb-5">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-nebula-accent/20 to-nebula-primary/20 border border-nebula-primary/20 flex items-center justify-center shadow-inner">
                  <Wallet className="w-5 h-5 text-nebula-primary" />
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-nebula-muted bg-nebula-bg px-2.5 py-1 rounded-full border border-nebula-border">
                  <Receipt className="w-3.5 h-3.5 text-nebula-primary" />
                  <span className="font-mono tabular-nums">{group.expenseCount || 0}</span> expenses
                </div>
              </div>

              <h3 className="text-xl font-extrabold text-white mb-2 group-hover:text-nebula-primary transition-colors leading-tight">
                {group.name}
              </h3>

              {group.description && (
                <p className="text-sm text-nebula-muted mb-6 line-clamp-2 leading-relaxed">
                  {group.description}
                </p>
              )}

              <div className="flex items-center justify-between border-t border-nebula-border pt-4 mt-auto">
                <div className="flex items-center gap-2">
                  {renderMemberAvatars(group.memberCount || 0)}
                  <span className="text-xs font-semibold text-nebula-muted flex items-center gap-1">
                    <Users className="w-3 h-3 text-nebula-accent" />
                    {group.memberCount || 0} members
                  </span>
                </div>
                
                <span className="text-[10px] font-semibold text-nebula-subtle uppercase tracking-wider">
                  {new Date(group.createdAt).toLocaleDateString('en-IN', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Group Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />
          <div className="relative nebula-card p-8 w-full max-w-md border-t-2 border-t-nebula-primary animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white tracking-wide">Create Group</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-nebula-muted hover:text-white hover:bg-nebula-border rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-5">
              <div>
                <label htmlFor="group-name" className="label-text">
                  Group Name
                </label>
                <input
                  id="group-name"
                  type="text"
                  value={newGroup.name}
                  onChange={(e) =>
                    setNewGroup({ ...newGroup, name: e.target.value })
                  }
                  placeholder="e.g., Flat Expenses 2024"
                  required
                  className="nebula-input"
                  autoFocus
                />
              </div>
              <div>
                <label htmlFor="group-desc" className="label-text">
                  Description (optional)
                </label>
                <textarea
                  id="group-desc"
                  value={newGroup.description}
                  onChange={(e) =>
                    setNewGroup({ ...newGroup, description: e.target.value })
                  }
                  placeholder="Brief description of this expense group..."
                  rows={3}
                  className="nebula-input resize-none"
                />
              </div>
              <div className="flex gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="nebula-button-ghost flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="nebula-button-primary flex-1"
                >
                  {creating ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Create Group'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
