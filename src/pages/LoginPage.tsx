import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface LoginPageProps { onLogin: () => void; }

export default function LoginPage({ onLogin }: LoginPageProps) {
  const { login } = useAuth();
  const [username,  setUsername]  = useState('');
  const [password,  setPassword]  = useState('');
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [isLocked,  setIsLocked]  = useState(false);

  // Lock after 5 failed attempts for 30 seconds
  useEffect(() => {
    if (failCount >= 5) {
      setIsLocked(true);
      setError('Too many failed attempts. Please wait 30 seconds.');
      const t = setTimeout(() => { setIsLocked(false); setFailCount(0); setError(''); }, 30000);
      return () => clearTimeout(t);
    }
  }, [failCount]);

  const handleLogin = async () => {
    if (isLocked) return;
    if (!username || !password) { setError('Please enter username and password'); return; }
    setLoading(true); setError('');
    const result = await login(username, password);
    if (result.ok) {
      onLogin();
    } else {
      setFailCount(prev => prev + 1);
      setError(result.error || 'Invalid username or password');
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleLogin(); };
  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-page)' }}>

      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #EFF6FF 0%, #DBEAFE 60%, #BFDBFE 100%)' }}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 h-full" style={{ left: '-20px', width: '110px', background: 'linear-gradient(180deg, #2196C9 0%, #1878A8 100%)', clipPath: 'polygon(0 0, 65% 0, 100% 100%, 35% 100%)', opacity: 0.3 }} />
          <div className="absolute top-0 h-full" style={{ left: '55px',  width: '55px',  background: 'linear-gradient(180deg, #4FC3E8 0%, #2BB8E8 100%)', clipPath: 'polygon(0 0, 65% 0, 100% 100%, 35% 100%)', opacity: 0.2 }} />
          <div className="absolute top-0 h-full" style={{ left: '98px',  width: '22px',  background: '#2BB8E8', clipPath: 'polygon(0 0, 65% 0, 100% 100%, 35% 100%)', opacity: 0.12 }} />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-5 mb-12">
            <img src="/logo.png" alt="PAKFROST" style={{ width: 88, height: 88, objectFit: 'contain' }} />
            <div>
              <div className="text-2xl font-black tracking-widest" style={{ color: 'var(--text-primary)', letterSpacing: '0.22em' }}>PAKFROST</div>
              <div className="text-xs font-semibold tracking-widest" style={{ color: '#0284C7', letterSpacing: '0.15em' }}>(PVT) LIMITED</div>
            </div>
          </div>
          <div className="mb-6">
            <h1 className="text-4xl font-black leading-tight mb-1" style={{ color: 'var(--text-primary)' }}>Premium</h1>
            <h1 className="text-4xl font-black leading-tight mb-1" style={{ color: '#0284C7' }}>Temperature</h1>
            <h1 className="text-4xl font-black leading-tight mb-1" style={{ color: 'var(--text-primary)' }}>Controlled</h1>
            <h1 className="text-4xl font-black leading-tight"       style={{ color: 'var(--text-primary)' }}>Warehousing</h1>
          </div>
          <div className="inline-block px-3 py-1.5 rounded-lg text-xs font-bold tracking-widest mt-2"
            style={{ background: 'rgba(2,132,199,0.1)', border: '1px solid rgba(2,132,199,0.25)', color: '#0284C7', letterSpacing: '0.1em' }}>
            WAREHOUSE MANAGEMENT SYSTEM
          </div>
          <p className="text-sm mt-4" style={{ color: 'var(--text-secondary)' }}>-18C to -22C Frozen Storage</p>
        </div>
        <div className="relative z-10">
          <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(2,132,199,0.06)', border: '1px solid rgba(2,132,199,0.15)' }}>
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}><div className="w-1 h-1 rounded-full" style={{ background: '#0284C7' }} /><span>0321-4394111</span></div>
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}><div className="w-1 h-1 rounded-full" style={{ background: '#0284C7' }} /><span>2 KM Off Manga Raiwind Road, Behind Achha Foods</span></div>
            <div className="flex items-center gap-2 text-xs" style={{ color: '#0284C7' }}><div className="w-1 h-1 rounded-full" style={{ background: '#0284C7' }} /><span>info.pakfrost@gmail.com</span></div>
          </div>
          <div className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>Developed by <span className="font-semibold" style={{ color: '#0284C7' }}>AttaTech</span></div>
        </div>
      </div>

      {/* ── Right panel — login form ── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8" style={{ background: 'var(--bg-card)' }}>
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex flex-col items-center mb-8">
            <img src="/logo.png" alt="PAKFROST" style={{ width: 88, height: 88, objectFit: 'contain' }} />
            <div className="mt-3 text-center">
              <div className="text-xl font-black tracking-widest" style={{ color: 'var(--text-primary)', letterSpacing: '0.2em' }}>PAKFROST</div>
              <div className="text-xs mt-0.5 font-semibold" style={{ color: '#0284C7' }}>(PVT) LIMITED</div>
            </div>
          </div>

          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-[2px] rounded" style={{ background: '#0284C7' }} />
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#0284C7', letterSpacing: '0.15em' }}>Secure Access</span>
            </div>
            <h2 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>Sign In</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Enter your credentials to continue</p>
          </div>

          {/* Error / lockout message */}
          {error && (
            <div className="mb-4 p-3 rounded-xl text-sm"
              style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
              {error}

            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold mb-1.5 uppercase tracking-widest" style={{ color: 'var(--text-secondary)', letterSpacing: '0.12em' }}>Username</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} onKeyDown={handleKey} autoFocus
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all disabled:opacity-50"
                style={{ background: 'var(--bg-card)', border: '1.5px solid #E2E8F0', color: 'var(--text-primary)', caretColor: '#0284C7' }}
                onFocus={e => { e.target.style.borderColor = '#0284C7'; e.target.style.boxShadow = '0 0 0 3px rgba(2,132,199,0.08)'; }}
                onBlur={e =>  { e.target.style.borderColor = 'var(--border-default)'; e.target.style.boxShadow = 'none'; }}
                placeholder="Enter username" />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5 uppercase tracking-widest" style={{ color: 'var(--text-secondary)', letterSpacing: '0.12em' }}>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={handleKey}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all disabled:opacity-50"
                style={{ background: 'var(--bg-card)', border: '1.5px solid #E2E8F0', color: 'var(--text-primary)', caretColor: '#0284C7' }}
                onFocus={e => { e.target.style.borderColor = '#0284C7'; e.target.style.boxShadow = '0 0 0 3px rgba(2,132,199,0.08)'; }}
                onBlur={e =>  { e.target.style.borderColor = 'var(--border-default)'; e.target.style.boxShadow = 'none'; }}
                placeholder="Enter password" />
            </div>
            <button onClick={handleLogin} disabled={loading || isLocked}
              className="w-full py-3 rounded-xl font-black text-sm transition-all mt-2 disabled:opacity-60 tracking-widest"
              style={{ background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)', color: 'var(--bg-card)', letterSpacing: '0.12em', boxShadow: (loading || isLocked) ? 'none' : '0 4px 20px rgba(2,132,199,0.25)' }}>
              {loading ? 'Signing in...' : 'SIGN IN'}
            </button>
          </div>

          <div className="mt-8 pt-6" style={{ borderTop: '1px solid #E2E8F0' }}>
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>Developed by <span className="font-semibold" style={{ color: '#0284C7' }}>AttaTech</span></p>
            <p className="text-xs mt-1 text-center" style={{ color: 'var(--border-strong)' }}>PAKFROST (PVT) LIMITED &copy; {new Date().getFullYear()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
