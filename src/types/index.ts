export type PageView =
  | 'login' | 'dashboard' | 'stock-in' | 'stock-out'
  | 'location-map' | 'pallet-tags' | 'temperature'
  | 'expiry-alerts' | 'reports' | 'master-data'
  | 'history' | 'user-access';

export interface UserPermissions {
  dashboard: boolean;
  stockIn: boolean;
  stockOut: boolean;
  locationMap: boolean;
  palletTags: boolean;
  temperature: boolean;
  expiryAlerts: boolean;
  reports: boolean;
  masterData: boolean;
  history: boolean;
  userAccess: boolean;
}

export type UserRole = 'admin' | 'supervisor' | 'operator' | 'viewer';

export const ROLE_DEFAULTS: Record<UserRole, UserPermissions> = {
  admin:      { dashboard:true,  stockIn:true,  stockOut:true,  locationMap:true,  palletTags:true,  temperature:true,  expiryAlerts:true,  reports:true,  masterData:true,  history:true,  userAccess:true  },
  supervisor: { dashboard:true,  stockIn:true,  stockOut:true,  locationMap:true,  palletTags:true,  temperature:true,  expiryAlerts:true,  reports:true,  masterData:false, history:true,  userAccess:false },
  operator:   { dashboard:true,  stockIn:true,  stockOut:true,  locationMap:true,  palletTags:true,  temperature:true,  expiryAlerts:false, reports:false, masterData:false, history:true,  userAccess:false },
  viewer:     { dashboard:true,  stockIn:false, stockOut:false, locationMap:true,  palletTags:false, temperature:true,  expiryAlerts:true,  reports:true,  masterData:false, history:true,  userAccess:false },
};

export interface User {
  id: string;
  username: string;
  /** Only present while creating/updating a user. Login responses never include it. */
  password?: string;
  name: string;
  role: UserRole;
  avatar: string | null;
  isActive: boolean;
  customPermissions?: Partial<UserPermissions>;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  code: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  tempRequirement?: string;
  contractExpiry?: string;
  isActive: boolean;
}

export interface Driver {
  id: string;
  name: string;
  code: string;
  cnic: string;
  phone: string;
  licenseNo: string;
  licenseExpiry: string;
  joiningDate?: string;
  status: 'active' | 'inactive';
}

export interface Vehicle {
  id: string;
  vehicleNo: string;
  type: 'Reefer_Truck' | 'Container' | 'Pickup' | 'Van' | 'Other';
  ownership: 'own' | 'external';
  routePermitExpiry?: string;
  tokenExpiry?: string;
  fitnessExpiry?: string;
  insuranceExpiry?: string;
  status: 'active' | 'inactive';
}

export interface Product {
  id: string;
  name: string;
  code: string;
  customerId: string;
  category: string;
  cartonsPerPallet: number;
  weightPerCarton: number;
  uom: 'Kg' | 'Lbs';
}

export type PalletStatus = 'active' | 'dispatched' | 'expired' | 'damaged' | 'voided';
export type MovementStatus = 'active' | 'voided';
export type DocLifecycleStatus = 'active' | 'voided' | 'not_found' | 'partial';

export interface DocStatusInfo {
  status: DocLifecycleStatus;
  canVoid: boolean;
  canRestore: boolean;
  blockReason?: string | null;
  voidedAt?: string;
  voidedBy?: string;
  voidReason?: string;
}

export type PackingType = 'Carton' | 'Bag' | 'Crate' | 'Box' | 'Drum';

export interface Pallet {
  id: string;
  igpNumber: string;
  vehicleNo: string;
  driverId?: string;
  driverName: string;
  sealNumber?: string;
  productId: string;
  productName: string;
  productCode: string;
  customerId: string;
  customerName: string;
  cartons: number;
  weightPerCarton: number;
  totalWeight: number;
  mfgDate?: string;
  expiryDate: string;
  batchNo?: string;
  lotNo?: string;
  dateIn: string;
  room: string;
  side: 'L' | 'R';
  row: string;
  slot: string;
  position?: number;
  status: 'active' | 'dispatched' | 'expired' | 'damaged' | 'voided';
  condition: 'Good' | 'Damaged' | 'Partial';
  temperatureAtReceipt: number;
  productTemperature?: string;
  notes: string;
  packingType?: PackingType;
  orderRef?: string;
  departureTime?: string;
  timeIn?: string;        // Actual arrival time recorded on IGP
  revised?: boolean;
  revisedAt?: string;
}

export interface StockMovement {
  id: string;
  docNumber: string;
  type: 'IN' | 'OUT' | 'MOVE';
  status?: MovementStatus;
  palletId: string;
  customerId: string;
  customerName: string;
  productName: string;
  productCode: string;
  cartons: number;
  totalWeight: number;
  location: string;
  date: string;
  reason?: string;
  vehicleNo?: string;
  driverId?: string;
  driverName?: string;
  destination?: string;
  notes?: string;
  packingType?: string;
  operatorName?: string;
  orderRef?: string;
  vehicleTemp?: string;   // OGP: vehicle temperature at time of dispatch
  condition?: string;     // OGP: stock condition at dispatch
  revised?: boolean;
  revisedAt?: string;
  voidedAt?: string;
  voidedBy?: string;
  voidReason?: string;
}

export interface TemperatureReading {
  id: string;
  room: string;
  temperature: number;
  recordedAt: string;
  time?: string;
  recordedBy: string;
  notes: string;
}

export interface Room {
  id: string;
  name: string;
  maxPallets: number;
  currentPallets: number;
  temperature: number;
  status: 'normal' | 'warning' | 'critical';
  dedicatedCustomer?: string;
  isAnteRoom?: boolean;
}

/** Returns a human-readable location string. */
export function formatLocation(
  room: string, side: string, row: string, slot: string, position?: number
): string {
  if (room === 'Ante Room') return 'Ante Room (Floor)';
  const pos = position ? `-P${position}` : '';
  return `${room} ${side}${row}-${slot}${pos}`;
}

export interface DocCounters {
  igpYear: number;
  igpSeq: number;
  ogpYear: number;
  ogpSeq: number;
  igpInitialized: boolean;
  ogpInitialized: boolean;
}

export function getUserPermissions(user: User): UserPermissions {
  const defaults = ROLE_DEFAULTS[user.role];
  if (!user.customPermissions) return defaults;
  return { ...defaults, ...user.customPermissions };
}

/**
 * Format IGP number with year prefix: e.g. "IGP-2026-0001"
 * FIX M5: year parameter is now actually used.
 */
export function formatIGP(seq: number, _year?: number): string {
  // _year kept for API compatibility but no longer shown in document number
  return `IGP-${String(seq).padStart(4, '0')}`;
}

/**
 * Format OGP number with year prefix: e.g. "OGP-2026-0001"
 * FIX M5: year parameter is now actually used.
 */
export function formatOGP(seq: number, _year?: number): string {
  // _year kept for API compatibility but no longer shown in document number
  return `OGP-${String(seq).padStart(4, '0')}`;
}
