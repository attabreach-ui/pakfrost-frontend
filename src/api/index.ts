/**
 * All API functions for PAKFROST WMS.
 * Each function maps to one backend endpoint.
 */
import client from './client';

// ── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  login:   (username: string, password: string) =>
    client.post('/auth/login', { username, password }) as Promise<any>,
  refresh: (refreshToken: string) =>
    client.post('/auth/refresh', { refreshToken }) as Promise<any>,
  logout:  () => client.post('/auth/logout') as Promise<any>,
  me:      () => client.get('/auth/me')      as Promise<any>,
};

// ── Users ───────────────────────────────────────────────────────────────────
export const usersApi = {
  getAll:    ()               => client.get('/users')            as Promise<any>,
  getById:   (id: string)     => client.get(`/users/${id}`)      as Promise<any>,
  create:    (data: any)      => client.post('/users', data)      as Promise<any>,
  update:    (id: string, data: any) => client.put(`/users/${id}`, data) as Promise<any>,
  remove:    (id: string)     => client.delete(`/users/${id}`)   as Promise<any>,
  changePassword: (id: string, data: any) =>
    client.put(`/users/${id}/password`, data)  as Promise<any>,
  resetPassword:  (id: string, newPassword: string) =>
    client.put(`/users/${id}/password/reset`, { newPassword }) as Promise<any>,
};

// ── Customers ───────────────────────────────────────────────────────────────
export const customersApi = {
  getAll:  (activeOnly = false) =>
    client.get(`/customers${activeOnly ? '?active=true' : ''}`) as Promise<any>,
  getById: (id: string)    => client.get(`/customers/${id}`)     as Promise<any>,
  create:  (data: any)     => client.post('/customers', data)     as Promise<any>,
  update:  (id: string, data: any) => client.put(`/customers/${id}`, data) as Promise<any>,
  remove:  (id: string)    => client.delete(`/customers/${id}`)  as Promise<any>,
};

// ── Products ────────────────────────────────────────────────────────────────
export const productsApi = {
  getAll:  (customerId?: string) =>
    client.get(`/products${customerId ? `?customerId=${customerId}` : ''}`) as Promise<any>,
  getById: (id: string)    => client.get(`/products/${id}`)      as Promise<any>,
  create:  (data: any)     => client.post('/products', data)      as Promise<any>,
  update:  (id: string, data: any) => client.put(`/products/${id}`, data) as Promise<any>,
  remove:  (id: string)    => client.delete(`/products/${id}`)   as Promise<any>,
};

// ── Drivers ─────────────────────────────────────────────────────────────────
export const driversApi = {
  getAll:  () => client.get('/drivers')          as Promise<any>,
  getById: (id: string) => client.get(`/drivers/${id}`) as Promise<any>,
  create:  (data: any)  => client.post('/drivers', data) as Promise<any>,
  update:  (id: string, data: any) => client.put(`/drivers/${id}`, data) as Promise<any>,
  remove:  (id: string) => client.delete(`/drivers/${id}`) as Promise<any>,
};

// ── Vehicles ────────────────────────────────────────────────────────────────
export const vehiclesApi = {
  getAll:  () => client.get('/vehicles')          as Promise<any>,
  getById: (id: string) => client.get(`/vehicles/${id}`) as Promise<any>,
  create:  (data: any)  => client.post('/vehicles', data) as Promise<any>,
  update:  (id: string, data: any) => client.put(`/vehicles/${id}`, data) as Promise<any>,
  remove:  (id: string) => client.delete(`/vehicles/${id}`) as Promise<any>,
};

// ── Stock operations ─────────────────────────────────────────────────────────
export const stockApi = {
  nextIGP:  () => client.get('/stock/next-igp')  as Promise<any>,
  nextOGP:  () => client.get('/stock/next-ogp')  as Promise<any>,
  stockIn:  (data: any) => client.post('/stock/in',   data) as Promise<any>,
  stockOut: (data: any) => client.post('/stock/out',  data) as Promise<any>,
  move:     (data: any) => client.post('/stock/move', data) as Promise<any>,
  editIGP:  (number: string, data: any) => client.put(`/stock/igp/${number}`, data) as Promise<any>,
  editOGP:  (number: string, data: any) => client.put(`/stock/ogp/${number}`, data) as Promise<any>,
};

// ── Pallets ─────────────────────────────────────────────────────────────────
export const palletsApi = {
  getAll:     (params?: any) => client.get('/pallets',          { params }) as Promise<any>,
  getFIFO:    (params?: any) => client.get('/pallets/fifo',     { params }) as Promise<any>,
  getExpiring:(days = 30)    => client.get(`/pallets/expiring?days=${days}`) as Promise<any>,
  getByLocation: (room: string, side: string, row: string, slot: string) =>
    client.get(`/pallets/location?room=${room}&side=${side}&row=${row}&slot=${slot}`) as Promise<any>,
  getById: (id: string) => client.get(`/pallets/${id}`) as Promise<any>,
};

// ── Movements ────────────────────────────────────────────────────────────────
export const movementsApi = {
  getAll:   (params?: any) => client.get('/movements',          { params }) as Promise<any>,
  getIGP:   (number: string) => client.get(`/movements/igp/${number}`) as Promise<any>,
  getOGP:   (number: string) => client.get(`/movements/ogp/${number}`) as Promise<any>,
};

// ── Temperature ──────────────────────────────────────────────────────────────
export const temperatureApi = {
  getAll:   (params?: any) => client.get('/temperature',         { params }) as Promise<any>,
  getLatest: ()            => client.get('/temperature/latest')  as Promise<any>,
  create:   (data: any)    => client.post('/temperature', data)  as Promise<any>,
};

// ── Reports ──────────────────────────────────────────────────────────────────
export const reportsApi = {
  stats:       ()             => client.get('/reports/stats')         as Promise<any>,
  chart:       ()             => client.get('/reports/chart')         as Promise<any>,
  stockLedger: (params?: any) => client.get('/reports/stock-ledger',  { params }) as Promise<any>,
  docExpiry:   ()             => client.get('/reports/document-expiry') as Promise<any>,
};
