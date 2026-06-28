import { useState, useMemo } from 'react';
import { X, Check, ChevronDown, Warehouse } from 'lucide-react';
import type { Pallet } from '@/types';

// ✅ Design #2 — room/side/row are now optional with defaults (internal state)
export interface SlotPickerProps {
  pallets: Pallet[];
  initialRoom?: string;
  initialSide?: 'L' | 'R';
  initialRow?: string;
  initialSlot?: string;
  // ✅ Design #2 — onConfirm now returns full location
  onConfirm: (room: string, side: 'L' | 'R', row: string, slot: string, position: number) => void;
  onCancel: () => void;
}

const SLOTS = ['1-6', '7-12', '13-18', '19-24', '25-30', '31-32'];
const COLD_ROOMS  = ['Room 1', 'Room 2', 'Room 3', 'Room 4'];
const ROOM_NAMES  = [...COLD_ROOMS, 'Ante Room'];
const LEFT_ROWS   = ['LG', 'LA', 'LB', 'LC', 'LD', 'LE'];
const RIGHT_ROWS  = ['RG', 'RA', 'RB', 'RC', 'RD', 'RE'];

// ✅ Design #3 — Front(odd)/Back(even) order so grid-cols-3 renders:
//    Row 1 (top):    1  3  5   ← FRONT
//    Row 2 (bottom): 2  4  6   ← BACK
export function getPositionsForSlot(slot: string): number[] {
  if (slot === '1-6')   return [1, 3, 5, 2, 4, 6];
  if (slot === '7-12')  return [7, 9, 11, 8, 10, 12];
  if (slot === '13-18') return [13, 15, 17, 14, 16, 18];
  if (slot === '19-24') return [19, 21, 23, 20, 22, 24];
  if (slot === '25-30') return [25, 27, 29, 26, 28, 30];
  if (slot === '31-32') return [31, 32];
  return [];
}

interface PositionInfo {
  position: number;
  pallet?: Pallet;
  isOccupied: boolean;
}

const IS = { background: 'var(--bg-card)', border: '1px solid #E2E8F0', color: 'var(--text-primary)' };
const selCls = 'w-full px-2 py-1.5 rounded-lg text-sm outline-none transition-colors';

export default function SlotPicker({
  pallets, initialRoom, initialSide, initialRow, initialSlot, onConfirm, onCancel
}: SlotPickerProps) {
  // ✅ Design #2 — internal state for room/side/row/slot
  const [room,    setRoom]    = useState(initialRoom  || 'Room 1');
  const [side,    setSide]    = useState<'L' | 'R'>(initialSide || 'L');
  const [row,     setRow]     = useState(initialRow   || 'LG');
  const [selectedSlot,      setSelectedSlot]     = useState(initialSlot || '1-6');
  const [selectedPosition,  setSelectedPosition] = useState<number | null>(null);
  const [hoveredPallet,     setHoveredPallet]    = useState<Pallet | null>(null);
  const [tooltipPos,        setTooltipPos]       = useState({ x: 0, y: 0 });

  const isAnteRoom = room === 'Ante Room';

  const activePallets = useMemo(() => pallets.filter(p => p.status === 'active'), [pallets]);

  const handleRoomChange = (r: string) => {
    setRoom(r);
    setSelectedPosition(null);
  };

  const handleSideChange = (s: 'L' | 'R') => {
    const newRow = s === 'L' ? LEFT_ROWS[0] : RIGHT_ROWS[0];
    setSide(s);
    setRow(newRow);
    setSelectedPosition(null);
  };

  const handleRowChange = (r: string) => {
    setRow(r);
    setSelectedPosition(null);
  };

  const handleSlotTabChange = (s: string) => {
    setSelectedSlot(s);
    setSelectedPosition(null);
  };

  const getSlotPositions = (s: string): PositionInfo[] => {
    const positions = getPositionsForSlot(s);
    return positions.map(pos => {
      const pallet = activePallets.find(p =>
        p.room === room && p.side === side && p.row === row && p.slot === s && p.position === pos
      );
      return { position: pos, pallet, isOccupied: !!pallet };
    });
  };

  const handlePositionClick = (info: PositionInfo) => {
    if (info.isOccupied) return;
    setSelectedPosition(info.position);
  };

  const handleMouseEnter = (e: React.MouseEvent, info: PositionInfo) => {
    if (info.isOccupied && info.pallet) {
      setHoveredPallet(info.pallet);
      setTooltipPos({ x: e.clientX + 12, y: e.clientY - 12 });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (hoveredPallet) setTooltipPos({ x: e.clientX + 12, y: e.clientY - 12 });
  };

  const handleMouseLeave = () => setHoveredPallet(null);

  const renderPositionButton = (info: PositionInfo) => {
    const isSelected = selectedPosition === info.position;
    let bg     = '#F0FDF4';
    let border = '1px solid #BBF7D0';
    let textColor = '#16a34a';

    if (info.isOccupied) {
      bg = '#FEF2F2'; border = '1px solid #FECACA'; textColor = '#ef4444';
    } else if (isSelected) {
      bg = '#FEF9C3'; border = '2px solid #EAB308'; textColor = '#ca8a04';
    }

    return (
      <button
        key={info.position}
        onClick={() => handlePositionClick(info)}
        onMouseEnter={e => handleMouseEnter(e, info)}
        onMouseLeave={handleMouseLeave}
        disabled={info.isOccupied}
        className="relative flex flex-col items-center justify-center py-3 rounded-lg transition-all text-center"
        style={{
          background: bg, border,
          cursor: info.isOccupied ? 'not-allowed' : 'pointer',
          opacity: info.isOccupied ? 0.8 : 1,
        }}
      >
        <span className="text-xs font-bold" style={{ color: textColor }}>
          {info.position}
        </span>
        {info.isOccupied && info.pallet && (
          <span className="text-[9px] mt-0.5 truncate w-full px-1" style={{ color: '#ef4444' }}>
            {info.pallet.productCode}
          </span>
        )}
        {!info.isOccupied && (
          <span className="text-[9px] mt-0.5" style={{ color: 'rgba(22,163,74,0.6)' }}>
            Free
          </span>
        )}
      </button>
    );
  };

  const currentPositions = getSlotPositions(selectedSlot);
  const isTwoPos = selectedSlot === '31-32';
  const frontPositions = isTwoPos ? currentPositions : currentPositions.slice(0, 3);
  const backPositions  = isTwoPos ? []              : currentPositions.slice(3, 6);

  // Count current ante-room pallets for info display
  const anteRoomPallets = useMemo(
    () => activePallets.filter(p => p.room === 'Ante Room'),
    [activePallets]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-2xl rounded-2xl p-6"
        style={{ background: 'var(--bg-card)', border: '1px solid #E2E8F0', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
        onClick={e => e.stopPropagation()}
        onMouseMove={handleMouseMove}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            📍 Select Position
          </h2>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {/* ── Room selector (all rooms including Ante Room) ── */}
        <div className="mb-4">
          <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Select Room
          </label>
          <div className="flex gap-1.5 flex-wrap">
            {ROOM_NAMES.map(r => (
              <button key={r}
                onClick={() => handleRoomChange(r)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: room === r
                    ? (r === 'Ante Room' ? '#F59E0B' : '#0284C7')
                    : 'var(--bg-page)',
                  color: room === r ? 'var(--bg-card)' : 'var(--text-secondary)',
                  border: room === r
                    ? (r === 'Ante Room' ? '1px solid #D97706' : '1px solid #0284C7')
                    : '1px solid #E2E8F0',
                }}>
                {r === 'Ante Room' ? '🏗️ Ante Room' : r}
              </button>
            ))}
          </div>
        </div>

        {/* ── ANTE ROOM — special floor-only UI ── */}
        {isAnteRoom ? (
          <div>
            <div
              className="rounded-xl p-5 mb-5 text-center"
              style={{ background: 'rgba(245,158,11,0.06)', border: '2px dashed rgba(245,158,11,0.4)' }}
            >
              <Warehouse className="w-10 h-10 mx-auto mb-3" style={{ color: '#F59E0B' }} />
              <div className="text-base font-bold mb-1" style={{ color: '#92400E' }}>
                Ante Room — Floor Storage
              </div>
              <div className="text-sm mb-3" style={{ color: '#78716C' }}>
                No racks or slots. Product will be placed on the floor.
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{ background: 'rgba(245,158,11,0.12)', color: '#92400E', border: '1px solid rgba(245,158,11,0.3)' }}>
                Currently {anteRoomPallets.length} pallet{anteRoomPallets.length !== 1 ? 's' : ''} on floor
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={onCancel}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={{ border: '1px solid #E2E8F0', color: 'var(--text-secondary)', background: 'var(--bg-input)' }}>
                Cancel
              </button>
              <button
                onClick={() => onConfirm('Ante Room', 'L', '', '', 0)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #D97706)', color: 'var(--bg-card)' }}>
                <Check className="w-4 h-4" />
                Confirm — Ante Room (Floor)
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ✅ Design #2 — Side / Row selectors INSIDE popup */}
            <div className="flex items-center gap-3 mb-4 p-3 rounded-xl" style={{ background: 'var(--bg-input)', border: '1px solid #E2E8F0' }}>
              {/* Side toggle */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>Side</label>
                <div className="flex gap-1">
                  {(['L', 'R'] as const).map(s => (
                    <button key={s} onClick={() => handleSideChange(s)}
                      className="w-9 py-1.5 rounded-lg text-xs font-bold transition-colors"
                      style={{
                        background: side === s ? '#0284C7' : 'var(--bg-card)',
                        color:      side === s ? 'var(--bg-card)'  : 'var(--text-secondary)',
                        border:     side === s ? '1px solid #0284C7' : '1px solid #E2E8F0',
                      }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Row */}
              <div className="flex-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>Row</label>
                <div className="relative">
                  <select value={row} onChange={e => handleRowChange(e.target.value)} className={selCls} style={IS}>
                    {(side === 'L' ? LEFT_ROWS : RIGHT_ROWS).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: 'var(--text-secondary)' }} />
                </div>
              </div>
            </div>

            {/* Slot Tabs */}
            <div className="flex gap-1.5 mb-4">
              {SLOTS.map(s => (
                <button key={s}
                  onClick={() => handleSlotTabChange(s)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: selectedSlot === s ? '#0284C7' : 'var(--bg-page)',
                    color:      selectedSlot === s ? 'var(--bg-card)'  : 'var(--text-secondary)',
                    border:     selectedSlot === s ? '1px solid #0284C7' : '1px solid #E2E8F0',
                  }}>
                  {s}
                </button>
              ))}
            </div>

            {/* ✅ Design #3 — Position Grid: FRONT / BACK rows */}
            <div className="mb-4">
              <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>
                Slot {selectedSlot}
              </div>

              {isTwoPos ? (
                <div className="grid grid-cols-2 gap-2">
                  {currentPositions.map(info => renderPositionButton(info))}
                </div>
              ) : (
                <div>
                  <div className="text-[10px] font-bold mb-1 px-1 flex items-center gap-1" style={{ color: '#16a34a' }}>
                    ▶ FRONT
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {frontPositions.map(info => renderPositionButton(info))}
                  </div>
                  <div className="text-[10px] font-bold mb-1 px-1 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                    ◀ BACK
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {backPositions.map(info => renderPositionButton(info))}
                  </div>
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-5 text-xs mb-5">
              {[
                { label: 'Available', bg: '#F0FDF4', border: '#BBF7D0', text: '#16a34a' },
                { label: 'Occupied',  bg: '#FEF2F2', border: '#FECACA', text: '#ef4444' },
                { label: 'Selected',  bg: '#FEF9C3', border: '#EAB308', text: '#ca8a04' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                  <div className="w-3 h-3 rounded-sm" style={{ background: l.bg, border: `1px solid ${l.border}` }} />
                  <span style={{ color: l.text }}>{l.label}</span>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex gap-3">
              <button onClick={onCancel}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={{ border: '1px solid #E2E8F0', color: 'var(--text-secondary)', background: 'var(--bg-input)' }}>
                Cancel
              </button>
              <button
                onClick={() => selectedPosition !== null && onConfirm(room, side, row, selectedSlot, selectedPosition)}
                disabled={selectedPosition === null}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, #0284C7, #0369A1)', color: 'var(--bg-card)' }}>
                <Check className="w-4 h-4" />
                {selectedPosition !== null ? `Confirm Position ${selectedPosition}` : 'Select a Position'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Tooltip */}
      {hoveredPallet && (
        <div
          className="fixed z-[60] px-3 py-2 rounded-lg text-xs pointer-events-none"
          style={{
            left: tooltipPos.x, top: tooltipPos.y,
            background: 'var(--bg-card)', border: '1px solid rgba(2,132,199,0.3)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)', color: '#e0e0e0', minWidth: '180px',
          }}
        >
          <div className="font-bold text-white mb-1">{hoveredPallet.productName}</div>
          <div style={{ color: 'var(--text-muted)' }}>Customer: <span className="text-white">{hoveredPallet.customerName}</span></div>
          <div style={{ color: 'var(--text-muted)' }}>Qty: <span className="text-white">{hoveredPallet.cartons}</span></div>
          <div style={{ color: 'var(--text-muted)' }}>Expiry: <span className="text-white">{hoveredPallet.expiryDate}</span></div>
          <div style={{ color: 'var(--text-muted)' }}>IGP: <span className="text-white">{hoveredPallet.igpNumber}</span></div>
          <div style={{ color: 'var(--text-muted)' }}>Position: <span className="text-white">{hoveredPallet.position || '-'}</span></div>
        </div>
      )}
    </div>
  );
}
