import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LogIn, Mail, Lock, Zap, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-nebula-bg text-nebula-text px-4 relative overflow-hidden">
      {/* Background glow orbs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-nebula-accent/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-nebula-primary/5 rounded-full blur-3xl" />

      <div className="w-full max-w-md animate-fade-in-up relative z-10 py-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-nebula-primary to-nebula-accent flex items-center justify-center shadow-xl shadow-nebula-sm mb-4">
            <Zap className="w-8 h-8 text-white fill-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-wider text-white">
            Split<span className="text-nebula-primary">Ledger</span>
          </h1>
          <p className="text-nebula-muted mt-2 text-sm">Sign in to manage shared expenses</p>
        </div>

        {/* Form card */}
        <div className="nebula-card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="login-email" className="label-text">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-nebula-subtle" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="nebula-input pl-10"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="label-text">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-nebula-subtle" />
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="nebula-input pl-10"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="nebula-button-gradient w-full py-2.5 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Sign In
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-nebula-muted text-sm">
              Don&apos;t have an account?{' '}
              <Link
                to="/register"
                className="text-nebula-primary hover:underline font-semibold inline-flex items-center gap-1 transition-colors"
              >
                Create one <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </p>
          </div>
        </div>

        {/* Demo Credentials Box */}
        <div className="nebula-card mt-6 p-5 text-xs text-nebula-muted">
          <h3 className="text-sm font-bold text-white mb-3 tracking-wide uppercase text-nebula-primary flex items-center gap-1.5">
            <Zap className="w-4 h-4 fill-nebula-primary text-nebula-primary" />
            Demo Credentials
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-nebula-border text-nebula-subtle font-bold uppercase tracking-wider text-[10px]">
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Email</th>
                  <th className="pb-2">Password</th>
                  <th className="pb-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nebula-border font-mono text-xs">
                {[
                  { name: 'Aisha', email: 'aisha@flatmates.com', password: 'password123', autofill: true },
                  { name: 'Rohan', email: 'rohan@flatmates.com', password: 'password123' },
                  { name: 'Priya', email: 'priya@flatmates.com', password: 'password123' },
                  { name: 'Meera', email: 'meera@flatmates.com', password: 'password123' },
                  { name: 'Sam', email: 'sam@flatmates.com', password: 'password123' },
                  { name: 'Dev', email: 'dev@flatmates.com', password: 'password123' }
                ].map((row) => (
                  <tr key={row.email} className="hover:bg-nebula-primary/5 transition-colors">
                    <td className="py-2 pr-2 font-bold text-nebula-text">{row.name}</td>
                    <td className="py-2 pr-2 text-nebula-muted">{row.email}</td>
                    <td className="py-2 pr-2 text-nebula-subtle">{row.password}</td>
                    <td className="py-2 text-right">
                      {row.autofill ? (
                        <button
                          type="button"
                          onClick={() => {
                            setEmail(row.email);
                            setPassword(row.password);
                            toast.success('Aisha\'s credentials loaded!');
                          }}
                          className="px-2 py-1 bg-nebula-primary/10 hover:bg-nebula-primary hover:text-nebula-bg text-nebula-primary border border-nebula-primary/25 rounded text-[10px] font-bold transition-all duration-200"
                        >
                          Autofill
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEmail(row.email);
                            setPassword(row.password);
                            toast.success(`${row.name}'s credentials loaded!`);
                          }}
                          className="px-2 py-0.5 bg-nebula-border hover:bg-nebula-border/80 text-nebula-text border border-nebula-border rounded text-[10px] transition-colors"
                        >
                          Fill
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
