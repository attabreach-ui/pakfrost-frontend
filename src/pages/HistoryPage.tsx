import { useState, useMemo, useEffect, useCallback } from 'react';
import { Search, Filter, TrendingDown, TrendingUp, BarChart3, Printer, Edit2, X, Save, Eye, Undo2, RotateCcw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { StockMovement, Pallet, Customer, Product, Driver, Vehicle, DocStatusInfo } from '@/types';

type ViewMode = 'transactions' | 'product-journey' | 'customer-ledger';

interface HistoryPageProps {
  movements: StockMovement[];
  pallets: Pallet[];
  customers: Customer[];
  products: Product[];
  drivers: Driver[];
  vehicles: Vehicle[];
  onEditIGP?: (igpNumber: string, header: any, items: any[]) => void;
  onEditOGP?: (ogpNumber: string, header: any) => void;
  onFetchIGPDetail?: (igpNumber: string) => Promise<any>;
  onFetchOGPDetail?: (ogpNumber: string) => Promise<any>;
  onVoidIGP?: (igpNumber: string, reason: string) => Promise<void>;
  onRestoreIGP?: (igpNumber: string) => Promise<void>;
  onVoidOGP?: (ogpNumber: string, reason: string) => Promise<void>;
  onRestoreOGP?: (ogpNumber: string) => Promise<void>;
  onGetDocStatus?: (docNumber: string, type: 'IN' | 'OUT') => Promise<DocStatusInfo>;
}

interface Driver { id: string; name: string; cnic?: string; phone?: string; }

function formatDate(iso: string) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatDateTime(iso: string) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-PK', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function HistoryPage({
  movements, pallets, customers, products, drivers, vehicles: _vehicles,
  onEditIGP, onEditOGP, onFetchIGPDetail, onFetchOGPDetail,
  onVoidIGP, onRestoreIGP, onVoidOGP, onRestoreOGP, onGetDocStatus,
}: HistoryPageProps) {
  const { currentUser } = useAuth();
  const canUndoRedo = currentUser?.role === 'admin' || currentUser?.role === 'supervisor';
  const [viewMode, setViewMode] = useState<ViewMode>('transactions');
  const [search, setSearch] = useState('');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterType, setFilterType] = useState<''|'IN'|'OUT'|'MOVE'>('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Edit state
  const [editDoc, setEditDoc] = useState<{ type: 'IN'|'OUT'; docNumber: string } | null>(null);
  const [editSaved, setEditSaved] = useState(false);
  const [editHeader, setEditHeader] = useState<any>({});
  const [editItems, setEditItems] = useState<any[]>([]);
  const [editLines, setEditLines] = useState<any[]>([]);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  const openEditIGP = (docNumber: string) => {
    setEditSaved(false);
    setEditError('');
    setEditSuccess('');
    const docPallets = pallets.filter(p => p.igpNumber === docNumber);
    if (docPallets.length === 0) return;
    const first = docPallets[0];
    setEditHeader({
      vehicleNo:            first.vehicleNo || '',
      driverName:           first.driverName || '',
      driverId:             first.driverId || '',
      sealNumber:           first.sealNumber || '',
      temperatureAtReceipt: first.temperatureAtReceipt ?? -20,
      productTemperature:   first.productTemperature || '',
      condition:            first.condition || 'Good',
      notes:                first.notes || '',
      orderRef:             first.orderRef || '',
      departureTime:        first.departureTime || '',
      timeIn:               first.timeIn || '',
      customerId:           first.customerId || '',
      customerName:         first.customerName || '',
    });
    setEditItems(docPallets.map(p => ({
      palletId:       p.id,
      productId:      p.productId || '',
      productName:    p.productName,
      productCode:    p.productCode || '',
      cartons:        p.cartons,
      weightPerCarton: p.weightPerCarton,
      packingType:    p.packingType || 'Carton',
      mfgDate:        p.mfgDate || '',
      expiryDate:     p.expiryDate || '',
      batchNo:        p.batchNo || '',
      lotNo:          p.lotNo || '',
      room:           p.room || '',
      side:           p.side || '',
      row:            p.row || '',
      slot:           p.slot || '',
      position:       p.position ?? undefined,
    })));
    setEditDoc({ type: 'IN', docNumber });
  };

  const openEditOGP = (docNumber: string) => {
    setEditSaved(false);
    setEditError('');
    setEditSuccess('');
    const docMovements = movements.filter(m => m.docNumber === docNumber && m.type === 'OUT');
    if (docMovements.length === 0) return;
    const first = docMovements[0];
    setEditHeader({
      vehicleNo:   first.vehicleNo || '',
      driverName:  first.driverName || '',
      driverId:    first.driverId || '',
      destination: first.destination || '',
      reason:      first.reason || 'Dispatch',
      notes:       first.notes || '',
      orderRef:    first.orderRef || '',
      vehicleTemp: (first as any).vehicleTemp || (first as any).tempCheck || '',
      condition:   (first as any).condition || 'Good',
      customerId:  first.customerId || '',
      customerName: first.customerName || '',
    });
    setEditLines(docMovements.map(m => {
      const pal = pallets.find((p:any) => p.id === m.palletId);
      return {
        movementId:     m.id,
        palletId:       m.palletId,
        productId:      pal?.productId || '',
        productName:    m.productName,
        productCode:    m.productCode || '',
        currentCartons: m.cartons,
        newCartons:     m.cartons,
        weightPerCarton: pal?.weightPerCarton || (Number(m.totalWeight) / (Number(m.cartons) || 1)),
      };
    }));
    setEditDoc({ type: 'OUT', docNumber });
  };

  const handleSaveEdit = async () => {
    if (!editDoc) return;
    setEditLoading(true);
    setEditError('');
    setEditSuccess('');
    try {
      if (editDoc.type === 'IN' && onEditIGP) {
        const items = editItems.map(it => ({
          palletId:        it.palletId,
          productId:       it.productId,
          productName:     it.productName,
          productCode:     it.productCode,
          cartons:         Number(it.cartons),
          weightPerCarton: Number(it.weightPerCarton),
          packingType:     it.packingType,
          mfgDate:         it.mfgDate || undefined,
          expiryDate:      it.expiryDate || undefined,
          batchNo:         it.batchNo || undefined,
          lotNo:           it.lotNo || undefined,
        }));
        await onEditIGP(editDoc.docNumber, editHeader, items);
        setEditSuccess(`IGP ${editDoc.docNumber} updated successfully`);
        setEditSaved(true);
      } else if (editDoc.type === 'OUT' && onEditOGP) {
        const lines = editLines.map(l => ({
          movementId:     l.movementId,
          palletId:       l.palletId,
          newCartons:     Number(l.newCartons),
          weightPerCarton: Number(l.weightPerCarton),
          productId:      l.productId,
          productName:    l.productName,
          productCode:    l.productCode,
        }));
        await onEditOGP(editDoc.docNumber, editHeader, lines);
        setEditSuccess(`OGP ${editDoc.docNumber} updated successfully`);
        setEditSaved(true);
      }
    } catch (err: any) {
      setEditError(err.message || 'Failed to save changes. Please try again.');
    } finally {
      setEditLoading(false);
    }
  };


  const buildGatePassHtml = (docNumber: string, type: 'IN' | 'OUT', header?: any, items?: any[]) => {
    const GP_STYLE = `*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;color:#000;font-size:11px}.page{width:210mm;min-height:297mm;padding:10mm 12mm;position:relative}.copy-label{position:absolute;top:6mm;right:12mm;font-size:10px;font-weight:bold;border:1px solid #000;padding:3px 0;width:170px;text-align:center;border-radius:3px}.header-row{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:8px}.company-name{font-size:15px;font-weight:900;letter-spacing:0.1em}.company-sub{font-size:9px;color:#444;margin-top:1px}.doc-title{font-size:13px;font-weight:900;margin-top:6px}.header-right{display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0;margin-left:10px}.doc-no-box{border:2px solid #000;padding:5px 0;font-size:13px;font-weight:900;display:block;width:170px;text-align:center;letter-spacing:0.04em}.date-box{font-size:10px;margin-top:0;border:1px solid #000;padding:4px 0;display:block;width:170px;text-align:center}.info-section{border:1px solid #999;margin-bottom:8px}.info-row{display:grid;grid-template-columns:80px 1fr 80px 1fr;border-bottom:1px solid #ddd;font-size:10px}.info-row:last-child{border-bottom:0}.info-label{background:#f5f5f5;padding:4px 6px;font-weight:bold;border-right:1px solid #ddd}.info-val{padding:4px 6px;border-right:1px solid #ddd}table{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:8px}th{background:#eee;border:1px solid #999;padding:4px 5px;font-size:9px;font-weight:bold}td{border:1px solid #bbb;padding:4px 5px;text-align:center}td.left{text-align:left}.total-row{background:#f5f5f5;font-weight:bold}.bottom-row{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:6px}.bottom-field{display:flex;flex-direction:column;gap:2px}.bottom-label{font-size:9px;font-weight:bold}.field-box{border:1px solid #999;min-height:22px;padding:2px 6px}.remarks-row{display:flex;align-items:flex-start;gap:6px;margin-bottom:8px}.remarks-box{border:1px solid #999;flex:1;min-height:28px;padding:2px 6px}.sigs{display:grid;grid-template-columns:repeat(2,1fr);gap:30px;margin-top:10px;margin-bottom:8px}.sig-box{text-align:center}.sig-val{min-height:30px;border-bottom:1px solid #000;padding-bottom:2px;font-size:11px}.sig-label{font-size:9px;margin-top:3px}.note-box{font-size:8px;color:#555;border-top:1px solid #ccc;padding-top:5px;line-height:1.4}@media print{@page{size:A4 portrait;margin:0}body{margin:0}}`;

    if (type === 'IN') {
      const docPallets = pallets.filter(p => p.igpNumber === docNumber);
      if (docPallets.length === 0) return '';
      const h = header || { vehicleNo: docPallets[0].vehicleNo || '-', driverName: docPallets[0].driverName || '-', customerName: docPallets[0].customerName, temperatureAtReceipt: docPallets[0].temperatureAtReceipt, productTemperature: docPallets[0].productTemperature || '', condition: docPallets[0].condition, sealNumber: docPallets[0].sealNumber, orderRef: docPallets[0].orderRef, departureTime: docPallets[0].departureTime, timeIn: docPallets[0].timeIn || '', date: docPallets[0].dateIn?.slice(0,10), remarks: docPallets[0].notes || '' };
      const drv = drivers.find((d:any) => d.id === docPallets[0].driverId);
      const _igpCustRec = customers.find((x:any) => x.id === docPallets[0].customerId);
      const igpCustDisplay = _igpCustRec ? `${_igpCustRec.name} (${_igpCustRec.code})` : (h.customerName || '-');
      const buildCopy = (n: number) => `<div class="page" style="page-break-after:${n<3?'always':'avoid'}"><div class="copy-label">Copy ${n} of 3</div>${docPallets[0].revised?'<div style="text-align:center;color:red;font-size:9px;margin-top:2px">* REVISED: '+new Date(docPallets[0].revisedAt||'').toLocaleDateString('en-PK')+'</div>':''}<div class="header-row"><div><div class="company-name">PAKFROST (PVT) LIMITED</div><div class="company-sub">2 Km Off Manga Raiwind Road, Behind Achha Foods, Lahore</div><div class="company-sub">info.pakfrost@gmail.com | -18C to -22C</div><div class="doc-title">Inward Gate Pass</div></div><div class="header-right"><div class="doc-no-box">IGP No: ${docNumber}</div><div class="date-box"><b>Date:</b> ${h.date ? new Date(h.date).toLocaleDateString('en-PK',{day:'2-digit',month:'short',year:'numeric'}) : '-'}</div></div></div><div class="info-section"><div class="info-row"><span class="info-label">Order Ref:</span><span class="info-val">${h.orderRef||'-'}</span><span class="info-label">Vehicle No:</span><span class="info-val">${h.vehicleNo}</span></div><div class="info-row"><span class="info-label">Customer:</span><span class="info-val">${igpCustDisplay}</span><span class="info-label">Driver Name:</span><span class="info-val">${h.driverName}</span></div><div class="info-row"><span class="info-label">Cell No:</span><span class="info-val">${drv?.phone||'-'}</span><span class="info-label">CNIC:</span><span class="info-val">${drv?.cnic||'-'}</span></div></div><table><thead><tr><th>Item No</th><th style="text-align:left">Description</th><th>Pack Type</th><th>Qty</th><th>Wt/Unit</th><th>Total Kg</th><th>Expiry Date</th></tr></thead><tbody>${(()=>{const grp={};docPallets.forEach(p=>{const k=p.productCode||p.productName;if(!grp[k])grp[k]={...p,cartons:0,totalWeight:0};grp[k].cartons+=Number(p.cartons);grp[k].totalWeight+=Number(p.totalWeight);});const rows=Object.values(grp);return rows.map((p,i)=>`<tr><td>${i+1}</td><td class="left">${p.productCode ? p.productCode+' '+p.productName : p.productName}</td><td>${p.packingType||'Carton'}</td><td><b>${p.cartons}</b></td><td>${Number(p.weightPerCarton).toFixed(2)}</td><td><b>${p.totalWeight.toFixed(1)}</b></td><td>${formatDate(p.expiryDate)}</td></tr>`).join('')+Array.from({length:Math.max(0,6-rows.length)}).map(()=>'<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join('');})()}</tbody><tfoot><tr class="total-row"><td colspan="3" style="text-align:right">TOTALS:</td><td><b>${docPallets.reduce((s,p)=>s + Number(p.cartons),0)}</b></td><td>-</td><td><b>${docPallets.reduce((s,p)=>s + Number(p.totalWeight),0).toFixed(1)}</b></td><td></td></tr></tfoot></table><div class="bottom-row"><div class="bottom-field"><span class="bottom-label">Vehicle Temperature:</span><div class="field-box">${Number(h.temperatureAtReceipt).toFixed(1)}°C</div></div><div class="bottom-field"><span class="bottom-label">Product Temperature:</span><div class="field-box">${h.productTemperature||''}</div></div><div class="bottom-field"><span class="bottom-label">Stock Condition:</span><div class="field-box">${h.condition}</div></div></div><div class="bottom-row"><div class="bottom-field"><span class="bottom-label">Arrival Time:</span><div class="field-box">${h.timeIn||'-'}</div></div><div class="bottom-field"><span class="bottom-label">Departure Time:</span><div class="field-box">${h.departureTime||''}</div></div><div class="bottom-field"><span class="bottom-label">Seal No:</span><div class="field-box">${h.sealNumber||'-'}</div></div></div><div class="remarks-row"><span class="bottom-label">Remarks:</span><div class="remarks-box">${h.remarks||''}</div></div><div class="sigs"><div class="sig-box"><div class="sig-val"></div><div class="sig-label">Prepared By</div></div><div class="sig-box"><div class="sig-val"></div><div class="sig-label">Approved By</div></div></div><div class="note-box"><b>Note:</b> The Client Is Solely Responsible For Compliance With Punjab Food Authority Regulations. As Per Warehouse Policy, Expired, Damaged, Opened, Loose, Market Return, Or Undated Stock Is Not Acceptable.</div></div>`;
      return `<!DOCTYPE html><html><head><title>IGP - ${docNumber}</title><style>${GP_STYLE}</style></head><body>${buildCopy(1)}${buildCopy(2)}${buildCopy(3)}</body></html>`;
    } else {
      const docMoves = movements.filter(m => m.docNumber === docNumber && m.type === 'OUT');
      if (docMoves.length === 0) return '';
      const h = header || { vehicleNo: docMoves[0].vehicleNo||'-', driverName: docMoves[0].driverName||'-', destination: docMoves[0].destination||'-', reason: docMoves[0].reason||'Dispatch', orderRef: docMoves[0].orderRef||'', date: docMoves[0].createdAt?.slice(0,10), timeOut: new Date(docMoves[0].createdAt||'').toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}), customerName: docMoves[0].customerName, vehicleTemp: docMoves[0].vehicleTemp || '', condition: docMoves[0].condition||'Good', remarks: docMoves[0].notes || '' };
      const drv = drivers.find((d:any) => d.id === docMoves[0].driverId);
      const _ogpCustRec = customers.find((x:any) => x.id === docMoves[0].customerId);
      const ogpCustDisplay = _ogpCustRec ? `${_ogpCustRec.name} (${_ogpCustRec.code})` : (h.customerName || '-');
      const totalC = docMoves.reduce((s,m)=>s + Number(m.cartons),0);
      const totalW = docMoves.reduce((s,m)=>s + Number(m.totalWeight),0);
      const buildCopy = (n: number) => `<div class="page" style="page-break-after:${n<3?'always':'avoid'}"><div class="copy-label">Copy ${n} of 3</div><div class="header-row"><div><div class="company-name">PAKFROST (PVT) LIMITED</div><div class="company-sub">2 Km Off Manga Raiwind Road, Behind Achha Foods, Lahore</div><div class="company-sub">info.pakfrost@gmail.com | -18C to -22C</div><div class="doc-title">Outward Gate Pass</div></div><div class="header-right"><div class="doc-no-box">OGP No: ${docNumber}</div><div class="date-box"><b>Date:</b> ${h.date ? new Date(h.date).toLocaleDateString('en-PK',{day:'2-digit',month:'short',year:'numeric'}) : '-'}</div></div></div><div class="info-section"><div class="info-row"><span class="info-label">Order Ref:</span><span class="info-val">${h.orderRef||'-'}</span><span class="info-label">Vehicle No:</span><span class="info-val">${h.vehicleNo}</span></div><div class="info-row"><span class="info-label">Customer:</span><span class="info-val">${ogpCustDisplay}</span><span class="info-label">Driver Name:</span><span class="info-val">${h.driverName}</span></div><div class="info-row"><span class="info-label">Cell No:</span><span class="info-val">${drv?.phone||'-'}</span><span class="info-label">CNIC:</span><span class="info-val">${drv?.cnic||'-'}</span></div></div><table><thead><tr><th>Item No</th><th style="text-align:left">Description</th><th>Pack Type</th><th>Qty</th><th>Wt/Unit</th><th>Total Kg</th><th>Expiry Date</th></tr></thead><tbody>${(()=>{const grp={};docMoves.forEach(m=>{const p=pallets.find(x=>x.id===m.palletId);const k=m.productCode||m.productName;if(!grp[k])grp[k]={m,p,cartons:0,totalWeight:0};grp[k].cartons+=Number(m.cartons);grp[k].totalWeight+=Number(m.totalWeight);});const rows=Object.values(grp);return rows.map((g,i)=>`<tr><td>${i+1}</td><td class="left">${g.m.productCode ? g.m.productCode+' '+g.m.productName : g.m.productName}</td><td>${g.p?.packingType||'Carton'}</td><td><b>${g.cartons}</b></td><td>${g.p?.weightPerCarton ? Number(g.p.weightPerCarton).toFixed(2) : '-'}</td><td><b>${g.totalWeight.toFixed(1)}</b></td><td>${g.p?.expiryDate ? new Date(g.p.expiryDate).toLocaleDateString('en-PK',{day:'2-digit',month:'short',year:'numeric'}) : '-'}</td></tr>`).join('')+Array.from({length:Math.max(0,6-rows.length)}).map(()=>'<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join('');})()}</tbody><tfoot><tr class="total-row"><td colspan="3" style="text-align:right">TOTALS:</td><td><b>${totalC}</b></td><td>-</td><td><b>${totalW.toFixed(1)}</b></td><td></td></tr></tfoot></table><div class="bottom-row"><div class="bottom-field"><span class="bottom-label">Vehicle Temperature:</span><div class="field-box">${h.vehicleTemp ? (h.vehicleTemp.toString().includes('°') ? h.vehicleTemp : h.vehicleTemp+'°C') : '-'}</div></div><div class="bottom-field"><span class="bottom-label">Stock Condition:</span><div class="field-box">${h.condition||'Good'}</div></div><div class="bottom-field"><span class="bottom-label">Destination:</span><div class="field-box">${h.destination}</div></div></div><div class="bottom-row"><div class="bottom-field"><span class="bottom-label">Arrival Time:</span><div class="field-box"></div></div><div class="bottom-field"><span class="bottom-label">Departure Time:</span><div class="field-box">${h.timeOut||''}</div></div><div class="bottom-field"><span class="bottom-label">Reason:</span><div class="field-box">${h.reason}</div></div></div><div class="remarks-row"><span class="bottom-label">Remarks:</span><div class="remarks-box">${h.remarks||''}</div></div><div class="sigs"><div class="sig-box"><div class="sig-val"></div><div class="sig-label">Prepared By</div></div><div class="sig-box"><div class="sig-val"></div><div class="sig-label">Received By</div></div></div><div class="note-box"><b>Disclaimer:</b> Client Must Ensure That Vehicle Temperature Is At The Required Level Before Loading Begins. Once The Order Has Been Dispatched, Pakfrost Will Not Be Held Responsible For Any Temperature Variations During Transit.</div></div>`;
      return `<!DOCTYPE html><html><head><title>OGP - ${docNumber}</title><style>${GP_STYLE}</style></head><body>${buildCopy(1)}${buildCopy(2)}${buildCopy(3)}</body></html>`;
    }
  };

  // H-FIX: builds the SAME gate pass HTML as the live Stock IN/OUT print,
  // using freshly-fetched data (works even after pallets are dispatched/moved,
  // unlike the local `pallets`/`movements` state which only holds active pallets).
  const buildGatePassHtmlFromDetail = (docNumber: string, type: 'IN' | 'OUT', detail: any) => {
    const GP_STYLE = `*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;color:#000;font-size:11px}.page{width:210mm;min-height:297mm;padding:10mm 12mm;position:relative}.copy-label{position:absolute;top:6mm;right:12mm;font-size:10px;font-weight:bold;border:1px solid #000;padding:3px 0;width:170px;text-align:center;border-radius:3px}.header-row{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:8px}.company-name{font-size:15px;font-weight:900;letter-spacing:0.1em}.company-sub{font-size:9px;color:#444;margin-top:1px}.doc-title{font-size:13px;font-weight:900;margin-top:6px}.header-right{display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0;margin-left:10px}.doc-no-box{border:2px solid #000;padding:5px 0;font-size:13px;font-weight:900;display:block;width:170px;text-align:center;letter-spacing:0.04em}.date-box{font-size:10px;margin-top:0;border:1px solid #000;padding:4px 0;display:block;width:170px;text-align:center}.info-section{border:1px solid #999;margin-bottom:8px}.info-row{display:grid;grid-template-columns:80px 1fr 80px 1fr;border-bottom:1px solid #ddd;font-size:10px}.info-row:last-child{border-bottom:0}.info-label{background:#f5f5f5;padding:4px 6px;font-weight:bold;border-right:1px solid #ddd}.info-val{padding:4px 6px;border-right:1px solid #ddd}table{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:8px}th{background:#eee;border:1px solid #999;padding:4px 5px;font-size:9px;font-weight:bold}td{border:1px solid #bbb;padding:4px 5px;text-align:center}td.left{text-align:left}.total-row{background:#f5f5f5;font-weight:bold}.bottom-row{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:6px}.bottom-field{display:flex;flex-direction:column;gap:2px}.bottom-label{font-size:9px;font-weight:bold}.field-box{border:1px solid #999;min-height:22px;padding:2px 6px}.remarks-row{display:flex;align-items:flex-start;gap:6px;margin-bottom:8px}.remarks-box{border:1px solid #999;flex:1;min-height:28px;padding:2px 6px}.sigs{display:grid;grid-template-columns:repeat(2,1fr);gap:30px;margin-top:10px;margin-bottom:8px}.sig-box{text-align:center}.sig-val{min-height:30px;border-bottom:1px solid #000;padding-bottom:2px;font-size:11px}.sig-label{font-size:9px;margin-top:3px}.note-box{font-size:8px;color:#555;border-top:1px solid #ccc;padding-top:5px;line-height:1.4}@media print{@page{size:A4 portrait;margin:0}body{margin:0}}`;

    if (type === 'IN') {
      const docPallets: any[] = detail.pallets || [];
      if (docPallets.length === 0) return '';
      const firstP = docPallets[0];
      const firstM = (detail.movements || [])[0];
      const h = {
        vehicleNo: firstP.vehicleNo || '-', driverName: firstP.driverName || '-',
        orderRef: firstP.orderRef || '', date: firstP.dateIn,
        temperatureAtReceipt: firstP.temperatureAtReceipt, condition: firstP.condition || 'Good',
        sealNumber: firstP.sealNumber, departureTime: firstP.departureTime, timeIn: firstP.timeIn || '',
        remarks: firstP.notes || '', driverId: firstP.driverId,
        customerId: firstP.customerId, customerName: firstP.customerName,
        preparedBy: firstM?.operatorName || '',
      };
      const drv = drivers.find((d: any) => d.id === h.driverId);
      const custRec = customers.find((x: any) => x.id === h.customerId);
      const custDisplay = custRec ? `${custRec.name} (${custRec.code})` : (h.customerName || '-');

      const buildCopy = (n: number) => `<div class="page" style="page-break-after:${n<3?'always':'avoid'}"><div class="copy-label">Copy ${n} of 3</div><div class="header-row"><div><div class="company-name">PAKFROST (PVT) LIMITED</div><div class="company-sub">2 Km Off Manga Raiwind Road, Behind Achha Foods, Lahore</div><div class="company-sub">info.pakfrost@gmail.com &nbsp;|&nbsp; Premium Temperature Controlled Warehousing | -18C to -22C</div><div class="doc-title">Inward Gate Pass</div></div><div class="header-right"><div class="doc-no-box">IGP No: ${docNumber}</div><div class="date-box"><b>Date:</b> ${h.date ? new Date(h.date).toLocaleDateString('en-PK',{day:'2-digit',month:'short',year:'numeric'}) : '-'}</div></div></div><div class="info-section"><div class="info-row"><span class="info-label">Order Ref:</span><span class="info-val">${h.orderRef||'-'}</span><span class="info-label">Vehicle No:</span><span class="info-val">${h.vehicleNo}</span></div><div class="info-row"><span class="info-label">Customer:</span><span class="info-val">${custDisplay}</span><span class="info-label">Driver Name:</span><span class="info-val">${h.driverName}</span></div><div class="info-row"><span class="info-label">Cell No:</span><span class="info-val">${drv?.phone||'-'}</span><span class="info-label">CNIC:</span><span class="info-val">${drv?.cnic||'-'}</span></div></div><table><thead><tr><th>Item No</th><th style="text-align:left">Description</th><th>Pack Type</th><th>Qty</th><th>Wt/Unit</th><th>Total Kg</th><th>Expiry Date</th></tr></thead><tbody>${(()=>{const grp:any={};docPallets.forEach(p=>{const k=p.productCode||p.productName;if(!grp[k])grp[k]={...p,cartons:0,totalWeight:0};grp[k].cartons+=Number(p.cartons);grp[k].totalWeight+=Number(p.totalWeight);});const rows=Object.values(grp);return rows.map((p:any,i:number)=>`<tr><td>${i+1}</td><td class="left">${p.productCode ? p.productCode+' '+p.productName : p.productName}</td><td>${p.packingType||'Carton'}</td><td><b>${p.cartons}</b></td><td>${Number(p.weightPerCarton)}</td><td><b>${p.totalWeight.toFixed(1)}</b></td><td>${formatDate(p.expiryDate)}</td></tr>`).join('')+Array.from({length:Math.max(0,6-rows.length)}).map(()=>'<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join('');})()}</tbody><tfoot><tr class="total-row"><td colspan="3" style="text-align:right">TOTALS:</td><td><b>${docPallets.reduce((s,p)=>s + Number(p.cartons),0)}</b></td><td>-</td><td><b>${docPallets.reduce((s,p)=>s + Number(p.totalWeight),0).toFixed(1)}</b></td><td></td></tr></tfoot></table><div class="bottom-row"><div class="bottom-field"><span class="bottom-label">Vehicle Temperature:</span><div class="field-box">${h.temperatureAtReceipt}°C</div></div><div class="bottom-field"><span class="bottom-label">Product Temperature:</span><div class="field-box"></div></div><div class="bottom-field"><span class="bottom-label">Stock Condition:</span><div class="field-box">${h.condition}</div></div></div><div class="bottom-row"><div class="bottom-field"><span class="bottom-label">Arrival Time:</span><div class="field-box">${h.timeIn||'-'}</div></div><div class="bottom-field"><span class="bottom-label">Departure Time:</span><div class="field-box">${h.departureTime||''}</div></div><div class="bottom-field"><span class="bottom-label">Seal No:</span><div class="field-box">${h.sealNumber||'-'}</div></div></div><div class="remarks-row"><span class="bottom-label">Remarks:</span><div class="remarks-box">${h.remarks||''}</div></div><div class="sigs"><div class="sig-box"><div class="sig-val">${h.preparedBy}</div><div class="sig-label">Prepared By</div></div><div class="sig-box"><div class="sig-val"></div><div class="sig-label">Approved By</div></div></div><div class="note-box"><b>Note:</b> The Client Is Solely Responsible For Compliance With Punjab Food Authority Regulations. As Per Warehouse Policy, Expired, Damaged, Opened, Loose, Market Return, Or Undated Stock Is Not Acceptable. We Follow Best Practices And Are Committed To Continuous Improvement In Food Safety Standards.</div></div>`;
      return `<!DOCTYPE html><html><head><title>IGP - ${docNumber}</title><style>${GP_STYLE}</style></head><body>${buildCopy(1)}${buildCopy(2)}${buildCopy(3)}</body></html>`;
    } else {
      const docMoves: any[] = detail.movements || [];
      if (docMoves.length === 0) return '';
      const firstM = docMoves[0];
      const h = {
        vehicleNo: firstM.vehicleNo || '-', driverName: firstM.driverName || '-',
        destination: firstM.destination || '-', reason: firstM.reason || 'Dispatch',
        orderRef: firstM.orderRef || '', date: firstM.createdAt,
        customerId: firstM.customerId, customerName: firstM.customerName,
        vehicleTemp: firstM.vehicleTemp || '', condition: firstM.condition || 'Good',
        remarks: firstM.notes || '', driverId: firstM.driverId,
        preparedBy: firstM.operatorName || '',
      };
      const drv = drivers.find((d: any) => d.id === h.driverId);
      const custRec = customers.find((x: any) => x.id === h.customerId);
      const custDisplay = custRec ? `${custRec.name} (${custRec.code})` : (h.customerName || '-');
      const totalC = docMoves.reduce((s,m)=>s + Number(m.cartons),0);
      const totalW = docMoves.reduce((s,m)=>s + Number(m.totalWeight),0);

      const buildCopy = (n: number) => `<div class="page" style="page-break-after:${n<3?'always':'avoid'}"><div class="copy-label">Copy ${n} of 3</div><div class="header-row"><div><div class="company-name">PAKFROST (PVT) LIMITED</div><div class="company-sub">2 Km Off Manga Raiwind Road, Behind Achha Foods, Lahore</div><div class="company-sub">info.pakfrost@gmail.com &nbsp;|&nbsp; Premium Temperature Controlled Warehousing | -18C to -22C</div><div class="doc-title">Outward Gate Pass</div></div><div class="header-right"><div class="doc-no-box">OGP No: ${docNumber}</div><div class="date-box"><b>Date:</b> ${h.date ? new Date(h.date).toLocaleDateString('en-PK',{day:'2-digit',month:'short',year:'numeric'}) : '-'}</div></div></div><div class="info-section"><div class="info-row"><span class="info-label">Order Ref:</span><span class="info-val">${h.orderRef||'-'}</span><span class="info-label">Vehicle No:</span><span class="info-val">${h.vehicleNo}</span></div><div class="info-row"><span class="info-label">Customer:</span><span class="info-val">${custDisplay}</span><span class="info-label">Driver Name:</span><span class="info-val">${h.driverName}</span></div><div class="info-row"><span class="info-label">Cell No:</span><span class="info-val">${drv?.phone||'-'}</span><span class="info-label">CNIC:</span><span class="info-val">${drv?.cnic||'-'}</span></div></div><table><thead><tr><th>Item No</th><th style="text-align:left">Description</th><th>Pack Type</th><th>Qty</th><th>Wt/Unit</th><th>Total Kg</th><th>Expiry Date</th></tr></thead><tbody>${(()=>{const grp:any={};docMoves.forEach(m=>{const k=m.productCode||m.productName;if(!grp[k])grp[k]={m,pallet:m.pallet,cartons:0,totalWeight:0};grp[k].cartons+=Number(m.cartons);grp[k].totalWeight+=Number(m.totalWeight);});const rows=Object.values(grp);return rows.map((g:any,i:number)=>{const wpc=g.pallet?.weightPerCarton ?? (g.cartons ? g.totalWeight/g.cartons : 0);const exp=g.pallet?.expiryDate ? new Date(g.pallet.expiryDate).toLocaleDateString('en-PK',{day:'2-digit',month:'short',year:'numeric'}) : '-';return `<tr><td>${i+1}</td><td class="left">${g.m.productCode ? g.m.productCode+' '+g.m.productName : g.m.productName}</td><td>Carton</td><td><b>${g.cartons}</b></td><td>${Number(wpc).toFixed(2)}</td><td><b>${g.totalWeight.toFixed(1)}</b></td><td>${exp}</td></tr>`;}).join('')+Array.from({length:Math.max(0,6-rows.length)}).map(()=>'<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>').join('');})()}</tbody><tfoot><tr class="total-row"><td colspan="3" style="text-align:right">TOTALS:</td><td><b>${totalC}</b></td><td>-</td><td><b>${totalW.toFixed(1)}</b></td><td></td></tr></tfoot></table><div class="bottom-row"><div class="bottom-field"><span class="bottom-label">Vehicle Temperature:</span><div class="field-box">${h.vehicleTemp ? (h.vehicleTemp.toString().includes('°') ? h.vehicleTemp : h.vehicleTemp+'°C') : '-'}</div></div><div class="bottom-field"><span class="bottom-label">Stock Condition:</span><div class="field-box">${h.condition||'Good'}</div></div><div class="bottom-field"><span class="bottom-label">Destination:</span><div class="field-box">${h.destination}</div></div></div><div class="bottom-row"><div class="bottom-field"><span class="bottom-label">Arrival Time:</span><div class="field-box"></div></div><div class="bottom-field"><span class="bottom-label">Departure Time:</span><div class="field-box">${h.date ? new Date(h.date).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : ''}</div></div><div class="bottom-field"><span class="bottom-label">Reason:</span><div class="field-box">${h.reason}</div></div></div><div class="remarks-row"><span class="bottom-label">Remarks:</span><div class="remarks-box">${h.remarks||''}</div></div><div class="sigs"><div class="sig-box"><div class="sig-val">${h.preparedBy}</div><div class="sig-label">Prepared By</div></div><div class="sig-box"><div class="sig-val"></div><div class="sig-label">Received By</div></div></div><div class="note-box"><b>Disclaimer:</b> Client Must Ensure That Vehicle Temperature Is At The Required Level Before Loading Begins. Once The Order Has Been Dispatched From The Pakfrost Warehouse, Pakfrost Will Not Be Held Responsible For Any Temperature Variations Or Degradation In Product Quality During Transit.</div></div>`;
      return `<!DOCTYPE html><html><head><title>OGP - ${docNumber}</title><style>${GP_STYLE}</style></head><body>${buildCopy(1)}${buildCopy(2)}${buildCopy(3)}</body></html>`;
    }
  };

  const viewGatePass = async (docNumber: string, type: 'IN' | 'OUT') => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write('<body style="font-family:Arial;padding:24px;color:#555">Loading gate pass…</body>');
    win.document.close();
    try {
      const fetchFn = type === 'IN' ? onFetchIGPDetail : onFetchOGPDetail;
      let html = '';
      if (fetchFn) {
        const detail = await fetchFn(docNumber);
        html = buildGatePassHtmlFromDetail(docNumber, type, detail);
      } else {
        // Fallback to old local-data builder if fetch function wasn't provided
        html = buildGatePassHtml(docNumber, type);
      }
      if (!html) {
        win.document.open();
        win.document.write('<body style="font-family:Arial;padding:24px;color:#555">Gate pass not found.</body>');
        win.document.close();
        return;
      }
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (err) {
      win.document.open();
      win.document.write('<body style="font-family:Arial;padding:24px;color:#b91c1c">Could not load gate pass. Please try again.</body>');
      win.document.close();
    }
  };

  const printEditedGatePass = () => {
    if (!editDoc) return;
    const html = buildGatePassHtml(editDoc.docNumber, editDoc.type, editHeader, editItems);
    if (!html) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  };
  const [journeyProductId, setJourneyProductId] = useState('');
  const [journeyCustomerId, setJourneyCustomerId] = useState('');
  const [ledgerCustomerId, setLedgerCustomerId] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const filteredMovements = useMemo(() => {
    let m = [...movements];
    if (filterCustomer) m = m.filter(x => x.customerId === filterCustomer);
    if (filterType)     m = m.filter(x => x.type === filterType);
    if (filterDateFrom) m = m.filter(x => new Date(x.date) >= new Date(filterDateFrom));
    if (filterDateTo)   m = m.filter(x => new Date(x.date) <= new Date(filterDateTo + 'T23:59:59'));
    if (search) {
      const q = search.toLowerCase();
      m = m.filter(x =>
        x.docNumber.toLowerCase().includes(q) ||
        x.customerName.toLowerCase().includes(q) ||
        x.productName.toLowerCase().includes(q) ||
        x.productCode.toLowerCase().includes(q) ||
        (x.vehicleNo || '').toLowerCase().includes(q) ||
        (x.driverName || '').toLowerCase().includes(q) ||
        (x.destination || '').toLowerCase().includes(q)
      );
    }
    return m.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [movements, filterCustomer, filterType, filterDateFrom, filterDateTo, search]);

  // Reset to page 1 when filters change
  const totalPages = Math.max(1, Math.ceil(filteredMovements.length / PAGE_SIZE));
  const paginatedMovements = useMemo(() =>
    filteredMovements.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
  [filteredMovements, page]);

  // Reset to page 1 whenever filters change
  // (import useEffect at the top if not already imported)
  // Reset page when search/filter changes
  useEffect(() => { setPage(1); }, [filterCustomer, filterType, filterDateFrom, filterDateTo, search]);

  // Undo / Redo modal
  const [undoModal, setUndoModal] = useState<{
    type: 'IN' | 'OUT';
    docNumber: string;
    action: 'void' | 'restore';
    statusInfo?: DocStatusInfo;
  } | null>(null);
  const [undoReason, setUndoReason] = useState('');
  const [undoError, setUndoError] = useState('');
  const [undoSuccess, setUndoSuccess] = useState('');

  const isDocVoided = useCallback((docNumber: string, type: 'IN' | 'OUT') => {
    const docMoves = movements.filter(m => m.docNumber === docNumber && m.type === type);
    return docMoves.length > 0 && docMoves.every(m => m.status === 'voided');
  }, [movements]);

  const openUndoModal = async (docNumber: string, type: 'IN' | 'OUT', action: 'void' | 'restore') => {
    setUndoError('');
    setUndoSuccess('');
    setUndoReason('');
    let statusInfo: DocStatusInfo | undefined;
    if (onGetDocStatus) {
      try {
        statusInfo = await onGetDocStatus(docNumber, type);
        if (action === 'void' && !statusInfo.canVoid) {
          setUndoError(statusInfo.blockReason || 'Cannot undo this document');
        }
        if (action === 'restore' && !statusInfo.canRestore) {
          setUndoError(statusInfo.blockReason || 'Cannot restore this document');
        }
      } catch (err: any) {
        setUndoError(err.message || 'Could not check document status');
        return; // Don't open modal if status check fails
      }
    }
    setUndoModal({ type, docNumber, action, statusInfo });
  };

  const handleUndoRedoConfirm = async () => {
    if (!undoModal) return;
    setUndoLoading(true);
    setUndoError('');
    setUndoSuccess('');
    try {
      if (undoModal.action === 'void') {
        if (!undoReason.trim() || undoReason.trim().length < 3) {
          setUndoError('Please enter a reason (min 3 characters)');
          setUndoLoading(false);
          return;
        }
        if (undoModal.type === 'IN' && onVoidIGP) await onVoidIGP(undoModal.docNumber, undoReason.trim());
        else if (undoModal.type === 'OUT' && onVoidOGP) await onVoidOGP(undoModal.docNumber, undoReason.trim());
        setUndoSuccess(`${undoModal.type === 'IN' ? 'IGP' : 'OGP'} ${undoModal.docNumber} has been undone successfully.`);
      } else {
        if (undoModal.type === 'IN' && onRestoreIGP) await onRestoreIGP(undoModal.docNumber);
        else if (undoModal.type === 'OUT' && onRestoreOGP) await onRestoreOGP(undoModal.docNumber);
        setUndoSuccess(`${undoModal.type === 'IN' ? 'IGP' : 'OGP'} ${undoModal.docNumber} has been restored successfully.`);
      }
      // Auto-close modal after 1.5 seconds so user can see the success message
      setTimeout(() => {
        setUndoModal(null);
        setUndoReason('');
        setUndoSuccess('');
      }, 1500);
    } catch (err: any) {
      setUndoError(err.message || 'Operation failed');
    } finally {
      setUndoLoading(false);
    }
  };

  const stats = useMemo(() => ({
    totalIn:  filteredMovements.filter(m => m.type === 'IN'  && m.status !== 'voided').reduce((s, m) => s + Number(m.cartons), 0),
    totalOut: filteredMovements.filter(m => m.type === 'OUT' && m.status !== 'voided').reduce((s, m) => s + Number(m.cartons), 0),
    count: filteredMovements.length,
  }), [filteredMovements]);

  const journeyPallets = useMemo(() => {
    if (viewMode !== 'product-journey') return [];
    return pallets.filter(p =>
      (!journeyCustomerId || p.customerId === journeyCustomerId) &&
      (!journeyProductId  || p.productId  === journeyProductId)
    );
  }, [pallets, journeyCustomerId, journeyProductId, viewMode]);

  const journeyMoves = useMemo(() => {
    if (viewMode !== 'product-journey' || journeyPallets.length === 0) return [];
    const ids = new Set(journeyPallets.map(p => p.id));
    return movements.filter(m => ids.has(m.palletId)).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [movements, journeyPallets, viewMode]);

  const ledgerData = useMemo(() => {
    if (viewMode !== 'customer-ledger' || !ledgerCustomerId) return null;
    const cust = customers.find(c => c.id === ledgerCustomerId);
    const custMoves = movements.filter(m => m.customerId === ledgerCustomerId).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const custPallets = pallets.filter(p => p.customerId === ledgerCustomerId && p.status === 'active');

    let balance = 0;
    const ledger = custMoves.map(m => {
      if (m.status !== 'voided') {
        if (m.type === 'IN')  balance += m.cartons;
        if (m.type === 'OUT') balance -= m.cartons;
      }
      return { ...m, runningBalance: balance };
    });

    const totalIn   = custMoves.filter(m => m.type === 'IN'  && m.status !== 'voided').reduce((s, m) => s + Number(m.cartons), 0);
    const totalOut  = custMoves.filter(m => m.type === 'OUT' && m.status !== 'voided').reduce((s, m) => s + Number(m.cartons), 0);
    const products  = [...new Set(custPallets.map(p => p.productName))];
    const avgStay   = custPallets.length > 0
      ? (custPallets.reduce((s, p) => s + Math.ceil((Date.now() - new Date(p.dateIn).getTime()) / 86400000), 0) / custPallets.length).toFixed(1)
      : '-';

    return { cust, ledger, totalIn, totalOut, balance, products, avgStay };
  }, [movements, pallets, customers, ledgerCustomerId, viewMode]);

  const inp   = "px-3 py-2 rounded-lg  text-sm outline-none";
  const IS    = { background: 'var(--bg-page)', border: '1px solid var(--border-default)' };
  const tabC  = 'var(--primary)';

  const MODES: { key: ViewMode; label: string }[] = [
    { key: 'transactions',     label: 'Transaction List' },
    { key: 'product-journey',  label: 'Product Journey'  },
    { key: 'customer-ledger',  label: 'Customer Ledger'  },
  ];

  const handlePrint = () => {
    const printWin = window.open('', '_blank');
    if (!printWin) return;
    const dateStr = new Date().toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });

    let rows = '';
    if (viewMode === 'transactions') {
      rows = filteredMovements.map(m =>
        `<tr>
          <td>${new Date(m.createdAt||m.date||"").toLocaleDateString('en-PK',{day:'2-digit',month:'short',year:'numeric'})}</td>
          <td>${m.docNumber}</td>
          <td style="color:${m.type==='IN'?'green':m.type==='OUT'?'#e05':'#08c'}">${m.type}</td>
          <td>${m.customerName}</td>
          <td>${m.productName}</td>
          <td>${m.cartons}</td>
          <td>${m.location}</td>
          <td>${m.vehicleNo||'-'}</td>
          <td>${m.driverName||'-'}</td>
        </tr>`
      ).join('');
      printWin.document.write(`<!DOCTYPE html><html><head><title>Stock History</title>
        <style>body{font-family:Arial,sans-serif;padding:20px}h1{font-size:16px;margin:0}.sub{font-size:11px;color:#555;margin:2px 0 14px}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#f0f0f0;padding:5px 7px;text-align:left;border:1px solid #ddd}td{padding:4px 7px;border:1px solid #eee}tr:nth-child(even){background:#fafafa}@media print{body{padding:10px}}</style>
        </head><body>
        <h1>PAKFROST — Stock History</h1>
        <p class="sub">Printed: ${dateStr} &nbsp;|&nbsp; ${filteredMovements.length} records</p>
        <table><thead><tr><th>Date</th><th>Doc No</th><th>Type</th><th>Customer</th><th>Product</th><th>Qty</th><th>Location</th><th>Vehicle</th><th>Driver</th></tr></thead>
        <tbody>${rows}</tbody></table></body></html>`);
    } else if (viewMode === 'customer-ledger' && ledgerData) {
      rows = ledgerData.ledger.map(m =>
        `<tr>
          <td>${new Date(m.createdAt||m.date||"").toLocaleDateString('en-PK',{day:'2-digit',month:'short',year:'numeric'})}</td>
          <td>${m.docNumber}</td>
          <td style="color:${m.type==='IN'?'green':'#e05'}">${m.type}</td>
          <td>${m.productName}</td>
          <td style="color:green">${m.type==='IN'?m.cartons:'-'}</td>
          <td style="color:#e05">${m.type==='OUT'?m.cartons:'-'}</td>
          <td><b>${m.runningBalance}</b></td>
        </tr>`
      ).join('');
      printWin.document.write(`<!DOCTYPE html><html><head><title>Customer Ledger</title>
        <style>body{font-family:Arial,sans-serif;padding:20px}h1{font-size:16px;margin:0}h2{font-size:13px;margin:10px 0 4px}.sub{font-size:11px;color:#555;margin:2px 0 14px}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#f0f0f0;padding:5px 7px;text-align:left;border:1px solid #ddd}td{padding:4px 7px;border:1px solid #eee}tr:nth-child(even){background:#fafafa}@media print{body{padding:10px}}</style>
        </head><body>
        <h1>PAKFROST — Customer Ledger</h1>
        <p class="sub">Customer: <b>${ledgerData.cust?.name}</b> &nbsp;|&nbsp; Printed: ${dateStr}</p>
        <p style="font-size:12px">Total IN: <b>${ledgerData.totalIn}</b> units &nbsp; Total OUT: <b>${ledgerData.totalOut}</b> units &nbsp; Balance: <b>${ledgerData.balance}</b> units</p>
        <table><thead><tr><th>Date</th><th>Doc No</th><th>Type</th><th>Product</th><th>IN</th><th>OUT</th><th>Balance</th></tr></thead>
        <tbody>${rows}</tbody></table></body></html>`);
    } else {
      printWin.document.write(`<!DOCTYPE html><html><body><p style="font-family:Arial;padding:20px">Please switch to Transaction List or Customer Ledger to print.</p></body></html>`);
    }
    printWin.document.close();
    setTimeout(() => printWin.print(), 250);
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
          <h1 className="text-2xl font-bold">Stock History & Ledger</h1>
          <div className="flex items-center gap-3">
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{movements.length} total records</div>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ background: 'rgba(43,184,232,0.15)', color: 'var(--primary)', border: '1px solid rgba(43,184,232,0.3)' }}
            >
              <Printer className="w-4 h-4" /> Print
            </button>
          </div>
        </div>

        {/* View mode selector */}
        <div className="flex gap-1 p-1 rounded-xl mb-5" style={{ background: 'var(--bg-card)' }}>
          {MODES.map(m => (
            <button key={m.key} onClick={() => setViewMode(m.key)}
              className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{ background: viewMode===m.key ? 'rgba(43,184,232,0.12)' : 'transparent', color: viewMode===m.key ? tabC : '#7a9bb5', border: viewMode===m.key ? '1px solid rgba(43,184,232,0.25)' : '1px solid transparent' }}>
              {m.label}
            </button>
          ))}
        </div>

        {/* Transaction List */}
        {viewMode === 'transactions' && (
          <>
            <div className="flex gap-3 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  className={`w-full pl-9 ${inp}`} style={IS} placeholder="Search doc no, customer, product, vehicle, driver..." />
              </div>
              <button onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
                style={{ background: showFilters ? 'rgba(43,184,232,0.12)' : 'rgba(0,0,0,0.3)', color: showFilters ? 'var(--primary)' : '#7a9bb5', border: '1px solid var(--border-default)' }}>
                <Filter className="w-4 h-4" /> Filters
              </button>
            </div>

            {showFilters && (
              <div className="grid grid-cols-3 gap-3 mb-4 p-4 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Customer</label>
                  <select value={filterCustomer} onChange={e => setFilterCustomer(e.target.value)} className={`w-full ${inp}`} style={IS}>
                    <option value="">All Customers</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Type</label>
                  <select value={filterType} onChange={e => setFilterType(e.target.value as any)} className={`w-full ${inp}`} style={IS}>
                    <option value="">All Types</option>
                    <option value="IN">Stock IN</option>
                    <option value="OUT">Stock OUT</option>
                    <option value="MOVE">Move</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Date From</label>
                  <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className={`w-full ${inp}`} style={IS} />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Date To</label>
                  <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className={`w-full ${inp}`} style={IS} />
                </div>
                <div className="flex items-end">
                  <button onClick={() => { setFilterCustomer(''); setFilterType(''); setFilterDateFrom(''); setFilterDateTo(''); setSearch(''); }}
                    className="px-4 py-2 rounded-lg text-sm w-full" style={{ border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                    Clear Filters
                  </button>
                </div>
              </div>
            )}

            {/* Summary stats */}
            <div className="grid grid-cols-3 sm:grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Records', value: stats.count, color: 'var(--primary)' },
                { label: 'IN Qty', value: stats.totalIn.toLocaleString(), color: '#4ade80' },
                { label: 'OUT Qty', value: stats.totalOut.toLocaleString(), color: '#f97316' },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-3" style={{ background: 'var(--bg-card)', border: '1px solid rgba(43,184,232,0.08)' }}>
                  <div className="text-base sm:text-lg font-black leading-tight" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[900px]">
                  <thead>
                    <tr style={{ background: 'var(--bg-input)' }}>
                      {['Date','Doc No','Type','Customer','Product','Qty','Weight','Location','Vehicle','Driver','Actions'].map(h => (
                        <th key={h} className="px-3 py-3 text-left text-xs font-semibold uppercase whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const seenDocActions = new Set<string>();
                      return paginatedMovements.map(m => {
                        const voided = m.status === 'voided';
                        const docKey = `${m.type}:${m.docNumber}`;
                        const showDocActions = m.type !== 'MOVE' && !seenDocActions.has(docKey);
                        if (showDocActions) seenDocActions.add(docKey);
                        const docVoided = m.type !== 'MOVE' && isDocVoided(m.docNumber, m.type as 'IN' | 'OUT');
                        return (
                      <tr key={m.id} className="hover:bg-white/5 transition-colors" style={{
                        borderTop: '1px solid rgba(43,184,232,0.05)',
                        opacity: voided ? 0.55 : 1,
                      }}>
                        <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{formatDateTime(m.createdAt||m.date||"")}</td>
                        <td className="px-3 py-2.5 font-mono font-bold text-xs cursor-pointer hover:underline" style={{ color: voided ? '#94a3b8' : 'var(--primary)', textDecoration: voided ? 'line-through' : undefined }} onClick={() => m.type !== 'MOVE' && viewGatePass(m.docNumber, m.type as 'IN'|'OUT')} title="Click to view Gate Pass">
                          {m.docNumber}
                          {docVoided && showDocActions && <span className="ml-1 text-[9px] font-bold px-1 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>VOID</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ background: m.type==='IN' ? 'rgba(74,222,128,0.12)' : m.type==='OUT' ? 'rgba(249,115,22,0.12)' : 'rgba(43,184,232,0.12)', color: m.type==='IN' ? '#4ade80' : m.type==='OUT' ? '#f97316' : 'var(--primary)' }}>
                            {m.type}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 ">{m.customerName}</td>
                        <td className="px-3 py-2.5 font-medium ">{m.productName}</td>
                        <td className="px-3 py-2.5 font-bold" style={{ color: voided ? '#94a3b8' : m.type==='IN' ? '#4ade80' : '#f97316' }}>
                          {m.type==='IN' ? '+' : m.type==='OUT' ? '-' : ''}{m.cartons}
                        </td>
                        <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{m.totalWeight ? `${Number(m.totalWeight).toFixed(0)} kg` : '-'}</td>
                        <td className="px-3 py-2.5 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{m.location}</td>
                        <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{m.vehicleNo || '-'}</td>
                        <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{m.driverName || '-'}</td>
                        <td className="px-3 py-2.5">
                          {showDocActions && m.type !== 'MOVE' && (
                            <div className="flex gap-1 flex-wrap">
                              <button onClick={() => viewGatePass(m.docNumber, m.type as 'IN'|'OUT')}
                                className="p-1.5 rounded-lg transition-colors hover:opacity-80"
                                title="View Gate Pass"
                                style={{ background: 'rgba(22,163,74,0.1)', color: '#16a34a' }}>
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              {!docVoided && (
                                <button onClick={() => m.type === 'IN' ? openEditIGP(m.docNumber) : openEditOGP(m.docNumber)}
                                  className="p-1.5 rounded-lg transition-colors hover:opacity-80"
                                  title="Edit this document"
                                  style={{ background: 'rgba(43,184,232,0.1)', color: 'var(--primary)' }}>
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {canUndoRedo && !docVoided && (
                                <button onClick={() => openUndoModal(m.docNumber, m.type as 'IN'|'OUT', 'void')}
                                  className="p-1.5 rounded-lg transition-colors hover:opacity-80"
                                  title="Undo — reverse this gate pass"
                                  style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                                  <Undo2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {canUndoRedo && docVoided && (
                                <button onClick={() => openUndoModal(m.docNumber, m.type as 'IN'|'OUT', 'restore')}
                                  className="p-1.5 rounded-lg transition-colors hover:opacity-80"
                                  title="Redo — restore this gate pass"
                                  style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                          {m.revised && <span className="ml-1 text-[9px] text-yellow-400 font-bold">REV</span>}
                        </td>
                      </tr>
                        );
                      });
                    })()}
                    {paginatedMovements.length === 0 && (
                      <tr><td colSpan={11} className="text-center py-10 text-sm" style={{ color: 'var(--text-secondary)' }}>No records found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* PAGINATION FIX: Show 50 records per page */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 mt-2" style={{ borderTop: '0.5px solid var(--border-default)' }}>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Showing {((page-1)*PAGE_SIZE)+1}–{Math.min(page*PAGE_SIZE, filteredMovements.length)} of {filteredMovements.length} records
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
                      className="px-3 py-1 rounded-lg text-xs font-medium disabled:opacity-40 transition-colors"
                      style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '0.5px solid var(--border-default)' }}>
                      ← Prev
                    </button>
                    <span className="text-xs font-medium px-2" style={{ color: 'var(--text-primary)' }}>{page} / {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}
                      className="px-3 py-1 rounded-lg text-xs font-medium disabled:opacity-40 transition-colors"
                      style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '0.5px solid var(--border-default)' }}>
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Product Journey */}
        {viewMode === 'product-journey' && (
          <>
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Select Customer</label>
                <select value={journeyCustomerId} onChange={e => { setJourneyCustomerId(e.target.value); setJourneyProductId(''); }} className={`w-full ${inp}`} style={IS}>
                  <option value="">All Customers</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Select Product</label>
                <select value={journeyProductId} onChange={e => setJourneyProductId(e.target.value)} className={`w-full ${inp}`} style={IS}>
                  <option value="">All Products</option>
                  {products.filter(p => !journeyCustomerId || p.customerId === journeyCustomerId).map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-3">
              {journeyMoves.length === 0 && (
                <div className="text-center py-10 text-sm" style={{ color: 'var(--text-secondary)' }}>Select a customer or product to view journey</div>
              )}
              {journeyMoves.map((m, i) => (
                <div key={m.id} className="flex gap-4 items-start">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: m.type==='IN' ? 'rgba(74,222,128,0.15)' : m.type==='OUT' ? 'rgba(249,115,22,0.15)' : 'rgba(43,184,232,0.15)' }}>
                      {m.type==='IN' ? <TrendingDown className="w-4 h-4 text-green-400" /> : m.type==='OUT' ? <TrendingUp className="w-4 h-4 text-orange-400" /> : <BarChart3 className="w-4 h-4 text-blue-400" />}
                    </div>
                    {i < journeyMoves.length - 1 && <div className="w-px flex-1 mt-1" style={{ background: 'rgba(43,184,232,0.15)', minHeight: '24px' }} />}
                  </div>
                  <div className="flex-1 pb-3 rounded-xl p-3" style={{ background: 'var(--bg-card)', border: '1px solid rgba(43,184,232,0.08)' }}>
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="px-2 py-0.5 rounded text-xs font-bold mr-2"
                          style={{ background: m.type==='IN' ? 'rgba(74,222,128,0.12)' : m.type==='OUT' ? 'rgba(249,115,22,0.12)' : 'rgba(43,184,232,0.12)', color: m.type==='IN' ? '#4ade80' : m.type==='OUT' ? '#f97316' : 'var(--primary)' }}>
                          {m.type==='IN' ? 'STOCK IN' : m.type==='OUT' ? 'STOCK OUT' : 'MOVED'}
                        </span>
                        <span className="font-mono text-xs font-bold" style={{ color: 'var(--primary)' }}>{m.docNumber}</span>
                      </div>
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{formatDateTime(m.createdAt||m.date||"")}</span>
                    </div>
                    <div className="mt-1 text-sm font-semibold ">{m.productName}</div>
                    <div className="flex gap-4 mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      <span className="font-bold" style={{ color: m.type==='IN' ? '#4ade80' : '#f97316' }}>{m.type==='IN' ? '+' : m.type==='OUT' ? '-' : ''}{m.cartons} ctns</span>
                      {m.totalWeight ? <span>{Number(m.totalWeight).toFixed(0)} kg</span> : null}
                      <span>{m.location}</span>
                      {m.vehicleNo && <span>{m.vehicleNo}</span>}
                      {m.driverName && <span>{m.driverName}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Customer Ledger */}
        {viewMode === 'customer-ledger' && (
          <>
            <div className="mb-5">
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Select Customer</label>
              <select value={ledgerCustomerId} onChange={e => setLedgerCustomerId(e.target.value)} className={`max-w-xs ${inp}`} style={IS}>
                <option value="">- Select Customer -</option>
                {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
              </select>
            </div>

            {!ledgerCustomerId && (
              <div className="text-center py-10 text-sm" style={{ color: 'var(--text-secondary)' }}>Select a customer to view ledger</div>
            )}

            {ledgerData && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                  {[
                    { label: 'Total IN',   value: `${ledgerData.totalIn} units`,   color: '#4ade80' },
                    { label: 'Total OUT',  value: `${ledgerData.totalOut} units`,  color: '#f97316' },
                    { label: 'Balance',    value: `${ledgerData.balance} units`,   color: 'var(--primary)' },
                    { label: 'Avg Stay',   value: `${ledgerData.avgStay} days`,   color: '#a78bfa' },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid rgba(43,184,232,0.08)' }}>
                      <div className="text-xl font-black" style={{ color: s.color }}>{s.value}</div>
                      <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  <div className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest border-b" style={{ color: 'var(--primary)', borderColor: 'rgba(43,184,232,0.1)' }}>
                    {ledgerData.cust?.name} - Stock Ledger
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[800px]">
                      <thead>
                        <tr style={{ background: 'var(--bg-input)' }}>
                          {['Date','Doc No','Type','Product','IN (Qty)','OUT (Qty)','Balance','Location'].map(h => (
                            <th key={h} className="px-3 py-3 text-left text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ledgerData.ledger.map(m => (
                          <tr key={m.id} className="hover:bg-white/5 transition-colors" style={{ borderTop: '1px solid rgba(43,184,232,0.05)' }}>
                            <td className="px-3 py-2.5 text-xs whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{formatDate(m.createdAt||m.date||"")}</td>
                            <td className="px-3 py-2.5 font-mono font-bold text-xs cursor-pointer hover:underline" style={{ color: 'var(--primary)' }} onClick={() => m.type !== 'MOVE' && viewGatePass(m.docNumber, m.type as 'IN'|'OUT')} title="Click to view Gate Pass">{m.docNumber}</td>
                            <td className="px-3 py-2.5"><span className="px-1.5 py-0.5 rounded text-xs font-bold" style={{ background: m.type==='IN' ? 'rgba(74,222,128,0.12)' : m.type==='OUT' ? 'rgba(249,115,22,0.12)' : 'rgba(43,184,232,0.12)', color: m.type==='IN' ? '#4ade80' : m.type==='OUT' ? '#f97316' : 'var(--primary)' }}>{m.type}</span></td>
                            <td className="px-3 py-2.5 font-medium ">{m.productName}</td>
                            <td className="px-3 py-2.5 font-bold" style={{ color: '#4ade80' }}>{m.type==='IN' ? m.cartons : '-'}</td>
                            <td className="px-3 py-2.5 font-bold" style={{ color: '#f97316' }}>{m.type==='OUT' ? m.cartons : '-'}</td>
                            <td className="px-3 py-2.5 font-black" style={{ color: m.runningBalance >= 0 ? 'var(--primary)' : '#f87171' }}>{m.runningBalance}</td>
                            <td className="px-3 py-2.5 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{m.location}</td>
                          </tr>
                        ))}
                        {ledgerData.ledger.length === 0 && (
                          <tr><td colSpan={8} className="text-center py-8 text-sm" style={{ color: 'var(--text-secondary)' }}>No records for this customer</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
      {/* ─── Edit Document Modal ─── */}
      {editDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-2xl rounded-2xl flex flex-col max-h-[90vh]" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border-default)' }}>
              <div>
                <h2 className="text-base font-bold">Edit {editDoc.type === 'IN' ? 'IGP' : 'OGP'} — <span style={{ color: 'var(--primary)' }}>{editDoc.docNumber}</span></h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Document number stays the same. Only details will be updated.</p>
              </div>
              <button onClick={() => setEditDoc(null)} className="p-2 rounded-lg" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}><X className="w-4 h-4" /></button>
            </div>
            <div className="overflow-y-auto p-5 flex-1">
              {/* Edit feedback messages */}
              {editError && (
                <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {editError}
                </div>
              )}
              {editSuccess && (
                <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}>
                  {editSuccess}
                </div>
              )}
              {/* Header fields */}
              <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--primary)' }}>Header Information</div>
              <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Vehicle No</label>
                  <input className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-page)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                    value={editHeader.vehicleNo || ''} onChange={e => setEditHeader((p:any) => ({ ...p, vehicleNo: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Driver</label>
                  <select className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-page)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                    value={editHeader.driverId || ''} onChange={e => setEditHeader((p:any) => ({ ...p, driverId: e.target.value, driverName: drivers.find((d:any) => d.id === e.target.value)?.name || p.driverName }))}>
                    <option value="">-- Select Driver --</option>
                    {drivers.map((d:any) => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
                  </select>
                </div>
                {editDoc.type === 'IN' && <>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Customer</label>
                    <div className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}>
                      {editHeader.customerName || '-'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Seal No</label>
                    <input className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-page)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                      value={editHeader.sealNumber || ''} onChange={e => setEditHeader((p:any) => ({ ...p, sealNumber: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Vehicle Temperature (°C)</label>
                    <input type="number" step="0.1" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-page)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                      value={editHeader.temperatureAtReceipt ?? ''} onChange={e => setEditHeader((p:any) => ({ ...p, temperatureAtReceipt: parseFloat(e.target.value) }))} />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Condition</label>
                    <select className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-page)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                      value={editHeader.condition || 'Good'} onChange={e => setEditHeader((p:any) => ({ ...p, condition: e.target.value }))}>
                      {['Good','Damaged','Partial'].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Product Temperature (°C)</label>
                    <input type="number" step="0.1" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-page)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                      value={editHeader.productTemperature ?? ''} onChange={e => setEditHeader((p:any) => ({ ...p, productTemperature: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Arrival Time</label>
                    <input type="time" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-page)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                      value={editHeader.timeIn || ''} onChange={e => setEditHeader((p:any) => ({ ...p, timeIn: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Departure Time</label>
                    <input type="time" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-page)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                      value={editHeader.departureTime || ''} onChange={e => setEditHeader((p:any) => ({ ...p, departureTime: e.target.value }))} />
                  </div>
                </>}
                {editDoc.type === 'OUT' && <>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Destination</label>
                    <input className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-page)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                      value={editHeader.destination || ''} onChange={e => setEditHeader((p:any) => ({ ...p, destination: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Reason</label>
                    <input className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-page)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                      value={editHeader.reason || ''} onChange={e => setEditHeader((p:any) => ({ ...p, reason: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Vehicle Temperature (°C)</label>
                    <input type="text" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-page)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                      value={editHeader.vehicleTemp || ''} onChange={e => setEditHeader((p:any) => ({ ...p, vehicleTemp: e.target.value }))} placeholder="-20" />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Stock Condition</label>
                    <select className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-page)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                      value={editHeader.condition || 'Good'} onChange={e => setEditHeader((p:any) => ({ ...p, condition: e.target.value }))}>
                      {['Good','Damaged','Partial'].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </>}
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Order Ref</label>
                  <input className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-page)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                    value={editHeader.orderRef || ''} onChange={e => setEditHeader((p:any) => ({ ...p, orderRef: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Notes / Remarks</label>
                  <input className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-page)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                    value={editHeader.notes || ''} onChange={e => setEditHeader((p:any) => ({ ...p, notes: e.target.value }))} />
                </div>
              </div>

              {/* Items (IGP only) */}
              {editDoc.type === 'IN' && editItems.length > 0 && (
                <>
                  <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--primary)' }}>Product Details</div>
                  <div className="space-y-3">
                    {editItems.map((item, i) => (
                      <div key={i} className="rounded-lg p-3" style={{ background: 'var(--bg-page)', border: '1px solid var(--border-default)' }}>
                        <div className="mb-2">
                          <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Product</label>
                          <select className="w-full px-2 py-1.5 rounded text-sm outline-none" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                            value={item.productId || ''}
                            onChange={e => {
                              const prod = products.find((p:any) => p.id === e.target.value);
                              if (prod) setEditItems(prev => prev.map((it,j) => j===i ? { ...it, productId: prod.id, productName: prod.name, productCode: prod.code, weightPerCarton: prod.weightPerCarton } : it));
                            }}>
                            <option value="">-- Select Product --</option>
                            {products.map((p:any) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                          </select>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <label className="block mb-1" style={{ color: 'var(--text-secondary)' }}>Qty</label>
                            <input type="number" min="1" className="w-full px-2 py-1.5 rounded text-sm outline-none" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                              value={item.cartons} onChange={e => setEditItems(prev => prev.map((it,j) => j===i ? { ...it, cartons: parseInt(e.target.value)||0 } : it))} />
                          </div>
                          <div>
                            <label className="block mb-1" style={{ color: 'var(--text-secondary)' }}>Weight (kg)</label>
                            <input type="number" step="0.1" className="w-full px-2 py-1.5 rounded text-sm outline-none" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                              value={item.weightPerCarton} onChange={e => setEditItems(prev => prev.map((it,j) => j===i ? { ...it, weightPerCarton: parseFloat(e.target.value)||0 } : it))} />
                          </div>
                          <div>
                            <label className="block mb-1" style={{ color: 'var(--text-secondary)' }}>Expiry Date</label>
                            <input type="date" className="w-full px-2 py-1.5 rounded text-sm outline-none" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                              value={formatDate(item.expiryDate)} onChange={e => setEditItems(prev => prev.map((it,j) => j===i ? { ...it, expiryDate: e.target.value } : it))} />
                          </div>
                          <div>
                            <label className="block mb-1" style={{ color: 'var(--text-secondary)' }}>Mfg Date</label>
                            <input type="date" className="w-full px-2 py-1.5 rounded text-sm outline-none" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                              value={item.mfgDate || ''} onChange={e => setEditItems(prev => prev.map((it,j) => j===i ? { ...it, mfgDate: e.target.value } : it))} />
                          </div>
                          <div>
                            <label className="block mb-1" style={{ color: 'var(--text-secondary)' }}>Batch No</label>
                            <input className="w-full px-2 py-1.5 rounded text-sm outline-none" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                              value={item.batchNo || ''} onChange={e => setEditItems(prev => prev.map((it,j) => j===i ? { ...it, batchNo: e.target.value } : it))} />
                          </div>
                          <div>
                            <label className="block mb-1" style={{ color: 'var(--text-secondary)' }}>Lot No</label>
                            <input className="w-full px-2 py-1.5 rounded text-sm outline-none" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                              value={item.lotNo || ''} onChange={e => setEditItems(prev => prev.map((it,j) => j===i ? { ...it, lotNo: e.target.value } : it))} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {editDoc.type === 'OUT' && <>
                {/* OGP extra header fields */}
                <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Vehicle Temperature (°C)</label>
                    <input type="text" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-page)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                      value={editHeader.vehicleTemp || ''} onChange={e => setEditHeader((p:any) => ({ ...p, vehicleTemp: e.target.value }))} placeholder="-20" />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Stock Condition</label>
                    <select className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ background: 'var(--bg-page)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                      value={editHeader.condition || 'Good'} onChange={e => setEditHeader((p:any) => ({ ...p, condition: e.target.value }))}>
                      {['Good','Damaged','Partial'].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                {/* OGP line quantities — now fully editable */}
                {editLines.length > 0 && <>
                  <div className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--primary)' }}>Dispatched Items</div>
                  <div className="space-y-2">
                    {editLines.map((line, i) => (
                      <div key={i} className="rounded-lg p-3" style={{ background: 'var(--bg-page)', border: '1px solid var(--border-default)' }}>
                        {/* Product dropdown — fully editable */}
                        <div className="mb-2">
                          <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Product</label>
                          <select className="w-full px-2 py-1.5 rounded text-sm outline-none"
                            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                            value={line.productId || ''}
                            onChange={e => {
                              const prod = products.find((p:any) => p.id === e.target.value);
                              if (prod) setEditLines(prev => prev.map((l,j) => j===i
                                ? { ...l, productId: prod.id, productName: prod.name, productCode: prod.code, weightPerCarton: prod.weightPerCarton }
                                : l));
                            }}>
                            <option value="">-- Select Product --</option>
                            {products.map((p:any) => (
                              <option key={p.id} value={p.id}>{p.code ? p.code+' ' : ''}{p.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <label className="block mb-1" style={{ color: 'var(--text-secondary)' }}>Original Qty</label>
                            <div className="px-2 py-1.5 rounded text-sm" style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>{line.currentCartons}</div>
                          </div>
                          <div>
                            <label className="block mb-1" style={{ color: 'var(--text-secondary)' }}>New Qty</label>
                            <input type="number" min="0" className="w-full px-2 py-1.5 rounded text-sm outline-none"
                              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                              value={line.newCartons}
                              onChange={e => setEditLines(prev => prev.map((l,j) => j===i ? { ...l, newCartons: parseInt(e.target.value)||0 } : l))} />
                          </div>
                          <div>
                            <label className="block mb-1" style={{ color: 'var(--text-secondary)' }}>Wt/Unit (kg)</label>
                            <input type="number" step="0.01" min="0" className="w-full px-2 py-1.5 rounded text-sm outline-none"
                              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                              value={line.weightPerCarton}
                              onChange={e => setEditLines(prev => prev.map((l,j) => j===i ? { ...l, weightPerCarton: parseFloat(e.target.value)||0 } : l))} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>}
              </>}
            </div>
            <div className="p-5 border-t flex gap-3 flex-wrap" style={{ borderColor: 'var(--border-default)' }}>
              <button onClick={() => { setEditDoc(null); setEditSaved(false); setEditError(''); setEditSuccess(''); }} className="flex-1 py-2.5 rounded-xl text-sm border" style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>Close</button>
              {!editSaved ? (
                <button onClick={handleSaveEdit} disabled={editLoading} className="flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #0284C7, #0369A1)', color: '#fff' }}>
                  {editLoading ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</>
                  ) : (
                    <><Save className="w-4 h-4" /> Save Changes</>
                  )}
                </button>
              ) : (
                <button onClick={printEditedGatePass} className="flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #16a34a, #15803d)', color: '#fff' }}>
                  <Printer className="w-4 h-4" /> Print Gate Pass
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Undo / Redo Modal ─── */}
      {undoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold">
                {undoModal.action === 'void' ? 'Undo' : 'Redo'}{' '}
                {undoModal.type === 'IN' ? 'IGP' : 'OGP'}{' '}
                <span style={{ color: 'var(--primary)' }}>{undoModal.docNumber}</span>
              </h2>
              <button onClick={() => setUndoModal(null)} className="p-2 rounded-lg" style={{ background: 'var(--bg-input)' }}><X className="w-4 h-4" /></button>
            </div>

            {undoModal.action === 'void' ? (
              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                {undoModal.type === 'IN'
                  ? 'All pallets from this IGP will be removed from the warehouse map. The document number stays the same.'
                  : 'Dispatch from this OGP will be reversed — cartons return to pallets. The document number stays the same.'}
              </p>
            ) : (
              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                This will restore the gate pass exactly as it was before undo — inventory, map, and history will update.
              </p>
            )}

            {undoError && (
              <div className="mb-3 p-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                {undoError}
              </div>
            )}

            {undoSuccess && (
              <div className="mb-3 p-3 rounded-lg text-sm" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}>
                {undoSuccess}
              </div>
            )}

            {undoModal.action === 'void' && (
              <div className="mb-4">
                <label className="block text-xs mb-1 font-semibold" style={{ color: 'var(--text-secondary)' }}>Reason (required)</label>
                <textarea
                  value={undoReason}
                  onChange={e => setUndoReason(e.target.value)}
                  rows={3}
                  placeholder="Why is this gate pass being undone?"
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                  style={{ background: 'var(--bg-page)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                />
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setUndoModal(null)} className="flex-1 py-2.5 rounded-xl text-sm border" style={{ borderColor: 'var(--border-default)', color: 'var(--text-secondary)' }}>
                Cancel
              </button>
              <button
                onClick={handleUndoRedoConfirm}
                disabled={undoLoading || undoSuccess || (undoModal.action === 'restore' && !!undoError) || (undoModal.action === 'void' && (!!undoError || undoReason.trim().length < 3))}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                style={{
                  background: undoModal.action === 'void'
                    ? 'linear-gradient(135deg, #dc2626, #b91c1c)'
                    : 'linear-gradient(135deg, #16a34a, #15803d)',
                  color: '#fff',
                }}>
                {undoLoading ? 'Processing...' : undoModal.action === 'void' ? <><Undo2 className="w-4 h-4" /> Confirm Undo</> : <><RotateCcw className="w-4 h-4" /> Confirm Redo</>}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}


