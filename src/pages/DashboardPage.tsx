import { useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, TrendingDown, TrendingUp, AlertTriangle,
  CheckCircle, Settings2, BarChart3, Thermometer, Clock, Bell, Trash2
} from 'lucide-react';
import type { Pallet, StockMovement, Room, TemperatureReading, Customer, Driver, Vehicle, DocCounters, PageView } from '@/types';

interface DashboardPageProps {
  pallets: Pallet[];
  movements: StockMovement[];
  rooms: Room[];
  temperatures: TemperatureReading[];
  customers: Customer[];
  drivers: Driver[];
  vehicles: Vehicle[];
  counters: DocCounters;
  peekNextIGP?: () => string;
  peekNextOGP?: () => string;
  onInitCounters: (igpStart: number, ogpStart: number) => Promise<void>;
  onResetAllData: () => Promise<void>;
  onNavigate: (page: PageView) => void;
}

// Stagger variants for card grids
const cardGrid = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.1 } },
};
const cardItem = {
  hidden: { y: 22, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

// Modal overlay + panel variants
const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit:   { opacity: 0, transition: { duration: 0.18 } },
};
const panelVariants = {
  hidden: { scale: 0.93, y: 18, opacity: 0 },
  visible: { scale: 1, y: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 320, damping: 26 } },
  exit:   { scale: 0.93, y: 18, opacity: 0, transition: { duration: 0.16 } },
};

export default function DashboardPage({
  pallets, movements, rooms, temperatures, customers, drivers, vehicles, counters,
  peekNextIGP, peekNextOGP,
  onInitCounters, onResetAllData, onNavigate
}: DashboardPageProps) {
  const { currentUser, verifyPassword } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const [showCounterModal,  setShowCounterModal]  = useState(false);
  const [showResetConfirm,  setShowResetConfirm]  = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingAction,     setPendingAction]     = useState<'counters' | 'clear-data' | null>(null);
  const [adminPassword,     setAdminPassword]     = useState('');
  const [passwordError,     setPasswordError]     = useState('');
  const [counterError,      setCounterError]      = useState('');
  const [isVerifying,       setIsVerifying]       = useState(false);
  const [isSavingCounters,  setIsSavingCounters]  = useState(false);
  const [igpStart, setIgpStart] = useState('');
  const [ogpStart, setOgpStart] = useState('');

  // ── All existing logic kept exactly the same ─────────────────────────────

  const stats = useMemo(() => {
    const now   = new Date();
    const d7    = new Date(now); d7.setDate(d7.getDate() + 7);
    const d30   = new Date(now); d30.setDate(d30.getDate() + 30);
    const today = now.toDateString();

    const active       = pallets.filter(p => p.status === 'active');
    const expired      = active.filter(p => new Date(p.expiryDate) < now);
    const exp7         = active.filter(p => { const e = new Date(p.expiryDate); return e >= now && e <= d7; });
    const exp30        = active.filter(p => { const e = new Date(p.expiryDate); return e >= now && e <= d30; });
    const todayIn      = movements.filter(m => m.type === 'IN'  && new Date(m.createdAt||m.date||"").toDateString() === today);
    const todayOut     = movements.filter(m => m.type === 'OUT' && new Date(m.createdAt||m.date||"").toDateString() === today);
    const totalCartons = active.reduce((s, p) => s + Number(p.cartons || 0), 0);
    const totalWeight  = active.reduce((s, p) => s + Number(p.totalWeight || 0), 0);

    const docAlerts: { label: string; type: string; expiry: string; urgent: boolean }[] = [];
    vehicles.forEach(v => {
      [{ f: v.routePermitExpiry, l: `${v.vehicleNo} Route Permit` },
       { f: v.tokenExpiry,       l: `${v.vehicleNo} Token`        },
       { f: v.fitnessExpiry,     l: `${v.vehicleNo} Fitness`      },
       { f: v.insuranceExpiry,   l: `${v.vehicleNo} Insurance`    },
      ].forEach(({ f, l }) => {
        if (f && new Date(f) <= d30)
          docAlerts.push({ label: l, type: 'vehicle', expiry: f, urgent: new Date(f) <= d7 });
      });
    });
    drivers.forEach(d => {
      if (d.licenseExpiry && new Date(d.licenseExpiry) <= d30)
        docAlerts.push({ label: `${d.name} License`, type: 'driver', expiry: d.licenseExpiry, urgent: new Date(d.licenseExpiry) <= d7 });
    });
    customers.forEach(c => {
      if (c.contractExpiry && new Date(c.contractExpiry) <= d30)
        docAlerts.push({ label: `${c.name} Contract`, type: 'customer', expiry: c.contractExpiry, urgent: new Date(c.contractExpiry) <= d7 });
    });

    return {
      totalActive: active.length, totalCartons, totalWeight,
      expired: expired.length, exp7: exp7.length, exp30: exp30.length,
      todayIn:  todayIn.reduce((s, m)  => s + Number(m.cartons), 0),
      todayOut: todayOut.reduce((s, m) => s + Number(m.cartons), 0),
      docAlerts: docAlerts.sort((a, b) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime()),
    };
  }, [pallets, movements, vehicles, drivers, customers]);

  const chartData = useMemo(() => {
    const now  = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const label   = d.toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric' });
      const dateStr = d.toDateString();
      const inQty  = movements.filter(m => m.type === 'IN'  && new Date(m.createdAt||m.date||"").toDateString() === dateStr).reduce((s, m) => s + Number(m.cartons), 0);
      const outQty = movements.filter(m => m.type === 'OUT' && new Date(m.createdAt||m.date||"").toDateString() === dateStr).reduce((s, m) => s + Number(m.cartons), 0);
      days.push({ label, inQty, outQty });
    }
    return days;
  }, [movements]);

  const maxChart = Math.max(...chartData.map(d => Math.max(d.inQty, d.outQty)), 1);

  const tempAlerts = useMemo(() => {
    const alerts: { room: string; latest: number; target: number; delta: number }[] = [];
    rooms.forEach(r => {
      const readings = temperatures.filter(t => t.room === r.name);
      if (readings.length === 0) return;
      const latest = readings[0].temperature;
      const target = r.temperature;
      const delta  = Math.abs(latest - target);
      if (delta > 2) alerts.push({ room: r.name, latest, target, delta });
    });
    return alerts.sort((a, b) => b.delta - a.delta);
  }, [rooms, temperatures]);

  const latestTemp = (room: string) => {
    const r = temperatures.filter(t => t.room === room)[0];
    return r ? r.temperature : null;
  };

  const getErrorMessage = (err: unknown) =>
    err instanceof Error ? err.message : 'Action failed. Please try again.';

  const requirePassword = (action: 'counters' | 'clear-data') => {
    if (!isAdmin) return;
    setAdminPassword(''); setPasswordError(''); setCounterError('');
    setPendingAction(action);
    setShowPasswordModal(true);
  };

  const openCounterModal   = () => requirePassword('counters');
  const openClearDataModal = () => requirePassword('clear-data');

  const verifyPasswordAndOpen = useCallback(async () => {
    if (!pendingAction || isVerifying) return;
    if (!adminPassword.trim()) { setPasswordError('Please enter your password.'); return; }
    setIsVerifying(true); setPasswordError('');
    try {
      const result = await verifyPassword(adminPassword);
      if (!result.ok) { setPasswordError(result.error || 'Incorrect password. Please try again.'); return; }
      if (pendingAction === 'clear-data') { await onResetAllData(); }
      setShowPasswordModal(false); setAdminPassword(''); setPasswordError('');
      if (pendingAction === 'counters') {
        setIgpStart(String(counters.igpSeq ?? 0));
        setOgpStart(String(counters.ogpSeq ?? 0));
        setShowCounterModal(true);
      }
      setPendingAction(null);
    } catch (err) {
      setPasswordError(getErrorMessage(err));
    } finally {
      setIsVerifying(false);
    }
  }, [adminPassword, counters.igpSeq, counters.ogpSeq, isVerifying, onResetAllData, pendingAction, verifyPassword]);

  const handleInitCounters = async () => {
    const i = parseInt(igpStart, 10);
    const o = parseInt(ogpStart, 10);
    if (isNaN(i) || i < 0 || isNaN(o) || o < 0) {
      setCounterError('Please enter valid zero or positive counter numbers.');
      return;
    }
    setIsSavingCounters(true); setCounterError('');
    try {
      await onInitCounters(i, o);
      setShowCounterModal(false); setIgpStart(''); setOgpStart('');
    } catch (err) {
      setCounterError(getErrorMessage(err));
    } finally {
      setIsSavingCounters(false);
    }
  };

  // ── Animated StatCard ────────────────────────────────────────────────────
  const StatCard = ({ label, value, sub, icon: Icon, color, onClick }: any) => (
    <motion.div
      onClick={onClick}
      className={`rounded-xl p-3 sm:p-4 flex items-start gap-2 sm:gap-3 ${onClick ? 'cursor-pointer' : ''}`}
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
      variants={cardItem}
      whileHover={onClick ? { y: -3, boxShadow: `0 6px 20px rgba(0,0,0,0.10), 0 0 0 1px ${color}22` } : { y: -1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
    >
      <motion.div
        className="p-1.5 sm:p-2 rounded-lg flex-shrink-0"
        style={{ background: `${color}18` }}
        whileHover={{ scale: 1.12 }}
        transition={{ type: 'spring', stiffness: 400, damping: 18 }}
      >
        <Icon className="w-4 h-4 sm:w-5 sm:h-5" style={{ color }} />
      </motion.div>
      <div className="min-w-0 flex-1">
        <div className="text-lg sm:text-xl font-black leading-tight">{value}</div>
        <div className="text-xs font-medium leading-tight break-words">{label}</div>
        {sub && <div className="text-[11px] mt-0.5 break-words" style={{ color: 'var(--text-secondary)' }}>{sub}</div>}
      </div>
    </motion.div>
  );

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <motion.div
      className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-5"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >

      {/* Counter not initialized banner */}
      <AnimatePresence>
        {!counters.igpInitialized && (
          <motion.div
            className="rounded-xl p-4 flex items-center justify-between"
            style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)' }}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{   opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <div>
                <div className="text-sm font-semibold text-yellow-400">Document counters not initialized</div>
                <div className="text-xs text-yellow-400/70">Set your starting IGP and OGP numbers to begin</div>
              </div>
            </div>
            <motion.button
              onClick={openCounterModal}
              className="px-4 py-2 rounded-lg text-sm font-semibold"
              style={{ background: 'rgba(234,179,8,0.15)', color: '#facc15', border: '1px solid rgba(234,179,8,0.3)' }}
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            >
              <Settings2 className="w-4 h-4 inline mr-1" /> Initialize
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Counter initialized status bar */}
      <AnimatePresence>
        {counters.igpInitialized && (
          <motion.div
            className="rounded-xl px-4 py-2.5 flex items-center justify-between"
            style={{ background: 'rgba(43,184,232,0.05)', border: '1px solid var(--border-default)' }}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
          >
            <div className="flex gap-4 sm:gap-6 text-xs sm:text-sm flex-wrap">
              <span style={{ color: 'var(--text-secondary)' }}>
                Next IGP: <span className="font-mono font-bold">{peekNextIGP ? peekNextIGP() : `IGP-${String(counters.igpSeq+1).padStart(4,'0')}`}</span>
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>
                Next OGP: <span className="font-mono font-bold">{peekNextOGP ? peekNextOGP() : `OGP-${String(counters.ogpSeq+1).padStart(4,'0')}`}</span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              {isAdmin && (
                <motion.button onClick={openCounterModal} className="text-xs" style={{ color: 'var(--text-secondary)' }}
                  whileHover={{ color: 'var(--primary)' }} whileTap={{ scale: 0.94 }}>
                  <Settings2 className="w-4 h-4 inline mr-1" /> Counters
                </motion.button>
              )}
              {isAdmin && (
                <motion.button onClick={openClearDataModal} className="text-xs font-medium" style={{ color: '#ef4444' }}
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.94 }}>
                  <Trash2 className="w-4 h-4 inline mr-1" /> Clear All Data
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Row 1: Main stat cards ── */}
      <motion.div
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
        variants={cardGrid} initial="hidden" animate="visible"
      >
        <StatCard label="Active Pallets"  value={stats.totalActive}  icon={Package}      color="#2BB8E8" sub={`${stats.totalCartons.toLocaleString()} units`} />
        <StatCard label="Total Weight"    value={`${(Number(stats.totalWeight)/1000).toFixed(1)}t`} icon={BarChart3} color="#2BB8E8" sub={`${Number(stats.totalWeight).toLocaleString()} kg`} />
        <StatCard label="Stock IN Today"  value={stats.todayIn}      icon={TrendingDown}  color="#4ade80" sub="units received"   onClick={() => onNavigate('stock-in')} />
        <StatCard label="Stock OUT Today" value={stats.todayOut}     icon={TrendingUp}    color="#f97316" sub="units dispatched" onClick={() => onNavigate('stock-out')} />
      </motion.div>

      {/* ── Row 2: Expiry alert cards ── */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        variants={cardGrid} initial="hidden" animate="visible"
      >
        <StatCard label="Expired Stock"   value={stats.expired} icon={AlertTriangle} color="#ef4444" sub="needs removal"   onClick={() => onNavigate('expiry-alerts')} />
        <StatCard label="Expiring in 7d"  value={stats.exp7}    icon={Clock}         color="#f97316" sub="urgent action"   onClick={() => onNavigate('expiry-alerts')} />
        <StatCard label="Expiring in 30d" value={stats.exp30}   icon={AlertTriangle} color="#eab308" sub="monitor closely" onClick={() => onNavigate('expiry-alerts')} />
      </motion.div>

      {/* ── Chart + Room Temps ── */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-3 gap-4"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* 7-day chart */}
        <div className="col-span-1 lg:col-span-2 rounded-xl p-4"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">7-Day Activity (Units)</h3>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#4ade80' }} /> IN</span>
              <span className="flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#f97316' }} /> OUT</span>
            </div>
          </div>
          <div className="flex items-end gap-2 h-36">
            {chartData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex gap-0.5 items-end" style={{ height: '100px' }}>
                  {/* Animated IN bar */}
                  <motion.div
                    className="flex-1 rounded-sm"
                    title={`IN: ${d.inQty}`}
                    style={{ background: '#4ade80', minHeight: d.inQty > 0 ? '2px' : '0' }}
                    initial={{ height: 0 }}
                    animate={{ height: `${(d.inQty / maxChart) * 100}%` }}
                    transition={{ duration: 0.6, delay: 0.35 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                  />
                  {/* Animated OUT bar */}
                  <motion.div
                    className="flex-1 rounded-sm"
                    title={`OUT: ${d.outQty}`}
                    style={{ background: '#f97316', minHeight: d.outQty > 0 ? '2px' : '0' }}
                    initial={{ height: 0 }}
                    animate={{ height: `${(d.outQty / maxChart) * 100}%` }}
                    transition={{ duration: 0.6, delay: 0.4 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
                <div className="text-[10px] text-center" style={{ color: 'var(--text-secondary)' }}>{d.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Room temperatures */}
        <div className="rounded-xl p-4"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Thermometer className="w-4 h-4" style={{ color: 'var(--primary)' }} /> Room Temps
          </h3>
          <div className="space-y-2.5">
            {rooms.map(room => {
              const temp = latestTemp(room.name);
              const isOk = temp !== null && temp <= -18;
              return (
                <div key={room.id}>
                  <div className="flex justify-between items-center text-xs mb-0.5">
                    <span className="font-medium">{room.name}</span>
                    {room.isAnteRoom ? (
                      <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(245,158,11,0.12)', color: '#D97706' }}>
                        Floor Only
                      </span>
                    ) : (
                      <span className="font-mono font-bold" style={{ color: isOk ? '#4ade80' : '#ef4444' }}>
                        {temp !== null ? `${Number(temp).toFixed(1)}C` : 'N/A'}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>
                    {room.currentPallets} pallet{room.currentPallets !== 1 ? 's' : ''}{room.isAnteRoom ? ' on floor' : ' active'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* ── Temperature deviation alerts ── */}
      <AnimatePresence>
        {tempAlerts.length > 0 && (
          <motion.div
            className="rounded-xl p-4"
            style={{ background: 'var(--bg-card)', border: '1px solid rgba(239,68,68,0.25)' }}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{   opacity: 0, y: 14 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#ef4444' }}>
              <Bell className="w-4 h-4" /> Temperature Deviation Alerts
              <span className="ml-auto text-xs font-normal px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                {tempAlerts.length} room{tempAlerts.length !== 1 ? 's' : ''}
              </span>
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {tempAlerts.map((a, i) => (
                <motion.div
                  key={i}
                  className="flex items-start gap-2 p-2.5 rounded-lg text-xs"
                  style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.06, duration: 0.3 }}
                >
                  <Thermometer className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                  <div>
                    <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{a.room}</div>
                    <div style={{ color: '#ef4444' }}>Actual: <b>{a.latest}°C</b></div>
                    <div style={{ color: 'var(--text-secondary)' }}>Target: {a.target}°C</div>
                    <div className="font-bold mt-0.5" style={{ color: '#ef4444' }}>Δ {Number(a.delta).toFixed(1)}°C off</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Document / contract expiry alerts ── */}
      <AnimatePresence>
        {stats.docAlerts.length > 0 && (
          <motion.div
            className="rounded-xl p-4"
            style={{ background: 'var(--bg-card)', border: '1px solid rgba(234,179,8,0.2)' }}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{   opacity: 0, y: 14 }}
            transition={{ duration: 0.35, delay: 0.05 }}
          >
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#facc15' }}>
              <AlertTriangle className="w-4 h-4" /> Document / License / Contract Expiry Alerts
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {stats.docAlerts.map((a, i) => (
                <motion.div
                  key={i}
                  className="flex items-center gap-2 p-2 rounded-lg text-xs"
                  style={{
                    background: a.urgent ? 'rgba(239,68,68,0.08)' : 'rgba(234,179,8,0.06)',
                    border: `1px solid ${a.urgent ? 'rgba(239,68,68,0.2)' : 'rgba(234,179,8,0.15)'}`,
                  }}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.28 }}
                >
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: a.urgent ? '#ef4444' : '#eab308' }} />
                  <div>
                    <div className="font-medium">{a.label}</div>
                    <div style={{ color: a.urgent ? '#f87171' : '#ca8a04' }}>Expires: {a.expiry}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Recent Transactions ── */}
      <motion.div
        className="rounded-xl p-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.38 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Recent Transactions</h3>
          <motion.button
            onClick={() => onNavigate('history')}
            className="text-xs"
            style={{ color: 'var(--primary)' }}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.94 }}
          >
            View All
          </motion.button>
        </div>
        <div className="space-y-1">
          {movements.slice(0, 8).map((m, i) => (
            <motion.div
              key={m.id}
              className="flex items-center gap-2 py-1.5 px-2 rounded-lg text-xs"
              style={{ cursor: 'default' }}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.04, duration: 0.28 }}
              whileHover={{ background: 'rgba(255,255,255,0.04)' }}
            >
              <span className="px-1.5 py-0.5 rounded font-bold text-[10px] flex-shrink-0"
                style={{
                  background: m.type === 'IN' ? 'rgba(74,222,128,0.15)' : m.type === 'OUT' ? 'rgba(249,115,22,0.15)' : 'rgba(43,184,232,0.15)',
                  color:      m.type === 'IN' ? '#4ade80'               : m.type === 'OUT' ? '#f97316'               : 'var(--primary)',
                }}>
                {m.type}
              </span>
              <span className="font-mono hidden sm:inline flex-shrink-0">{m.docNumber}</span>
              <span className="truncate flex-1" style={{ color: 'var(--text-secondary)' }}>{m.customerName}</span>
              <span className="truncate hidden md:inline flex-1">{m.productName}</span>
              <span className="ml-auto font-medium flex-shrink-0" style={{ color: m.type === 'IN' ? '#4ade80' : '#f97316' }}>
                {m.type === 'OUT' ? '-' : '+'}{m.cartons}
              </span>
              <span className="flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>
                {new Date(m.createdAt||m.date||"").toLocaleDateString('en-PK', { day:'2-digit', month:'short' })}
              </span>
            </motion.div>
          ))}
          {movements.length === 0 && (
            <div className="text-center py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>No transactions yet</div>
          )}
        </div>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════
          MODALS — all wrapped with AnimatePresence for smooth
          enter/exit animations. Logic is 100% unchanged.
      ═══════════════════════════════════════════════════════ */}

      {/* Reset confirm modal */}
      <AnimatePresence>
        {showResetConfirm && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.55)' }}
            variants={overlayVariants} initial="hidden" animate="visible" exit="exit"
          >
            <motion.div
              className="w-full max-w-sm rounded-2xl p-6"
              style={{ background: 'var(--bg-card)', border: '1px solid rgba(239,68,68,0.3)' }}
              variants={panelVariants}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.12)' }}>
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <h2 className="text-base font-bold">Reset Document Counters?</h2>
              </div>
              <div className="flex gap-3">
                <motion.button onClick={() => setShowResetConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: 'rgba(43,184,232,0.1)', color: 'var(--primary)', border: '1px solid var(--border-default)' }}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                  Cancel
                </motion.button>
                <motion.button onClick={() => { setShowResetConfirm(false); setShowCounterModal(true); }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                  Yes, Reset
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin password modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.72)' }}
            variants={overlayVariants} initial="hidden" animate="visible" exit="exit"
          >
            <motion.div
              className="w-full max-w-sm rounded-2xl p-6"
              style={{ background: 'var(--bg-card)', border: `1px solid ${pendingAction === 'clear-data' ? 'rgba(239,68,68,0.4)' : 'rgba(239,68,68,0.3)'}` }}
              variants={panelVariants}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)' }}>
                  {pendingAction === 'clear-data'
                    ? <AlertTriangle className="w-5 h-5 text-red-400" />
                    : <Settings2   className="w-5 h-5 text-red-400" />}
                </div>
                <div>
                  <h2 className="text-base font-bold">Admin Verification</h2>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {pendingAction === 'clear-data'
                      ? 'Enter your password to confirm data deletion'
                      : 'Enter admin password to change the counter'}
                  </p>
                </div>
              </div>
              <div className="mb-1">
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Password for <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{currentUser?.name || currentUser?.username}</span>
                </label>
                <input
                  type="password" value={adminPassword}
                  onChange={e => { setAdminPassword(e.target.value); setPasswordError(''); }}
                  onKeyDown={e => e.key === 'Enter' && !isVerifying && verifyPasswordAndOpen()}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ background: 'var(--bg-page)', border: passwordError ? '1px solid #ef4444' : '1px solid var(--border-default)' }}
                  placeholder="Enter password" autoFocus
                />
                <AnimatePresence mode="wait">
                  {passwordError && (
                    <motion.p className="text-xs mt-1 text-red-400"
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                      {passwordError}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
              {pendingAction === 'clear-data' && (
                <div className="mt-2 mb-3 rounded-lg p-3 text-xs"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                  <p className="font-semibold text-red-400 mb-1">The following will be permanently deleted:</p>
                  <ul className="space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
                    <li>• All pallets &amp; stock movements</li>
                    <li>• All customers, products, drivers, vehicles</li>
                    <li>• All temperature readings</li>
                    <li>• Document counters (IGP/OGP)</li>
                  </ul>
                  <p className="mt-1.5 text-red-400 font-medium">Users will NOT be deleted.</p>
                </div>
              )}
              <div className="flex gap-3 mt-4">
                <motion.button
                  onClick={() => { setShowPasswordModal(false); setAdminPassword(''); setPasswordError(''); setPendingAction(null); }}
                  disabled={isVerifying}
                  className="flex-1 py-2.5 rounded-xl text-sm border"
                  style={{ borderColor: 'rgba(43,184,232,0.2)', color: 'var(--text-secondary)' }}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                  Cancel
                </motion.button>
                <motion.button
                  onClick={verifyPasswordAndOpen} disabled={isVerifying}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                  style={{
                    background: pendingAction === 'clear-data' ? '#ef4444' : 'linear-gradient(135deg, #0284C7, #0369A1)',
                    color: '#fff', opacity: isVerifying ? 0.7 : 1,
                  }}
                  whileHover={!isVerifying ? { scale: 1.02 } : {}} whileTap={!isVerifying ? { scale: 0.97 } : {}}>
                  {isVerifying
                    ? (pendingAction === 'clear-data' ? 'Deleting...' : 'Verifying...')
                    : (pendingAction === 'clear-data'
                        ? <><Trash2 className="w-4 h-4 inline mr-1" /> Yes, Delete All Data</>
                        : 'Verify & Open')}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Counter initialisation modal */}
      <AnimatePresence>
        {showCounterModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.72)' }}
            variants={overlayVariants} initial="hidden" animate="visible" exit="exit"
          >
            <motion.div
              className="w-full max-w-md rounded-2xl p-6"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}
              variants={panelVariants}
            >
              <h2 className="text-lg font-bold mb-1">Initialize Document Counters</h2>
              <p className="text-xs mb-5" style={{ color: 'var(--text-secondary)' }}>
                Enter your last used IGP and OGP numbers. System will continue from next number automatically.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Last IGP Number Used</label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Last IGP No:</span>
                    <input type="number" min="0" value={igpStart}
                      onChange={e => { setIgpStart(e.target.value); setCounterError(''); }}
                      className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ background: 'var(--bg-page)', border: '1px solid var(--border-default)' }}
                      placeholder="e.g. 2847" />
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Next IGP will be: {(parseInt(igpStart)||0) + 1}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Last OGP Number Used</label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Last OGP No:</span>
                    <input type="number" min="0" value={ogpStart}
                      onChange={e => { setOgpStart(e.target.value); setCounterError(''); }}
                      className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ background: 'var(--bg-page)', border: '1px solid var(--border-default)' }}
                      placeholder="e.g. 1923" />
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Next OGP will be: {(parseInt(ogpStart)||0) + 1}</p>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <motion.button onClick={() => setShowCounterModal(false)} disabled={isSavingCounters}
                  className="flex-1 py-2.5 rounded-xl text-sm border"
                  style={{ borderColor: 'rgba(43,184,232,0.2)', color: 'var(--text-secondary)' }}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                  Cancel
                </motion.button>
                <motion.button onClick={handleInitCounters} disabled={isSavingCounters}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: 'linear-gradient(135deg, #0284C7, #0369A1)', color: '#fff', opacity: isSavingCounters ? 0.7 : 1 }}
                  whileHover={!isSavingCounters ? { scale: 1.02 } : {}} whileTap={!isSavingCounters ? { scale: 0.97 } : {}}>
                  <CheckCircle className="w-4 h-4 inline mr-1" /> {isSavingCounters ? 'Saving...' : 'Save & Activate'}
                </motion.button>
              </div>
              <AnimatePresence mode="wait">
                {counterError && (
                  <motion.p className="text-xs mt-3 text-red-400"
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    {counterError}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
