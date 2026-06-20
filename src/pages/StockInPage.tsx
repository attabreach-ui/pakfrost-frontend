import { useState, useMemo, useRef } from 'react';
import { ArrowDownLeft, Save, Printer, Plus, Trash2, ChevronDown, RotateCcw, Lock, MapPin, Layers } from 'lucide-react';
import type { Customer, Product, Driver, Vehicle, Room, DocCounters, Pallet, PackingType } from '@/types';
import SlotPicker from '@/components/SlotPicker';

const COMPANY = {
  name: 'PAKFROST (PVT) LIMITED',
  address: '2 KM Off Manga Raiwind Road, Behind Achha Foods',
  city: 'Lahore, Pakistan',
  email: 'info.pakfrost@gmail.com',
  storage: 'Premium Temperature Controlled Warehousing | -18C to -22C',
};

interface StockInPageProps {
  pallets: Pallet[];
  customers: Customer[];
  products: Product[];
  drivers: Driver[];
  vehicles: Vehicle[];
  rooms: Room[];
  counters: DocCounters;
  onStockIn: (igp: string, header: any, items: any[]) => Promise<Pallet[]>;
  onNextIGP: () => Promise<string>;
  peekNextIGP: () => string;
  onAddProduct: (p: any) => Product;
  onAddCustomer: (c: any) => Customer;
}

const CONDITIONS   = ['Good', 'Damaged', 'Partial'] as const;
const PACKING_TYPES: PackingType[] = ['Carton', 'Bag', 'Crate', 'Box', 'Drum'];

type StepType = 'form' | 'sheet';

// ✅ Design #1 — LineItem NO LONGER has location (moved to palletDefsMap)
interface LineItem {
  productId: string;
  productName: string;
  productCode: string;
  customerName: string;
  cartons: number;
  weightPerCarton: number;
  totalWeight: number;
  uom: string;
  packingType: PackingType;
  mfgDate: string;
  expiryDate: string;
  batchNo: string;
  lotNo: string;
}

interface PalletDef {
  id: string;
  qty: number;
  room: string;
  side: 'L' | 'R';
  row: string;
  slot: string;
  position?: number;
}

// Used for Unloading Sheet (saved state has full location)
interface SavedPalletLine extends LineItem {
  room: string;
  side: 'L' | 'R';
  row: string;
  slot: string;
  position?: number;
}

// Light theme shared styles
const inputCls  = 'w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors';
const inputStyle = { background: 'var(--bg-card)', border: '1px solid #E2E8F0', color: 'var(--text-primary)' };
const cardStyle  = { background: 'var(--bg-card)', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' };
const Req        = () => <span style={{ color: '#0284C7' }}> *</span>;

const fmtDate = (iso: string | undefined | null) => iso ? new Date(iso).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const vehicleTypeLabel = (type: Vehicle['type']) => type.replace('_', ' ');

export default function StockInPage({
  pallets, customers, products, drivers, vehicles,
  counters, onStockIn, onNextIGP, peekNextIGP, currentUserName,
}: StockInPageProps) {
  const [step,        setStep]        = useState<StepType>('form');
  const [savedIGP,    setSavedIGP]    = useState('');
  const [savedHeader, setSavedHeader] = useState<any>(null);
  const [savedItems,  setSavedItems]  = useState<SavedPalletLine[]>([]);

  const [header, setHeader] = useState({
    igpNumber:            peekNextIGP(),
    vehicleNo:            '',
    vehicleNoOther:       '',
    driverId:             '',
    sealNumber:           '',
    temperatureAtReceipt: '-20',
    condition:            'Good' as typeof CONDITIONS[number],
    notes:                '',
    date:    new Date().toISOString().split('T')[0],
    timeIn:  new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    orderRef: '',
    departureTime: '',
    productTemp: '',
  });

  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  // ✅ Design #1 — Simplified line state (no location fields)
  const [line, setLine] = useState({
    productId:      '',
    cartons:        '',
    weightPerCarton:'',
    packingType:    'Carton' as PackingType,
    mfgDate:        '',
    expiryDate:     '',
    batchNo:        '',
    lotNo:          '',
  });

  const [items, setItems] = useState<LineItem[]>([]);
  const [msg,   setMsg]   = useState<{ text: string; ok: boolean } | null>(null);
  const [otherVehicleText, setOtherVehicleText] = useState('');

  // ✅ Design #1 — palletDefsMap: keyed by item index, replaces global palletDefs
  const [palletDefsMap,  setPalletDefsMap]  = useState<Record<number, PalletDef[]>>({});
  const [showSlotPicker, setShowSlotPicker] = useState(false);
  const [activeItemIdx,  setActiveItemIdx]  = useState(0);   // which LineItem's pallet is being picked
  const [slotPickerIdx,  setSlotPickerIdx]  = useState(0);   // which PalletDef within that item

  const productSelectRef = useRef<HTMLDivElement>(null);
  const customerLocked   = items.length > 0;

  const filteredProducts = useMemo(() =>
    selectedCustomerId ? products.filter(p => p.customerId === selectedCustomerId) : products,
  [products, selectedCustomerId]);

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const selectedDriver   = drivers.find(d => d.id === header.driverId);

  const totalWeight = line.cartons && line.weightPerCarton
    ? (parseFloat(line.cartons) * parseFloat(line.weightPerCarton)).toFixed(1)
    : '-';

  const handleProductChange = (productId: string) => {
    const p = products.find(x => x.id === productId);
    setLine(prev => ({ ...prev, productId, weightPerCarton: p ? String(p.weightPerCarton) : prev.weightPerCarton }));
  };

  const handleChangeCustomer = () => {
    if (confirm(`This will clear ${items.length} item(s). Continue?`)) {
      setItems([]);
      setPalletDefsMap({});
      setSelectedCustomerId('');
    }
  };

  // ===== PALLET DEF HELPERS (per item) =====
  const updatePalletDef = (itemIdx: number, defId: string, updates: Partial<PalletDef>) => {
    setPalletDefsMap(prev => ({
      ...prev,
      [itemIdx]: (prev[itemIdx] || []).map(d => d.id === defId ? { ...d, ...updates } : d),
    }));
  };

  const addPalletDefForItem = (itemIdx: number) => {
    setPalletDefsMap(prev => ({
      ...prev,
      [itemIdx]: [...(prev[itemIdx] || []), {
        id: `pd-${Date.now()}-${Math.random().toString(36).slice(2, 4)}`,
        qty: 0, room: 'Room 1', side: 'L', row: 'LG', slot: '1-6',
      }],
    }));
  };

  const removePalletDefForItem = (itemIdx: number, defId: string) => {
    setPalletDefsMap(prev => ({
      ...prev,
      [itemIdx]: (prev[itemIdx] || []).filter(d => d.id !== defId),
    }));
  };

  const openSlotPicker = (itemIdx: number, palletIdx: number) => {
    setActiveItemIdx(itemIdx);
    setSlotPickerIdx(palletIdx);
    setShowSlotPicker(true);
  };

  // ✅ Design #2 — handleSlotConfirm receives full location from SlotPicker
  const handleSlotConfirm = (room: string, side: 'L' | 'R', row: string, slot: string, position: number) => {
    setPalletDefsMap(prev => ({
      ...prev,
      [activeItemIdx]: (prev[activeItemIdx] || []).map((d, i) =>
        i === slotPickerIdx ? { ...d, room, side, row, slot, position } : d
      ),
    }));
    setShowSlotPicker(false);
  };

  // ✅ Bug #2 — Build virtual pallets from OTHER defs to show as occupied in SlotPicker
  const buildVirtualPallets = (): Pallet[] => {
    const virtuals: Pallet[] = [];
    Object.entries(palletDefsMap).forEach(([idxStr, defs]) => {
      const idx = parseInt(idxStr);
      defs.forEach((d, di) => {
        if (idx === activeItemIdx && di === slotPickerIdx) return; // skip the one being picked
        if (d.position == null) return;
        const item = items[idx];
        if (!item) return;
        const product = products.find(p => p.id === item.productId);
        virtuals.push({
          id: `virtual-${idx}-${di}-${Date.now()}`,
          igpNumber: 'PENDING', vehicleNo: '', driverName: '',
          productId: item.productId,
          productName: item.productName,
          productCode: item.productCode || product?.code || 'PENDING',
          customerId: selectedCustomerId,
          customerName: item.customerName,
          cartons: d.qty,
          weightPerCarton: item.weightPerCarton,
          totalWeight: 0,
          expiryDate: item.expiryDate || '',
          dateIn: new Date().toISOString().split('T')[0],
          room: d.room, side: d.side, row: d.row, slot: d.slot,
          position: d.position,
          status: 'active' as const,
          condition: 'Good' as const,
          temperatureAtReceipt: 0,
          notes: '',
        });
      });
    });
    return virtuals;
  };

  // ✅ Design #1 — addLine: simplified, no location validation
  const addLine = () => {
    if (!selectedCustomerId)    { setMsg({ text: 'Please select a customer first', ok: false }); return; }
    if (!line.productId)        { setMsg({ text: '* Product is required',           ok: false }); return; }
    if (!line.cartons)          { setMsg({ text: '* Quantity is required',          ok: false }); return; }
    if (!line.expiryDate)       { setMsg({ text: '* Expiry date is required',       ok: false }); return; }
    if (!line.weightPerCarton)  { setMsg({ text: '* Weight per unit is required',   ok: false }); return; }

    const product  = products.find(p => p.id === line.productId)!;
    const customer = customers.find(c => c.id === product.customerId)!;
    const cartons  = parseFloat(line.cartons);
    const wt       = parseFloat(line.weightPerCarton);

    const newItem: LineItem = {
      productId:    product.id,
      productName:  product.name,  // FIX: clean name; code shown via productCode field
      productCode:  product.code,
      customerName: customer.name,
      cartons, weightPerCarton: wt, totalWeight: cartons * wt,
      uom:        product.uom,
      packingType: line.packingType,
      mfgDate:    line.mfgDate,
      expiryDate: line.expiryDate,
      batchNo:    line.batchNo,
      lotNo:      line.lotNo,
    };

    const newIdx = items.length; // index this new item will get

    setItems(prev => [...prev, newItem]);
    // Initialize with one pallet def holding full qty
    setPalletDefsMap(prev => ({
      ...prev,
      [newIdx]: [{ id: `pd-${Date.now()}`, qty: cartons, room: 'Room 1', side: 'L', row: 'LG', slot: '1-6' }],
    }));

    // Reset product fields only
    setLine(prev => ({ ...prev, productId: '', cartons: '', mfgDate: '', expiryDate: '', batchNo: '', lotNo: '' }));
    setMsg({ text: `"${newItem.productName}" added — assign pallets below ↓`, ok: true });
    setTimeout(() => setMsg(null), 3000);
    setTimeout(() => productSelectRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };

  // Remove item and shift palletDefsMap indices
  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, j) => j !== idx));
    setPalletDefsMap(prev => {
      const newMap: Record<number, PalletDef[]> = {};
      Object.entries(prev).forEach(([key, val]) => {
        const k = parseInt(key);
        if (k < idx)       newMap[k]     = val;  // keep below
        else if (k > idx)  newMap[k - 1] = val;  // shift down
        // k === idx: drop
      });
      return newMap;
    });
  };

  // Validate all items have complete pallet assignments
  // Ante Room pallets don't need a position (floor storage) — room assignment is enough
  const allAssigned = items.length > 0 && items.every((item, idx) => {
    const defs = palletDefsMap[idx] || [];
    if (defs.length === 0) return false;
    const sum = defs.reduce((s, d) => s + (d.qty || 0), 0);
    const allHavePos = defs.every(d => d.room === 'Ante Room' || d.position != null);
    return sum === item.cartons && allHavePos;
  });

  // ✅ Bug #1 + #3 — saveAll correctly passes position AND packingType
  const saveAll = async () => {
    const resolvedVehicleNo = header.vehicleNo === '__other__' ? header.vehicleNoOther : header.vehicleNo;
    if (!resolvedVehicleNo)  { setMsg({ text: '* Vehicle number is required', ok: false }); return; }
    if (items.length === 0)  { setMsg({ text: 'Add at least one product',     ok: false }); return; }
    if (!allAssigned)        { setMsg({ text: 'Assign all pallets in Stacking section first', ok: false }); return; }
    if (!counters.igpInitialized) { setMsg({ text: 'Please initialize document counters from Dashboard first', ok: false }); return; }

    // Build stock-in items from palletDefsMap
    const stockInItems: any[] = [];
    const savedPalletLines: SavedPalletLine[] = [];

    items.forEach((item, idx) => {
      const defs = palletDefsMap[idx] || [];
      defs.forEach(def => {
        stockInItems.push({
          productId:      item.productId,
          cartons:        def.qty,
          weightPerCarton:item.weightPerCarton,
          packingType:    item.packingType,        // ✅ Bug #3
          mfgDate:        item.mfgDate || undefined,
          expiryDate:     item.expiryDate,
          batchNo:        item.batchNo || undefined,
          lotNo:          item.lotNo   || undefined,
          room:           def.room,
          side:           def.side,
          row:            def.row,
          slot:           def.slot,
          position:       def.position,             // ✅ Bug #1
        });
        savedPalletLines.push({
          ...item,
          cartons:    def.qty,
          totalWeight: def.qty * item.weightPerCarton,
          room: def.room, side: def.side, row: def.row, slot: def.slot,
          position: def.position,
        });
      });
    });

    const igp = await onNextIGP();
    await onStockIn(igp, {
      vehicleNo:            resolvedVehicleNo,
      driverId:             header.driverId || undefined,
      driverName:           selectedDriver?.name || resolvedVehicleNo,
      sealNumber:           header.sealNumber || undefined,
      temperatureAtReceipt: parseFloat(header.temperatureAtReceipt),
      condition:            header.condition,
      notes:                header.notes,
      orderRef:             header.orderRef || undefined,
      departureTime:        header.departureTime || undefined,
      timeIn:               header.timeIn || undefined,  // FIX: pass arrival time so History reprint shows correctly
      operatorName:         currentUserName,
    }, stockInItems);

    setSavedIGP(igp);
    setSavedHeader({ ...header, driverName: selectedDriver?.name || '', customerName: selectedCustomer?.name || '', selectedDriver });
    setSavedItems(savedPalletLines);
    setStep('sheet');
  };

  const reset = () => {
    setStep('form');
    setHeader(prev => ({
      ...prev, igpNumber: peekNextIGP(), vehicleNo: '', driverId: '', sealNumber: '',
      temperatureAtReceipt: '-20', condition: 'Good', notes: '',
      date: new Date().toISOString().split('T')[0],
      timeIn: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    }));
    setSelectedCustomerId('');
    setItems([]);
    setPalletDefsMap({});
    setLine({ productId: '', cartons: '', weightPerCarton: '', packingType: 'Carton', mfgDate: '', expiryDate: '', batchNo: '', lotNo: '' });
    setMsg(null);
  };

  // ======================== UNLOADING SHEET ========================
  if (step === 'sheet') {
    const totalCartons = savedItems.reduce((s, i) => s + Number(i.cartons), 0);
    const totalKg      = savedItems.reduce((s, i) => s + Number(i.totalWeight), 0);

    return (
      <div className="flex-1 overflow-y-auto p-3 sm:p-6" style={{ background: 'var(--bg-page)' }}>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6 print:hidden">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Inward Gate Pass Generated</h1>
            <div className="flex gap-2">
              <button onClick={() => {
                const totalC = savedItems.reduce((s,i) => s + Number(i.cartons), 0);
                const totalKg2 = savedItems.reduce((s,i) => s + Number(i.totalWeight), 0);
                const drv = savedHeader.selectedDriver;
                const driverPhone = drv?.phone || '-';
                const driverCnic  = drv?.cnic  || '-';
                const revised = savedItems.some((x:any) => x.revised);
                const revisedNote = revised ? `<div style="text-align:center;color:red;font-size:9px;margin-top:2px">* REVISED: ${new Date().toLocaleDateString('en-PK')}</div>` : '';
                const _custRec = customers.find((c:any) => c.name === savedHeader.customerName || c.id === savedItems[0]?.customerId);
                const custDisplay = _custRec ? `${_custRec.name} (${_custRec.code})` : (savedHeader.customerName || '-');

                const buildCopy = (copyNo: number) => `
<div class="page" style="page-break-after:${copyNo < 3 ? 'always' : 'avoid'}">
  <div class="copy-label">Copy ${copyNo} of 3</div>
  ${revisedNote}
  <div class="header-row">
    <div class="header-left">
      <div class="company-name">PAKFROST (PVT) LIMITED</div>
      <div class="company-sub">2 Km Off Manga Raiwind Road, Behind Achha Foods, Lahore</div>
      <div class="company-sub">info.pakfrost@gmail.com &nbsp;|&nbsp; Premium Temperature Controlled Warehousing | -18C to -22C</div>
      <div class="doc-title">Inward Gate Pass</div>
    </div>
    <div class="header-right">
      <div class="doc-no-box">IGP No: ${savedIGP}</div>
      <div class="date-box"><b>Date:</b> ${fmtDate(savedHeader.date)}</div>
    </div>
  </div>
  <div class="info-section">
    <div class="info-row"><span class="info-label">Order Ref:</span><span class="info-val">${savedHeader.orderRef || ''}</span><span class="info-label">Vehicle No:</span><span class="info-val">${savedHeader.vehicleNo}</span></div>
    <div class="info-row"><span class="info-label">Customer:</span><span class="info-val">${custDisplay}</span><span class="info-label">Driver Name:</span><span class="info-val">${savedHeader.driverName || '-'}</span></div>
    <div class="info-row"><span class="info-label">Cell No:</span><span class="info-val">${driverPhone}</span><span class="info-label">CNIC:</span><span class="info-val">${driverCnic}</span></div>
  </div>
  <table>
    <thead><tr>
      <th>Item No</th><th style="text-align:left">Description</th><th>Pack Type</th>
      <th>Qty</th><th>Wt/Unit</th><th>Total Kg</th><th>Expiry Date</th>
    </tr></thead>
    <tbody>
      ${(() => {
        const grp: Record<string,any> = {};
        savedItems.forEach(item => {
          const k = item.productCode || item.productName;
          if (!grp[k]) grp[k] = { ...item, cartons: 0, totalWeight: 0 };
          grp[k].cartons += item.cartons;
          grp[k].totalWeight += item.totalWeight;
        });
        return Object.values(grp).map((item: any, i: number) => `<tr>
          <td>${i+1}</td>
          <td class="left">${item.productCode ? item.productCode+' '+item.productName : item.productName}</td>
          <td>${item.packingType || 'Carton'}</td>
          <td><b>${item.cartons}</b></td>
          <td>${item.weightPerCarton}</td>
          <td><b>${Number(item.totalWeight).toFixed(1)}</b></td>
          <td>${fmtDate(item.expiryDate)}</td>
        </tr>`).join('');
      })()}
      ${Array.from({length:Math.max(0,6-savedItems.length)}).map(()=>`<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`).join('')}
    </tbody>
    <tfoot><tr class="total-row">
      <td colspan="3" style="text-align:right">TOTALS:</td>
      <td><b>${totalC}</b></td><td>-</td><td><b>${totalKg2.toFixed(1)}</b></td><td></td>
    </tr></tfoot>
  </table>
  <div class="bottom-section">
    <div class="bottom-row">
      <div class="bottom-field"><span class="bottom-label">Vehicle Temperature (°C):</span><div class="field-box">${savedHeader.temperatureAtReceipt}°C</div></div>
      <div class="bottom-field"><span class="bottom-label">Product Temperature (°C):</span><div class="field-box">${savedHeader.productTemp || ''}</div></div>
      <div class="bottom-field"><span class="bottom-label">Stock Condition:</span><div class="field-box">${savedHeader.condition}</div></div>
    </div>
    <div class="bottom-row">
      <div class="bottom-field"><span class="bottom-label">Arrival Time:</span><div class="field-box">${savedHeader.timeIn}</div></div>
      <div class="bottom-field"><span class="bottom-label">Departure Time:</span><div class="field-box">${savedHeader.departureTime || ''}</div></div>
      <div class="bottom-field"><span class="bottom-label">Seal No:</span><div class="field-box">${savedHeader.sealNumber || '-'}</div></div>
    </div>
    <div class="remarks-row"><span class="bottom-label">Remarks:</span><div class="remarks-box">${savedHeader.notes || ''}</div></div>
  </div>
  <div class="sigs">
    <div class="sig-box"><div class="sig-val">${savedHeader.operatorName || currentUserName}</div><div class="sig-label">Prepared By</div></div>
    <div class="sig-box"><div class="sig-val"></div><div class="sig-label">Approved By</div></div>
  </div>
  <div class="note-box">
    <b>Note:</b> The Client Is Solely Responsible For Compliance With Punjab Food Authority Regulations.
    As Per Warehouse Policy, Expired, Damaged, Opened, Loose, Market Return, Or Undated Stock Is Not Acceptable.
    We Follow Best Practices And Are Committed To Continuous Improvement In Food Safety Standards.
  </div>
</div>`;

                const win = window.open('', '_blank');
                if (!win) return;
                win.document.write(`<!DOCTYPE html><html><head><title>Inward Gate Pass - ${savedIGP}</title>
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
  .doc-no-box{border:2px solid #000;padding:5px 0;font-size:13px;font-weight:900;display:block;width:170px;text-align:center;letter-spacing:0.04em}
  .date-box{font-size:10px;margin-top:3px;border:1px solid #000;padding:4px 0;display:block;width:170px;text-align:center}
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
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors"
                style={{ background: '#0284C7', color: 'var(--bg-card)' }}>
                <Printer className="w-4 h-4" /> Print (3 Copies)
              </button>
              <button onClick={reset}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
                style={{ border: '1px solid #E2E8F0', color: 'var(--text-secondary)', background: 'var(--bg-input)' }}>
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
                <div className="text-sm font-black mt-2 tracking-wide">Inward Gate Pass</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="font-black text-sm tracking-wide text-center" style={{ border:'2px solid #000', padding:'5px 0', width:'170px' }}>IGP No: {savedIGP}</div>
                <div className="text-[10px] text-center" style={{ border:'1px solid #000', padding:'4px 0', width:'170px' }}><b>Date:</b> {fmtDate(savedHeader?.date)}</div>
              </div>
            </div>
            {/* Info Grid */}
            <div className="border border-gray-400 mb-3 text-[10px]">
              <div className="grid grid-cols-4 border-b border-gray-300">
                <div className="bg-gray-100 font-bold px-2 py-1.5 border-r border-gray-300">Order Ref:</div>
                <div className="px-2 py-1.5 border-r border-gray-300">{savedHeader?.orderRef || '-'}</div>
                <div className="bg-gray-100 font-bold px-2 py-1.5 border-r border-gray-300">Vehicle No:</div>
                <div className="px-2 py-1.5">{savedHeader?.vehicleNo}</div>
              </div>
              <div className="grid grid-cols-4 border-b border-gray-300">
                <div className="bg-gray-100 font-bold px-2 py-1.5 border-r border-gray-300">Customer:</div>
                <div className="px-2 py-1.5 border-r border-gray-300">{(() => { const r = customers.find((x:any) => x.name === savedHeader?.customerName || x.id === savedItems[0]?.customerId); return r ? `${r.name} (${r.code})` : savedHeader?.customerName || '-'; })()}</div>
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
            {/* Table — no location */}
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
                  const grp: Record<string,any> = {};
                  savedItems.forEach((item, idx) => {
                    const k = item.productCode || item.productName;
                    if (!grp[k]) grp[k] = { ...item, cartons: 0, totalWeight: 0 };
                    grp[k].cartons += item.cartons;
                    grp[k].totalWeight += item.totalWeight;
                  });
                  const rows = Object.values(grp);
                  return (<>
                    {rows.map((item: any, i: number) => (
                      <tr key={i}>
                        <td className="border border-gray-400 p-1 text-center">{i + 1}</td>
                        <td className="border border-gray-400 p-1">{item.productName}</td>
                        <td className="border border-gray-400 p-1 text-center">{item.packingType || 'Carton'}</td>
                        <td className="border border-gray-400 p-1 text-center font-bold">{item.cartons}</td>
                        <td className="border border-gray-400 p-1 text-center">{item.weightPerCarton}</td>
                        <td className="border border-gray-400 p-1 text-center font-bold">{Number(item.totalWeight).toFixed(1)}</td>
                        <td className="border border-gray-400 p-1 text-center">{fmtDate(item.expiryDate)}</td>
                      </tr>
                    ))}
                    {Array.from({ length: Math.max(0, 6 - rows.length) }).map((_, i) => (
                      <tr key={`e-${i}`}>{Array.from({ length: 7 }).map((_, j) => <td key={j} className="border border-gray-400 p-3">&nbsp;</td>)}</tr>
                    ))}
                  </>);
                })()}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-bold">
                  <td colSpan={3} className="border border-gray-400 p-1 text-right text-[10px]">TOTALS:</td>
                  <td className="border border-gray-400 p-1 text-center font-bold">{savedItems.reduce((s,i) => s + Number(i.cartons),0)}</td>
                  <td className="border border-gray-400 p-1 text-center">-</td>
                  <td className="border border-gray-400 p-1 text-center font-bold">{savedItems.reduce((s,i) => s + Number(i.totalWeight),0).toFixed(1)}</td>
                  <td className="border border-gray-400 p-1" />
                </tr>
              </tfoot>
            </table>
            {/* Bottom fields */}
            <div className="grid grid-cols-3 gap-2 mb-2 text-[10px]">
              <div><div className="font-bold mb-0.5">Vehicle Temperature:</div><div className="border border-gray-400 p-1 min-h-[22px]">{savedHeader?.temperatureAtReceipt}°C</div></div>
              <div><div className="font-bold mb-0.5">Product Temperature:</div><div className="border border-gray-400 p-1 min-h-[22px]">{savedHeader?.productTemp || ''}</div></div>
              <div><div className="font-bold mb-0.5">Stock Condition:</div><div className="border border-gray-400 p-1 min-h-[22px]">{savedHeader?.condition}</div></div>
              <div><div className="font-bold mb-0.5">Arrival Time:</div><div className="border border-gray-400 p-1 min-h-[22px]">{savedHeader?.timeIn}</div></div>
              <div><div className="font-bold mb-0.5">Departure Time:</div><div className="border border-gray-400 p-1 min-h-[22px]">{savedHeader?.departureTime || ''}</div></div>
              <div><div className="font-bold mb-0.5">Seal No:</div><div className="border border-gray-400 p-1 min-h-[22px]">{savedHeader?.sealNumber || '-'}</div></div>
            </div>
            <div className="flex gap-2 mb-3 text-[10px]">
              <div className="font-bold flex-shrink-0">Remarks:</div>
              <div className="border border-gray-400 flex-1 p-1 min-h-[28px]">{savedHeader?.notes || ''}</div>
            </div>
            {/* Signatures */}
            <div className="grid grid-cols-2 gap-8 text-[10px] max-w-md">
              {[['Prepared By', currentUserName], ['Approved By', '']].map(([label, val]) => (
                <div key={label} className="text-center">
                  <div className="min-h-[28px] border-b border-black pb-0.5 text-xs">{val}</div>
                  <div className="mt-1">{label}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 text-[8px] text-gray-500 border-t border-gray-200 pt-2 leading-4">
              <b>Note:</b> The Client Is Solely Responsible For Compliance With Punjab Food Authority Regulations.
              As Per Warehouse Policy, Expired, Damaged, Opened, Loose, Market Return, Or Undated Stock Is Not Acceptable.
              We Follow Best Practices And Are Committed To Continuous Improvement In Food Safety Standards.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ======================== FORM ========================
  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6" style={{ background: 'var(--bg-page)' }}>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-1">
          <ArrowDownLeft className="w-6 h-6" style={{ color: '#0284C7' }} />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Stock IN / Receiving</h1>
        </div>
        <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
          IGP Auto: <span className="font-mono font-bold" style={{ color: '#0284C7' }}>{peekNextIGP()}</span>
          {!counters.igpInitialized && <span className="ml-3 text-yellow-600 text-xs">⚠ Set starting number from Dashboard first</span>}
        </p>

        {msg && (
          <div className="mb-4 p-3 rounded-lg text-sm" style={{
            background: msg.ok ? '#F0FDF4' : '#FEF2F2',
            color:      msg.ok ? '#16a34a' : '#ef4444',
            border:     `1px solid ${msg.ok ? '#BBF7D0' : '#FECACA'}`,
          }}>
            {msg.text}
          </div>
        )}

        {/* ── SECTION 1: Receiving Information ── */}
        <div className="rounded-xl p-5 mb-4" style={cardStyle}>
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#0284C7' }}>
            Receiving Information
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Order Ref</label>
              <input type="text" value={header.orderRef} onChange={e => setHeader(p => ({ ...p, orderRef: e.target.value }))} className={inputCls} style={inputStyle} placeholder="DM-14738 (optional)" />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Date</label>
              <input type="date" value={header.date} onChange={e => setHeader(p => ({ ...p, date: e.target.value }))} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Time In</label>
              <input type="time" value={header.timeIn} onChange={e => setHeader(p => ({ ...p, timeIn: e.target.value }))} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Departure Time</label>
              <input type="time" value={header.departureTime} onChange={e => setHeader(p => ({ ...p, departureTime: e.target.value }))} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Condition</label>
              <select value={header.condition} onChange={e => setHeader(p => ({ ...p, condition: e.target.value as any }))} className={inputCls} style={inputStyle}>
                {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Vehicle No<Req /></label>
              <div className="relative">
                <select value={header.vehicleNo} onChange={e => setHeader(p => ({ ...p, vehicleNo: e.target.value }))} className={inputCls} style={inputStyle}>
                  <option value="">Select Vehicle</option>
                  {vehicles.filter(v => v.status === 'active').map(v => (
                    <option key={v.id} value={v.vehicleNo}>{v.vehicleNo} ({vehicleTypeLabel(v.type)})</option>
                  ))}
                  <option value="__other__">Other (type below)</option>
                </select>
              </div>
              {header.vehicleNo === '__other__' && (
                <input type="text" placeholder="Enter vehicle no" value={otherVehicleText} className={`${inputCls} mt-1`} style={inputStyle}
                  onChange={e => { setOtherVehicleText(e.target.value); setHeader(p => ({ ...p, vehicleNoOther: e.target.value })); }} />
              )}
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Driver<Req /></label>
              <select value={header.driverId} onChange={e => setHeader(p => ({ ...p, driverId: e.target.value }))} className={inputCls} style={inputStyle}>
                <option value="">Select Driver</option>
                {drivers.filter(d => d.status === 'active').map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Seal No</label>
              <input type="text" value={header.sealNumber} onChange={e => setHeader(p => ({ ...p, sealNumber: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Optional" />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Vehicle Temperature (°C)<Req /></label>
              <input type="number" step="0.1" value={header.temperatureAtReceipt} onChange={e => setHeader(p => ({ ...p, temperatureAtReceipt: e.target.value }))} className={inputCls} style={inputStyle} placeholder="-20" />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Product Temperature (°C)</label>
              <input type="number" step="0.1" value={header.productTemp} onChange={e => setHeader(p => ({ ...p, productTemp: e.target.value }))} className={inputCls} style={inputStyle} placeholder="-18" />
            </div>
            <div className="col-span-2 sm:col-span-2">
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Remarks</label>
              <input type="text" value={header.notes} onChange={e => setHeader(p => ({ ...p, notes: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Optional remarks" />
            </div>
          </div>
        </div>

        {/* ── SECTION 2: Add Product (NO location fields) ── */}
        <div className="rounded-xl p-5 mb-4" style={cardStyle}>
          <h2 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: '#0284C7' }}>
            Add Product
          </h2>

          {/* Customer */}
          <div className="mb-4">
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Customer<Req /></label>
            {customerLocked ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
                  style={{ background: '#EFF6FF', border: '1px solid rgba(2,132,199,0.2)', color: '#0284C7' }}>
                  <Lock className="w-3.5 h-3.5" />
                  <span>{selectedCustomer?.name} — Adding products for this customer</span>
                </div>
                <button onClick={handleChangeCustomer} className="text-xs underline transition-colors" style={{ color: 'var(--text-secondary)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f97316'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}>
                  [Change]
                </button>
              </div>
            ) : (
              <div className="relative max-w-xs">
                <select value={selectedCustomerId} onChange={e => { setSelectedCustomerId(e.target.value); setLine(p => ({ ...p, productId: '' })); }} className={inputCls} style={inputStyle}>
                  <option value="">Select Customer</option>
                  {customers.filter(c => c.isActive).map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--text-secondary)' }} />
              </div>
            )}
          </div>

          {/* Product row — responsive */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-3">
            <div className="col-span-2 sm:col-span-2" ref={productSelectRef}>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Product<Req /></label>
              <div className="relative">
                <select value={line.productId} onChange={e => handleProductChange(e.target.value)} className={inputCls} style={inputStyle} disabled={!selectedCustomerId}>
                  <option value="">Select Product</option>
                  {filteredProducts.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--text-secondary)' }} />
              </div>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Packing Type</label>
              <select value={line.packingType} onChange={e => setLine(p => ({ ...p, packingType: e.target.value as PackingType }))} className={inputCls} style={inputStyle}>
                {PACKING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Qty<Req /></label>
              <input type="number" min="1" value={line.cartons} onChange={e => setLine(p => ({ ...p, cartons: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Qty" />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Wt/Unit (kg)<Req /></label>
              <input type="number" step="0.1" min="0" value={line.weightPerCarton} onChange={e => setLine(p => ({ ...p, weightPerCarton: e.target.value }))} className={inputCls} style={inputStyle} placeholder="kg" />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Total Weight</label>
              <div className="px-3 py-2 rounded-lg text-sm font-mono font-bold text-center" style={{ background: '#EFF6FF', color: '#0284C7', border: '1px solid rgba(2,132,199,0.2)' }}>
                {totalWeight} kg
              </div>
            </div>
          </div>

          {/* Dates row — 2 cols on mobile, 4 on desktop */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Expiry Date<Req /></label>
              <input type="date" value={line.expiryDate} onChange={e => setLine(p => ({ ...p, expiryDate: e.target.value }))} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Mfg Date</label>
              <input type="date" value={line.mfgDate} onChange={e => setLine(p => ({ ...p, mfgDate: e.target.value }))} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Batch No</label>
              <input type="text" value={line.batchNo} onChange={e => setLine(p => ({ ...p, batchNo: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Optional" />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Lot No</label>
              <input type="text" value={line.lotNo} onChange={e => setLine(p => ({ ...p, lotNo: e.target.value }))} className={inputCls} style={inputStyle} placeholder="Optional" />
            </div>
          </div>

          <button onClick={addLine}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
            style={{ background: '#F0FDF4', color: '#16a34a', border: '1px solid #BBF7D0' }}>
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>

        {/* ── SECTION 3: Stacking / Pallet Assignment (NEW, Design #1) ── */}
        {items.length > 0 && (
          <div className="rounded-xl p-5 mb-4" style={cardStyle}>
            <div className="flex items-center gap-2 mb-4">
              <Layers className="w-4 h-4" style={{ color: '#0284C7' }} />
              <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#0284C7' }}>
                Stacking / Pallet Assignment
              </h2>
            </div>

            <div className="space-y-4">
              {items.map((item, itemIdx) => {
                const defs      = palletDefsMap[itemIdx] || [];
                const qtySum    = defs.reduce((s, d) => s + (d.qty || 0), 0);
                const remaining = item.cartons - qtySum;
                const isDone    = remaining === 0 && defs.every(d => d.position != null);

                return (
                  <div key={itemIdx} className="rounded-xl p-4" style={{ background: 'var(--bg-input)', border: `1px solid ${isDone ? '#BBF7D0' : 'var(--border-default)'}` }}>
                    {/* Item header */}
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{item.productName}</span>
                        <span className="ml-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          ({item.cartons} {item.packingType}s · {Number(item.totalWeight).toFixed(1)} kg · Exp: {fmtDate(item.expiryDate)})
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-bold ${isDone ? 'text-green-600' : remaining < 0 ? 'text-red-500' : 'text-amber-600'}`}>
                          {isDone
                            ? `✓ All ${item.cartons} assigned`
                            : remaining < 0
                              ? `⚠ Over by ${-remaining}`
                              : `Remaining: ${remaining}/${item.cartons}`}
                        </span>
                        <button onClick={() => removeItem(itemIdx)} className="p-1 rounded hover:bg-red-50 transition-colors" style={{ color: '#ef4444' }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Pallet rows */}
                    <div className="space-y-2">
                      {defs.map((def, palletIdx) => (
                        <div key={def.id} className="flex items-center gap-2 p-2 rounded-lg bg-white" style={{ border: '1px solid #E2E8F0' }}>
                          <span className="text-xs font-bold w-16" style={{ color: '#0284C7' }}>Pallet {palletIdx + 1}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Qty:</span>
                            <input
                              type="number" min="1" max={item.cartons}
                              value={def.qty}
                              onChange={e => updatePalletDef(itemIdx, def.id, { qty: parseInt(e.target.value) || 0 })}
                              className="w-16 px-2 py-1 rounded text-xs text-center outline-none"
                              style={inputStyle}
                            />
                          </div>
                          {/* ✅ Design #2 — Select Position button opens SlotPicker with internal room/side/row */}
                          <button
                            onClick={() => openSlotPicker(itemIdx, palletIdx)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ml-auto"
                            style={{
                              background: (def.position || def.room === 'Ante Room') ? '#F0FDF4' : '#EFF6FF',
                              color:      (def.position || def.room === 'Ante Room') ? '#16a34a' : '#0284C7',
                              border:     (def.position || def.room === 'Ante Room') ? '1px solid #BBF7D0' : '1px solid rgba(2,132,199,0.3)',
                            }}>
                            <MapPin className="w-3 h-3" />
                            {def.room === 'Ante Room'
                              ? '🏗️ Ante Room — Floor'
                              : def.position
                                ? `${def.room} · ${def.side}${def.row} · Slot ${def.slot} · P${def.position}`
                                : '📍 Select Position'}
                          </button>
                          {defs.length > 1 && (
                            <button onClick={() => removePalletDefForItem(itemIdx, def.id)} className="p-1 hover:opacity-70 transition-opacity" style={{ color: '#ef4444' }}>
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <button onClick={() => addPalletDefForItem(itemIdx)}
                      className="mt-2 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                      style={{ background: '#EFF6FF', color: '#0284C7', border: '1px solid rgba(2,132,199,0.2)' }}>
                      <Plus className="w-3 h-3" /> Add Pallet
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Summary table ── */}
        {items.length > 0 && (
          <div className="rounded-xl mb-4 overflow-hidden" style={cardStyle}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--bg-input)' }}>
                  {['#', 'Product', 'Code', 'Pack Type', 'Total Qty', 'Total Wt', 'Expiry', 'Pallets', ''].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs uppercase" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => {
                  const defs   = palletDefsMap[i] || [];
                  const isDone = defs.length > 0 && defs.reduce((s, d) => s + d.qty, 0) === item.cartons && defs.every(d => d.room === 'Ante Room' || d.position != null);
                  return (
                    <tr key={i} style={{ borderTop: '1px solid #E2E8F0' }}>
                      <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{i + 1}</td>
                      <td className="px-3 py-2 font-medium" style={{ color: 'var(--text-primary)' }}>{item.productName}</td>
                      <td className="px-3 py-2 font-mono" style={{ color: '#0284C7' }}>{item.productCode}</td>
                      <td className="px-3 py-2" style={{ color: 'var(--text-primary)' }}>{item.packingType}</td>
                      <td className="px-3 py-2 font-bold" style={{ color: 'var(--text-primary)' }}>{item.cartons}</td>
                      <td className="px-3 py-2 font-bold" style={{ color: '#0284C7' }}>{Number(item.totalWeight).toFixed(1)} kg</td>
                      <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{fmtDate(item.expiryDate)}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isDone ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {isDone ? `✓ ${defs.length} pallet(s)` : `⏳ ${defs.length} pallet(s) — incomplete`}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <button onClick={() => removeItem(i)} style={{ color: 'var(--text-secondary)' }} className="hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-4 py-3 flex gap-6" style={{ borderTop: '1px solid #E2E8F0', background: 'var(--bg-input)' }}>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Products: <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{items.length}</span></span>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Total Qty: <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{items.reduce((s, i) => s + Number(i.cartons), 0)}</span></span>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Total Weight: <span className="font-bold" style={{ color: '#0284C7' }}>{items.reduce((s, i) => s + Number(i.totalWeight), 0).toFixed(1)} kg</span></span>
            </div>
          </div>
        )}

        <button onClick={saveAll}
          disabled={items.length === 0 || !allAssigned}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all disabled:opacity-40"
          style={{ background: 'linear-gradient(135deg, #0284C7, #0369A1)', color: 'var(--bg-card)' }}>
          <Save className="w-5 h-5" />
          {items.length === 0
            ? 'Save & Generate Gate Pass'
            : !allAssigned
              ? 'Assign all pallets before saving...'
              : `Save & Generate Inward Gate Pass (${peekNextIGP()})`}
        </button>

        {/* ✅ Bug #2 — SlotPicker receives merged store + virtual pallets */}
        {showSlotPicker && (
          <SlotPicker
            pallets={[...pallets, ...buildVirtualPallets()]}
            initialRoom={palletDefsMap[activeItemIdx]?.[slotPickerIdx]?.room || 'Room 1'}
            initialSide={palletDefsMap[activeItemIdx]?.[slotPickerIdx]?.side || 'L'}
            initialRow={palletDefsMap[activeItemIdx]?.[slotPickerIdx]?.row || 'LG'}
            initialSlot={palletDefsMap[activeItemIdx]?.[slotPickerIdx]?.slot || '1-6'}
            onConfirm={handleSlotConfirm}
            onCancel={() => setShowSlotPicker(false)}
          />
        )}
      </div>
    </div>
  );
}
