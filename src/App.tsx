import { useState, useCallback } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { useStore } from '@/store/useStore';
import Layout from '@/components/Layout';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import StockInPage from '@/pages/StockInPage';
import StockOutPage from '@/pages/StockOutPage';
import LocationMapPage from '@/pages/LocationMapPage';
import PalletTagsPage from '@/pages/PalletTagsPage';
import TemperaturePage from '@/pages/TemperaturePage';
import ExpiryAlertsPage from '@/pages/ExpiryAlertsPage';
import ReportsPage from '@/pages/ReportsPage';
import MasterDataPage from '@/pages/MasterDataPage';
import HistoryPage from '@/pages/HistoryPage';
import UserAccessPage from '@/pages/UserAccessPage';
import type { PageView } from '@/types';
import { getUserPermissions } from '@/types';

function AppContent() {
  const { currentUser, updateCurrentUser, isLoading: authLoading } = useAuth();
  const [currentPage, setCurrentPage] = useState<PageView>('dashboard');
  const [, setKey] = useState(0);
  const refresh = useCallback(() => setKey(k => k + 1), []);

  const store = useStore(!!currentUser);

  // Wrap updateUser so AuthContext stays in sync when current user is edited
  const handleUpdateUser = useCallback((id: string, updates: Partial<any>) => {
    store.updateUser(id, updates);
    if (currentUser?.id === id) {
      updateCurrentUser(updates);
    }
  }, [store, currentUser, updateCurrentUser]);

  // ✅ handleBackup — Professional styled Excel with colors
  const handleBackup = useCallback(async () => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      const today = new Date();
      const dateStr = today.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });

      // ── Colour palette ────────────────────────────────────────
      const COL = {
        navy:    '0C3547',  // title bg
        navyMid: '1A5276',  // subtitle bg
        blue:    '2471A3',  // header row bg
        blueLt:  'AED6F1',  // border colour
        rowAlt:  'EBF5FB',  // even data row
        white:   'FFFFFF',
        labelBg: 'D6EAF8',
        dark:    '1B2631',
      };

      // ── Cell builder helpers ──────────────────────────────────
      const cell = (v: any, t: 's'|'n'|'b', fill: string, fontColor = COL.white, bold = false, sz = 10): any => ({
        v, t, s: {
          fill: { patternType: 'solid', fgColor: { rgb: fill } },
          font: { bold, color: { rgb: fontColor }, sz, name: 'Calibri' },
          alignment: { horizontal: 'left', vertical: 'center', wrapText: false },
          border: {
            top:    { style: 'thin', color: { rgb: COL.blueLt } },
            bottom: { style: 'thin', color: { rgb: COL.blueLt } },
            left:   { style: 'thin', color: { rgb: COL.blueLt } },
            right:  { style: 'thin', color: { rgb: COL.blueLt } },
          }
        }
      });

      const titleCell  = (v: string) => cell(v, 's', COL.navy,    COL.white, true,  14);
      const subCell    = (v: string) => cell(v, 's', COL.navyMid, COL.white, false, 10);
      const hdrCell    = (v: string) => cell(v, 's', COL.blue,    COL.white, true,  10);
      const dataCell   = (v: any, even: boolean) => {
        const t = typeof v === 'number' ? 'n' : 's';
        return cell(v ?? '', t, even ? COL.rowAlt : COL.white, COL.dark, false, 10);
      };
      const summLabel  = (v: string) => cell(v, 's', COL.navyMid, COL.white, true,  10);
      const summValue  = (v: any)    => cell(v ?? '', typeof v === 'number' ? 'n' : 's', COL.labelBg, COL.dark, true, 10);

      // ── Build sheet helper ────────────────────────────────────
      const buildSheet = (title: string, headers: string[], dataRows: any[][], colWidths: number[]) => {
        const ws: any = {};
        const nCols = headers.length;

        // Row 1: Title (merged)
        ws['A1'] = titleCell(`PAKFROST (PVT) LIMITED — ${title}`);
        for (let c2 = 1; c2 < nCols; c2++) {
          ws[XLSX.utils.encode_cell({ r: 0, c: c2 })] = cell('', 's', COL.navy);
        }

        // Row 2: Subtitle
        ws['A2'] = subCell(`Generated: ${dateStr}   |   Cold Storage WMS`);
        for (let c2 = 1; c2 < nCols; c2++) {
          ws[XLSX.utils.encode_cell({ r: 1, c: c2 })] = cell('', 's', COL.navyMid);
        }

        // Row 3: blank spacer
        ws['A3'] = cell('', 's', COL.white, COL.dark);

        // Row 4: Headers
        headers.forEach((h, ci) => {
          ws[XLSX.utils.encode_cell({ r: 3, c: ci })] = hdrCell(h);
        });

        // Data rows
        dataRows.forEach((row, ri) => {
          const even = ri % 2 === 0;
          row.forEach((val, ci) => {
            ws[XLSX.utils.encode_cell({ r: 4 + ri, c: ci })] = dataCell(val, even);
          });
        });

        // Sheet range
        ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 3 + dataRows.length, c: nCols - 1 } });

        // Merges: title + subtitle across all columns
        ws['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: nCols - 1 } },
          { s: { r: 1, c: 0 }, e: { r: 1, c: nCols - 1 } },
        ];

        // Column widths
        ws['!cols'] = colWidths.map(w => ({ wch: w }));

        // Freeze header
        ws['!freeze'] = { xSplit: 0, ySplit: 4 };

        return ws;
      };

      // ── 1. Active Inventory ───────────────────────────────────
      const invHeaders = ['IGP No', 'Customer', 'Product', 'Code', 'Qty', 'Weight', 'Total Wt (Kg)', 'Pack Type', 'Room', 'Location', 'Mfg Date', 'Expiry Date', 'Date In'];
      const invData = store.pallets.filter(p => p.status === 'active').map(p => [
        p.igpNumber, p.customerName, p.productName, p.productCode,
        p.cartons, p.weightPerCarton, p.totalWeight, p.packingType || 'Carton',
        p.room, p.room === 'Ante Room' ? 'Floor' : `${p.side}${p.row}-${p.slot}`,
        p.mfgDate || '', p.expiryDate,
        new Date(p.dateIn).toLocaleDateString('en-PK'),
      ]);
      XLSX.utils.book_append_sheet(wb, buildSheet('Active Inventory', invHeaders, invData, [10, 16, 22, 10, 6, 8, 13, 10, 10, 12, 12, 13, 13]), 'Active Inventory');

      // ── 2. Stock IN History ───────────────────────────────────
      const inMoves = store.movements.filter(m => m.type === 'IN');
      const inHeaders = ['IGP No', 'Date', 'Customer', 'Product', 'Qty', 'Total Wt (Kg)', 'Vehicle', 'Driver', 'Operator'];
      const inData = inMoves.map(m => [
        m.docNumber, new Date(m.createdAt||m.date||"").toLocaleDateString('en-PK'),
        m.customerName, m.productName, m.cartons, m.totalWeight,
        m.vehicleNo || '', m.driverName || '', m.operatorName || '',
      ]);
      XLSX.utils.book_append_sheet(wb, buildSheet('Stock IN History', inHeaders, inData, [10, 12, 16, 22, 8, 13, 14, 16, 14]), 'Stock IN History');

      // ── 3. Stock OUT History ──────────────────────────────────
      const outMoves = store.movements.filter(m => m.type === 'OUT');
      const outHeaders = ['OGP No', 'Date', 'Customer', 'Product', 'Qty', 'Total Wt (Kg)', 'Vehicle', 'Driver', 'Destination', 'Operator'];
      const outData = outMoves.map(m => [
        m.docNumber, new Date(m.createdAt||m.date||"").toLocaleDateString('en-PK'),
        m.customerName, m.productName, m.cartons, m.totalWeight,
        m.vehicleNo || '', m.driverName || '', m.destination || '', m.operatorName || '',
      ]);
      XLSX.utils.book_append_sheet(wb, buildSheet('Stock OUT History', outHeaders, outData, [10, 12, 16, 22, 8, 13, 14, 16, 18, 14]), 'Stock OUT History');

      // ── 4. Customers ──────────────────────────────────────────
      const custHeaders = ['Code', 'Name', 'Contact Person', 'Phone', 'Email', 'Temp Req.', 'Contract Expiry', 'Status'];
      const custData = store.customers.map(cu => [
        cu.code, cu.name, cu.contactPerson || '', cu.phone || '', cu.email || '',
        cu.tempRequirement || '', cu.contractExpiry || '', cu.isActive ? 'Active' : 'Inactive',
      ]);
      XLSX.utils.book_append_sheet(wb, buildSheet('Customers', custHeaders, custData, [10, 20, 18, 14, 22, 12, 15, 10]), 'Customers');

      // ── 5. Products ───────────────────────────────────────────
      const prodHeaders = ['Code', 'Name', 'Category', 'Customer', 'Ctns/Pallet', 'Weight', 'UOM'];
      const prodData = store.products.map(p => {
        const cu = store.customers.find(c => c.id === p.customerId);
        return [p.code, p.name, p.category, cu?.name || '', p.cartonsPerPallet, p.weightPerCarton, p.uom];
      });
      XLSX.utils.book_append_sheet(wb, buildSheet('Products', prodHeaders, prodData, [12, 24, 14, 18, 12, 10, 8]), 'Products');

      // ── 6. Drivers ────────────────────────────────────────────
      const drvHeaders = ['Code', 'Name', 'CNIC', 'Phone', 'License No', 'License Expiry', 'Status'];
      const drvData = store.drivers.map(d => [d.code, d.name, d.cnic, d.phone, d.licenseNo, d.licenseExpiry, d.status]);
      XLSX.utils.book_append_sheet(wb, buildSheet('Drivers', drvHeaders, drvData, [10, 20, 16, 14, 16, 15, 10]), 'Drivers');

      // ── 7. Vehicles ───────────────────────────────────────────
      const vehHeaders = ['Vehicle No', 'Type', 'Ownership', 'Route Permit Expiry', 'Token Expiry', 'Fitness Expiry', 'Insurance Expiry', 'Status'];
      const vehData = store.vehicles.map(v => [
        v.vehicleNo, v.type, v.ownership,
        v.routePermitExpiry || '', v.tokenExpiry || '',
        v.fitnessExpiry || '', v.insuranceExpiry || '', v.status,
      ]);
      XLSX.utils.book_append_sheet(wb, buildSheet('Vehicles', vehHeaders, vehData, [14, 14, 12, 20, 14, 14, 17, 10]), 'Vehicles');

      // ── 8. Temperature Log ────────────────────────────────────
      const tempHeaders = ['Date / Time', 'Room', 'Temperature (°C)', 'Recorded By', 'Notes'];
      const tempData = store.temperatures.map(t => [
        new Date(t.recordedAt||t.time||"").toLocaleString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        t.room, t.temperature, t.recordedBy, t.notes || '',
      ]);
      XLSX.utils.book_append_sheet(wb, buildSheet('Temperature Log', tempHeaders, tempData, [22, 12, 18, 18, 24]), 'Temperature Log');

      // ── 9. Summary ────────────────────────────────────────────
      const activePallets = store.pallets.filter(p => p.status === 'active');
      const totalWt = activePallets.reduce((s, p) => s + Number(p.totalWeight), 0);
      const wsSummary: any = {};

      // Title
      wsSummary['A1'] = titleCell('PAKFROST (PVT) LIMITED — Summary Report');
      wsSummary['B1'] = cell('', 's', COL.navy);
      wsSummary['C1'] = cell('', 's', COL.navy);
      wsSummary['A2'] = subCell(`Generated: ${dateStr}`);
      wsSummary['B2'] = cell('', 's', COL.navyMid);
      wsSummary['C2'] = cell('', 's', COL.navyMid);
      wsSummary['A3'] = cell('', 's', COL.white, COL.dark);

      // KPI rows
      const kpiRows = [
        ['Total Active Pallets',          activePallets.length],
        ['Total Weight in Storage (Kg)',  parseFloat(Number(totalWt).toFixed(0))],
        ['Total Customers (Active)',       store.customers.filter(c => c.isActive).length],
        ['Total Products',                 store.products.length],
        ['Total Stock Movements',          store.movements.length],
        ['Last Backup',                    dateStr],
      ];
      kpiRows.forEach((row, ri) => {
        wsSummary[XLSX.utils.encode_cell({ r: 3 + ri, c: 0 })] = summLabel(String(row[0]));
        wsSummary[XLSX.utils.encode_cell({ r: 3 + ri, c: 1 })] = summValue(row[1]);
        wsSummary[XLSX.utils.encode_cell({ r: 3 + ri, c: 2 })] = cell('', 's', COL.white, COL.dark);
      });

      // Spacer
      const summSpacerR = 3 + kpiRows.length;
      wsSummary[XLSX.utils.encode_cell({ r: summSpacerR, c: 0 })] = cell('', 's', COL.white, COL.dark);

      // Customer table
      const custTblStart = summSpacerR + 1;
      ['Customer', 'Active Pallets', 'Total Qty', 'Total Kg'].forEach((h, ci) => {
        wsSummary[XLSX.utils.encode_cell({ r: custTblStart, c: ci })] = hdrCell(h);
      });
      store.customers.filter(cu => cu.isActive).forEach((cu, ri) => {
        const cp = activePallets.filter(p => p.customerId === cu.id);
        const rowData = [cu.name, cp.length, cp.reduce((s, p) => s + Number(p.cartons), 0), parseFloat(cp.reduce((s, p) => s + Number(p.totalWeight), 0).toFixed(0))];
        rowData.forEach((v, ci) => {
          wsSummary[XLSX.utils.encode_cell({ r: custTblStart + 1 + ri, c: ci })] = dataCell(v, ri % 2 === 0);
        });
      });

      const summLastR = custTblStart + 1 + store.customers.filter(cu => cu.isActive).length;
      wsSummary['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: summLastR, c: 3 } });
      wsSummary['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
      ];
      wsSummary['!cols'] = [{ wch: 32 }, { wch: 16 }, { wch: 14 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

      XLSX.writeFile(wb, `PAKFROST_WMS_Backup_${new Date().toISOString().slice(0, 10)}.xlsx`, { cellStyles: true });
    } catch (err) {
      console.error('Backup error:', err);
      alert('Backup failed. Please try again.');
    }
  }, [store]);

  // Show loading screen while auth is checking saved session
  if (authLoading || store.isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4"
        style={{ background: 'var(--bg-page)' }}>
        <div style={{ width: 48, height: 48, border: '3px solid #E2E8F0',
          borderTopColor: '#0284C7', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading PAKFROST WMS...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage onLogin={refresh} />;
  }

  const perms = getUserPermissions(currentUser);

  const navigate = (page: PageView) => {
    // Check permission before navigating
    const permMap: Partial<Record<PageView, keyof typeof perms>> = {
      'stock-in':      'stockIn',
      'stock-out':     'stockOut',
      'location-map':  'locationMap',
      'pallet-tags':   'palletTags',
      'temperature':   'temperature',
      'expiry-alerts': 'expiryAlerts',
      'reports':       'reports',
      'master-data':   'masterData',
      'history':       'history',
      'user-access':   'userAccess',
    };
    const permKey = permMap[page];
    if (permKey && !perms[permKey]) return; // silently block
    setCurrentPage(page);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <DashboardPage
            pallets={store.pallets}
            movements={store.movements}
            rooms={store.rooms}
            temperatures={store.temperatures}
            customers={store.customers}
            drivers={store.drivers}
            vehicles={store.vehicles}
            counters={store.counters}
            onInitCounters={store.initializeCounters}
            onResetAllData={store.resetAllData}
            onNavigate={navigate}
          />
        );
      case 'stock-in':
        return (
          <StockInPage
            pallets={store.pallets}
            customers={store.customers}
            products={store.products}
            drivers={store.drivers}
            vehicles={store.vehicles}
            rooms={store.rooms}
            counters={store.counters}
            onStockIn={store.stockIn}
            onNextIGP={store.nextIGP}
            peekNextIGP={store.peekNextIGP}
            onAddProduct={store.addProduct}
            onAddCustomer={store.addCustomer}
            currentUserName={currentUser.name}
          />
        );
      case 'stock-out':
        return (
          <StockOutPage
            pallets={store.pallets}
            customers={store.customers}
            products={store.products}
            drivers={store.drivers}
            vehicles={store.vehicles}
            counters={store.counters}
            onStockOut={store.stockOut}
            onNextOGP={store.nextOGP}
            peekNextOGP={store.peekNextOGP}
            getFIFOPallets={store.getFIFOPallets}
            currentUserName={currentUser.name}
          />
        );
      case 'location-map':
        return (
          <LocationMapPage
            pallets={store.pallets}
            currentUserName={currentUser.name}
            onMovePallet={store.movePallet}
          />
        );
      case 'pallet-tags':
        return <PalletTagsPage pallets={store.pallets} />;
      case 'temperature':
        return (
          <TemperaturePage
            temperatures={store.temperatures}
            onAddTemperature={store.addTemperature}
            currentUserName={currentUser.name}
          />
        );
      case 'expiry-alerts':
        return <ExpiryAlertsPage pallets={store.pallets} />;
      case 'reports':
        return (
          <ReportsPage
            pallets={store.pallets}
            movements={store.movements}
            temperatures={store.temperatures}
          />
        );
      case 'master-data':
        return (
          <MasterDataPage
            customers={store.customers}
            products={store.products}
            drivers={store.drivers}
            vehicles={store.vehicles}
            rooms={store.rooms}
            pallets={store.pallets}
            onAddCustomer={store.addCustomer}
            onUpdateCustomer={store.updateCustomer}
            onDeleteCustomer={store.deleteCustomer}
            onAddProduct={store.addProduct}
            onUpdateProduct={store.updateProduct}
            onDeleteProduct={store.deleteProduct}
            onAddDriver={store.addDriver}
            onUpdateDriver={store.updateDriver}
            onDeleteDriver={store.deleteDriver}
            onAddVehicle={store.addVehicle}
            onUpdateVehicle={store.updateVehicle}
            onDeleteVehicle={store.deleteVehicle}
            onUpdateRoom={store.updateRoom}
          />
        );
      case 'history':
        return (
          <HistoryPage
            movements={store.movements}
            pallets={store.pallets}
            customers={store.customers}
            products={store.products}
            drivers={store.drivers}
            vehicles={store.vehicles}
            onEditIGP={store.editIGP}
            onEditOGP={store.editOGP}
          />
        );
      case 'user-access':
        return (
          <UserAccessPage
            users={store.users}
            currentUser={currentUser}
            onAddUser={store.addUser}
            onUpdateUser={handleUpdateUser}
            onDeleteUser={store.deleteUser}
            onUpdatePermissions={store.updateUserPermissions}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Layout currentPage={currentPage} onNavigate={navigate} permissions={perms} onBackup={handleBackup} isRefreshing={store.isRefreshing} lastSync={store.lastSync} onManualRefresh={store.manualRefresh}>
      {renderPage()}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}


