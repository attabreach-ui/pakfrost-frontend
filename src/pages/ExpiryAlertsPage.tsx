import { AlertTriangle, Clock } from 'lucide-react';
import type { Pallet } from '@/types';

interface ExpiryAlertsPageProps {
  pallets: Pallet[];
}

const fmtDate = (iso: string | undefined | null) => iso ? new Date(iso).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

export default function ExpiryAlertsPage({ pallets }: ExpiryAlertsPageProps) {
  const now = new Date();
  const d7 = new Date(now); d7.setDate(d7.getDate() + 7);
  const d30 = new Date(now); d30.setDate(d30.getDate() + 30);

  const active = pallets.filter(p => p.status === 'active');

  const expired = active.filter(p => new Date(p.expiryDate) <= now);
  const expiring7 = active.filter(p => { const e = new Date(p.expiryDate); return e > now && e <= d7; });
  const expiring30 = active.filter(p => { const e = new Date(p.expiryDate); return e > d7 && e <= d30; });

  const sections = [
    { title: 'Expired Stock', items: expired, color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', icon: AlertTriangle },
    { title: 'Expiring in 7 Days', items: expiring7, color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.2)', icon: Clock },
    { title: 'Expiring in 30 Days', items: expiring30, color: '#eab308', bg: 'rgba(234,179,8,0.08)', border: 'rgba(234,179,8,0.2)', icon: Clock },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-1">
          <AlertTriangle className="w-6 h-6" style={{ color: '#ef4444' }} />
          <h1 className="text-2xl font-bold ">Expiry Alerts</h1>
        </div>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
          {active.length} active pallets - {expired.length} expired, {expiring7.length} urgent, {expiring30.length} warning
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {sections.map(s => (
            <div key={s.title} className="rounded-xl p-4" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
              <div className="flex items-center gap-2 mb-1">
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
                <span className="text-xs font-semibold" style={{ color: s.color }}>{s.title}</span>
              </div>
              <div className="text-2xl font-black ">{s.items.length}</div>
              <div className="text-xs" style={{ color: s.color }}>{s.items.reduce((sum, i) => sum + Number(i.cartons), 0).toLocaleString()} units</div>
            </div>
          ))}
        </div>

        {sections.map(section => (
          <div key={section.title} className="rounded-xl overflow-hidden mb-4" style={{ background: 'var(--bg-card)', border: `1px solid ${section.border}` }}>
            <div className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest" style={{ color: section.color, borderBottom: `1px solid ${section.border}` }}>
              {section.title} ({section.items.length})
            </div>
            {section.items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#FAFAFA' }}>
                      {['Product', 'Code', 'IGP', 'Customer', 'Qty', 'Location', 'Expiry', 'Days Left'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-xs" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {section.items.map(p => {
                      const daysLeft = Math.ceil((new Date(p.expiryDate).getTime() - now.getTime()) / 86400000);
                      return (
                        <tr key={p.id} style={{ borderTop: '1px solid rgba(43,184,232,0.05)' }}>
                          <td className="px-3 py-2 font-medium ">{p.productName}</td>
                          <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--primary)' }}>{p.productCode}</td>
                          <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{p.igpNumber}</td>
                          <td className="px-3 py-2 ">{p.customerName}</td>
                          <td className="px-3 py-2 font-bold ">{p.cartons}</td>
                          <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{p.room === 'Ante Room' ? 'Ante Room (Floor)' : `${p.room} ${p.side}${p.row}-${p.slot}`}</td>
                          <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{fmtDate(p.expiryDate)}</td>
                          <td className="px-3 py-2 font-bold" style={{ color: daysLeft <= 0 ? '#ef4444' : daysLeft <= 7 ? '#f97316' : '#eab308' }}>
                            {daysLeft <= 0 ? 'EXPIRED' : `${daysLeft}d`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-6 text-sm" style={{ color: 'var(--text-secondary)' }}>No items in this category</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


