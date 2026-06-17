import { useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { verifyPassword } from '@/lib/crypto';
import {
  Package, TrendingDown, TrendingUp, AlertTriangle,
  CheckCircle, Settings2, BarChart3, Thermometer, Clock, Bell
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
  onInitCounters: (igpStart: number, ogpStart: number) => void;
  onResetAllData: () => void;
  onNavigate: (page: PageView) => void;
}

export default function DashboardPage({
  pallets, movements, rooms, temperatures, customers, drivers, vehicles, counters,
  peekNextIGP, peekNextOGP,
  onInitCounters, onResetAllData, onNavigate
}: DashboardPageProps) {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin';
  const [showCounterModal,     setShowCounterModal]     = useState(false);
  const [showResetConfirm,     setShowResetConfirm]     = useState(false);
  const [showPasswordModal,    setShowPasswordModal]    = useState(false);
  const [pendingAction,        setPendingAction]        = useState<'counters' | 'clear-data' | null>(null);
  const [adminPassword,        setAdminPassword]        = useState('');
  const [passwordError,        setPasswordError]        = useState('');
  const [igpStart, setIgpStart] = useState('');
  const [ogpStart, setOgpStart] = useState('');

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
      todayIn: todayIn.reduce((s, m) => s + Number(m.cartons), 0),
      todayOut: todayOut.reduce((s, m) => s + Number(m.cartons), 0),
      docAlerts: docAlerts.sort((a, b) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime()),
    };
  }, [pallets, movements, vehicles, drivers, customers]);

  const chartData = useMemo(() => {
    const now = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString('en-PK', { weekday: 'short', day: 'numeric' });
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

  const requirePassword = (action: 'counters' | 'clear-data') => {
    if (!isAdmin) return;
    setAdminPassword('');
    setPasswordError('');
    setPendingAction(action);
    setShowPasswordModal(true);
  };

  const openCounterModal  = () => requirePassword('counters');
  const openClearDataModal = () => requirePassword('clear-data');

  const verifyPasswordAndOpen = useCallback(async () => {
    if (!currentUser?.password) return;
    const ok = await verifyPassword(adminPassword, currentUser.password);
    if (ok) {
      setShowPasswordModal(false);
      setAdminPassword('');
      setPasswordError('');
      if (pendingAction === 'counters')   setShowCounterModal(true);
      if (pendingAction === 'clear-data') { onResetAllData(); }
      setPendingAction(null);
    } else {
      setPasswordError('Incorrect password. Please try again.');
    }
  }, [adminPassword, currentUser, pendingAction, onResetAllData]);

  const handleInitCounters = () => {
    const i = parseInt(igpStart);
    const o = parseInt(ogpStart);
    if (isNaN(i) || i < 0 || isNaN(o) || o < 0) return;
    onInitCounters(i, o);
    setShowCounterModal(false);
    setIgpStart(''); setOgpStart('');
  };

  const StatCard = ({ label, value, sub, icon: Icon, color, onClick }: any) => (
    <div onClick={onClick} className={`rounded-xl p-3 sm:p-4 flex items-start gap-2 sm:gap-3 ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''} transition-transform`}
      style={{ background: 'var(--bg-card)', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      <div className="p-1.5 sm:p-2 rounded-lg flex-shrink-0" style={{ background: `${color}18` }}>
        <Icon className="w-4 h-4 sm:w-5 sm:h-5" style={{ color }} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-lg sm:text-xl font-black leading-tight">{value}</div>
        <div className="text-xs font-medium leading-tight break-words">{label}</div>
        {sub && <div className="text-[11px] mt-0.5 break-words" style={{ color: 'var(--text-secondary)' }}>{sub}</div>}
      </div>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-5">

      {!counters.igpInitialized && (
        <div className="rounded-xl p-4 flex items-center justify-between"
          style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)' }}>
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            <div>
              <div className="text-sm font-semibold text-yellow-400">Document counters not initialized</div>
              <div className="text-xs text-yellow-400/70">Set your starting IGP and OGP numbers to begin</div>
            </div>
          </div>
          <button onClick={openCounterModal}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: 'rgba(234,179,8,0.15)', color: '#facc15', border: '1px solid rgba(234,179,8,0.3)' }}>
            <Settings2 className="w-4 h-4 inline mr-1" /> Initialize
          </button>
        </div>
      )}

      {counters.igpInitialized && (
        <div className="rounded-xl px-4 py-2.5 flex items-center justify-between"
          style={{ background: 'rgba(43,184,232,0.05)', border: '1px solid var(--border-default)' }}>
          <div className="flex gap-4 sm:gap-6 text-xs sm:text-sm flex-wrap">
            <span style={{ color: 'var(--text-secondary)' }}>Next IGP: <span className="font-mono font-bold">{peekNextIGP ? peekNextIGP() : `IGP-${String(counters.igpSeq+1).padStart(4,'0')}`}</span></span>
            <span style={{ color: 'var(--text-secondary)' }}>Next OGP: <span className="font-mono font-bold">{peekNextOGP ? peekNextOGP() : `OGP-${String(counters.ogpSeq+1).padStart(4,'0')}`}</span></span>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && <button onClick={openCounterModal} className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              <Settings2 className="w-4 h-4 inline mr-1" /> Counters
            </button>}
            {isAdmin && <button onClick={openClearDataModal} className="text-xs font-medium"
              style={{ color: '#ef4444' }}>
              🗑 Clear All Data
            </button>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Active Pallets"  value={stats.totalActive}  icon={Package}     color="#2BB8E8" sub={`${stats.totalCartons.toLocaleString()} units`} />
        <StatCard label="Total Weight"    value={`${(Number(stats.totalWeight)/1000).toFixed(1)}t`} icon={BarChart3}  color="#2BB8E8" sub={`${Number(stats.totalWeight).toLocaleString()} kg`} />
        <StatCard label="Stock IN Today"  value={stats.todayIn}      icon={TrendingDown} color="#4ade80" sub="units received"    onClick={() => onNavigate('stock-in')} />
        <StatCard label="Stock OUT Today" value={stats.todayOut}     icon={TrendingUp}   color="#f97316" sub="units dispatched"  onClick={() => onNavigate('stock-out')} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label="Expired Stock"    value={stats.expired}  icon={AlertTriangle} color="#ef4444" sub="needs removal"   onClick={() => onNavigate('expiry-alerts')} />
        <StatCard label="Expiring in 7d"   value={stats.exp7}     icon={Clock}         color="#f97316" sub="urgent action"   onClick={() => onNavigate('expiry-alerts')} />
        <StatCard label="Expiring in 30d"  value={stats.exp30}    icon={AlertTriangle} color="#eab308" sub="monitor closely" onClick={() => onNavigate('expiry-alerts')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="col-span-1 lg:col-span-2 rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold ">7-Day Activity (Units)</h3>
            <div className="flex gap-3 text-xs">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#4ade80' }} /> IN</span>
              <span className="flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}><span className="w-2 h-2 rounded-full inline-block" style={{ background: '#f97316' }} /> OUT</span>
            </div>
          </div>
          <div className="flex items-end gap-2 h-36">
            {chartData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex gap-0.5 items-end" style={{ height: '100px' }}>
                  <div className="flex-1 rounded-sm transition-all" title={`IN: ${d.inQty}`}
                    style={{ height: `${(d.inQty / maxChart) * 100}%`, background: '#4ade80', minHeight: d.inQty > 0 ? '2px' : '0' }} />
                  <div className="flex-1 rounded-sm transition-all" title={`OUT: ${d.outQty}`}
                    style={{ height: `${(d.outQty / maxChart) * 100}%`, background: '#f97316', minHeight: d.outQty > 0 ? '2px' : '0' }} />
                </div>
                <div className="text-[10px] text-center" style={{ color: 'var(--text-secondary)' }}>{d.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <h3 className="text-sm font-semibold  mb-3 flex items-center gap-2">
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
                      <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.12)', color: '#D97706' }}>
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
      </div>

      {tempAlerts.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#ef4444' }}>
            <Bell className="w-4 h-4" /> Temperature Deviation Alerts
            <span className="ml-auto text-xs font-normal px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
              {tempAlerts.length} room{tempAlerts.length !== 1 ? 's' : ''}
            </span>
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {tempAlerts.map((a, i) => (
              <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg text-xs"
                style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}>
                <Thermometer className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                <div>
                  <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{a.room}</div>
                  <div style={{ color: '#ef4444' }}>Actual: <b>{a.latest}°C</b></div>
                  <div style={{ color: 'var(--text-secondary)' }}>Target: {a.target}°C</div>
                  <div className="font-bold mt-0.5" style={{ color: '#ef4444' }}>Δ {Number(a.delta).toFixed(1)}°C off</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.docAlerts.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid rgba(234,179,8,0.2)' }}>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#facc15' }}>
            <AlertTriangle className="w-4 h-4" /> Document / License / Contract Expiry Alerts
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {stats.docAlerts.map((a, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg text-xs"
                style={{ background: a.urgent ? 'rgba(239,68,68,0.08)' : 'rgba(234,179,8,0.06)', border: `1px solid ${a.urgent ? 'rgba(239,68,68,0.2)' : 'rgba(234,179,8,0.15)'}` }}>
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: a.urgent ? '#ef4444' : '#eab308' }} />
                <div>
                  <div className="font-medium ">{a.label}</div>
                  <div style={{ color: a.urgent ? '#f87171' : '#ca8a04' }}>Expires: {a.expiry}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold ">Recent Transactions</h3>
          <button onClick={() => onNavigate('history')} className="text-xs" style={{ color: 'var(--primary)' }}>View All</button>
        </div>
        <div className="space-y-1">
          {movements.slice(0, 8).map(m => (
            <div key={m.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg text-xs hover:bg-white/5 transition-colors">
              <span className="px-1.5 py-0.5 rounded font-bold text-[10px] flex-shrink-0"
                style={{ background: m.type === 'IN' ? 'rgba(74,222,128,0.15)' : m.type === 'OUT' ? 'rgba(249,115,22,0.15)' : 'rgba(43,184,232,0.15)',
                  color: m.type === 'IN' ? '#4ade80' : m.type === 'OUT' ? '#f97316' : 'var(--primary)' }}>
                {m.type}
              </span>
              <span className="font-mono hidden sm:inline flex-shrink-0">{m.docNumber}</span>
              <span className="truncate flex-1" style={{ color: 'var(--text-secondary)' }}>{m.customerName}</span>
              <span className="truncate hidden md:inline flex-1">{m.productName}</span>
              <span className="ml-auto font-medium flex-shrink-0" style={{ color: m.type === 'IN' ? '#4ade80' : '#f97316' }}>
                {m.type === 'OUT' ? '-' : '+'}{m.cartons}
              </span>
              <span className="flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>{new Date(m.createdAt||m.date||"").toLocaleDateString('en-PK', { day:'2-digit', month:'short' })}</span>
            </div>
          ))}
          {movements.length === 0 && (
            <div className="text-center py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>No transactions yet</div>
          )}
        </div>
      </div>

      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.12)' }}>
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <h2 className="text-base font-bold ">Reset Document Counters?</h2>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(43,184,232,0.1)', color: 'var(--primary)', border: '1px solid var(--border-default)' }}>
                Cancel
              </button>
              <button onClick={() => { setShowResetConfirm(false); setShowCounterModal(true); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
                Yes, Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: `1px solid ${pendingAction === 'clear-data' ? 'rgba(239,68,68,0.4)' : 'rgba(239,68,68,0.3)'}` }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)' }}>
                {pendingAction === 'clear-data'
                  ? <AlertTriangle className="w-5 h-5 text-red-400" />
                  : <Settings2 className="w-5 h-5 text-red-400" />}
              </div>
              <div>
                <h2 className="text-base font-bold">Admin Verification</h2>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {pendingAction === 'clear-data'
                    ? `Enter your password to confirm data deletion`
                    : `Enter admin password to change the counter`}
                </p>
              </div>
            </div>
            <div className="mb-1">
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                Password for <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{currentUser?.name || currentUser?.username}</span>
              </label>
              <input
                type="password"
                value={adminPassword}
                onChange={e => { setAdminPassword(e.target.value); setPasswordError(''); }}
                onKeyDown={e => e.key === 'Enter' && verifyPasswordAndOpen()}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: 'var(--bg-page)', border: passwordError ? '1px solid #ef4444' : '1px solid var(--border-default)' }}
                placeholder="Enter password"
                autoFocus
              />
              {passwordError && <p className="text-xs mt-1 text-red-400">{passwordError}</p>}
            </div>
            {pendingAction === 'clear-data' && (
              <div className="mt-2 mb-3 rounded-lg p-3 text-xs" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
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
              <button onClick={() => { setShowPasswordModal(false); setAdminPassword(''); setPasswordError(''); setPendingAction(null); }}
                className="flex-1 py-2.5 rounded-xl text-sm border"
                style={{ borderColor: 'rgba(43,184,232,0.2)', color: 'var(--text-secondary)' }}>
                Cancel
              </button>
              <button onClick={verifyPasswordAndOpen}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: pendingAction === 'clear-data' ? '#ef4444' : 'linear-gradient(135deg, #0284C7, #0369A1)', color: '#fff' }}>
                {pendingAction === 'clear-data' ? '🗑 Yes, Delete All Data' : 'Verify & Open'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCounterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <h2 className="text-lg font-bold  mb-1">Initialize Document Counters</h2>
            <p className="text-xs mb-5" style={{ color: 'var(--text-secondary)' }}>
              Enter your last used IGP and OGP numbers. System will continue from next number automatically.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Last IGP Number Used</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Last IGP No:</span>
                  <input type="number" min="0" value={igpStart} onChange={e => setIgpStart(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg  text-sm outline-none"
                    style={{ background: 'var(--bg-page)', border: '1px solid var(--border-default)' }}
                    placeholder="e.g. 2847" />
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Next IGP will be: {(parseInt(igpStart)||0) + 1}</p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Last OGP Number Used</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Last OGP No:</span>
                  <input type="number" min="0" value={ogpStart} onChange={e => setOgpStart(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg  text-sm outline-none"
                    style={{ background: 'var(--bg-page)', border: '1px solid var(--border-default)' }}
                    placeholder="e.g. 1923" />
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Next OGP will be: {(parseInt(ogpStart)||0) + 1}</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCounterModal(false)}
                className="flex-1 py-2.5 rounded-xl text-sm border"
                style={{ borderColor: 'rgba(43,184,232,0.2)', color: 'var(--text-secondary)' }}>
                Cancel
              </button>
              <button onClick={handleInitCounters}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: 'linear-gradient(135deg, #0284C7, #0369A1)', color: 'var(--bg-card)' }}>
                <CheckCircle className="w-4 h-4 inline mr-1" /> Save & Activate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
