import { useState, useEffect } from 'react';
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
  { key: 'dashboard',     label: 'Dashboard',    icon: LayoutDashboard },
  { key: 'stock-in',      label: 'Stock IN',     icon: ArrowDownLeft,  permKey: 'stockIn'      },
  { key: 'stock-out',     label: 'Stock OUT',    icon: ArrowUpRight,   permKey: 'stockOut'     },
  { key: 'history',       label: 'History',      icon: History,        permKey: 'history'      },
  { key: 'location-map',  label: 'Location Map', icon: Grid3X3,        permKey: 'locationMap'  },
  { key: 'pallet-tags',   label: 'Pallet Tags',  icon: Tag,            permKey: 'palletTags'   },
  { key: 'temperature',   label: 'Temperature',  icon: Thermometer,    permKey: 'temperature'  },
  { key: 'expiry-alerts', label: 'Expiry Alerts',icon: AlertTriangle,  permKey: 'expiryAlerts' },
  { key: 'reports',       label: 'Reports',      icon: BarChart3,      permKey: 'reports'      },
  { key: 'master-data',   label: 'Master Data',  icon: Database,       permKey: 'masterData'   },
  { key: 'user-access',   label: 'User Access',  icon: ShieldCheck,    permKey: 'userAccess'   },
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

export default function Layout({ currentPage, onNavigate, permissions, onBackup, children, isRefreshing, lastSync, onManualRefresh, syncError }: LayoutProps) {
  const { currentUser, logout, sessionWarning, extendSession } = useAuth();
  const { isDark, toggle: toggleTheme } = useTheme();

  // ── Responsive state ─────────────────────────────────────────────────────
  const [isMobile,       setIsMobile]       = useState(() => window.innerWidth < 640);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);   // desktop only: icon-only mode
  const [mobileOpen,     setMobileOpen]     = useState(false);        // mobile only: drawer open

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 640;
      setIsMobile(mobile);
      if (!mobile) setMobileOpen(false); // close drawer when resizing to desktop
    };
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const visibleItems = NAV_ITEMS.filter(i => !i.permKey || permissions[i.permKey]);

  // Derived: what the sidebar actually looks like right now
  
  const collapsed      = isMobile ? false : desktopCollapsed; // drawer always expanded

  function navigate(page: PageView) {
    onNavigate(page);
    if (isMobile) setMobileOpen(false); // close drawer after navigation
  }

  // ── Shared sidebar content ────────────────────────────────────────────────
  const SidebarContent = () => (
    <>
      {/* Logo row */}
      <div className="flex items-center gap-3 px-3 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border-default)', minHeight: '64px' }}>
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

        {/* ── Theme toggle — top right of sidebar ── */}
        {!collapsed && !isMobile && (
          <button
            onClick={toggleTheme}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200"
            style={{
              background: isDark ? 'rgba(56,189,248,0.15)' : 'rgba(2,132,199,0.10)',
              border: `1px solid ${isDark ? 'rgba(56,189,248,0.3)' : 'rgba(2,132,199,0.2)'}`,
              color: isDark ? '#38BDF8' : '#0284C7',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.1)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}>
            {isDark
              ? <Sun  className="w-3.5 h-3.5" />
              : <Moon className="w-3.5 h-3.5" />
            }
          </button>
        )}

        {/* Close button — mobile drawer only */}
        {isMobile && (
          <button onClick={() => setMobileOpen(false)}
            className="ml-auto p-1.5 rounded-lg"
            style={{ color: 'var(--text-muted)' }}>
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 overflow-y-auto" style={{ overflowX: 'hidden' }}>
        {visibleItems.map(item => {
          const isActive = currentPage === item.key;
          const Icon = item.icon;
          return (
            <button key={item.key} onClick={() => navigate(item.key)}
              className="w-full flex items-center gap-3 text-sm font-medium transition-all duration-150 relative group"
              style={{
                padding:       collapsed ? '10px 0' : '10px 14px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                color:          isActive ? 'var(--bg-card)' : 'var(--text-secondary)',
                background:     isActive ? 'var(--primary)' : 'transparent',
                borderRadius:   collapsed ? '0' : '0 8px 8px 0',
                margin:         collapsed ? '1px 0' : '1px 8px 1px 0',
              }}
              onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'var(--primary-light)'; (e.currentTarget as HTMLElement).style.color = 'var(--primary)'; } }}
              onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; } }}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && (
                <span className="whitespace-nowrap text-xs font-semibold tracking-wide">{item.label}</span>
              )}
              {/* Desktop collapsed tooltip */}
              {collapsed && (
                <div className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg text-xs z-50 whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity font-semibold"
                  style={{ background: 'var(--text-primary)', color: 'var(--bg-card)', boxShadow: 'var(--shadow-card)' }}>
                  {item.label}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Divider */}
      <div style={{ height: '1px', background: 'var(--border-default)', margin: '0 12px' }} />

      {/* User + action buttons */}
      <div className="p-3 flex-shrink-0">
        <div className="flex items-center gap-2.5" style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm"
            style={{ background: 'linear-gradient(135deg,#0284C7,#38BDF8)', color: 'white', minWidth: 32 }}>
            {currentUser?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0 overflow-hidden">
                <div className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{currentUser?.name}</div>
                <div className="capitalize font-medium" style={{ fontSize: '9px', color: 'var(--primary)', letterSpacing: '0.08em' }}>{currentUser?.role}</div>
              </div>
              <div className="flex gap-1">
                <button onClick={onManualRefresh} title={lastSync ? `Last sync: ${lastSync.toLocaleTimeString('en-PK',{hour:'2-digit',minute:'2-digit'})}` : 'Sync data'} className="p-1.5 rounded-lg transition-all"
                  style={{ color: isRefreshing ? '#4ade80' : 'var(--text-muted)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#4ade80'; (e.currentTarget as HTMLElement).style.background = 'rgba(74,222,128,0.08)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = isRefreshing ? '#4ade80' : 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
                <button onClick={onBackup} title="Backup" className="p-1.5 rounded-lg transition-all"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#4ade80'; (e.currentTarget as HTMLElement).style.background = 'rgba(74,222,128,0.08)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                  <Download className="w-4 h-4" />
                </button>
                <button onClick={logout} title="Logout" className="p-1.5 rounded-lg transition-all"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ef4444'; (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
        {collapsed && (
          <div className="flex flex-col gap-1 mt-2">
            <button onClick={onManualRefresh} title="Sync" className="w-full flex items-center justify-center p-1.5 rounded-lg transition-all"
              style={{ color: isRefreshing ? '#4ade80' : 'var(--text-muted)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#4ade80'; (e.currentTarget as HTMLElement).style.background = 'rgba(74,222,128,0.08)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = isRefreshing ? '#4ade80' : 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onBackup} title="Backup" className="w-full flex items-center justify-center p-1.5 rounded-lg transition-all"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#4ade80'; (e.currentTarget as HTMLElement).style.background = 'rgba(74,222,128,0.08)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
              <Download className="w-4 h-4" />
            </button>
            <button onClick={logout} title="Logout" className="w-full flex items-center justify-center p-1.5 rounded-lg transition-all"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ef4444'; (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.08)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Desktop collapse toggle */}
      {!isMobile && (
        <button onClick={() => setDesktopCollapsed(!desktopCollapsed)}
          className="absolute top-1/2 -right-3 w-6 h-6 rounded-full flex items-center justify-center transition-all z-10"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', boxShadow: 'var(--shadow-card)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--primary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}>
          {desktopCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      )}
    </>
  );

  return (
    <>
      {/* M1 FIX: Session timeout warning modal */}
      {sessionWarning && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="rounded-2xl p-6 max-w-sm w-full mx-4 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(234,88,12,0.1)' }}>
              <Clock className="w-7 h-7" style={{ color: '#ea580c' }} />
            </div>
            <h3 className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Session Expiring Soon</h3>
            <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
              You have been inactive for 25 minutes. You will be logged out in <strong>5 minutes</strong> unless you continue.
            </p>
            <div className="flex gap-3">
              <button onClick={logout} className="flex-1 py-2 rounded-xl text-sm font-medium" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
                Logout Now
              </button>
              <button onClick={extendSession} className="flex-1 py-2 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, #0284C7, #0369A1)' }}>
                Stay Signed In
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-page)' }}>

      {/* ── DESKTOP SIDEBAR ── always mounted, collapsible */}
      {!isMobile && (
        <aside className="relative flex flex-col flex-shrink-0 transition-all duration-300 print:hidden"
          style={{
            background:   'var(--bg-sidebar)',
            borderRight:  '1px solid var(--border-default)',
            boxShadow:    'var(--shadow-sidebar)',
            width:        desktopCollapsed ? '64px' : '240px',
          }}>
          <SidebarContent />
        </aside>
      )}

      {/* ── MOBILE DRAWER — backdrop + slide-in panel ── */}
      {isMobile && (
        <>
          {/* Backdrop */}
          {mobileOpen && (
            <div
              className="fixed inset-0 z-40 print:hidden"
              style={{ background: 'rgba(0,0,0,0.45)' }}
              onClick={() => setMobileOpen(false)}
            />
          )}
          {/* Drawer panel */}
          <aside
            className="fixed top-0 left-0 h-full z-50 flex flex-col transition-transform duration-300 print:hidden"
            style={{
              width:       '260px',
              background:  'var(--bg-sidebar)',
              borderRight: '1px solid var(--border-default)',
              boxShadow:   'var(--shadow-sidebar)',
              transform:   mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
            }}>
            <SidebarContent />
          </aside>
        </>
      )}

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 flex flex-col overflow-hidden print:overflow-visible print:w-full">

        {/* Mobile top bar */}
        {isMobile && (
          <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0 print:hidden"
            style={{
              background:   'var(--bg-sidebar)',
              borderBottom: '1px solid var(--border-default)',
              minHeight:    '56px',
            }}>
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 rounded-lg transition-all flex-shrink-0"
              style={{ color: 'var(--text-secondary)', background: 'var(--primary-light)' }}>
              <Menu className="w-5 h-5" style={{ color: 'var(--primary)' }} />
            </button>
            <img src="/logo.png" alt="logo" style={{ width: 32, height: 32, objectFit: 'contain' }} />
            <div>
              <div className="font-black leading-tight" style={{ fontSize: '12px', letterSpacing: '0.15em', color: 'var(--text-primary)' }}>
                PAK FROST
              </div>
              <div className="font-semibold" style={{ fontSize: '8px', color: 'var(--primary)', letterSpacing: '0.1em' }}>
                Cold Storage WMS
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {/* Theme toggle — mobile */}
              <button
                onClick={toggleTheme}
                title={isDark ? 'Light Mode' : 'Dark Mode'}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200"
                style={{
                  background: isDark ? 'rgba(56,189,248,0.15)' : 'rgba(2,132,199,0.10)',
                  border: `1px solid ${isDark ? 'rgba(56,189,248,0.3)' : 'rgba(2,132,199,0.2)'}`,
                  color: isDark ? '#38BDF8' : '#0284C7',
                }}>
                {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                style={{ background: 'linear-gradient(135deg,#0284C7,#38BDF8)', color: 'white' }}>
                {currentUser?.name?.[0]?.toUpperCase() || 'U'}
              </div>
            </div>
          </div>
        )}

        {syncError && (
          <div className="mx-3 mt-3 sm:mx-6 sm:mt-4 rounded-lg px-3 py-2.5 text-xs sm:text-sm flex items-start gap-2"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#dc2626' }}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="font-semibold">Data sync failed</div>
              <div className="break-words">{syncError}</div>
            </div>
          </div>
        )}

        {children}
      </main>
    </div>
    </>
  );
}
