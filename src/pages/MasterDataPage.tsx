import { useState } from 'react';
import { Database, Plus, Pencil, Trash2, X, CheckCircle } from 'lucide-react';
import type { Customer, Product, Driver, Vehicle, Room, Pallet } from '@/types';

type TabType = 'customers' | 'products' | 'drivers' | 'vehicles' | 'rooms';
const vehicleTypeLabel = (type: Vehicle['type']) => type.replace('_', ' ');

interface MasterDataPageProps {
  customers: Customer[];
  products: Product[];
  drivers: Driver[];
  vehicles: Vehicle[];
  rooms: Room[];
  pallets: Pallet[];   // ✅ Fix 3 — needed for safe delete checks
  onAddCustomer: (c: Omit<Customer, 'id'>) => Customer;
  onUpdateCustomer: (id: string, updates: Partial<Omit<Customer, 'id'>>) => void;
  onDeleteCustomer: (id: string) => void;
  onAddProduct: (p: Omit<Product, 'id'>) => Product;
  onUpdateProduct: (id: string, updates: Partial<Omit<Product, 'id'>>) => void;
  onDeleteProduct: (id: string) => void;
  onAddDriver: (d: Omit<Driver, 'id'>) => Driver;
  onUpdateDriver: (id: string, updates: Partial<Omit<Driver, 'id'>>) => void;
  onDeleteDriver: (id: string) => void;
  onAddVehicle: (v: Omit<Vehicle, 'id'>) => Vehicle;
  onUpdateVehicle: (id: string, updates: Partial<Omit<Vehicle, 'id'>>) => void;
  onDeleteVehicle: (id: string) => void;
  onUpdateRoom: (id: string, updates: Partial<Omit<Room, 'id'>>) => void;
}

const inputCls = "w-full px-3 py-2 rounded-lg  text-sm outline-none";
const inputStyle = { background: 'var(--bg-page)', border: '1px solid var(--border-default)' };

export default function MasterDataPage({
  customers, products, drivers, vehicles, rooms, pallets,
  onAddCustomer, onUpdateCustomer, onDeleteCustomer,
  onAddProduct, onUpdateProduct, onDeleteProduct,
  onAddDriver, onUpdateDriver, onDeleteDriver,
  onAddVehicle, onUpdateVehicle, onDeleteVehicle,
  onUpdateRoom: _onUpdateRoom,
}: MasterDataPageProps) {
  const [activeTab, setActiveTab] = useState<TabType>('customers');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // ✅ Fix 3 — safe delete helpers
  const activePallets = pallets.filter(p => p.status === 'active');

  const safeDeleteCustomer = (id: string, name: string) => {
    const inUse = activePallets.filter(p => p.customerId === id).length;
    if (inUse > 0) {
      alert(`Cannot delete "${name}" — ${inUse} active pallet(s) in warehouse. Remove their stock first.`);
      return;
    }
    if (confirm(`Delete customer "${name}"?`)) onDeleteCustomer(id);
  };

  const safeDeleteProduct = (id: string, name: string) => {
    const inUse = activePallets.filter(p => p.productId === id).length;
    if (inUse > 0) {
      alert(`Cannot delete "${name}" — ${inUse} active pallet(s) in warehouse. Remove their stock first.`);
      return;
    }
    if (confirm(`Delete product "${name}"?`)) onDeleteProduct(id);
  };

  const safeDeleteDriver = (id: string, name: string) => {
    if (confirm(`Delete driver "${name}"?`)) onDeleteDriver(id);
  };

  const safeDeleteVehicle = (id: string, vehicleNo: string) => {
    if (confirm(`Delete vehicle "${vehicleNo}"?`)) onDeleteVehicle(id);
  };

  // Form states
  const [customerForm, setCustomerForm] = useState({ name: '', code: '', contactPerson: '', phone: '', email: '', address: '', tempRequirement: '-18C to -22C', isActive: true });
  const [productForm, setProductForm] = useState({ name: '', code: '', customerId: '', category: '', cartonsPerPallet: 160, weightPerCarton: 10, uom: 'Kg' as 'Kg' | 'Lbs' });
  const [driverForm, setDriverForm] = useState({ name: '', code: '', cnic: '', phone: '', licenseNo: '', licenseExpiry: '', status: 'active' as 'active' | 'inactive' });
  const [vehicleForm, setVehicleForm] = useState({ vehicleNo: '', type: 'Reefer_Truck' as Vehicle['type'], ownership: 'own' as 'own' | 'external', status: 'active' as 'active' | 'inactive' });

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: 'customers', label: 'Customers', count: customers.length },
    { key: 'products', label: 'Products', count: products.length },
    { key: 'drivers', label: 'Drivers', count: drivers.length },
    { key: 'vehicles', label: 'Vehicles', count: vehicles.length },
    { key: 'rooms', label: 'Rooms', count: rooms.length },
  ];

  const resetForms = () => {
    setCustomerForm({ name: '', code: '', contactPerson: '', phone: '', email: '', address: '', tempRequirement: '-18C to -22C', isActive: true });
    setProductForm({ name: '', code: '', customerId: '', category: '', cartonsPerPallet: 160, weightPerCarton: 10, uom: 'Kg' });
    setDriverForm({ name: '', code: '', cnic: '', phone: '', licenseNo: '', licenseExpiry: '', status: 'active' });
    setVehicleForm({ vehicleNo: '', type: 'Reefer_Truck', ownership: 'own', status: 'active' });
    setEditingId(null);
  };

  const handleAdd = () => {
    resetForms();
    setShowForm(true);
  };

  const handleEditCustomer = (c: Customer) => {
    setCustomerForm({ name: c.name, code: c.code, contactPerson: c.contactPerson || '', phone: c.phone || '', email: c.email || '', address: c.address || '', tempRequirement: c.tempRequirement || '', isActive: c.isActive });
    setEditingId(c.id);
    setShowForm(true);
  };

  const handleEditProduct = (p: Product) => {
    setProductForm({ name: p.name, code: p.code, customerId: p.customerId, category: p.category, cartonsPerPallet: p.cartonsPerPallet, weightPerCarton: p.weightPerCarton, uom: p.uom });
    setEditingId(p.id);
    setShowForm(true);
  };

  const handleEditDriver = (d: Driver) => {
    setDriverForm({ name: d.name, code: d.code, cnic: d.cnic, phone: d.phone, licenseNo: d.licenseNo, licenseExpiry: d.licenseExpiry, status: d.status });
    setEditingId(d.id);
    setShowForm(true);
  };

  const handleEditVehicle = (v: Vehicle) => {
    setVehicleForm({ vehicleNo: v.vehicleNo, type: v.type, ownership: v.ownership, status: v.status });
    setEditingId(v.id);
    setShowForm(true);
  };

  const handleSave = () => {
    if (activeTab === 'customers') {
      if (!customerForm.name || !customerForm.code) return;
      if (editingId) onUpdateCustomer(editingId, customerForm);
      else onAddCustomer(customerForm);
    } else if (activeTab === 'products') {
      if (!productForm.name || !productForm.code || !productForm.customerId) return;
      if (editingId) onUpdateProduct(editingId, productForm);
      else onAddProduct(productForm);
    } else if (activeTab === 'drivers') {
      if (!driverForm.name || !driverForm.code) return;
      if (editingId) onUpdateDriver(editingId, driverForm);
      else onAddDriver(driverForm);
    } else if (activeTab === 'vehicles') {
      if (!vehicleForm.vehicleNo) return;
      if (editingId) onUpdateVehicle(editingId, vehicleForm);
      else onAddVehicle(vehicleForm);
    }
    setShowForm(false);
    resetForms();
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="p-6 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h1 className="text-2xl font-bold  flex items-center gap-2">
              <Database className="w-6 h-6" style={{ color: 'var(--primary)' }} /> Master Data
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Manage customers, products, drivers, vehicles, and rooms</p>
          </div>
          <button onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: 'rgba(43,184,232,0.15)', color: 'var(--primary)', border: '1px solid rgba(43,184,232,0.3)' }}>
            <Plus className="w-4 h-4" /> Add {activeTab.slice(0, -1)}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-card)' }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => { setActiveTab(t.key); setShowForm(false); }}
              className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{ background: activeTab === t.key ? 'rgba(43,184,232,0.12)' : 'transparent', color: activeTab === t.key ? 'var(--primary)' : '#7a9bb5', border: activeTab === t.key ? '1px solid rgba(43,184,232,0.25)' : '1px solid transparent' }}>
              {t.label} ({t.count})
            </button>
          ))}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold ">{editingId ? 'Edit' : 'Add'} {activeTab.slice(0, -1)}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} /></button>
            </div>

            <div className="space-y-3">
              {activeTab === 'customers' && (
                <>
                  <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Name *</label><input value={customerForm.name} onChange={e => setCustomerForm(p => ({ ...p, name: e.target.value }))} className={inputCls} style={inputStyle} /></div>
                  <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Code *</label><input value={customerForm.code} onChange={e => setCustomerForm(p => ({ ...p, code: e.target.value }))} className={inputCls} style={inputStyle} /></div>
                  <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Contact Person</label><input value={customerForm.contactPerson} onChange={e => setCustomerForm(p => ({ ...p, contactPerson: e.target.value }))} className={inputCls} style={inputStyle} /></div>
                  <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Phone</label><input value={customerForm.phone} onChange={e => setCustomerForm(p => ({ ...p, phone: e.target.value }))} className={inputCls} style={inputStyle} /></div>
                </>
              )}
              {activeTab === 'products' && (
                <>
                  <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Name *</label><input value={productForm.name} onChange={e => setProductForm(p => ({ ...p, name: e.target.value }))} className={inputCls} style={inputStyle} /></div>
                  <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Code *</label><input value={productForm.code} onChange={e => setProductForm(p => ({ ...p, code: e.target.value }))} className={inputCls} style={inputStyle} /></div>
                  <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Customer *</label>
                    <select value={productForm.customerId} onChange={e => setProductForm(p => ({ ...p, customerId: e.target.value }))} className={inputCls} style={inputStyle}>
                      <option value="">Select Customer</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Category</label><input value={productForm.category} onChange={e => setProductForm(p => ({ ...p, category: e.target.value }))} className={inputCls} style={inputStyle} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Cartons/Pallet</label><input type="number" value={productForm.cartonsPerPallet} onChange={e => setProductForm(p => ({ ...p, cartonsPerPallet: parseInt(e.target.value) || 0 }))} className={inputCls} style={inputStyle} /></div>
                    <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Weight/Carton</label><input type="number" step="0.1" value={productForm.weightPerCarton} onChange={e => setProductForm(p => ({ ...p, weightPerCarton: parseFloat(e.target.value) || 0 }))} className={inputCls} style={inputStyle} /></div>
                  </div>
                </>
              )}
              {activeTab === 'drivers' && (
                <>
                  <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Name *</label><input value={driverForm.name} onChange={e => setDriverForm(p => ({ ...p, name: e.target.value }))} className={inputCls} style={inputStyle} /></div>
                  <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Code *</label><input value={driverForm.code} onChange={e => setDriverForm(p => ({ ...p, code: e.target.value }))} className={inputCls} style={inputStyle} /></div>
                  <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>CNIC</label><input value={driverForm.cnic} onChange={e => setDriverForm(p => ({ ...p, cnic: e.target.value }))} className={inputCls} style={inputStyle} /></div>
                  <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Phone</label><input value={driverForm.phone} onChange={e => setDriverForm(p => ({ ...p, phone: e.target.value }))} className={inputCls} style={inputStyle} /></div>
                  <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>License No</label><input value={driverForm.licenseNo} onChange={e => setDriverForm(p => ({ ...p, licenseNo: e.target.value }))} className={inputCls} style={inputStyle} /></div>
                  <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>License Expiry</label><input type="date" value={driverForm.licenseExpiry} onChange={e => setDriverForm(p => ({ ...p, licenseExpiry: e.target.value }))} className={inputCls} style={inputStyle} /></div>
                </>
              )}
              {activeTab === 'vehicles' && (
                <>
                  <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Vehicle No *</label><input value={vehicleForm.vehicleNo} onChange={e => setVehicleForm(p => ({ ...p, vehicleNo: e.target.value }))} className={inputCls} style={inputStyle} /></div>
                  <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Type</label>
                    <select value={vehicleForm.type} onChange={e => setVehicleForm(p => ({ ...p, type: e.target.value as Vehicle['type'] }))} className={inputCls} style={inputStyle}>
                      {(['Reefer_Truck', 'Container', 'Pickup', 'Van', 'Other'] as Vehicle['type'][]).map(t => <option key={t} value={t}>{vehicleTypeLabel(t)}</option>)}
                    </select>
                  </div>
                  <div><label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Ownership</label>
                    <select value={vehicleForm.ownership} onChange={e => setVehicleForm(p => ({ ...p, ownership: e.target.value as 'own' | 'external' }))} className={inputCls} style={inputStyle}>
                      <option value="own">Own</option>
                      <option value="external">External</option>
                    </select>
                  </div>
                </>
              )}
              {activeTab === 'rooms' && (
                <div className="text-center py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>Room editing is view-only. Use the table below.</div>
              )}
            </div>

            {activeTab !== 'rooms' && (
              <button onClick={handleSave}
                className="w-full mt-5 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: 'linear-gradient(135deg, #0284C7, #0369A1)', color: 'var(--bg-card)' }}>
                <CheckCircle className="w-4 h-4 inline mr-1" /> {editingId ? 'Update' : 'Save'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 pb-6">
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          {activeTab === 'customers' && (
            <DataTable headers={['Name', 'Code', 'Contact', 'Phone', 'Status', 'Actions']}>
              {customers.map(c => (
                <tr key={c.id} style={{ borderTop: '1px solid rgba(43,184,232,0.05)' }}>
                  <td className="px-3 py-2 ">{c.name}</td>
                  <td className="px-3 py-2 font-mono" style={{ color: 'var(--primary)' }}>{c.code}</td>
                  <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{c.contactPerson || '-'}</td>
                  <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{c.phone || '-'}</td>
                  <td className="px-3 py-2"><span className="px-2 py-0.5 rounded text-xs" style={{ background: c.isActive ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.15)', color: c.isActive ? '#4ade80' : '#ef4444' }}>{c.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td className="px-3 py-2">
                    <button onClick={() => handleEditCustomer(c)} className="mr-2" style={{ color: 'var(--primary)' }}><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => safeDeleteCustomer(c.id, c.name)} style={{ color: '#ef4444' }}><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}

          {activeTab === 'products' && (
            <DataTable headers={['Name', 'Code', 'Customer', 'Category', 'Wt/Ctn', 'Actions']}>
              {products.map(p => (
                <tr key={p.id} style={{ borderTop: '1px solid rgba(43,184,232,0.05)' }}>
                  <td className="px-3 py-2 ">{p.name}</td>
                  <td className="px-3 py-2 font-mono" style={{ color: 'var(--primary)' }}>{p.code}</td>
                  <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{customers.find(c => c.id === p.customerId)?.name || '-'}</td>
                  <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{p.category}</td>
                  <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{p.weightPerCarton} {p.uom}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => handleEditProduct(p)} className="mr-2" style={{ color: 'var(--primary)' }}><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => safeDeleteProduct(p.id, p.name)} style={{ color: '#ef4444' }}><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}

          {activeTab === 'drivers' && (
            <DataTable headers={['Name', 'Code', 'Phone', 'License', 'License Expiry', 'Actions']}>
              {drivers.map(d => (
                <tr key={d.id} style={{ borderTop: '1px solid rgba(43,184,232,0.05)' }}>
                  <td className="px-3 py-2 ">{d.name}</td>
                  <td className="px-3 py-2 font-mono" style={{ color: 'var(--primary)' }}>{d.code}</td>
                  <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{d.phone}</td>
                  <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{d.licenseNo}</td>
                  <td className="px-3 py-2" style={{ color: new Date(d.licenseExpiry) <= new Date() ? '#ef4444' : '#7a9bb5' }}>{d.licenseExpiry}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => handleEditDriver(d)} className="mr-2" style={{ color: 'var(--primary)' }}><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => safeDeleteDriver(d.id, d.name)} style={{ color: '#ef4444' }}><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}

          {activeTab === 'vehicles' && (
            <DataTable headers={['Vehicle No', 'Type', 'Ownership', 'Status', 'Actions']}>
              {vehicles.map(v => (
                <tr key={v.id} style={{ borderTop: '1px solid rgba(43,184,232,0.05)' }}>
                  <td className="px-3 py-2 font-mono ">{v.vehicleNo}</td>
                  <td className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{vehicleTypeLabel(v.type)}</td>
                  <td className="px-3 py-2"><span className="px-2 py-0.5 rounded text-xs capitalize" style={{ background: v.ownership === 'own' ? 'rgba(74,222,128,0.15)' : 'rgba(234,179,8,0.15)', color: v.ownership === 'own' ? '#4ade80' : '#eab308' }}>{v.ownership}</span></td>
                  <td className="px-3 py-2"><span className="px-2 py-0.5 rounded text-xs" style={{ background: v.status === 'active' ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.15)', color: v.status === 'active' ? '#4ade80' : '#ef4444' }}>{v.status}</span></td>
                  <td className="px-3 py-2">
                    <button onClick={() => handleEditVehicle(v)} className="mr-2" style={{ color: 'var(--primary)' }}><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => safeDeleteVehicle(v.id, v.vehicleNo)} style={{ color: '#ef4444' }}><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </DataTable>
          )}

          {activeTab === 'rooms' && (
            <DataTable headers={['Room', 'Current Pallets', 'Temperature', 'Status']}>
              {rooms.map(r => (
                <tr key={r.id} style={{ borderTop: '1px solid rgba(43,184,232,0.05)' }}>
                  <td className="px-3 py-2 ">{r.name}</td>
                  <td className="px-3 py-2 font-bold">{r.currentPallets}</td>
                  <td className="px-3 py-2 font-mono font-bold" style={{ color: r.temperature <= -18 ? '#4ade80' : '#ef4444' }}>{Number(r.temperature).toFixed(1)}C</td>
                  <td className="px-3 py-2"><span className="px-2 py-0.5 rounded text-xs capitalize" style={{ background: r.status === 'normal' ? 'rgba(74,222,128,0.15)' : 'rgba(239,68,68,0.15)', color: r.status === 'normal' ? '#4ade80' : '#ef4444' }}>{r.status}</span></td>
                </tr>
              ))}
            </DataTable>
          )}
        </div>
      </div>
    </div>
  );
}

function DataTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: '#FAFAFA' }}>
            {headers.map(h => (
              <th key={h} className="px-3 py-3 text-left text-xs font-semibold uppercase" style={{ color: 'var(--text-secondary)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}


