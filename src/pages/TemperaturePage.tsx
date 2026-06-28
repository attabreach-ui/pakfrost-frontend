import { useState } from 'react';
import { Thermometer, Plus, X, CheckCircle } from 'lucide-react';
import type { TemperatureReading } from '@/types';

interface TemperaturePageProps {
  temperatures: TemperatureReading[];
  onAddTemperature: (r: Omit<TemperatureReading, 'id'>) => void;
  currentUserName: string;
}

const ROOMS = ['Room 1', 'Room 2', 'Room 3', 'Room 4', 'Ante Room']; // H5 FIX: Ante Room added

export default function TemperaturePage({ temperatures, onAddTemperature, currentUserName }: TemperaturePageProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [room, setRoom] = useState('Room 1');
  const [temp, setTemp] = useState('-20');
  const [notes, setNotes] = useState('');
  const [success, setSuccess] = useState(false);

  const handleAdd = () => {
    const t = parseFloat(temp);
    if (isNaN(t)) return;
    onAddTemperature({
      room,
      temperature: t,
      time: new Date().toISOString(),
      recordedBy: currentUserName,
      notes,
    });
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      setShowAdd(false);
      setTemp('-20');
      setNotes('');
    }, 1000);
  };

  const grouped = temperatures.reduce((acc, t) => {
    if (!acc[t.room]) acc[t.room] = [];
    acc[t.room].push(t);
    return acc;
  }, {} as Record<string, TemperatureReading[]>);

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold  flex items-center gap-2">
              <Thermometer className="w-6 h-6" style={{ color: 'var(--primary)' }} /> Temperature Monitoring
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Track cold room temperatures</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'rgba(43,184,232,0.15)', color: 'var(--primary)', border: '1px solid rgba(43,184,232,0.3)' }}
          >
            <Plus className="w-4 h-4" /> Add Reading
          </button>
        </div>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            {success ? (
              <div className="text-center py-4">
                <CheckCircle className="w-12 h-12 mx-auto mb-3" style={{ color: '#4ade80' }} />
                <div className="text-lg font-bold ">Recorded!</div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center mb-5">
                  <h2 className="text-lg font-bold ">Add Temperature Reading</h2>
                  <button onClick={() => setShowAdd(false)}><X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} /></button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Room</label>
                    <select value={room} onChange={e => setRoom(e.target.value)} className="w-full px-3 py-2 rounded-lg  text-sm outline-none"
                      style={{ background: 'var(--bg-page)', border: '1px solid var(--border-default)' }}>
                      {ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Temperature (C)</label>
                    <input type="number" step="0.1" value={temp} onChange={e => setTemp(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg  text-sm outline-none"
                      style={{ background: 'var(--bg-page)', border: '1px solid var(--border-default)' }} />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Notes</label>
                    <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg  text-sm outline-none"
                      style={{ background: 'var(--bg-page)', border: '1px solid var(--border-default)' }} placeholder="Optional" />
                  </div>
                </div>
                <button onClick={handleAdd}
                  className="w-full mt-5 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: 'linear-gradient(135deg, #0284C7, #0369A1)', color: 'var(--bg-card)' }}>
                  Save Reading
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {ROOMS.map(roomName => {
            const roomTemps = grouped[roomName] || [];
            const latest = roomTemps[0];
            const isOk = latest && latest.temperature <= -18;
            return (
              <div key={roomName} className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold ">{roomName}</h3>
                  {latest && (
                    <span className="text-xs font-mono font-bold px-2 py-1 rounded" style={{
                      background: isOk ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.15)',
                      color: isOk ? '#4ade80' : '#ef4444',
                    }}>
                      {Number(latest.temperature).toFixed(1)}C
                    </span>
                  )}
                </div>

                {roomTemps.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ background: '#FAFAFA' }}>
                          {['Time', 'Temp', 'Recorded By', 'Notes'].map(h => (
                            <th key={h} className="px-2 py-1.5 text-left" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {roomTemps.slice(0, 10).map(t => (
                          <tr key={t.id} style={{ borderTop: '1px solid rgba(43,184,232,0.05)' }}>
                            <td className="px-2 py-1.5" style={{ color: 'var(--text-secondary)' }}>
                              {new Date(t.recordedAt||t.time||"").toLocaleString('en-PK', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-2 py-1.5 font-mono font-bold" style={{ color: t.temperature <= -18 ? '#4ade80' : '#ef4444' }}>
                              {Number(t.temperature).toFixed(1)}C
                            </td>
                            <td className="px-2 py-1.5 ">{t.recordedBy}</td>
                            <td className="px-2 py-1.5" style={{ color: 'var(--text-secondary)' }}>{t.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-4 text-xs" style={{ color: 'var(--text-secondary)' }}>No readings yet</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


