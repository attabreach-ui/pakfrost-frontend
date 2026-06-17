/**
 * useStore — Phase 5: API-backed store
 */
import { useState, useCallback, useEffect, useMemo } from 'react';
import type {
  User, Customer, Driver, Vehicle, Product, Pallet,
  StockMovement, TemperatureReading, Room, UserPermissions
} from '@/types';
import { ROLE_DEFAULTS } from '@/types';
import {
  usersApi, customersApi, productsApi, driversApi, vehiclesApi,
  stockApi, palletsApi, movementsApi, temperatureApi,
} from '@/api';
import { subscribeRealtime, unsubscribeRealtime } from '@/lib/supabaseRealtime';

const DEFAULT_ROOMS: Room[] = [
  { id:'r1', name:'Room 1',    maxPallets:384, currentPallets:0, temperature:-20, status:'normal' },
  { id:'r2', name:'Room 2',    maxPallets:384, currentPallets:0, temperature:-20, status:'normal' },
  { id:'r3', name:'Room 3',    maxPallets:384, currentPallets:0, temperature:-20, status:'normal' },
  { id:'r4', name:'Room 4',    maxPallets:384, currentPallets:0, temperature:-20, status:'normal' },
  { id:'ar', name:'Ante Room', maxPallets:30,  currentPallets:0, temperature:0,   status:'normal', isAnteRoom:true },
];

export function useStore(isLoggedIn = false) {
  const [users,        setUsers]        = useState<User[]>([]);
  const [customers,    setCustomers]    = useState<Customer[]>([]);
  const [drivers,      setDrivers]      = useState<Driver[]>([]);
  const [vehicles,     setVehicles]     = useState<Vehicle[]>([]);
  const [products,     setProducts]     = useState<Product[]>([]);
  const [pallets,      setPallets]      = useState<Pallet[]>([]);
  const [movements,    setMovements]    = useState<StockMovement[]>([]);
  const [temperatures, setTemperatures] = useState<TemperatureReading[]>([]);
  const [rooms]                         = useState<Room[]>(DEFAULT_ROOMS);
  const [nextIGPNum,   setNextIGPNum]   = useState('IGP-0001');
  const [nextOGPNum,   setNextOGPNum]   = useState('OGP-0001');
  const [isLoading,    setIsLoading]    = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSync,     setLastSync]     = useState<Date | null>(null);

  const loadAll = useCallback(async (initial = false) => {
    if (initial) setIsLoading(true);
    else setIsRefreshing(true);
    try {
      const [u, cu, p, d, v, pal, mov, tmp, igp, ogp] = await Promise.all([
        usersApi.getAll(),
        customersApi.getAll(),
        productsApi.getAll(),
        driversApi.getAll(),
        vehiclesApi.getAll(),
        palletsApi.getAll(),
        movementsApi.getAll({ limit: 500 }),
        temperatureApi.getAll({ limit: 100 }),
        stockApi.nextIGP(),
        stockApi.nextOGP(),
      ]);
      setUsers(        (u   as any).data ?? []);
      setCustomers(    (cu  as any).data ?? []);
      setProducts(     (p   as any).data ?? []);
      setDrivers(      (d   as any).data ?? []);
      setVehicles(     (v   as any).data ?? []);
      setPallets(      (pal as any).data ?? []);
      setMovements(    (mov as any).data?.data ?? (mov as any).data ?? []);
      setTemperatures( (tmp as any).data ?? []);
      setNextIGPNum(   (igp as any).data?.number ?? 'IGP-0001');
      setNextOGPNum(   (ogp as any).data?.number ?? 'OGP-0001');
      setLastSync(new Date());
    } catch (err) {
      console.error('Failed to load store data:', err);
    } finally {
      if (initial) setIsLoading(false);
      else setIsRefreshing(false);
    }
  }, []);

  // ── Refresh helpers — BEFORE useEffect ───────────────────────────────────
  const refreshPallets = useCallback(async () => {
    const res: any = await palletsApi.getAll();
    setPallets(res.data ?? []);
  }, []);

  const refreshMovements = useCallback(async () => {
    const res: any = await movementsApi.getAll({ limit: 500 });
    setMovements(res.data?.data ?? res.data ?? []);
  }, []);

  const refreshCounters = useCallback(async () => {
    const [igp, ogp]: any[] = await Promise.all([stockApi.nextIGP(), stockApi.nextOGP()]);
    setNextIGPNum(igp.data?.number ?? 'IGP-0001');
    setNextOGPNum(ogp.data?.number ?? 'OGP-0001');
  }, []);

  const pollVolatile = useCallback(async () => {
    if (document.visibilityState === 'hidden') return;
    try {
      const [pal, mov, tmp] = await Promise.all([
        palletsApi.getAll(),
        movementsApi.getAll({ limit: 500 }),
        temperatureApi.getAll({ limit: 100 }),
      ]);
      setPallets(      (pal as any).data ?? []);
      setMovements(    (mov as any).data?.data ?? (mov as any).data ?? []);
      setTemperatures( (tmp as any).data ?? []);
      setLastSync(new Date());
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) { setIsLoading(false); return; }
    loadAll(true);

    const channel = subscribeRealtime({
      onPalletsChange:     () => refreshPallets(),
      onMovementsChange:   () => refreshMovements(),
      onTemperatureChange: () => {
        temperatureApi.getAll({ limit: 100 })
          .then((r: any) => setTemperatures(r.data ?? []))
          .catch(() => {});
      },
    });

    const interval = !channel
      ? setInterval(() => {
          if (document.visibilityState === 'hidden') return;
          Promise.all([refreshPallets(), refreshMovements()]).catch(() => {});
        }, 15_000)
      : null;

    const onVisible = () => {
      if (document.visibilityState === 'visible')
        Promise.all([refreshPallets(), refreshMovements()]).catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      unsubscribeRealtime();
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isLoggedIn, loadAll, refreshPallets, refreshMovements]);

  const manualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await pollVolatile();
    setIsRefreshing(false);
  }, [pollVolatile]);

  const peekNextIGP      = useCallback(() => nextIGPNum, [nextIGPNum]);
  const peekNextOGP      = useCallback(() => nextOGPNum, [nextOGPNum]);
  const nextIGP          = useCallback(async () => nextIGPNum, [nextIGPNum]);
  const nextOGP          = useCallback(async () => nextOGPNum, [nextOGPNum]);
  const initializeCounters = useCallback(async () => { await refreshCounters(); }, [refreshCounters]);

  const addUser = useCallback(async (data: Omit<User,'id'|'createdAt'>) => {
    const res: any = await usersApi.create({ ...data, password: (data as any).password });
    setUsers(prev => [...prev, res.data]); return res.data;
  }, []);
  const updateUser = useCallback(async (id: string, updates: Partial<Omit<User,'id'>>) => {
    const res: any = await usersApi.update(id, updates);
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...res.data } : u));
  }, []);
  const deleteUser = useCallback(async (id: string) => {
    await usersApi.remove(id); setUsers(prev => prev.filter(u => u.id !== id));
  }, []);
  const updateUserPermissions = useCallback(async (id: string, permissions: Partial<UserPermissions>) => {
    await usersApi.update(id, { customPermissions: permissions });
    setUsers(prev => prev.map(u => u.id === id ? { ...u, customPermissions: permissions } : u));
  }, []);

  const addCustomer = useCallback(async (data: any) => {
    const res: any = await customersApi.create(data);
    setCustomers(prev => [...prev, res.data]); return res.data;
  }, []);
  const updateCustomer = useCallback(async (id: string, data: any) => {
    const res: any = await customersApi.update(id, data);
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...res.data } : c));
  }, []);
  const deleteCustomer = useCallback(async (id: string) => {
    await customersApi.remove(id); setCustomers(prev => prev.filter(c => c.id !== id));
  }, []);

  const addDriver = useCallback(async (data: any) => {
    const res: any = await driversApi.create(data);
    setDrivers(prev => [...prev, res.data]); return res.data;
  }, []);
  const updateDriver = useCallback(async (id: string, data: any) => {
    const res: any = await driversApi.update(id, data);
    setDrivers(prev => prev.map(d => d.id === id ? { ...d, ...res.data } : d));
  }, []);
  const deleteDriver = useCallback(async (id: string) => {
    await driversApi.remove(id); setDrivers(prev => prev.filter(d => d.id !== id));
  }, []);

  const addVehicle = useCallback(async (data: any) => {
    const res: any = await vehiclesApi.create(data);
    setVehicles(prev => [...prev, res.data]); return res.data;
  }, []);
  const updateVehicle = useCallback(async (id: string, data: any) => {
    const res: any = await vehiclesApi.update(id, data);
    setVehicles(prev => prev.map(v => v.id === id ? { ...v, ...res.data } : v));
  }, []);
  const deleteVehicle = useCallback(async (id: string) => {
    await vehiclesApi.remove(id); setVehicles(prev => prev.filter(v => v.id !== id));
  }, []);

  const addProduct = useCallback(async (data: any) => {
    const res: any = await productsApi.create(data);
    setProducts(prev => [...prev, res.data]); return res.data;
  }, []);
  const updateProduct = useCallback(async (id: string, data: any) => {
    const res: any = await productsApi.update(id, data);
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...res.data } : p));
  }, []);
  const deleteProduct = useCallback(async (id: string) => {
    await productsApi.remove(id); setProducts(prev => prev.filter(p => p.id !== id));
  }, []);

  const stockIn = useCallback(async (_igpNumber: string, header: any, items: any[]) => {
    const res: any = await stockApi.stockIn({ header, items });
    await Promise.all([refreshPallets(), refreshMovements(), refreshCounters()]);
    return res.data?.pallets ?? [];
  }, [refreshPallets, refreshMovements, refreshCounters]);

  const stockOut = useCallback(async (_ogpNumber: string, palletId: string, cartonsOut: number, header: any) => {
    await stockApi.stockOut({ header, items: [{ palletId, cartonsOut }] });
    await Promise.all([refreshPallets(), refreshMovements(), refreshCounters()]);
  }, [refreshPallets, refreshMovements, refreshCounters]);

  const movePallet = useCallback(async (
    palletId: string, newRoom: string, newSide: 'L'|'R',
    newRow: string, newSlot: string, newPosition: number|undefined, movedBy: string,
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      await stockApi.move({ palletId, newRoom, newSide, newRow, newSlot, newPosition, movedBy });
      await refreshPallets();
      return { ok: true };
    } catch (err: any) { return { ok: false, error: err.message }; }
  }, [refreshPallets]);

  const editIGP = useCallback(async (igpNumber: string, header: any, items: any[]) => {
    await stockApi.editIGP(igpNumber, { header, items });
    await Promise.all([refreshPallets(), refreshMovements()]);
  }, [refreshPallets, refreshMovements]);

  const editOGP = useCallback(async (ogpNumber: string, header: any, lines?: any[]) => {
    await stockApi.editOGP(ogpNumber, { header, lines });
    await Promise.all([refreshPallets(), refreshMovements()]);
  }, [refreshPallets, refreshMovements]);

  const addTemperature = useCallback(async (data: Omit<TemperatureReading,'id'>) => {
    const res: any = await temperatureApi.create(data);
    setTemperatures(prev => [res.data, ...prev]);
  }, []);

  const computedRooms = useMemo(() =>
    rooms.map(r => {
      const live = pallets.filter(p => p.status === 'active' && p.room === r.name).length;
      const pct  = r.maxPallets > 0 ? live / r.maxPallets : 0;
      const status: Room['status'] = pct >= 0.95 ? 'critical' : pct >= 0.80 ? 'warning' : 'normal';
      return { ...r, currentPallets: live, status };
    }),
  [rooms, pallets]);

  const getFIFOPallets = useCallback((customerId?: string, productId?: string) =>
    pallets
      .filter(p => p.status === 'active'
        && (!customerId || p.customerId === customerId)
        && (!productId  || p.productId  === productId))
      .sort((a,b) => new Date(a.dateIn).getTime() - new Date(b.dateIn).getTime()),
  [pallets]);

  const getPalletsByLocation = useCallback((room: string, side: 'L'|'R', row: string, slot: string) =>
    pallets.filter(p => p.status === 'active' && p.room === room && p.side === side && p.row === row && p.slot === slot),
  [pallets]);

  const getStats = useCallback(() => {
    const active = pallets.filter(p => p.status === 'active');
    const now = new Date();
    const d7  = new Date(now); d7.setDate(d7.getDate() + 7);
    const d30 = new Date(now); d30.setDate(d30.getDate() + 30);
    const today = now.toDateString();
    const docExpiries: { label: string; type: string; expiry: string }[] = [];
    vehicles.forEach(v => {
      [
        { field: v.routePermitExpiry, label: `${v.vehicleNo} Route Permit` },
        { field: v.tokenExpiry,       label: `${v.vehicleNo} Token` },
        { field: v.fitnessExpiry,     label: `${v.vehicleNo} Fitness` },
        { field: v.insuranceExpiry,   label: `${v.vehicleNo} Insurance` },
      ].forEach(({ field, label }) => {
        if (field && new Date(field) <= d30) docExpiries.push({ label, type:'vehicle', expiry: field });
      });
    });
    drivers.forEach(d => {
      if (d.licenseExpiry && new Date(d.licenseExpiry) <= d30)
        docExpiries.push({ label:`${d.name} License`, type:'driver', expiry: d.licenseExpiry });
    });
    return {
      totalPallets:   active.length,
      totalCartons:   active.reduce((s,p) => s + (p.cartons||0), 0),
      totalWeight:    active.reduce((s,p) => s + (Number(p.totalWeight)||0), 0),
      expired:        active.filter(p => new Date(p.expiryDate) <= now).length,
      expiring7Days:  active.filter(p => { const e=new Date(p.expiryDate); return e>now&&e<=d7; }).length,
      expiring30Days: active.filter(p => { const e=new Date(p.expiryDate); return e>now&&e<=d30; }).length,
      stockInToday:   movements.filter(m => m.type==='IN'  && new Date((m as any).createdAt||(m as any).date||'').toDateString()===today).reduce((s,m) => s+Number(m.cartons), 0),
      stockOutToday:  movements.filter(m => m.type==='OUT' && new Date((m as any).createdAt||(m as any).date||'').toDateString()===today).reduce((s,m) => s+Number(m.cartons), 0),
      docAlerts:      docExpiries.sort((a,b) => new Date(a.expiry).getTime()-new Date(b.expiry).getTime()),
    };
  }, [pallets, movements, vehicles, drivers]);

  const resetAllData = useCallback(async () => {
    setPallets([]); setMovements([]); setTemperatures([]);
  }, []);
  const updatePallet = useCallback((id: string, updates: Partial<Pallet>) => {
    setPallets(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);
  const updateRoom = useCallback((_id: string, _updates: any) => {}, []);

  return {
    isLoading, isRefreshing, lastSync, manualRefresh,
    users, customers, drivers, vehicles, products,
    pallets, movements, temperatures,
    rooms: computedRooms,
    counters: { igpSeq: 0, ogpSeq: 0, igpInitialized: true, ogpInitialized: true },
    peekNextIGP, peekNextOGP, nextIGP, nextOGP,
    initializeCounters,
    addUser, updateUser, deleteUser, updateUserPermissions,
    addCustomer,  updateCustomer,  deleteCustomer,
    addDriver,    updateDriver,    deleteDriver,
    addVehicle,   updateVehicle,   deleteVehicle,
    addProduct,   updateProduct,   deleteProduct,
    updateRoom, updatePallet,
    stockIn, stockOut, movePallet, editIGP, editOGP,
    addTemperature,
    getStats, getFIFOPallets, getPalletsByLocation,
    resetAllData,
    ROLE_DEFAULTS,
  };
}
