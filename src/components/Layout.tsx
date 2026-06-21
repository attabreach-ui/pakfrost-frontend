import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, ArrowDownLeft, ArrowUpRight, Grid3X3, RefreshCw,
  Tag, Thermometer, AlertTriangle, BarChart3, Database,
  LogOut, ChevronLeft, ChevronRight, History, ShieldCheck,
  Download, Menu, X, Sun, Moon, Clock,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import type { PageView, UserPermissions } from '@/types';

interface NavItem { key: PageView; label: string; icon: React.ElementType; permKey?: keyof UserPermissions }

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard',     label: 'Dashboard',     icon: LayoutDashboard },
  { key: 'stock-in',      label: 'Stock IN',      icon: ArrowDownLeft,  permKey: 'stockIn'      },
  { key: 'stock-out',     label: 'Stock OUT',     icon: ArrowUpRight,   permKey: 'stockOut'     },
  { key: 'history',       label: 'History',       icon: History,        permKey: 'history'      },
  { key: 'location-map',  label: 'Location Map',  icon: Grid3X3,        permKey: 'locationMap'  },
  { key: 'pallet-tags',   label: 'Pallet Tags',   icon: Tag,            permKey: 'palletTags'   },
  { key: 'temperature',   label: 'Temperature',   icon: Thermometer,    permKey: 'temperature'  },
  { key: 'expiry-alerts', label: 'Expiry Alerts', icon: AlertTriangle,  permKey: 'expiryAlerts' },
  { key: 'reports',       label: 'Reports',       icon: BarChart3,      permKey: 'reports'      },
  { key: 'master-data',   label: 'Master Data',   icon: Database,       permKey: 'masterData'   },
  { key: 'user-access',   label: 'User Access',   icon: ShieldCheck,    permKey: 'userAccess'   },
];

interface LayoutProps {
  currentPage: PageView;
  onNavigate: (page: PageView) => void;
  permissions: UserPermissions;
  onBackup: () => void;
  children: React.ReactNode;
  isRefreshing?: boolean;
  lastSync?: Date | null;
  onManualRefresh?: () => void;
  syncError?: string | null;
}

export default function Layout({
  currentPage, onNavigate, permissions, onBackup,
  children, isRefreshing, lastSync, onManualRefresh, syncError,
}: LayoutProps) {
  const { currentUser, logout, sessionWarning, extendSession } = useAuth();
  const { isDark, toggle: toggleTheme } = useTheme();

  const [isMobile,          setIsMobile]          = useState(() => window.innerWidth < 640);
  const [desktopCollapsed,  setDesktopCollapsed]  = useState(false);
  const [mobileOpen,        setMobileOpen]        = useState(false);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 640;
      setIsMobile(mobile);
      if (!mobile) setMobileOpen(false);
    };
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const visibleItems = NAV_ITEMS.filter(i => !i.permKey || permissions[i.permKey]);
  const collapsed    = isMobile ? false : desktopCollapsed;

  function navigate(page: PageView) {
    onNavigate(page);
    if (isMobile) setMobileOpen(false);
  }

  // ── Sidebar content (shared between desktop & mobile drawer) ──────────────
  const SidebarContent = () => (
    <>
      {/* Logo row */}
      <div
        className="flex items-center gap-3 px-3 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border-default)', minHeight: '64px' }}
      >
        <div className="flex-shrink-0 flex items-center justify-center" style={{ minWidth: 40 }}>
          <img src="/logo.png" alt="PAKFROST" style={{ width: 40, height: 40, objectFit: 'contain' }} />
        </div>

        {!collapsed && (
          <div className="overflow-hidden flex-1">
            <div className="font-black tracking-widest whitespace-nowrap leading-tight"
              style={{ fontSize: '13px', letterSpacing: '0.18em', color: 'var(--text-primary)' }}>
              PAK FROST
            </div>
            <div className="whitespace-nowrap font-semibold"
              style={{ fontSize: '9px', color: 'var(--primary)', letterSpacing: '0.12em' }}>
              (PVT) LIMITED
            </div>
            <div className="whitespace-nowrap"
              style={{ fontSize: '8px', color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
              Cold Storage WMS
            </div>
          </div>
        )}

        {/* Theme toggle – desktop expanded */}
        {!collapsed && !isMobile && (
          <motion.button
            onClick={toggleTheme}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
            style={{
              background: isDark ? 'rgba(56,189,248,0.15)' : 'rgba(2,132,199,0.10)',
              border: `1px solid ${isDark ? 'rgba(56,189,248,0.3)' : 'rgba(2,132,199,0.2)'}`,
              color: isDark ? '#38BDF8' : '#0284C7',
            }}
            whileHover={{ scale: 1.12 }}
            whileTap={{ scale: 0.92, rotate: 15 }}
            transition={{ type: 'spring', stiffness: 400, damping: 18 }}
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </motion.button>
        )}

        {/* Close – mobile drawer only */}
        {isMobile && (
          <motion.button
            onClick={() => setMobileOpen(false)}
            className="ml-auto p-1.5 rounded-lg"
            style={{ color: 'var(--text-muted)' }}
            whileTap={{ scale: 0.9 }}
          >
            <X className="w-4 h-4" />
          </motion.button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 overflow-y-auto" style={{ overflowX: 'hidden' }}>
        {visibleItems.map(item => {
          const isActive = currentPage === item.key;
          const Icon     = item.icon;
          return (
            <motion.button
              key={item.key}
              onClick={() => navigate(item.key)}
              className="w-full flex items-center gap-3 text-sm font-medium relative group"
              style={{
                padding:        collapsed ? '10px 0' : '10px 14px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                color:          isActive ? 'var(--bg-card)' : 'var(--text-secondary)',
                borderRadius:   collapsed ? '0' : '0 8px 8px 0',
                margin:         collapsed ? '1px 0' : '1px 8px 1px 0',
                position: 'relative',
                overflow: 'hidden',
              }}
              whileHover={!isActive ? { x: collapsed ? 0 : 3 } : {}}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              {/* Sliding active background (layoutId makes it animate between items) */}
              {isActive && (
                <motion.div
                  layoutId="nav-active-bg"
                  className="absolute inset-0"
                  style={{
                    background: 'var(--primary)',
                    borderRadius: collapsed ? '0' : '0 8px 8px 0',
                    zIndex: 0,
                  }}
                  transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                />
              )}

              {/* Hover highlight (only when not active) */}
              {!isActive && (
                <motion.div
                  className="absolute inset-0"
                  style={{
                    background: 'var(--primary-light)',
                    borderRadius: collapsed ? '0' : '0 8px 8px 0',
                    zIndex: 0,
                    opacity: 0,
                  }}
                  whileHover={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                />
              )}

              <Icon
                className="w-4 h-4 flex-shrink-0 relative"
                style={{
                  zIndex: 1,
                  color: isActive ? 'var(--bg-card)' : undefined,
                }}
              />
              {!collapsed && (
                <span
                  className="whitespace-nowrap text-xs font-semibold tracking-wide relative"
                  style={{ zIndex: 1, color: isActive ? 'var(--bg-card)' : undefined }}
                >
                  {item.label}
                </span>
              )}

              {/* Desktop collapsed tooltip */}
              {collapsed && (
                <div
                  className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg text-xs z-50 whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity font-semibold"
                  style={{ background: 'var(--text-primary)', color: 'var(--bg-card)', boxShadow: 'var(--shadow-card)' }}
                >
                  {item.label}
                </div>
              )}
            </motion.button>
          );
        })}
      </nav>

      {/* Divider */}
      <div style={{ height: '1px', background: 'var(--border-default)', margin: '0 12px' }} />

      {/* User + action buttons */}
      <div className="p-3 flex-shrink-0">
        <div className="flex items-center gap-2.5" style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}>
          {/* Avatar */}
          <motion.div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
            style={{ background: 'linear-gradient(135deg,#0284C7,#38BDF8)', color: 'white', minWidth: 32 }}
            whileHover={{ scale: 1.08 }}
            transition={{ type: 'spring', stiffness: 400, damping: 18 }}
          >
            {currentUser?.name?.[0]?.toUpperCase() || 'U'}
          </motion.div>

          {!collapsed && (
            <>
              <div className="flex-1 min-w-0 overflow-hidden">
                <div className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{currentUser?.name}</div>
                <div className="capitalize font-medium" style={{ fontSize: '9px', color: 'var(--primary)', letterSpacing: '0.08em' }}>{currentUser?.role}</div>
              </div>
              <div className="flex gap-1">
                {/* Sync */}
                <motion.button
                  onClick={onManualRefresh}
                  title={lastSync ? `Last sync: ${lastSync.toLocaleTimeString('en-PK',{hour:'2-digit',minute:'2-digit'})}` : 'Sync data'}
                  className="p-1.5 rounded-lg"
                  style={{ color: isRefreshing ? '#4ade80' : 'var(--text-muted)' }}
                  whileHover={{ color: '#4ade80', background: 'rgba(74,222,128,0.08)' }}
                  whileTap={{ scale: 0.9 }}
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </motion.button>
                {/* Backup */}
                <motion.button
                  onClick={onBackup} title="Backup"
                  className="p-1.5 rounded-lg"
                  style={{ color: 'var(--text-muted)' }}
                  whileHover={{ color: '#4ade80', background: 'rgba(74,222,128,0.08)' }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Download className="w-4 h-4" />
                </motion.button>
                {/* Logout */}
                <motion.button
                  onClick={logout} title="Logout"
                  className="p-1.5 rounded-lg"
                  style={{ color: 'var(--text-muted)' }}
                  whileHover={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)' }}
                  whileTap={{ scale: 0.9 }}
                >
                  <LogOut className="w-4 h-4" />
                </motion.button>
              </div>
            </>
          )}
        </div>

        {/* Collapsed-mode action buttons (vertical stack) */}
        {collapsed && (
          <div className="flex flex-col gap-1 mt-2">
            <motion.button onClick={onManualRefresh} title="Sync" className="w-full flex items-center justify-center p-1.5 rounded-lg" style={{ color: isRefreshing ? '#4ade80' : 'var(--text-muted)' }} whileHover={{ color: '#4ade80', background: 'rgba(74,222,128,0.08)' }} whileTap={{ scale: 0.9 }}>
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </motion.button>
            <motion.button onClick={onBackup} title="Backup" className="w-full flex items-center justify-center p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }} whileHover={{ color: '#4ade80', background: 'rgba(74,222,128,0.08)' }} whileTap={{ scale: 0.9 }}>
              <Download className="w-4 h-4" />
            </motion.button>
            <motion.button onClick={logout} title="Logout" className="w-full flex items-center justify-center p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }} whileHover={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)' }} whileTap={{ scale: 0.9 }}>
              <LogOut className="w-4 h-4" />
            </motion.button>
          </div>
        )}
      </div>

      {/* Desktop collapse toggle button */}
      {!isMobile && (
        <motion.button
          onClick={() => setDesktopCollapsed(!desktopCollapsed)}
          className="absolute top-1/2 -right-3 w-6 h-6 rounded-full flex items-center justify-center z-10"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-secondary)',
            boxShadow: 'var(--shadow-card)',
          }}
          whileHover={{ scale: 1.15, borderColor: 'var(--primary)', color: 'var(--primary)' }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18 }}
        >
          {desktopCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </motion.button>
      )}
    </>
  );

  // ── Main render ──────────────────────────────────────────────────────────
  return (
    <>
      {/* Session timeout warning */}
      <AnimatePresence>
        {sessionWarning && (
          <motion.div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.55)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="rounded-2xl p-6 max-w-sm w-full mx-4 text-center"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
              initial={{ scale: 0.92, y: 20, opacity: 0 }}
              animate={{ scale: 1,    y: 0,  opacity: 1 }}
              exit={{   scale: 0.92, y: 20,  opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            >
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(234,88,12,0.1)' }}>
                <Clock className="w-7 h-7" style={{ color: '#ea580c' }} />
              </div>
              <h3 className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Session Expiring Soon</h3>
              <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
                You have been inactive for 25 minutes. You will be logged out in <strong>5 minutes</strong> unless you continue.
              </p>
              <div className="flex gap-3">
                <button onClick={logout}
                  className="flex-1 py-2 rounded-xl text-sm font-medium"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
                  Logout Now
                </button>
                <motion.button onClick={extendSession}
                  className="flex-1 py-2 rounded-xl text-sm font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #0284C7, #0369A1)' }}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                  Stay Signed In
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-page)' }}>

        {/* ── DESKTOP SIDEBAR — spring-animated width ── */}
        {!isMobile && (
          <motion.aside
            className="relative flex flex-col flex-shrink-0 print:hidden"
            style={{
              background:  'var(--bg-sidebar)',
              borderRight: '1px solid var(--border-default)',
              boxShadow:   'var(--shadow-sidebar)',
              overflow:    'hidden',
            }}
            animate={{ width: desktopCollapsed ? 64 : 240 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
          >
            <SidebarContent />
          </motion.aside>
        )}

        {/* ── MOBILE DRAWER — backdrop + slide-in ── */}
        {isMobile && (
          <AnimatePresence>
            {mobileOpen && (
              <>
                {/* Blurred backdrop */}
                <motion.div
                  className="fixed inset-0 z-40 print:hidden"
                  style={{ background: 'rgba(0,0,0,0.48)', backdropFilter: 'blur(2px)' }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{   opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  onClick={() => setMobileOpen(false)}
                />
                {/* Drawer panel */}
                <motion.aside
                  className="fixed top-0 left-0 h-full z-50 flex flex-col print:hidden"
                  style={{
                    width:       '260px',
                    background:  'var(--bg-sidebar)',
                    borderRight: '1px solid var(--border-default)',
                    boxShadow:   'var(--shadow-sidebar)',
                  }}
                  initial={{ x: -260 }}
                  animate={{ x: 0 }}
                  exit={{   x: -260 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                >
                  <SidebarContent />
                </motion.aside>
              </>
            )}
          </AnimatePresence>
        )}

        {/* ── MAIN CONTENT ── */}
        <main className="flex-1 flex flex-col overflow-hidden print:overflow-visible print:w-full">

          {/* Mobile top bar */}
          {isMobile && (
            <div
              className="flex items-center gap-3 px-4 py-3 flex-shrink-0 print:hidden"
              style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-default)', minHeight: '56px' }}
            >
              <motion.button
                onClick={() => setMobileOpen(true)}
                className="p-2 rounded-lg flex-shrink-0"
                style={{ color: 'var(--text-secondary)', background: 'var(--primary-light)' }}
                whileTap={{ scale: 0.9 }}
              >
                <Menu className="w-5 h-5" style={{ color: 'var(--primary)' }} />
              </motion.button>
              <img src="/logo.png" alt="logo" style={{ width: 32, height: 32, objectFit: 'contain' }} />
              <div>
                <div className="font-black leading-tight" style={{ fontSize: '12px', letterSpacing: '0.15em', color: 'var(--text-primary)' }}>PAK FROST</div>
                <div className="font-semibold" style={{ fontSize: '8px', color: 'var(--primary)', letterSpacing: '0.1em' }}>Cold Storage WMS</div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <motion.button
                  onClick={toggleTheme}
                  title={isDark ? 'Light Mode' : 'Dark Mode'}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{
                    background: isDark ? 'rgba(56,189,248,0.15)' : 'rgba(2,132,199,0.10)',
                    border: `1px solid ${isDark ? 'rgba(56,189,248,0.3)' : 'rgba(2,132,199,0.2)'}`,
                    color: isDark ? '#38BDF8' : '#0284C7',
                  }}
                  whileTap={{ scale: 0.9, rotate: 15 }}
                >
                  {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                </motion.button>
                <motion.div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                  style={{ background: 'linear-gradient(135deg,#0284C7,#38BDF8)', color: 'white' }}
                  whileHover={{ scale: 1.08 }}
                >
                  {currentUser?.name?.[0]?.toUpperCase() || 'U'}
                </motion.div>
              </div>
            </div>
          )}

          {/* Sync error banner */}
          <AnimatePresence>
            {syncError && (
              <motion.div
                className="mx-3 mt-3 sm:mx-6 sm:mt-4 rounded-lg px-3 py-2.5 text-xs sm:text-sm flex items-start gap-2"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#dc2626' }}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0  }}
                exit={{   opacity: 0, y: -8  }}
                transition={{ duration: 0.25 }}
              >
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="font-semibold">Data sync failed</div>
                  <div className="break-words">{syncError}</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {children}
        </main>
      </div>
    </>
  );
}
