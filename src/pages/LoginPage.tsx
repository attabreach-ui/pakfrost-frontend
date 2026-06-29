import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

interface LoginPageProps { onLogin: () => void; }

// Floating particle config for left panel background
const PARTICLES = [
  { size: 90,  left: '72%', top: '8%',  delay: 0,   dur: 9  },
  { size: 55,  left: '83%', top: '32%', delay: 1.5, dur: 11 },
  { size: 110, left: '58%', top: '52%', delay: 0.7, dur: 13 },
  { size: 42,  left: '76%', top: '72%', delay: 2.2, dur: 8  },
  { size: 65,  left: '63%', top: '22%', delay: 1.1, dur: 10 },
  { size: 38,  left: '88%', top: '62%', delay: 2.7, dur: 7  },
  { size: 28,  left: '68%', top: '85%', delay: 0.4, dur: 12 },
];

// Stagger variants for form fields
const fieldStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.32 } },
};
const fieldItem = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

export default function LoginPage({ onLogin }: LoginPageProps) {
  const { login } = useAuth();
  const [username,  setUsername]  = useState('');
  const [password,  setPassword]  = useState('');
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [isLocked,  setIsLocked]  = useState(false);

  const lockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLock = () => {
    setIsLocked(false);
    setFailCount(0);
    setError('');
    if (lockTimerRef.current) { clearTimeout(lockTimerRef.current); lockTimerRef.current = null; }
  };

  // Progressive lock: 5 fails → 30s, 10 → 5min, 15+ → 15min
  useEffect(() => {
    if (failCount >= 5) {
      setIsLocked(true);
      const duration = failCount >= 15 ? 900_000 : failCount >= 10 ? 300_000 : 30_000;
      setError(`Too many failed attempts. Please wait ${Math.ceil(duration / 1000)} seconds.`);
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
      lockTimerRef.current = setTimeout(clearLock, duration);
    }
    return () => { if (lockTimerRef.current) clearTimeout(lockTimerRef.current); };
  }, [failCount]);

  const handleLogin = async () => {
    if (isLocked) { setError('Account is locked. Please wait before trying again.'); return; }
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

      {/* ── LEFT PANEL ── */}
      <motion.div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #EFF6FF 0%, #DBEAFE 60%, #BFDBFE 100%)' }}
        initial={{ x: -70, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Decorative stripes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div className="absolute top-0 h-full"
            style={{ left: '-20px', width: '110px', background: 'linear-gradient(180deg,#2196C9 0%,#1878A8 100%)', clipPath: 'polygon(0 0,65% 0,100% 100%,35% 100%)', opacity: 0.3 }}
            initial={{ x: -40, opacity: 0 }} animate={{ x: 0, opacity: 0.3 }}
            transition={{ duration: 1, delay: 0.25 }} />
          <motion.div className="absolute top-0 h-full"
            style={{ left: '55px', width: '55px', background: 'linear-gradient(180deg,#4FC3E8 0%,#2BB8E8 100%)', clipPath: 'polygon(0 0,65% 0,100% 100%,35% 100%)', opacity: 0.2 }}
            initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 0.2 }}
            transition={{ duration: 1, delay: 0.4 }} />
          <motion.div className="absolute top-0 h-full"
            style={{ left: '98px', width: '22px', background: '#2BB8E8', clipPath: 'polygon(0 0,65% 0,100% 100%,35% 100%)', opacity: 0.12 }}
            initial={{ opacity: 0 }} animate={{ opacity: 0.12 }}
            transition={{ duration: 1, delay: 0.55 }} />

          {/* Floating particles */}
          {PARTICLES.map((p, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full"
              style={{
                width: p.size, height: p.size,
                left: p.left, top: p.top,
                background: 'radial-gradient(circle, rgba(43,184,232,0.13) 0%, rgba(43,184,232,0.03) 70%)',
                border: '1px solid rgba(43,184,232,0.2)',
              }}
              animate={{ y: [0, -18, 0], x: [0, 7, 0], scale: [1, 1.05, 1] }}
              transition={{ duration: p.dur, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
            />
          ))}
        </div>

        {/* ── Top: Logo + Heading ── */}
        <div className="relative z-10">
          <div className="flex items-center gap-5 mb-12">
            <motion.img
              src="/logo.png" alt="PAKFROST"
              style={{ width: 88, height: 88, objectFit: 'contain' }}
              initial={{ scale: 0.7, opacity: 0, rotate: -8 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ duration: 0.85, delay: 0.22, type: 'spring', stiffness: 170, damping: 13 }}
            />
            <motion.div
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.38, duration: 0.5 }}
            >
              <div className="text-2xl font-black tracking-widest" style={{ color: 'var(--text-primary)', letterSpacing: '0.22em' }}>PAKFROST</div>
              <div className="text-xs font-semibold tracking-widest" style={{ color: '#0284C7', letterSpacing: '0.15em' }}>(PVT) LIMITED</div>
            </motion.div>
          </div>

          <div className="mb-6">
            {[
              { word: 'Premium',     color: 'var(--text-primary)' },
              { word: 'Temperature', color: '#0284C7'             },
              { word: 'Controlled',  color: 'var(--text-primary)' },
              { word: 'Warehousing', color: 'var(--text-primary)' },
            ].map(({ word, color }, i) => (
              <motion.h1
                key={word}
                className="text-4xl font-black leading-tight mb-1"
                style={{ color }}
                initial={{ opacity: 0, x: -28 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.55, delay: 0.28 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              >
                {word}
              </motion.h1>
            ))}
          </div>

          <motion.div
            className="inline-block px-3 py-1.5 rounded-lg text-xs font-bold tracking-widest mt-2"
            style={{ background: 'rgba(2,132,199,0.1)', border: '1px solid rgba(2,132,199,0.25)', color: '#0284C7', letterSpacing: '0.1em' }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.68, duration: 0.45 }}
          >
            WAREHOUSE MANAGEMENT SYSTEM
          </motion.div>

          <motion.p
            className="text-sm mt-4" style={{ color: 'var(--text-secondary)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.82 }}
          >
            -18°C to -22°C Frozen Storage
          </motion.p>
        </div>

        {/* ── Bottom: Contact info ── */}
        <motion.div
          className="relative z-10"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.6 }}
        >
          <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(2,132,199,0.06)', border: '1px solid rgba(2,132,199,0.15)' }}>
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: '#0284C7' }} />
              <span>0321-4394111</span>
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: '#0284C7' }} />
              <span>2 KM Off Manga Raiwind Road, Behind Achha Foods</span>
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: '#0284C7' }}>
              <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: '#0284C7' }} />
              <span>info.pakfrost@gmail.com</span>
            </div>
          </div>
          <div className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            Developed by <span className="font-semibold" style={{ color: '#0284C7' }}>AttaTech</span>
          </div>
        </motion.div>
      </motion.div>

      {/* ── RIGHT PANEL — Login Form ── */}
      <motion.div
        className="w-full lg:w-1/2 flex items-center justify-center p-8"
        style={{ background: 'var(--bg-card)' }}
        initial={{ x: 70, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
      >
        <div className="w-full max-w-sm">

          {/* Mobile-only logo */}
          <motion.div
            className="lg:hidden flex flex-col items-center mb-8"
            initial={{ opacity: 0, y: -18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <img src="/logo.png" alt="PAKFROST" style={{ width: 88, height: 88, objectFit: 'contain' }} />
            <div className="mt-3 text-center">
              <div className="text-xl font-black tracking-widest" style={{ color: 'var(--text-primary)', letterSpacing: '0.2em' }}>PAKFROST</div>
              <div className="text-xs mt-0.5 font-semibold" style={{ color: '#0284C7' }}>(PVT) LIMITED</div>
            </div>
          </motion.div>

          {/* Heading */}
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center gap-2 mb-2">
              <motion.div
                className="h-[2px] rounded w-6"
                style={{ background: '#0284C7', transformOrigin: 'left' }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.35, duration: 0.4 }}
              />
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#0284C7', letterSpacing: '0.15em' }}>Secure Access</span>
            </div>
            <h2 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>Sign In</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Enter your credentials to continue</p>
          </motion.div>

          {/* Error message */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="error"
                className="mb-4 p-3 rounded-xl text-sm"
                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}
                initial={{ opacity: 0, y: -10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0,   scale: 1    }}
                exit={{   opacity: 0, y: -10,  scale: 0.97 }}
                transition={{ duration: 0.22 }}
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form fields — staggered entrance */}
          <motion.div
            className="space-y-4"
            variants={fieldStagger}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={fieldItem}>
              <label className="block text-xs font-bold mb-1.5 uppercase tracking-widest" style={{ color: 'var(--text-secondary)', letterSpacing: '0.12em' }}>
                Username
              </label>
              <input
                type="text" value={username}
                onChange={e => { setUsername(e.target.value); if (error) setError(''); }}
                onKeyDown={handleKey} autoFocus
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all disabled:opacity-50"
                style={{ background: 'var(--bg-input)', border: '1.5px solid var(--border-default)', color: 'var(--text-primary)', caretColor: '#0284C7' }}
                onFocus={e => { e.target.style.borderColor = '#0284C7'; e.target.style.boxShadow = '0 0 0 3px rgba(2,132,199,0.09)'; }}
                onBlur={e =>  { e.target.style.borderColor = 'var(--border-default)'; e.target.style.boxShadow = 'none'; }}
                placeholder="Enter username"
              />
            </motion.div>

            <motion.div variants={fieldItem}>
              <label className="block text-xs font-bold mb-1.5 uppercase tracking-widest" style={{ color: 'var(--text-secondary)', letterSpacing: '0.12em' }}>
                Password
              </label>
              <input
                type="password" value={password}
                onChange={e => { setPassword(e.target.value); if (error) setError(''); }}
                onKeyDown={handleKey}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all disabled:opacity-50"
                style={{ background: 'var(--bg-input)', border: '1.5px solid var(--border-default)', color: 'var(--text-primary)', caretColor: '#0284C7' }}
                onFocus={e => { e.target.style.borderColor = '#0284C7'; e.target.style.boxShadow = '0 0 0 3px rgba(2,132,199,0.09)'; }}
                onBlur={e =>  { e.target.style.borderColor = 'var(--border-default)'; e.target.style.boxShadow = 'none'; }}
                placeholder="Enter password"
              />
            </motion.div>

            <motion.div variants={fieldItem}>
              <motion.button
                onClick={handleLogin}
                disabled={loading || isLocked}
                className="w-full py-3 rounded-xl font-black text-sm mt-2 disabled:opacity-60 tracking-widest"
                style={{
                  background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)',
                  color: '#fff',
                  letterSpacing: '0.12em',
                  boxShadow: (loading || isLocked) ? 'none' : '0 4px 20px rgba(2,132,199,0.3)',
                }}
                whileHover={!(loading || isLocked) ? {
                  scale: 1.013,
                  boxShadow: '0 6px 28px rgba(2,132,199,0.42)',
                } : {}}
                whileTap={!(loading || isLocked) ? { scale: 0.986 } : {}}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              >
                {loading ? 'Signing in…' : 'SIGN IN'}
              </motion.button>
            </motion.div>
          </motion.div>

          {/* Footer */}
          <motion.div
            className="mt-8 pt-6"
            style={{ borderTop: '1px solid var(--border-default)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.88 }}
          >
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              Developed by <span className="font-semibold" style={{ color: '#0284C7' }}>AttaTech</span>
            </p>
            <p className="text-xs mt-1 text-center" style={{ color: 'var(--border-strong)' }}>
              PAKFROST (PVT) LIMITED &copy; {new Date().getFullYear()}
            </p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
