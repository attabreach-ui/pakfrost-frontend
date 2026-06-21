import { useState, useMemo } from 'react';
import { Search, Filter, MoveRight, X, CheckCircle } from 'lucide-react';
import type { Pallet } from '@/types';
import SlotPicker, { getPositionsForSlot } from '@/components/SlotPicker';

interface LocationMapPageProps {
  currentUserName: string;
  onMovePallet: (palletId: string, newRoom: string, newSide: 'L' | 'R', newRow: string, newSlot: string, newPosition: number | undefined, movedBy: string) => Promise<{ ok: boolean; error?: string }>;
  pallets: Pallet[];
}

const ROOMS = ['Room 1', 'Room 2', 'Room 3', 'Room 4', 'Ante Room'];
const LEFT_ROWS  = ['LG', 'LA', 'LB', 'LC', 'LD', 'LE'];
const RIGHT_ROWS = ['RG', 'RA', 'RB', 'RC', 'RD', 'RE'];
const SLOTS = ['1-6', '7-12', '13-18', '19-24', '25-30', '31-32'];

// Format location for display
const fmtDate = (iso: string | undefined | null) => iso ? new Date(iso).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

function fmtLoc(room: string, side: 'L'|'R', row: string, slot: string, position?: number | null) {
  if (room === 'Ante Room') return 'Ante Room (Floor)';
  return `${room} — ${side === 'L' ? 'Left' : 'Right'} ${row} — Slot ${slot}${position ? ` — P-${position}` : ''}`;
}

export default function LocationMapPage({ pallets, currentUserName, onMovePallet }: LocationMapPageProps) {
  const [selectedRoom, setSelectedRoom] = useState('Room 1');
  const [search,  setSearch]  = useState('');
  const [filter,  setFilter]  = useState<'all' | 'occupied' | 'vacant' | 'expiring' | 'expired'>('all');
  const [selectedSlot, setSelectedSlot] = useState<{ side: 'L' | 'R'; row: string; slot: string } | null>(null);

  const [moveTarget,      setMoveTarget]      = useState<Pallet | null>(null);
  const [moveNewLocation, setMoveNewLocation] = useState<{ room: string; side: 'L'|'R'; row: string; slot: string; position: number } | null>(null);
  const [showSlotPicker,  setShowSlotPicker]  = useState(false);
  const [moveSuccess,     setMoveSuccess]     = useState(false);
  const [isMoving,        setIsMoving]        = useState(false);

  const activePallets = useMemo(() => pallets.filter(p => p.status === 'active'), [pallets]);

  const getSlotPallets = (room: string, side: 'L' | 'R', row: string, slot: string) =>
    activePallets.filter(p => p.room === room && p.side === side && p.row === row && p.slot === slot);

  const getSlotStatus = (palletsInSlot: Pallet[]) => {
    if (palletsInSlot.length === 0) return 'vacant';
    const now = new Date();
    const d7  = new Date(now); d7.setDate(d7.getDate() + 7);
    if (palletsInSlot.some(p => new Date(p.expiryDate) <= now))          return 'expired';
    if (palletsInSlot.some(p => new Date(p.expiryDate) > now && new Date(p.expiryDate) <= d7)) return 'expiring';
    return 'occupied';
  };

  const openMoveModal = (pallet: Pallet) => {
    setMoveNewLocation(null);
    setShowSlotPicker(false);
    setMoveSuccess(false);
    setIsMoving(false);
    setMoveTarget(pallet);
  };

  const confirmMove = async () => {
    if (!moveTarget || !moveNewLocation || isMoving) return;
    setIsMoving(true);
    try {
      // M2 FIX: movePallet now returns {ok, error} — show error if slot is occupied
      const result = await onMovePallet(
        moveTarget.id,
        moveNewLocation.room,
        moveNewLocation.room === 'Ante Room' ? 'L' : moveNewLocation.side,
        moveNewLocation.room === 'Ante Room' ? '' : moveNewLocation.row,
        moveNewLocation.room === 'Ante Room' ? '' : moveNewLocation.slot,
        moveNewLocation.room === 'Ante Room' ? undefined : moveNewLocation.position,
        currentUserName,
      );
      if (!result.ok) {
        alert(result.error || 'Move failed — slot may already be occupied.');
        return;
      }
      setMoveSuccess(true);
      setTimeout(() => { setMoveTarget(null); setSelectedSlot(null); }, 1200);
    } finally {
      setIsMoving(false);
    }
  };

  const slotMatchesFilter = (status: string) => filter === 'all' || filter === status;

  // Tooltip state
  const [tooltipPallet, setTooltipPallet] = useState<Pallet | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const handlePosMouseEnter = (e: React.MouseEvent, pallet?: Pallet) => {
    if (pallet) {
      setTooltipPallet(pallet);
      setTooltipPos({ x: e.clientX + 10, y: e.clientY - 10 });
    }
  };
  const handlePosMouseMove = (e: React.MouseEvent) => {
    if (tooltipPallet) setTooltipPos({ x: e.clientX + 10, y: e.clientY - 10 });
  };
  const handlePosMouseLeave = () => setTooltipPallet(null);

  const getPositionPallet = (room: string, side: 'L' | 'R', row: string, slot: string, position: number) =>
    activePallets.find(p => p.room === room && p.side === side && p.row === row && p.slot === slot && p.position === position);

  const getPositionBorder = (pallet?: Pallet) => {
    if (!pallet) return '1px solid rgba(34,197,94,0.3)';
    const daysLeft = Math.ceil((new Date(pallet.expiryDate).getTime() - Date.now()) / 86400000);
    if (daysLeft <= 0) return '1px solid rgba(239,68,68,0.6)';
    if (daysLeft <= 7) return '1px solid rgba(234,179,8,0.6)';
    return '1px solid rgba(43,184,232,0.3)';
  };

  const renderSide = (side: 'L' | 'R') => {
    const rows = side === 'L' ? LEFT_ROWS : RIGHT_ROWS;
    return (
      <div className="flex-1">
        <div className="text-center mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full"
            style={{ color: 'var(--text-secondary)', background: 'var(--bg-input)' }}>
            {side === 'L' ? 'LEFT SIDE' : 'RIGHT SIDE'}
          </span>
        </div>
        <div className="space-y-1">
          {rows.map(row => (
            <div key={row} className="flex items-start gap-1">
              <div className="w-8 flex-shrink-0 pt-1">
                <span className="text-xs font-mono font-bold" style={{ color: 'var(--primary)' }}>{row}</span>
              </div>
              <div className="flex-1 grid grid-cols-6 gap-1">
                {SLOTS.map(slot => {
                  const slotPallets = getSlotPallets(selectedRoom, side, row, slot);
                  const status = getSlotStatus(slotPallets);
                  const isSelected = selectedSlot?.side === side && selectedSlot?.row === row && selectedSlot?.slot === slot;
                  if (!slotMatchesFilter(status)) return <div key={slot} className="h-16 rounded" style={{ background: 'var(--bg-page)' }} />;

                  const positions = getPositionsForSlot(slot);
                  const isHighlighted = search && slotPallets.some(p =>
                    p.productName.toLowerCase().includes(search.toLowerCase()) || p.productCode.includes(search)
                  );

                  return (
                    <button key={slot}
                      onClick={() => setSelectedSlot(isSelected ? null : { side, row, slot })}
                      onMouseMove={handlePosMouseMove}
                      className="h-16 rounded text-[10px] font-mono transition-all hover:scale-105 relative p-0.5"
                      style={{
                        background: isSelected ? 'rgba(2,132,199,0.06)' : 'var(--bg-card)',
                        border: isSelected ? '2px solid var(--primary)' : isHighlighted ? '2px solid #eab308' : '1px solid #E2E8F0',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      }}
                      title={`${side}${row}-${slot}: Click to view details`}
                    >
                      {/* Slot label */}
                      <div className="text-center leading-none mb-0.5" style={{ fontSize: '7px', color: 'var(--text-muted)' }}>
                        {slot}
                      </div>
                      {/* ✅ Design #3 — grid-cols-3 with new order from getPositionsForSlot = FRONT row then BACK row */}
                      <div className={`grid gap-px ${positions.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                        {positions.map((pos: number) => {
                          const posPallet = getPositionPallet(selectedRoom, side, row, slot, pos);
                          const border = getPositionBorder(posPallet);
                          return (
                            <div
                              key={pos}
                              className="rounded-sm flex items-center justify-center overflow-hidden"
                              style={{
                                background: posPallet ? 'rgba(2,132,199,0.1)' : 'rgba(34,197,94,0.08)',
                                border,
                                height: '18px',
                              }}
                              onMouseEnter={e => { e.stopPropagation(); handlePosMouseEnter(e, posPallet); }}
                              onMouseLeave={handlePosMouseLeave}
                            >
                              {posPallet ? (
                                <span className="truncate w-full text-center px-0.5" style={{ fontSize: '6px', color: 'var(--text-primary)' }}>
                                  {posPallet.productCode}
                                </span>
                              ) : (
                                <span style={{ fontSize: '5px', color: 'rgba(22,163,74,0.4)' }}>{pos}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const selectedSlotPallets = selectedSlot
    ? getSlotPallets(selectedRoom, selectedSlot.side, selectedSlot.row, selectedSlot.slot)
    : [];

  return (
    <div className="flex-1 overflow-hidden flex flex-col">

      {/* ── MOVE MODAL ── */}
      {moveTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-2xl p-6"
            style={{ background: 'var(--bg-card)', border: '1px solid #E2E8F0', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>

            {moveSuccess ? (
              <div className="text-center py-6">
                <CheckCircle className="w-12 h-12 mx-auto mb-3" style={{ color: '#4ade80' }} />
                <div className="text-lg font-bold mb-1">Moved Successfully</div>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {moveTarget.productName} relocated to {moveNewLocation ? fmtLoc(moveNewLocation.room, moveNewLocation.side, moveNewLocation.row, moveNewLocation.slot, moveNewLocation.position) : ''}
                </div>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex justify-between items-start mb-5">
                  <div>
                    <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                      <MoveRight className="w-5 h-5" style={{ color: '#0284C7' }} /> Move Pallet
                    </h2>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                      {moveTarget.productName} — {moveTarget.productCode} — {moveTarget.cartons} units
                    </p>
                  </div>
                  <button onClick={() => setMoveTarget(null)} className="p-1 rounded-lg hover:bg-slate-100">
                    <X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                  </button>
                </div>

                {/* FROM */}
                <div className="rounded-lg px-4 py-3 mb-3"
                  style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#f87171' }}>
                    Current Location
                  </div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {fmtLoc(moveTarget.room, moveTarget.side, moveTarget.row, moveTarget.slot, moveTarget.position)}
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex justify-center my-2">
                  <MoveRight className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                </div>

                {/* TO */}
                <div className="rounded-lg px-4 py-3 mb-5"
                  style={{ background: moveNewLocation ? 'rgba(22,163,74,0.05)' : 'rgba(43,184,232,0.05)', border: `1px solid ${moveNewLocation ? 'rgba(22,163,74,0.25)' : 'rgba(43,184,232,0.2)'}` }}>
                  <div className="text-[10px] font-bold uppercase tracking-wider mb-2"
                    style={{ color: moveNewLocation ? '#16a34a' : '#0284C7' }}>
                    New Location
                  </div>

                  {moveNewLocation ? (
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {fmtLoc(moveNewLocation.room, moveNewLocation.side, moveNewLocation.row, moveNewLocation.slot, moveNewLocation.position)}
                      </div>
                      <button
                        onClick={() => setShowSlotPicker(true)}
                        className="text-xs px-3 py-1 rounded-lg font-medium ml-3"
                        style={{ background: 'rgba(43,184,232,0.1)', color: '#0284C7', border: '1px solid rgba(43,184,232,0.3)', whiteSpace: 'nowrap' }}>
                        Change
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowSlotPicker(true)}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                      style={{ background: '#0284C7', color: 'var(--bg-card)' }}>
                      📍 Select New Position
                    </button>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-3">
                  <button onClick={() => setMoveTarget(null)}
                    disabled={isMoving}
                    className="flex-1 py-2.5 rounded-xl text-sm disabled:opacity-40"
                    style={{ border: '1px solid #E2E8F0', color: 'var(--text-secondary)' }}>
                    Cancel
                  </button>
                  <button
                    onClick={confirmMove}
                    disabled={!moveNewLocation || isMoving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg, #0284C7, #0369A1)', color: 'var(--bg-card)' }}>
                    <MoveRight className="w-4 h-4" /> {isMoving ? 'Moving...' : 'Confirm Move'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── SLOT PICKER OVERLAY ── z-50 so it appears above the move modal */}
      {showSlotPicker && moveTarget && (
        <SlotPicker
          pallets={pallets.filter(p => p.id !== moveTarget.id)}
          initialRoom={moveTarget.room}
          initialSide={moveTarget.side}
          initialRow={moveTarget.row}
          initialSlot={moveTarget.slot}
          onConfirm={(room, side, row, slot, position) => {
            setMoveNewLocation({ room, side, row, slot, position });
            setShowSlotPicker(false);
          }}
          onCancel={() => setShowSlotPicker(false)}
        />
      )}

      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
          <div>
            <h1 className="text-2xl font-bold ">Location Map</h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Visual warehouse rack map</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search product or code..."
                className="pl-9 pr-4 py-2 rounded-lg text-sm outline-none w-full sm:w-64"
                style={{ background: 'var(--bg-card)', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }} />
            </div>
            <div className="relative flex-shrink-0">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
              <select value={filter} onChange={e => setFilter(e.target.value as typeof filter)}
                className="pl-9 pr-3 py-2 rounded-lg text-sm outline-none appearance-none"
                style={{ background: 'var(--bg-card)', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <option value="all">All</option>
                <option value="occupied">Occupied</option>
                <option value="vacant">Vacant</option>
                <option value="expiring">Expiring</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>
        </div>

        {/* Room Tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {ROOMS.map(room => (
            <button key={room} onClick={() => { setSelectedRoom(room); setSelectedSlot(null); }}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: selectedRoom === room
                  ? (room === 'Ante Room' ? '#F59E0B' : 'var(--primary)')
                  : 'var(--bg-page)',
                color: selectedRoom === room ? 'var(--bg-card)' : 'var(--text-secondary)',
                border: `1px solid ${selectedRoom === room && room === 'Ante Room' ? '#D97706' : 'var(--border-default)'}`,
              }}>
              {room === 'Ante Room' ? '🏗️ Ante Room' : room}
            </button>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs mb-2 flex-wrap">
          {[
            { label: 'Occupied', bg: 'rgba(43,184,232,0.12)', border: '1px solid rgba(43,184,232,0.3)' },
            { label: 'Available', bg: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.3)' },
            { label: 'Expiring <7d', bg: 'transparent', border: '1px solid rgba(234,179,8,0.6)' },
            { label: 'Expired', bg: 'transparent', border: '1px solid rgba(239,68,68,0.6)' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
              <div className="w-3 h-3 rounded-sm" style={{ background: l.bg, border: l.border }} />
              {l.label}
            </div>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">

        {/* ── ANTE ROOM — Floor view ── */}
        {selectedRoom === 'Ante Room' ? (
          <div>
            {/* Ante Room banner */}
            <div className="rounded-xl p-4 mb-4 flex items-center gap-4"
              style={{ background: 'rgba(245,158,11,0.06)', border: '2px dashed rgba(245,158,11,0.35)' }}>
              <div className="text-3xl">🏗️</div>
              <div>
                <div className="text-sm font-bold" style={{ color: '#92400E' }}>Ante Room — Floor Storage</div>
                <div className="text-xs mt-0.5" style={{ color: '#78716C' }}>
                  Temporary holding area. No racks or slots — products stored on the floor.
                </div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-2xl font-bold" style={{ color: '#D97706' }}>
                  {activePallets.filter(p => p.room === 'Ante Room').length}
                </div>
                <div className="text-xs" style={{ color: '#92400E' }}>pallets on floor</div>
              </div>
            </div>

            {activePallets.filter(p => p.room === 'Ante Room').length === 0 ? (
              <div className="text-center py-16 rounded-xl" style={{ background: '#FAFAFA', border: '1px dashed #E2E8F0' }}>
                <div className="text-4xl mb-3">📦</div>
                <div className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Ante Room is empty</div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>No pallets currently on the floor</div>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'rgba(245,158,11,0.06)' }}>
                      {['#', 'Product', 'Code', 'Customer', 'IGP', 'Qty', 'Wt (kg)', 'Date In', 'Expiry', 'Days Left', 'Action'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase"
                          style={{ color: '#92400E', borderBottom: '2px solid rgba(245,158,11,0.2)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activePallets
                      .filter(p => p.room === 'Ante Room')
                      .filter(p => !search || p.productName.toLowerCase().includes(search.toLowerCase()) || p.productCode.includes(search))
                      .map((p, idx) => {
                        const daysLeft = Math.ceil((new Date(p.expiryDate).getTime() - Date.now()) / 86400000);
                        return (
                          <tr key={p.id} style={{ borderTop: '1px solid #F1F5F9' }}>
                            <td className="px-3 py-2.5 text-xs font-bold" style={{ color: '#D97706' }}>{idx + 1}</td>
                            <td className="px-3 py-2.5 font-medium ">{p.productName}</td>
                            <td className="px-3 py-2.5 font-mono text-xs" style={{ color: 'var(--primary)' }}>{p.productCode}</td>
                            <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{p.customerName}</td>
                            <td className="px-3 py-2.5 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{p.igpNumber}</td>
                            <td className="px-3 py-2.5 font-bold">{p.cartons}</td>
                            <td className="px-3 py-2.5 font-mono text-xs" style={{ color: 'var(--primary)' }}>{Number(p.totalWeight).toFixed(1)}</td>
                            <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{fmtDate(p.dateIn)}</td>
                            <td className="px-3 py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{fmtDate(p.expiryDate)}</td>
                            <td className="px-3 py-2.5 font-mono font-bold"
                              style={{ color: daysLeft <= 0 ? '#ef4444' : daysLeft <= 7 ? '#eab308' : '#4ade80' }}>
                              {daysLeft <= 0 ? 'EXPIRED' : `${daysLeft}d`}
                            </td>
                            <td className="px-3 py-2.5">
                              <button
                                onClick={() => openMoveModal(p)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                                style={{ background: 'var(--primary-light)', color: 'var(--primary)', border: '1px solid var(--border-default)' }}>
                                <MoveRight className="w-3.5 h-3.5" /> Move
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* ── NORMAL ROOMS — rack/slot map ── */
          <div>
          {/* Mobile hint banner */}
          <div className="sm:hidden rounded-lg px-3 py-2 mb-3 flex items-center gap-2 text-xs"
            style={{ background: 'rgba(43,184,232,0.06)', border: '1px solid rgba(43,184,232,0.2)', color: 'var(--text-secondary)' }}>
            <span>👉</span> Swipe left to see Right Side
          </div>

          {/* Desktop: both sides + AISLE label side by side */}
          <div className="hidden sm:flex gap-6">
            {renderSide('L')}
            <div className="w-10 flex-shrink-0 flex flex-col items-center">
              <div className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>AISLE</div>
              <div className="flex-1 w-full rounded-lg border border-dashed flex items-center justify-center"
                style={{ background: 'rgba(122,155,181,0.05)', borderColor: 'rgba(122,155,181,0.2)' }}>
                <div className="text-xs -rotate-90 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>WALKWAY</div>
              </div>
            </div>
            {renderSide('R')}
          </div>

          {/* Mobile: horizontal scroll, LEFT fills screen, RIGHT comes after divider */}
          <div className="sm:hidden overflow-x-auto pb-2" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="flex" style={{ minWidth: 'max-content', gap: '0' }}>
              {/* LEFT SIDE — fits mobile screen width */}
              <div style={{ minWidth: 'calc(100vw - 48px)' }}>
                {renderSide('L')}
              </div>
              {/* Divider with RIGHT label */}
              <div className="flex-shrink-0 flex flex-col items-center justify-center mx-3"
                style={{ minWidth: '32px' }}>
                <div className="h-full w-px" style={{ background: 'rgba(43,184,232,0.25)' }} />
                <div className="text-xs font-bold py-2 px-1 rounded"
                  style={{ writingMode: 'vertical-lr', color: 'var(--primary)', background: 'rgba(43,184,232,0.06)', letterSpacing: '0.1em' }}>
                  RIGHT SIDE →
                </div>
                <div className="h-full w-px" style={{ background: 'rgba(43,184,232,0.25)' }} />
              </div>
              {/* RIGHT SIDE */}
              <div style={{ minWidth: 'calc(100vw - 48px)' }}>
                {renderSide('R')}
              </div>
            </div>
          </div>

        {/* Slot Detail Panel */}
        {selectedSlot && (
          <div className="mt-6 rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold ">
                {selectedRoom} - {selectedSlot.side === 'L' ? 'Left' : 'Right'} {selectedSlot.row} - Slot {selectedSlot.slot}
              </h3>
              <button onClick={() => setSelectedSlot(null)} className="text-sm" style={{ color: 'var(--text-secondary)' }}>x Close</button>
            </div>

            {selectedSlotPallets.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>This slot is vacant.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'rgba(100,116,139,0.06)' }}>
                      {['Product', 'Code', 'IGP', 'Qty', 'Expiry', 'Days Left', 'Action'].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSlotPallets.map(p => {
                      const daysLeft = Math.ceil((new Date(p.expiryDate).getTime() - Date.now()) / 86400000);
                      return (
                        <tr key={p.id} style={{ borderTop: '1px solid var(--border-default)' }}>
                          <td className="px-3 py-2.5 font-medium ">{p.productName}</td>
                          <td className="px-3 py-2.5 font-mono" style={{ color: 'var(--primary)' }}>{p.productCode}</td>
                          <td className="px-3 py-2.5 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{p.igpNumber}</td>
                          <td className="px-3 py-2.5 ">{p.cartons}</td>
                          <td className="px-3 py-2.5" style={{ color: 'var(--text-secondary)' }}>{fmtDate(p.expiryDate)}</td>
                          <td className="px-3 py-2.5 font-mono font-bold"
                            style={{ color: daysLeft <= 0 ? '#ef4444' : daysLeft <= 7 ? '#eab308' : '#4ade80' }}>
                            {daysLeft <= 0 ? 'EXPIRED' : `${daysLeft}d`}
                          </td>
                          <td className="px-3 py-2.5">
                            <button
                              onClick={() => openMoveModal(p)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
                              style={{ background: 'var(--primary-light)', color: 'var(--primary)', border: '1px solid var(--border-default)' }}>
                              <MoveRight className="w-3.5 h-3.5" /> Move
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
          </div>
        )}
      </div>

      {/* Hover Tooltip */}
      {tooltipPallet && (
        <div
          className="fixed z-[60] px-3 py-2 rounded-lg text-xs pointer-events-none"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y,
            background: 'var(--bg-hover)',
            border: '1px solid rgba(43,184,232,0.3)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            color: 'var(--bg-input)',
            minWidth: '180px',
          }}
        >
          <div className="font-bold  mb-1">{tooltipPallet.productName}</div>
          <div style={{ color: 'var(--text-secondary)' }}>Customer: <span className="">{tooltipPallet.customerName}</span></div>
          <div style={{ color: 'var(--text-secondary)' }}>Qty: <span className="">{tooltipPallet.cartons}</span></div>
          <div style={{ color: 'var(--text-secondary)' }}>Expiry: <span className="">{fmtDate(tooltipPallet.expiryDate)}</span></div>
          <div style={{ color: 'var(--text-secondary)' }}>IGP: <span className="">{tooltipPallet.igpNumber}</span></div>
          <div style={{ color: 'var(--text-secondary)' }}>Position: <span className="">{tooltipPallet.position || '-'}</span></div>
        </div>
      )}
    </div>
  );
}


