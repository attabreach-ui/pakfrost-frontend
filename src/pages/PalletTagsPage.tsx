import { useState } from 'react';
import { Tag, Printer, Search } from 'lucide-react';
import type { Pallet } from '@/types';

interface PalletTagsPageProps {
  pallets: Pallet[];
}

const fmtDate = (iso: string | undefined | null) => iso ? new Date(iso).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

function palletLocation(p: Pallet): string {
  if (p.room === 'Ante Room') return 'Ante Room (Floor)';
  return `${p.room} ${p.side}${p.row}-${p.slot}${p.position ? `-P${p.position}` : ''}`;
}

export default function PalletTagsPage({ pallets }: PalletTagsPageProps) {
  const [search, setSearch] = useState('');
  const [selectedPallet, setSelectedPallet] = useState<Pallet | null>(null);

  const activePallets = pallets.filter(p => p.status === 'active');

  const filtered = search
    ? activePallets.filter(p =>
        p.productName.toLowerCase().includes(search.toLowerCase()) ||
        p.productCode.includes(search) ||
        p.igpNumber.toLowerCase().includes(search.toLowerCase())
      )
    : activePallets;

  const handlePrint = () => {
    if (!selectedPallet) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const location = selectedPallet.room === 'Ante Room'
      ? 'Ante Room (Floor)'
      : `${selectedPallet.room} ${selectedPallet.side}${selectedPallet.row}-${selectedPallet.slot}${selectedPallet.position ? '-P' + selectedPallet.position : ''}`;

    // Single tag HTML — reused twice
    const tagHTML = `
      <div class="tag">
        <div class="header">
          <div class="logo">PAK FROST</div>
          <div class="subtitle">Cold Storage - Lahore, Pakistan</div>
        </div>
        <div class="field">
          <div class="label">Product Name</div>
          <div class="value">${selectedPallet.productName}</div>
        </div>
        <div class="row2">
          <div class="field">
            <div class="label">Product Code</div>
            <div class="value">${selectedPallet.productCode}</div>
          </div>
          <div class="field">
            <div class="label">IGP Number</div>
            <div class="value">${selectedPallet.igpNumber}</div>
          </div>
        </div>
        <div class="field">
          <div class="label">Location</div>
          <div class="value">${location}</div>
        </div>
        <div class="row2">
          <div class="field">
            <div class="label">Expiry Date</div>
            <div class="value">${new Date(selectedPallet.expiryDate).toLocaleDateString('en-PK', {day: '2-digit', month: 'short', year: 'numeric'})}</div>
          </div>
          <div class="field">
            <div class="label">Qty</div>
            <div class="value">${selectedPallet.cartons}</div>
          </div>
          <div class="field">
            <div class="label">Weight</div>
            <div class="value">${Number(selectedPallet.totalWeight).toFixed(1)} kg</div>
          </div>
        </div>
        <div class="barcode">
          <div class="barcode-line"></div>
          <div class="barcode-text">${selectedPallet.id}</div>
        </div>
        <div class="footer">
          PAKFROST (PVT) LIMITED - Premium Temperature Controlled Warehousing<br/>
          2 KM Off Manga Raiwind Road, Lahore - 0321-4394111
        </div>
      </div>`;

    printWindow.document.write(`<!DOCTYPE html><html><head>
      <title>Pallet Tag - ${selectedPallet.igpNumber}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; background: #fff; }
        .page {
          display: flex;
          flex-direction: row;
          gap: 12px;
          padding: 16px;
          width: 100%;
          justify-content: center;
        }
        .tag {
          width: 3.8in;
          min-height: 5.5in;
          padding: 0.25in;
          border: 2px solid #000;
          font-family: Arial, sans-serif;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; }
        .logo { font-size: 18px; font-weight: 900; letter-spacing: 0.12em; }
        .subtitle { font-size: 9px; color: #555; margin-top: 2px; }
        .field { display: flex; flex-direction: column; gap: 2px; }
        .label { font-size: 8px; text-transform: uppercase; color: #777; letter-spacing: 0.5px; }
        .value { font-size: 14px; font-weight: bold; color: #000; }
        .row2 { display: flex; gap: 12px; }
        .row2 .field { flex: 1; }
        .barcode { text-align: center; margin: 4px 0; }
        .barcode-line { height: 50px; background: repeating-linear-gradient(90deg,#000 0,#000 2px,#fff 2px,#fff 4px,#000 4px,#000 5px,#fff 5px,#fff 8px); }
        .barcode-text { font-size: 9px; margin-top: 4px; font-family: monospace; color: #333; }
        .footer { font-size: 8px; color: #666; text-align: center; border-top: 1px solid #ccc; padding-top: 6px; margin-top: auto; line-height: 1.4; }
        .divider { width: 1px; background: #ccc; margin: 0 4px; }
        @media print {
          body { margin: 0; }
          .page { padding: 8px; gap: 8px; }
          @page { size: A4 portrait; margin: 8mm; }
        }
      </style>
    </head><body>
      <div class="page">
        ${tagHTML}
        <div class="divider"></div>
        ${tagHTML}
      </div>
    </body></html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="p-6 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h1 className="text-2xl font-bold  flex items-center gap-2">
              <Tag className="w-6 h-6" style={{ color: 'var(--primary)' }} /> Pallet Tags
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Generate and print pallet labels</p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search pallet..."
              className="pl-9 pr-4 py-2 rounded-lg  text-sm outline-none w-full sm:w-64"
              style={{ background: 'var(--bg-card)', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Pallet List */}
          <div className="lg:col-span-1 rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div className="px-4 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--primary)', borderBottom: '1px solid var(--border-default)' }}>
              Active Pallets ({filtered.length})
            </div>
            <div className="max-h-[calc(100vh-240px)] overflow-y-auto">
              {filtered.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPallet(p)}
                  className="w-full text-left px-4 py-3 transition-colors"
                  style={{
                    background: selectedPallet?.id === p.id ? 'rgba(43,184,232,0.1)' : 'transparent',
                    borderBottom: '1px solid rgba(43,184,232,0.05)',
                  }}
                >
                  <div className="text-sm font-medium ">{p.productName}</div>
                  <div className="text-xs flex gap-2 mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    <span className="font-mono" style={{ color: 'var(--primary)' }}>{p.igpNumber}</span>
                    <span>{p.room} {p.side}{p.row}-{p.slot}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Tag Preview */}
          <div className="lg:col-span-2">
            {selectedPallet ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold ">Tag Preview</h3>
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={{ background: 'var(--primary)', color: 'var(--bg-card)' }}
                  >
                    <Printer className="w-4 h-4" /> Print Tag
                  </button>
                </div>

                {/* Visual Tag Preview */}
                <div
                  className="rounded-xl p-8 mx-auto"
                  style={{
                    background: 'white',
                    color: 'black',
                    maxWidth: '384px',
                    border: '2px solid #333',
                  }}
                >
                  <div className="text-center border-b-2 border-black pb-3 mb-4">
                    <div className="text-lg font-black tracking-wider">PAK FROST</div>
                    <div className="text-[9px] text-gray-600">Cold Storage - Lahore, Pakistan</div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="text-[8px] uppercase text-gray-500 tracking-wider">Product Name</div>
                      <div className="text-sm font-bold">{selectedPallet.productName}</div>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <div className="text-[8px] uppercase text-gray-500 tracking-wider">Product Code</div>
                        <div className="text-xs font-mono font-bold">{selectedPallet.productCode}</div>
                      </div>
                      <div className="flex-1">
                        <div className="text-[8px] uppercase text-gray-500 tracking-wider">IGP Number</div>
                        <div className="text-xs font-mono font-bold">{selectedPallet.igpNumber}</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-[8px] uppercase text-gray-500 tracking-wider">Location</div>
                      <div className="text-sm font-bold">{palletLocation(selectedPallet)}</div>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <div className="text-[8px] uppercase text-gray-500 tracking-wider">Expiry Date</div>
                        <div className="text-xs font-bold">{new Date(selectedPallet.expiryDate).toLocaleDateString('en-PK', {day: '2-digit', month: 'short', year: 'numeric'})}</div>
                      </div>
                      <div className="flex-1">
                        <div className="text-[8px] uppercase text-gray-500 tracking-wider">Qty</div>
                        <div className="text-xs font-bold">{selectedPallet.cartons}</div>
                      </div>
                      <div className="flex-1">
                        <div className="text-[8px] uppercase text-gray-500 tracking-wider">Weight</div>
                        <div className="text-xs font-bold">{Number(selectedPallet.totalWeight).toFixed(1)} kg</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-300 text-center">
                    <div className="h-12 bg-repeating-linear-gradient(90deg, #000 0px, #000 2px, #fff 2px, #fff 4px)" />
                    <div className="text-[9px] font-mono mt-1">{selectedPallet.id}</div>
                  </div>

                  <div className="mt-3 text-[7px] text-gray-500 text-center">
                    PAKFROST (PVT) LIMITED - 2 KM Off Manga Raiwind Road, Lahore
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--text-secondary)' }}>
                Select a pallet to preview and print tag
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


