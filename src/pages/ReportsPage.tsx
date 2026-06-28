import { useState, useMemo } from 'react';
import { BarChart3, Printer } from 'lucide-react';
import type { Pallet, StockMovement, TemperatureReading } from '@/types';

interface ReportsPageProps {
  pallets: Pallet[];
  movements: StockMovement[];
  temperatures: TemperatureReading[];
}

export default function ReportsPage({ pallets, movements, temperatures }: ReportsPageProps) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reportType, setReportType] = useState<'inventory' | 'movement' | 'temperature'>('inventory');

  const now = new Date();
  const active = pallets.filter(p => p.status === 'active');

  // Inventory summary
  const inventoryStats = useMemo(() => {
    const byCustomer = active.reduce((acc, p) => {
      if (!acc[p.customerName]) acc[p.customerName] = { pallets: 0, cartons: 0, weight: 0 };
      acc[p.customerName].pallets++;
      acc[p.customerName].cartons += p.cartons;
      acc[p.customerName].weight += p.totalWeight;
      return acc;
    }, {} as Record<string, { pallets: number; cartons: number; weight: number }>);

    const byRoom = active.reduce((acc, p) => {
      if (!acc[p.room]) acc[p.room] = { pallets: 0, cartons: 0 };
      acc[p.room].pallets++;
      acc[p.room].cartons += p.cartons;
      return acc;
    }, {} as Record<string, { pallets: number; cartons: number }>);

    return { byCustomer, byRoom, totalPallets: active.length, totalCartons: active.reduce((s, p) => s + Number(p.cartons), 0), totalWeight: active.reduce((s, p) => s + Number(p.totalWeight), 0) };
  }, [active]);

  // Movement summary
  const movementStats = useMemo(() => {
    const from = dateFrom ? new Date(dateFrom) : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = dateTo ? new Date(dateTo + 'T23:59:59') : now;

    const filtered = movements.filter(m => {
      const d = new Date(m.createdAt||m.date||"");
      return d >= from && d <= to;
    });

    const totalIn = filtered.filter(m => m.type === 'IN').reduce((s, m) => s + Number(m.cartons), 0);
    const totalOut = filtered.filter(m => m.type === 'OUT').reduce((s, m) => s + Number(m.cartons), 0);

    const byCustomer = filtered.reduce((acc, m) => {
      if (!acc[m.customerName]) acc[m.customerName] = { in: 0, out: 0 };
      if (m.type === 'IN') acc[m.customerName].in += m.cartons;
      if (m.type === 'OUT') acc[m.customerName].out += m.cartons;
      return acc;
    }, {} as Record<string, { in: number; out: number }>);

    return { filtered, totalIn, totalOut, byCustomer, count: filtered.length };
  }, [movements, dateFrom, dateTo]);

  const handlePrint = () => {
    const printWin = window.open('', '_blank');
    if (!printWin) return;
    const title =
      reportType === 'inventory'   ? 'Inventory Report' :
      reportType === 'movement'    ? 'Movement Report'  : 'Temperature Report';
    const dateStr = new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });

    let tableHTML = '';
    if (reportType === 'inventory') {
      const byCustomerRows = Object.entries(inventoryStats.byCustomer).map(([name, s]) =>
        `<tr><td>${name}</td><td>${s.pallets}</td><td>${s.cartons.toLocaleString()}</td><td>${(Number(s.weight)/1000).toFixed(1)} t</td></tr>`
      ).join('');
      const byRoomRows = Object.entries(inventoryStats.byRoom).map(([name, s]) =>
        `<tr><td>${name}</td><td>${s.pallets}</td><td>${s.cartons.toLocaleString()}</td></tr>`
      ).join('');
      tableHTML = `
        <h3>Summary</h3>
        <p>Total Pallets: <b>${inventoryStats.totalPallets}</b> &nbsp; Total Qty: <b>${inventoryStats.totalCartons.toLocaleString()}</b> &nbsp; Total Weight: <b>${(Number(inventoryStats.totalWeight)/1000).toFixed(1)} t</b></p>
        <h3>By Customer</h3>
        <table><thead><tr><th>Customer</th><th>Pallets</th><th>Qty</th><th>Weight</th></tr></thead><tbody>${byCustomerRows}</tbody></table>
        <h3>By Room</h3>
        <table><thead><tr><th>Room</th><th>Pallets</th><th>Qty</th></tr></thead><tbody>${byRoomRows}</tbody></table>`;
    } else if (reportType === 'movement') {
      const period = `${dateFrom || 'Month Start'} to ${dateTo || 'Today'}`;
      const byCustomerRows = Object.entries(movementStats.byCustomer).map(([name, s]) =>
        `<tr><td>${name}</td><td>${s.in.toLocaleString()}</td><td>${s.out.toLocaleString()}</td><td>${(s.in-s.out).toLocaleString()}</td></tr>`
      ).join('');
      tableHTML = `
        <h3>Period: ${period}</h3>
        <p>Transactions: <b>${movementStats.count}</b> &nbsp; Total IN: <b>${movementStats.totalIn.toLocaleString()}</b> units &nbsp; Total OUT: <b>${movementStats.totalOut.toLocaleString()}</b> units</p>
        <h3>By Customer</h3>
        <table><thead><tr><th>Customer</th><th>IN (Qty)</th><th>OUT (Qty)</th><th>Balance</th></tr></thead><tbody>${byCustomerRows}</tbody></table>`;
    } else {
      const tempRows = temperatures.slice(0, 50).map(t =>
        `<tr><td>${new Date(t.recordedAt||t.time||"").toLocaleString('en-PK',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</td><td>${t.room}</td><td style="color:${t.temperature<=-18?'green':'red'}">${Number(t.temperature).toFixed(1)}C</td><td>${t.recordedBy}</td><td>${t.notes||'-'}</td></tr>`
      ).join('');
      tableHTML = `
        <table><thead><tr><th>Time</th><th>Room</th><th>Temperature</th><th>Recorded By</th><th>Notes</th></tr></thead><tbody>${tempRows}</tbody></table>`;
    }

    printWin.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:20px;color:#000}
        h1{font-size:18px;margin:0}.sub{font-size:11px;color:#555;margin:2px 0 16px}
        h3{font-size:13px;margin:14px 0 6px;border-bottom:1px solid #ccc;padding-bottom:3px}
        table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px}
        th{background:#f0f0f0;padding:6px 8px;text-align:left;border:1px solid #ddd}
        td{padding:5px 8px;border:1px solid #eee}
        tr:nth-child(even){background:#fafafa}
        p{font-size:12px;margin:4px 0}
        @media print{body{padding:10px}}
      </style></head><body>
      <h1>PAKFROST (PVT) LIMITED — ${title}</h1>
      <p class="sub">Printed: ${dateStr} &nbsp;|&nbsp; 2 KM Off Manga Raiwind Road, Lahore</p>
      ${tableHTML}
    </body></html>`);
    printWin.document.close();
    setTimeout(() => printWin.print(), 250);
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6" style={{ color: 'var(--primary)' }} />
            <h1 className="text-2xl font-bold">Reports</h1>
          </div>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'rgba(43,184,232,0.15)', color: 'var(--primary)', border: '1px solid rgba(43,184,232,0.3)' }}
          >
            <Printer className="w-4 h-4" /> Print Report
          </button>
        </div>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>Generate warehouse reports and analytics</p>

        {/* Report type selector */}
        <div className="flex gap-2 mb-6">
          {[
            { key: 'inventory' as const, label: 'Inventory Report' },
            { key: 'movement' as const, label: 'Movement Report' },
            { key: 'temperature' as const, label: 'Temperature Report' },
          ].map(t => (
            <button key={t.key} onClick={() => setReportType(t.key)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: reportType === t.key ? 'rgba(43,184,232,0.15)' : 'transparent',
                color: reportType === t.key ? 'var(--primary)' : '#7a9bb5',
                border: reportType === t.key ? '1px solid rgba(43,184,232,0.3)' : '1px solid rgba(43,184,232,0.1)',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Date filter for movement */}
        {reportType === 'movement' && (
          <div className="flex gap-3 mb-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="px-3 py-2 rounded-lg  text-sm outline-none"
                style={{ background: 'var(--bg-page)', border: '1px solid var(--border-default)' }} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>To</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="px-3 py-2 rounded-lg  text-sm outline-none"
                style={{ background: 'var(--bg-page)', border: '1px solid var(--border-default)' }} />
            </div>
          </div>
        )}

        {/* Inventory Report */}
        {reportType === 'inventory' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: 'Total Pallets', value: inventoryStats.totalPallets, color: 'var(--primary)' },
                { label: 'Total Qty', value: inventoryStats.totalCartons.toLocaleString(), color: '#4ade80' },
                { label: 'Total Weight', value: `${(Number(inventoryStats.totalWeight) / 1000).toFixed(1)}t`, color: '#f97316' },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  <div className="text-xl font-black" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <h3 className="text-sm font-semibold  mb-3">By Customer</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: '#FAFAFA' }}>
                        {['Customer', 'Pallets', 'Qty', 'Weight'].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-xs" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(inventoryStats.byCustomer).map(([name, stats]) => (
                        <tr key={name} style={{ borderTop: '1px solid rgba(43,184,232,0.05)' }}>
                          <td className="px-3 py-2 ">{name}</td>
                          <td className="px-3 py-2 font-bold ">{stats.pallets}</td>
                          <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{stats.cartons.toLocaleString()}</td>
                          <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{(stats.weight / 1000).toFixed(1)}t</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <h3 className="text-sm font-semibold  mb-3">By Room</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: '#FAFAFA' }}>
                        {['Room', 'Pallets', 'Qty'].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-xs" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(inventoryStats.byRoom).map(([name, stats]) => (
                        <tr key={name} style={{ borderTop: '1px solid rgba(43,184,232,0.05)' }}>
                          <td className="px-3 py-2 ">{name}</td>
                          <td className="px-3 py-2 font-bold ">{stats.pallets}</td>
                          <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{stats.cartons.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Movement Report */}
        {reportType === 'movement' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Transactions', value: movementStats.count, color: 'var(--primary)' },
                { label: 'Total IN', value: movementStats.totalIn.toLocaleString(), color: '#4ade80' },
                { label: 'Total OUT', value: movementStats.totalOut.toLocaleString(), color: '#f97316' },
                { label: 'Net', value: (movementStats.totalIn - movementStats.totalOut).toLocaleString(), color: '#a78bfa' },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-3" style={{ background: 'var(--bg-card)', border: '1px solid rgba(43,184,232,0.08)' }}>
                  <div className="text-base sm:text-lg font-black leading-tight" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <h3 className="text-sm font-semibold  mb-3">By Customer</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#FAFAFA' }}>
                      {['Customer', 'IN (Qty)', 'OUT (Qty)', 'Balance'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-xs" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(movementStats.byCustomer).map(([name, stats]) => (
                      <tr key={name} style={{ borderTop: '1px solid rgba(43,184,232,0.05)' }}>
                        <td className="px-3 py-2 ">{name}</td>
                        <td className="px-3 py-2 font-bold" style={{ color: '#4ade80' }}>{stats.in.toLocaleString()}</td>
                        <td className="px-3 py-2 font-bold" style={{ color: '#f97316' }}>{stats.out.toLocaleString()}</td>
                        <td className="px-3 py-2 font-black" style={{ color: stats.in - stats.out >= 0 ? 'var(--primary)' : '#ef4444' }}>{(stats.in - stats.out).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Temperature Report */}
        {reportType === 'temperature' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {['Room 1', 'Room 2', 'Room 3', 'Room 4'].map(room => {
                const roomTemps = temperatures.filter(t => t.room === room);
                const latest = roomTemps[0];
                const avg = roomTemps.length > 0 ? roomTemps.reduce((s, t) => s + Number(t.temperature), 0) / roomTemps.length : 0;
                return (
                  <div key={room} className="rounded-xl p-3" style={{ background: 'var(--bg-card)', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{room}</div>
                    <div className="text-lg font-black" style={{ color: latest && latest.temperature <= -18 ? '#4ade80' : '#ef4444' }}>
                      {latest ? `${Number(latest.temperature).toFixed(1)}C` : 'N/A'}
                    </div>
                    <div className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>Avg: {avg.toFixed(1)}C</div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <h3 className="text-sm font-semibold  mb-3">Recent Readings</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#FAFAFA' }}>
                      {['Time', 'Room', 'Temperature', 'Recorded By', 'Notes'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-xs" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {temperatures.slice(0, 20).map(t => (
                      <tr key={t.id} style={{ borderTop: '1px solid rgba(43,184,232,0.05)' }}>
                        <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>
                          {new Date(t.recordedAt||t.time||"").toLocaleString('en-PK', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-3 py-2 ">{t.room}</td>
                        <td className="px-3 py-2 font-mono font-bold" style={{ color: t.temperature <= -18 ? '#4ade80' : '#ef4444' }}>{Number(t.temperature).toFixed(1)}C</td>
                        <td className="px-3 py-2 ">{t.recordedBy}</td>
                        <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{t.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


