import { useState, useMemo } from 'react';
import { ArrowUpRight, Printer, Save, RotateCcw, AlertCircle, ChevronDown, Check, X } from 'lucide-react';
import type { Pallet, Customer, Product, Driver, Vehicle, DocCounters } from '@/types';

const COMPANY = {
  name: 'PAKFROST (PVT) LIMITED',
  address: '2 KM Off Manga Raiwind Road, Behind Achha Foods',
  city: 'Lahore, Pakistan',
  email: 'info.pakfrost@gmail.com',
  storage: 'Premium Temperature Controlled Warehousing | -18C to -22C',
};

interface StockOutPageProps {
  pallets: Pallet[];
  customers: Customer[];
  products: Product[];
  drivers: Driver[];
  vehicles: Vehicle[];
  counters: DocCounters;
  onStockOut: (items: { palletId: string; cartonsOut: number }[], header: any) => Promise<string>;
  peekNextOGP: () => string;
  getFIFOPallets: (customerId?: string, productId?: string) => Pallet[];
  currentUserName: string;
}

interface DispatchLine { id: string; pallet: Pallet; cartonsOut: number; }
type Step = 'form' | 'sheet';

const fmtDate = (iso: string | undefined | null) => iso ? new Date(iso).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const vehicleTypeLabel = (type: Vehicle['type']) => type.replace('_', ' ');

export default function StockOutPage({
  pallets, customers, products, drivers, vehicles, counters,
  onStockOut, peekNextOGP, getFIFOPallets, currentUserName,
}: StockOutPageProps) {
  const [step, setStep] = useState<Step>('form');
  const [savedOGP, setSavedOGP] = useState('');
  const [savedHeader, setSavedHeader] = useState<any>(null);
  const [savedLines, setSavedLines] = useState<DispatchLine[]>([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [header, setHeader] = useState({
    vehicleNo: '',
    vehicleNoOther: '',
    driverId: '',
    destination: '',
    reason: 'Dispatch',
    notes: '',
    date: new Date().toISOString().split('T')[0],
    timeOut: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    tempCheck: '-20',
    orderRef: '',  // C4 FIX: was missing, causing OGP order ref to never save
  });

  const [lines, setLines] = useState<DispatchLine[]>([]);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [otherVehicleText, setOtherVehicleText] = useState('');

  // Improvement D: Inline quantity input state
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingQty, setPendingQty] = useState<number>(0);

  const fifoPallets = useMemo(() => {
    if (!selectedProductId) return [];
    return getFIFOPallets(selectedCustomerId || undefined, selectedProductId);
  }, [getFIFOPallets, selectedCustomerId, selectedProductId]);

  const customerProducts = useMemo(() => {
    if (!selectedCustomerId) return products;
    const ids = new Set(pallets.filter(p => p.status === 'active' && p.customerId === selectedCustomerId).map(p => p.productId));
    return products.filter(p => ids.has(p.id) && p.customerId === selectedCustomerId);
  }, [selectedCustomerId, products, pallets]);

  const selectedDriver = drivers.find(d => d.id === header.driverId);
  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  // Improvement D: Updated addPallet to show inline input
  const startAddPallet = (pallet: Pallet) => {
    // ✅ Fix 2 — prevent duplicate: same pallet already in dispatch list
    if (lines.some(l => l.pallet.id === pallet.id)) {
      setMsg({ text: `"${pallet.productName}" is already in the dispatch list`, ok: false });
      setTimeout(() => setMsg(null), 3000);
      return;
    }
    setPendingId(pallet.id);
    setPendingQty(pallet.cartons);
  };

  const confirmPallet = (pallet: Pallet) => {
    const qty = pendingQty;
    if (qty < 1 || qty > pallet.cartons) return;

    const expiry = new Date(pallet.expiryDate);
    const now = new Date();
    const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / 86400000);
    if (daysLeft < 0) {
      setMsg({ text: `Warning: Pallet ${pallet.igpNumber} has EXPIRED (${Math.abs(daysLeft)} days ago). Added to list.`, ok: false });
    } else if (daysLeft <= 30) {
      setMsg({ text: `Note: Pallet ${pallet.igpNumber} expires in ${daysLeft} day(s). Added to list.`, ok: false });
    } else {
      setMsg(null);
    }

    setLines(prev => [...prev, { id: `L-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, pallet, cartonsOut: qty }]);
    setPendingId(null);
    setPendingQty(0);
  };

  const cancelPallet = () => {
    setPendingId(null);
    setPendingQty(0);
  };

  const removeLine = (lineId: string) => setLines(prev => prev.filter(l => l.id !== lineId));

  const updateCartons = (lineId: string, val: number) => {
    setLines(prev => prev.map(l => {
      if (l.id !== lineId) return l;
      return { ...l, cartonsOut: Math.min(val, l.pallet.cartons) };
    }));
  };

  const save = async () => {
    const resolvedVehicleNo = header.vehicleNo === '__other__' ? header.vehicleNoOther : header.vehicleNo;
    if (!resolvedVehicleNo) { setMsg({ text: '* Vehicle number required', ok: false }); return; }
    if (lines.length === 0) { setMsg({ text: 'Add at least one pallet', ok: false }); return; }
    if (!counters.ogpInitialized) { setMsg({ text: 'Initialize counters from Dashboard first', ok: false }); return; }

    const ogp = await onStockOut(lines.map(l => ({
      palletId: l.pallet.id,
      cartonsOut: l.cartonsOut,
    })), {
      vehicleNo: resolvedVehicleNo,
      driverId: header.driverId || undefined,
      driverName: selectedDriver?.name,
      destination: header.destination,
      reason: header.reason,
      notes: header.notes,
      operatorName: currentUserName,
      orderRef: header.orderRef || undefined,
      tempCheck: header.tempCheck,
      condition: 'Good',
    });
    setSavedOGP(ogp);
    const _cCode = customers.find(x => x.id === selectedCustomerId)?.code || '';
    setSavedHeader({ ...header, driverName: selectedDriver?.name || '', customerName: selectedCustomer?.name || '', selectedDriver, _custCode: _cCode });
    setSavedLines([...lines]);
    setStep('sheet');
  };

  const reset = () => {
    setStep('form');
    setHeader({ vehicleNo: '', vehicleNoOther: '', driverId: '', destination: '', reason: 'Dispatch', notes: '', date: new Date().toISOString().split('T')[0], timeOut: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), tempCheck: '-20', orderRef: '' });
    setOtherVehicleText('');
    setSelectedCustomerId(''); setSelectedProductId('');
    setLines([]); setMsg(null);
    setPendingId(null); setPendingQty(0);
  };

  // Loading Sheet
  if (step === 'sheet') {
    const totalCartonsOut = savedLines.reduce((s, l) => s + l.cartonsOut, 0);
    const totalWeightOut  = savedLines.reduce((s, l) => s + l.cartonsOut * Number(l.pallet.weightPerCarton), 0);

    return (
      <div className="flex-1 overflow-y-auto p-3 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6 print:hidden">
            <h1 className="text-2xl font-bold">Outward Gate Pass Generated</h1>
            <div className="flex gap-2">
              <button onClick={() => {
                const totalC = savedLines.reduce((s,l) => s + l.cartonsOut, 0);
                const totalW = savedLines.reduce((s,l) => s + l.cartonsOut * Number(l.pallet.weightPerCarton), 0);
                const drv = savedHeader.selectedDriver;
                const driverPhone = drv?.phone || '-';
                const driverCnic  = drv?.cnic  || '-';

                const buildCopy = (copyNo: number) => `
<div class="page" style="page-break-after:${copyNo < 3 ? 'always' : 'avoid'}">
  <div class="copy-label">Copy ${copyNo} of 3</div>
  <div class="header-row">
    <div class="header-left">
      <div class="company-name">PAKFROST (PVT) LIMITED</div>
      <div class="company-sub">2 Km Off Manga Raiwind Road, Behind Achha Foods, Lahore</div>
      <div class="company-sub">info.pakfrost@gmail.com &nbsp;|&nbsp; Premium Temperature Controlled Warehousing | -18C to -22C</div>
      <div class="doc-title">Outward Gate Pass</div>
    </div>
    <div class="header-right">
      <div class="doc-no-box">OGP No: ${savedOGP}</div>
      <div class="date-box"><b>Date:</b> ${fmtDate(savedHeader.date)}</div>
    </div>
  </div>
  <div class="info-section">
    <div class="info-row"><span class="info-label">Order Ref:</span><span class="info-val">${savedHeader.orderRef || ''}</span><span class="info-label">Vehicle No:</span><span class="info-val">${savedHeader.vehicleNo}</span></div>
    <div class="info-row"><span class="info-label">Customer:</span><span class="info-val">${savedHeader._custCode ? savedHeader.customerName+' ('+savedHeader._custCode+')' : savedHeader.customerName || '-'}</span><span class="info-label">Driver Name:</span><span class="info-val">${savedHeader.driverName || '-'}</span></div>
    <div class="info-row"><span class="info-label">Cell No:</span><span class="info-val">${driverPhone}</span><span class="info-label">CNIC:</span><span class="info-val">${driverCnic}</span></div>
  </div>
  <table>
    <thead><tr>
      <th>Item No</th><th style="text-align:left">Description</th><th>Pack Type</th>
      <th>Qty</th><th>Wt/Unit</th><th>Total Kg</th><th>Expiry Date</th>
    </tr></thead>
    <tbody>
      ${(()=>{
        const grp={};
        savedLines.forEach(l=>{const k=l.pallet.productCode||l.pallet.productName;if(!grp[k])grp[k]={pallet:l.pallet,cartonsOut:0};grp[k].cartonsOut+=l.cartonsOut;});
        const rows=Object.values(grp);
        return rows.map((g,i)=>`<tr>
          <td>${i+1}</td>
          <td class="left">${g.pallet.productCode ? g.pallet.productCode+' '+g.pallet.productName : g.pallet.productName}</td>
          <td>${g.pallet.packingType||'Carton'}</td>
          <td><b>${g.cartonsOut}</b></td>
          <td>${g.pallet.weightPerCarton}</td>
          <td><b>${(g.cartonsOut * Number(g.pallet.weightPerCarton)).toFixed(1)}</b></td>
          <td>${fmtDate(g.pallet.expiryDate)}</td>
        </tr>`).join('')
        +Array.from({length:Math.max(0,6-rows.length)}).map(()=>'<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join('');
      })()}
    </tbody>
    <tfoot><tr class="total-row">
      <td colspan="3" style="text-align:right">TOTALS:</td>
      <td><b>${totalC}</b></td><td>-</td><td><b>${totalW.toFixed(1)}</b></td><td></td>
    </tr></tfoot>
  </table>
  <div class="bottom-section">
    <div class="bottom-row">
      <div class="bottom-field"><span class="bottom-label">Vehicle Temperature:</span><div class="field-box">${savedHeader.tempCheck}°C</div></div>
      <div class="bottom-field"><span class="bottom-label">Stock Condition:</span><div class="field-box">Good</div></div>
      <div class="bottom-field"><span class="bottom-label">Destination:</span><div class="field-box">${savedHeader.destination || '-'}</div></div>
    </div>
    <div class="bottom-row">
      <div class="bottom-field"><span class="bottom-label">Arrival Time:</span><div class="field-box">${savedHeader.arrivalTime || ''}</div></div>
      <div class="bottom-field"><span class="bottom-label">Departure Time:</span><div class="field-box">${savedHeader.timeOut}</div></div>
      <div class="bottom-field"><span class="bottom-label">Reason:</span><div class="field-box">${savedHeader.reason}</div></div>
    </div>
    <div class="remarks-row"><span class="bottom-label">Remarks:</span><div class="remarks-box">${savedHeader.notes || ''}</div></div>
  </div>
  <div class="sigs">
    <div class="sig-box"><div class="sig-val">${currentUserName}</div><div class="sig-label">Prepared By</div></div>
    <div class="sig-box"><div class="sig-val"></div><div class="sig-label">Received By</div></div>
  </div>
  <div class="note-box">
    <b>Disclaimer:</b> Client Must Ensure That Vehicle Temperature Is At The Required Level Before Loading Begins.
    Once The Order Has Been Dispatched From The Pakfrost Warehouse, Pakfrost Will Not Be Held Responsible
    For Any Temperature Variations Or Degradation In Product Quality During Transit.
  </div>
</div>`;

                const win = window.open('', '_blank');
                if (!win) return;
                win.document.write(`<!DOCTYPE html><html><head><title>Outward Gate Pass - ${savedOGP}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;color:#000;font-size:11px;background:#fff}
  .page{width:210mm;min-height:297mm;padding:10mm 12mm;position:relative;background:#fff}
  .copy-label{position:absolute;top:6mm;right:12mm;font-size:10px;font-weight:bold;border:1px solid #000;padding:2px 8px;border-radius:3px}
  .header-row{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:8px}
  .company-name{font-size:15px;font-weight:900;letter-spacing:0.1em}
  .company-sub{font-size:9px;color:#444;margin-top:1px}
  .doc-title{font-size:13px;font-weight:900;margin-top:6px;letter-spacing:0.05em}
  .header-right{text-align:right;flex-shrink:0;margin-left:10px}
  .doc-no-box{border:2px solid #000;padding:5px 14px;font-size:13px;font-weight:900;display:inline-block;letter-spacing:0.04em}
  .date-box{font-size:10px;margin-top:4px;border:1px solid #000;padding:3px 8px}
  .info-section{border:1px solid #999;margin-bottom:8px}
  .info-row{display:grid;grid-template-columns:80px 1fr 80px 1fr;border-bottom:1px solid #ddd;font-size:10px}
  .info-row:last-child{border-bottom:0}
  .info-label{background:#f5f5f5;padding:4px 6px;font-weight:bold;border-right:1px solid #ddd}
  .info-val{padding:4px 6px;border-right:1px solid #ddd}
  table{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:8px}
  th{background:#eeeeee;border:1px solid #999;padding:4px 5px;font-size:9px;font-weight:bold}
  td{border:1px solid #bbb;padding:4px 5px;text-align:center}
  td.left{text-align:left}
  .total-row{background:#f5f5f5;font-weight:bold}
  .bottom-section{margin-bottom:8px}
  .bottom-row{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:6px}
  .bottom-field{display:flex;flex-direction:column;gap:2px}
  .bottom-label{font-size:9px;font-weight:bold}
  .field-box{border:1px solid #999;min-height:22px;padding:2px 6px;font-size:11px}
  .remarks-row{display:flex;align-items:flex-start;gap:6px}
  .remarks-box{border:1px solid #999;flex:1;min-height:28px;padding:2px 6px}
  .sigs{display:grid;grid-template-columns:repeat(2,1fr);gap:30px;margin-top:10px;margin-bottom:8px}
  .sig-box{text-align:center}
  .sig-val{min-height:30px;border-bottom:1px solid #000;padding-bottom:2px;font-size:11px}
  .sig-label{font-size:9px;margin-top:3px}
  .note-box{font-size:8px;color:#555;border-top:1px solid #ccc;padding-top:5px;line-height:1.4}
  @media print{@page{size:A4 portrait;margin:0}body{margin:0}}
</style></head><body>
${buildCopy(1)}
${buildCopy(2)}
${buildCopy(3)}
</body></html>`);
                win.document.close();
                setTimeout(() => win.print(), 500);
              }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm"
                style={{ background: 'var(--primary)', color: 'var(--bg-card)' }}>
                <Printer className="w-4 h-4" /> Print (3 Copies)
              </button>
              <button onClick={reset}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm border"
                style={{ borderColor: 'rgba(43,184,232,0.3)', color: 'var(--text-secondary)' }}>
                <RotateCcw className="w-4 h-4" /> New Entry
              </button>
            </div>
          </div>

          <div className="bg-white text-black rounded-xl p-6 shadow-lg print-sheet text-xs">
            {/* Gate Pass Header */}
            <div className="flex justify-between items-start border-b-2 border-black pb-3 mb-3">
              <div>
                <div className="text-base font-black tracking-widest">PAKFROST (PVT) LIMITED</div>
                <div className="text-[10px] text-gray-500">2 KM Off Manga Raiwind Road, Behind Achha Foods, Lahore</div>
                <div className="text-[10px] text-gray-500">info.pakfrost@gmail.com | Premium Temperature Controlled Warehousing | -18C to -22C</div>
                <div className="text-sm font-black mt-2 tracking-wide">Outward Gate Pass</div>
              </div>
              <div className="text-right">
                <div className="border-2 border-black px-4 py-2 inline-block font-black text-sm tracking-wide">OGP No: {savedOGP}</div>
                <div className="text-[10px] border border-black px-3 py-1 mt-1"><b>Date:</b> {fmtDate(savedHeader?.date)}</div>
              </div>
            </div>
            <div className="border border-gray-400 mb-3 text-[10px]">
              <div className="grid grid-cols-4 border-b border-gray-300">
                <div className="bg-gray-100 font-bold px-2 py-1.5 border-r border-gray-300">Order Ref:</div>
                <div className="px-2 py-1.5 border-r border-gray-300">{savedHeader?.orderRef || '-'}</div>
                <div className="bg-gray-100 font-bold px-2 py-1.5 border-r border-gray-300">Vehicle No:</div>
                <div className="px-2 py-1.5">{savedHeader?.vehicleNo}</div>
              </div>
              <div className="grid grid-cols-4 border-b border-gray-300">
                <div className="bg-gray-100 font-bold px-2 py-1.5 border-r border-gray-300">Customer:</div>
                <div className="px-2 py-1.5 border-r border-gray-300">{savedHeader?._custCode ? `${savedHeader.customerName} (${savedHeader._custCode})` : savedHeader?.customerName || '-'}</div>
                <div className="bg-gray-100 font-bold px-2 py-1.5 border-r border-gray-300">Driver Name:</div>
                <div className="px-2 py-1.5">{savedHeader?.driverName || '-'}</div>
              </div>
              <div className="grid grid-cols-4">
                <div className="bg-gray-100 font-bold px-2 py-1.5 border-r border-gray-300">Cell No:</div>
                <div className="px-2 py-1.5 border-r border-gray-300">{savedHeader?.selectedDriver?.phone || '-'}</div>
                <div className="bg-gray-100 font-bold px-2 py-1.5 border-r border-gray-300">CNIC:</div>
                <div className="px-2 py-1.5">{savedHeader?.selectedDriver?.cnic || '-'}</div>
              </div>
            </div>
            <table className="w-full border-collapse text-[10px] mb-3">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-400 p-1 text-center">Item No</th>
                  <th className="border border-gray-400 p-1 text-left">Description</th>
                  <th className="border border-gray-400 p-1 text-center">Pack Type</th>
                  <th className="border border-gray-400 p-1 text-center">Qty</th>
                  <th className="border border-gray-400 p-1 text-center">Wt/Unit</th>
                  <th className="border border-gray-400 p-1 text-center">Total Kg</th>
                  <th className="border border-gray-400 p-1 text-center">Expiry Date</th>

                </tr>
              </thead>
              <tbody>
                {(() => {
                  const grp: Record<string, { pallet: typeof savedLines[0]['pallet']; cartonsOut: number }> = {};
                  savedLines.forEach(l => {
                    const k = l.pallet.productCode || l.pallet.productName;
                    if (!grp[k]) grp[k] = { pallet: l.pallet, cartonsOut: 0 };
                    grp[k].cartonsOut += l.cartonsOut;
                  });
                  const rows = Object.values(grp);
                  return (<>
                    {rows.map((g, i) => (
                      <tr key={i}>
                        <td className="border border-gray-400 p-1 text-center">{i + 1}</td>
                        <td className="border border-gray-400 p-1">{g.pallet.productCode ? g.pallet.productCode+' '+g.pallet.productName : g.pallet.productName}</td>
                        <td className="border border-gray-400 p-1 text-center">{g.pallet.packingType || 'Carton'}</td>
                        <td className="border border-gray-400 p-1 text-center font-bold">{g.cartonsOut}</td>
                        <td className="border border-gray-400 p-1 text-center">{g.pallet.weightPerCarton}</td>
                        <td className="border border-gray-400 p-1 text-center font-bold">{(g.cartonsOut * Number(g.pallet.weightPerCarton)).toFixed(1)}</td>
                        <td className="border border-gray-400 p-1 text-center">{fmtDate(g.pallet.expiryDate)}</td>
                      </tr>
                    ))}
                    {Array.from({ length: Math.max(0, 6 - rows.length) }).map((_, i) => (
                      <tr key={`e${i}`}>{Array.from({ length: 7 }).map((_, j) => <td key={j} className="border border-gray-400 p-3">&nbsp;</td>)}</tr>
                    ))}
                  </>);
                })()}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-bold">
                  <td colSpan={3} className="border border-gray-400 p-1 text-right">TOTALS:</td>
                  <td className="border border-gray-400 p-1 text-center">{totalCartonsOut}</td>
                  <td className="border border-gray-400 p-1 text-center">-</td>
                  <td className="border border-gray-400 p-1 text-center">{totalWeightOut.toFixed(1)}</td>
                  <td className="border border-gray-400 p-1"></td>
                </tr>
              </tfoot>
            </table>
            <div className="grid grid-cols-3 gap-2 mb-2 text-[10px]">
              <div><div className="font-bold mb-0.5">Vehicle Temperature:</div><div className="border border-gray-400 p-1 min-h-[22px]">{savedHeader?.tempCheck}°C</div></div>
              <div><div className="font-bold mb-0.5">Stock Condition:</div><div className="border border-gray-400 p-1 min-h-[22px]">Good</div></div>
              <div><div className="font-bold mb-0.5">Destination:</div><div className="border border-gray-400 p-1 min-h-[22px]">{savedHeader?.destination || '-'}</div></div>
              <div><div className="font-bold mb-0.5">Arrival Time:</div><div className="border border-gray-400 p-1 min-h-[22px]">{savedHeader?.arrivalTime || ''}</div></div>
              <div><div className="font-bold mb-0.5">Departure Time:</div><div className="border border-gray-400 p-1 min-h-[22px]">{savedHeader?.timeOut}</div></div>
              <div><div className="font-bold mb-0.5">Reason:</div><div className="border border-gray-400 p-1 min-h-[22px]">{savedHeader?.reason}</div></div>
            </div>
            <div className="flex gap-2 mb-3 text-[10px]">
              <div className="font-bold flex-shrink-0">Remarks:</div>
              <div className="border border-gray-400 flex-1 p-1 min-h-[28px]">{savedHeader?.notes || ''}</div>
            </div>
            <div className="grid grid-cols-2 gap-8 text-[10px] max-w-md">
              {[['Prepared By', currentUserName], ['Received By', '']].map(([label, val]) => (
                <div key={label} className="text-center">
                  <div className="min-h-[28px] border-b border-black pb-0.5 text-xs">{val}</div>
                  <div className="mt-1">{label}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-[8px] text-gray-500 border-t border-gray-200 pt-2 leading-4">
              <b>Disclaimer:</b> Client Must Ensure That Vehicle Temperature Is At The Required Level Before Loading Begins.
              Once The Order Has Been Dispatched From The Pakfrost Warehouse, Pakfrost Will Not Be Held Responsible
              For Any Temperature Variations Or Degradation In Product Quality During Transit.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Form
  const inputCls = "w-full px-3 py-2 rounded-lg  text-sm outline-none transition-colors";
  const inputStyle = { background: 'var(--bg-card)', border: '1px solid #E2E8F0', color: 'var(--text-primary)' };
  const Req = () => <span style={{ color: '#f97316' }}> *</span>;

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-1">
          <ArrowUpRight className="w-6 h-6" style={{ color: '#f97316' }} />
          <h1 className="text-2xl font-bold ">Stock OUT / Dispatch</h1>
        </div>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
          OGP Auto: <span className="font-mono font-bold" style={{ color: '#f97316' }}>{peekNextOGP()}</span>
          &nbsp;|&nbsp; <span style={{ color: '#4ade80' }}>FIFO Order - Oldest stock dispatched first</span>
        </p>

        {msg && (
          <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: msg.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: msg.ok ? '#4ade80' : '#f87171', border: `1px solid ${msg.ok ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
            {msg.text}
          </div>
        )}

        {/* Dispatch header */}
        <div className="rounded-xl p-5 mb-4" style={{ background: 'var(--bg-card)', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#f97316' }}>Dispatch Information</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Order Ref</label>
              <input type="text" value={header.orderRef} onChange={e => setHeader(p => ({ ...p, orderRef: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Optional" />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Date</label>
              <input type="date" value={header.date} onChange={e => setHeader(p => ({ ...p, date: e.target.value }))} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Time Out</label>
              <input type="time" value={header.timeOut} onChange={e => setHeader(p => ({ ...p, timeOut: e.target.value }))} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Vehicle No<Req /></label>
              <select value={header.vehicleNo} onChange={e => setHeader(p => ({ ...p, vehicleNo: e.target.value }))} className={inputCls} style={inputStyle}>
                <option value="">Select Vehicle</option>
                {vehicles.filter(v => v.status === 'active').map(v => <option key={v.id} value={v.vehicleNo}>{v.vehicleNo} ({vehicleTypeLabel(v.type)})</option>)}
                <option value="__other__">Other</option>
              </select>
              {header.vehicleNo === '__other__' && (
                <input type="text" placeholder="Enter vehicle no" value={otherVehicleText} className={`${inputCls} mt-1`} style={inputStyle}
                  onChange={e => { setOtherVehicleText(e.target.value); setHeader(p => ({ ...p, vehicleNoOther: e.target.value })); }} />
              )}
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Driver<Req /></label>
              <select value={header.driverId} onChange={e => setHeader(p => ({ ...p, driverId: e.target.value }))} className={inputCls} style={inputStyle}>
                <option value="">Select Driver</option>
                {drivers.filter(d => d.status === 'active').map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Destination</label>
              <input type="text" value={header.destination} onChange={e => setHeader(p => ({ ...p, destination: e.target.value }))} className={inputCls} style={inputStyle} placeholder="e.g. Metro Lahore" />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Arrival Time</label>
              <input type="time" value={header.arrivalTime} onChange={e => setHeader(p => ({ ...p, arrivalTime: e.target.value }))} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Temp Check (C)</label>
              <input type="number" step="0.1" value={header.tempCheck} onChange={e => setHeader(p => ({ ...p, tempCheck: e.target.value }))} className={inputCls} style={inputStyle} />
            </div>
            <div className="col-span-2 sm:col-span-3">
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Remarks</label>
              <input type="text" value={header.notes} onChange={e => setHeader(p => ({ ...p, notes: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Optional" />
            </div>
          </div>
        </div>

        {/* FIFO Pallet Selector */}
        <div className="rounded-xl p-5 mb-4" style={{ background: 'var(--bg-card)', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#f97316' }}>Select Stock (FIFO - Oldest First)</h2>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Filter by Customer</label>
              <div className="relative">
                <select value={selectedCustomerId} onChange={e => { setSelectedCustomerId(e.target.value); setSelectedProductId(''); }} className={inputCls} style={inputStyle}>
                  <option value="">All Customers</option>
                  {customers.filter(c => c.isActive).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--text-secondary)' }} />
              </div>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Filter by Product</label>
              <div className="relative">
                {/* Improvement E: disabled + faded when no customer */}
                <select
                  value={selectedProductId}
                  onChange={e => setSelectedProductId(e.target.value)}
                  className={inputCls}
                  style={{ ...inputStyle, opacity: selectedCustomerId ? 1 : 0.5 }}
                  disabled={!selectedCustomerId}
                >
                  <option value="">All Products</option>
                  {customerProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--text-secondary)', opacity: selectedCustomerId ? 1 : 0.5 }} />
              </div>
              {!selectedCustomerId && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '11px' }} className="mt-1">&#8593; Select a customer first</p>
              )}
            </div>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {!selectedProductId && (
              <div className="text-center py-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
                Select a customer and product to see available stock
              </div>
            )}
            {selectedProductId && fifoPallets.length === 0 && (
              <div className="text-center py-6 text-sm" style={{ color: 'var(--text-secondary)' }}>No active stock found for this product</div>
            )}
            {selectedProductId && fifoPallets.map((pallet, idx) => {
              const expiry = new Date(pallet.expiryDate);
              const now = new Date();
              const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / 86400000);
              const isPending = pendingId === pallet.id;
              return (
                <div key={`${pallet.id}-${idx}`} className="flex items-center gap-3 p-3 rounded-lg transition-colors"
                  style={{ background: '#FAFAFA', border: '1px solid rgba(43,184,232,0.08)' }}>
                  <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: idx === 0 ? 'rgba(74,222,128,0.15)' : 'rgba(43,184,232,0.08)', color: idx === 0 ? '#4ade80' : '#7a9bb5' }}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium ">{pallet.productName}</div>
                    <div className="text-xs flex gap-3 flex-wrap mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      <span className="font-mono">{pallet.igpNumber}</span>
                      <span>In: {fmtDate(pallet.dateIn)}</span>
                      <span className={daysLeft < 7 ? 'text-red-400' : daysLeft < 30 ? 'text-yellow-400' : ''}>
                        Exp: {fmtDate(pallet.expiryDate)} ({daysLeft}d left)
                      </span>
                      <span>{pallet.room === 'Ante Room' ? 'Ante Room (Floor)' : `${pallet.room} ${pallet.side}${pallet.row}-${pallet.slot}`}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold ">{pallet.cartons} units</div>
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{Number(pallet.totalWeight || 0).toFixed(0)} kg</div>
                  </div>
                  {daysLeft < 0 && <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}

                  {/* Improvement D: Inline quantity input */}
                  {isPending ? (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <input
                        type="number"
                        min={1}
                        max={pallet.cartons}
                        value={pendingQty}
                        onChange={e => setPendingQty(parseInt(e.target.value) || 0)}
                        className="w-16 px-2 py-1 rounded  text-sm text-center outline-none"
                        style={{
                          background: 'var(--bg-page)',
                          border: pendingQty < 1 || pendingQty > pallet.cartons
                            ? '1px solid rgba(239,68,68,0.6)'
                            : '1px solid rgba(249,115,22,0.4)',
                        }}
                        autoFocus
                      />
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>/ {pallet.cartons} max</span>
                      <button
                        onClick={() => confirmPallet(pallet)}
                        className="p-1 rounded transition-colors"
                        style={{ color: '#4ade80' }}
                        title="Confirm"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={cancelPallet}
                        className="p-1 rounded transition-colors"
                        style={{ color: '#f87171' }}
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => startAddPallet(pallet)}
                      className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                      style={{
                        background: 'rgba(249,115,22,0.12)',
                        color: '#f97316',
                        border: '1px solid rgba(249,115,22,0.25)',
                      }}>
                      Add
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Dispatch list */}
        {lines.length > 0 && (
          <div className="rounded-xl mb-4 overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid rgba(249,115,22,0.15)' }}>
            <div className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest" style={{ color: '#f97316', borderBottom: '1px solid rgba(249,115,22,0.1)' }}>
              Dispatch List
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#FAFAFA' }}>
                  {['Product', 'IGP Ref', 'Location', 'Available', 'Dispatch Qty', 'Total Wt', ''].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map(l => (
                  <tr key={l.id} style={{ borderTop: '1px solid var(--border-default)' }}>
                    <td className="px-3 py-2">
                      <div className=" font-medium">{l.pallet.productName}</div>
                      {/* Improvement D: Partial dispatch note */}
                      {l.cartonsOut < l.pallet.cartons && (
                        <div className="text-xs mt-0.5" style={{ color: '#facc15' }}>
                          Partial &mdash; {l.pallet.cartons - l.cartonsOut} remaining in warehouse
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--primary)' }}>{l.pallet.igpNumber}</td>
                    <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{l.pallet.room === 'Ante Room' ? 'Ante Room (Floor)' : `${l.pallet.room} ${l.pallet.side}${l.pallet.row}-${l.pallet.slot}`}</td>
                    <td className="px-3 py-2 ">{l.pallet.cartons}</td>
                    <td className="px-3 py-2">
                      <input type="number" min="1" max={l.pallet.cartons} value={l.cartonsOut}
                        onChange={e => updateCartons(l.id, parseInt(e.target.value) || 0)}
                        className="w-20 px-2 py-1 rounded  text-sm outline-none text-center"
                        style={{ background: 'var(--bg-input)', border: '1px solid rgba(249,115,22,0.3)' }} />
                    </td>
                    <td className="px-3 py-2 font-bold" style={{ color: '#f97316' }}>
                      {(l.cartonsOut * Number(l.pallet.weightPerCarton)).toFixed(1)} kg
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => removeLine(l.id)} className="text-xs" style={{ color: '#f87171' }}>x</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 flex gap-6" style={{ borderTop: '1px solid var(--border-default)', background: '#FAFAFA' }}>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Items: <span className=" font-bold">{lines.length}</span></span>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Total Qty: <span className="font-bold" style={{ color: '#f97316' }}>{lines.reduce((s, l) => s + l.cartonsOut, 0)}</span></span>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Total Weight: <span className="font-bold" style={{ color: '#f97316' }}>{lines.reduce((s, l) => s + l.cartonsOut * Number(l.pallet.weightPerCarton), 0).toFixed(1)} kg</span></span>
            </div>
          </div>
        )}

        <button onClick={save} disabled={lines.length === 0}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg,#f97316,#ea580c)', color: 'var(--text-primary)' }}>
          <Save className="w-5 h-5" /> Save & Generate Loading Sheet ({peekNextOGP()})
        </button>
      </div>
    </div>
  );
}

