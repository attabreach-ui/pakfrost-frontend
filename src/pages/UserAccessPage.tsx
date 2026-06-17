import { useState } from 'react';
import { ShieldCheck, Plus, Pencil, Trash2, X, CheckCircle } from 'lucide-react';
import type { User, UserPermissions, UserRole } from '@/types';

interface UserAccessPageProps {
  users: User[];
  currentUser: User;
  onAddUser: (user: Omit<User, 'id' | 'createdAt'>) => User;
  onUpdateUser: (id: string, updates: Partial<Omit<User, 'id'>>) => void;
  onDeleteUser: (id: string) => void;
  onUpdatePermissions: (id: string, permissions: Partial<UserPermissions>) => void;
}

const PERM_LABELS: Record<keyof UserPermissions, string> = {
  dashboard: 'Dashboard', stockIn: 'Stock IN', stockOut: 'Stock OUT',
  locationMap: 'Location Map', palletTags: 'Pallet Tags', temperature: 'Temperature',
  expiryAlerts: 'Expiry Alerts', reports: 'Reports', masterData: 'Master Data',
  history: 'History', userAccess: 'User Access',
};

export default function UserAccessPage({
  users, currentUser, onAddUser, onUpdateUser, onDeleteUser, onUpdatePermissions: _onUpdatePermissions,
}: UserAccessPageProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    username: '', password: '', name: '', role: 'operator' as UserRole, isActive: true,
  });
  const [customPerms, setCustomPerms] = useState<Partial<UserPermissions>>({});

  const resetForm = () => {
    setForm({ username: '', password: '', name: '', role: 'operator', isActive: true });
    setCustomPerms({});
    setEditingId(null);
  };

  const handleAdd = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEdit = (u: User) => {
    setForm({ username: u.username, password: u.password, name: u.name, role: u.role, isActive: u.isActive });
    setCustomPerms(u.customPermissions || {});
    setEditingId(u.id);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!form.username || !form.password || !form.name) return;
    const userData = { ...form, avatar: '', customPermissions: Object.keys(customPerms).length > 0 ? customPerms : undefined };
    if (editingId) {
      onUpdateUser(editingId, userData);
    } else {
      onAddUser(userData);
    }
    setShowForm(false);
    resetForm();
  };

  const handlePermToggle = (permKey: keyof UserPermissions) => {
    setCustomPerms(prev => ({ ...prev, [permKey]: !prev[permKey] }));
  };

  const isAdmin = currentUser.role === 'admin';

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6" style={{ color: 'var(--primary)' }} />
            <h1 className="text-2xl font-bold ">User Access</h1>
          </div>
          {isAdmin && (
            <button onClick={handleAdd}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ background: 'rgba(43,184,232,0.15)', color: 'var(--primary)', border: '1px solid rgba(43,184,232,0.3)' }}>
              <Plus className="w-4 h-4" /> Add User
            </button>
          )}
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
            <div className="w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ background: 'var(--bg-card)', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-lg font-bold ">{editingId ? 'Edit' : 'Add'} User</h2>
                <button onClick={() => setShowForm(false)}><X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} /></button>
              </div>

              <div className="space-y-3">
                <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Name *</label><input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 rounded-lg  text-sm outline-none" style={{ background: 'var(--bg-page)', border: '1px solid var(--border-default)' }} /></div>
                <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Username *</label><input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} className="w-full px-3 py-2 rounded-lg  text-sm outline-none" style={{ background: 'var(--bg-page)', border: '1px solid var(--border-default)' }} /></div>
                <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Password *</label><input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} className="w-full px-3 py-2 rounded-lg  text-sm outline-none" style={{ background: 'var(--bg-page)', border: '1px solid var(--border-default)' }} /></div>
                <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Role</label>
                  <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value as UserRole }))} className="w-full px-3 py-2 rounded-lg  text-sm outline-none" style={{ background: 'var(--bg-page)', border: '1px solid var(--border-default)' }}>
                    <option value="admin">Admin</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="operator">Operator</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} />
                  <label htmlFor="isActive" className="text-xs" style={{ color: 'var(--text-secondary)' }}>Active</label>
                </div>

                {/* Custom Permissions */}
                <div className="mt-4">
                  <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--primary)' }}>Custom Permissions (optional)</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.entries(PERM_LABELS) as [keyof UserPermissions, string][]).map(([key, label]) => (
                      <button key={key} onClick={() => handlePermToggle(key)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors"
                        style={{
                          background: customPerms[key] ? 'rgba(74,222,128,0.15)' : 'rgba(0,0,0,0.2)',
                          border: `1px solid ${customPerms[key] ? 'rgba(74,222,128,0.3)' : 'rgba(43,184,232,0.1)'}`,
                          color: customPerms[key] ? '#4ade80' : '#7a9bb5',
                        }}>
                        <span className="w-3 h-3 rounded-sm flex items-center justify-center" style={{ background: customPerms[key] ? '#4ade80' : 'transparent', border: '1px solid rgba(43,184,232,0.3)' }}>
                          {customPerms[key] && <CheckCircle className="w-2.5 h-2.5" style={{ color: 'var(--bg-card)' }} />}
                        </span>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button onClick={handleSave}
                className="w-full mt-5 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: 'linear-gradient(135deg, #0284C7, #0369A1)', color: 'var(--bg-card)' }}>
                <CheckCircle className="w-4 h-4 inline mr-1" /> {editingId ? 'Update' : 'Save'} User
              </button>
            </div>
          </div>
        )}

        {/* Users Table */}
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#FAFAFA' }}>
                  {['Name', 'Username', 'Role', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-white/5 transition-colors" style={{ borderTop: '1px solid rgba(43,184,232,0.05)' }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'linear-gradient(135deg, #1A5F8A, #2BB8E8)', color: 'var(--text-primary)' }}>
                          {u.name[0].toUpperCase()}
                        </div>
                        <span className="font-medium ">{u.name}</span>
                        {u.id === currentUser.id && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(43,184,232,0.15)', color: 'var(--primary)' }}>You</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{u.username}</td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-xs capitalize" style={{ background: 'rgba(43,184,232,0.1)', color: 'var(--primary)' }}>{u.role}</span></td>
                    <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-xs" style={{ background: u.isActive ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.15)', color: u.isActive ? '#4ade80' : '#ef4444' }}>{u.isActive ? 'Active' : 'Inactive'}</span></td>
                    <td className="px-4 py-3">
                      {isAdmin && u.id !== currentUser.id && (
                        <>
                          <button onClick={() => handleEdit(u)} className="mr-2" style={{ color: 'var(--primary)' }}><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => onDeleteUser(u.id)} style={{ color: '#ef4444' }}><Trash2 className="w-3.5 h-3.5" /></button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}


