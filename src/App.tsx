import { useState, useCallback } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { useStore } from '@/store/useStore';
import Layout from '@/components/Layout';
import PageTransition from '@/components/PageTransition';
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

  const store = useStore(!!currentUser, currentUser?.role === 'admin');

  // Wrap updateUser so AuthContext stays in sync when current user is edited
  const handleUpdateUser = useCallback((id: string, updates: Partial<any>) => {
    store.updateUser(id, updates);
    if (currentUser?.id === id) {
      updateCurrentUser(updates);
    }
  }, [store, currentUser, updateCurrentUser]);

  // Backup export without vulnerable spreadsheet dependencies.
  const handleBackup = useCallback(async () => {
    try {
      const today = new Date();
      const dateStr = today.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });

      const esc = (value: any) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
      const sheetName = (name: string) => esc(name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
      const formatDate = (value: any) => {
        if (!value) return '';
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-PK');
      };
      const formatDateTime = (value: any) => {
        if (!value) return '';
        const d = new Date(value);
        return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-PK', {
          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
        });
      };
      const cell = (value: any, style = 'Data') => {
        const isNumber = typeof value === 'number' && Number.isFinite(value);
        const type = isNumber ? 'Number' : 'String';
        return `<Cell ss:StyleID="${style}"><Data ss:Type="${type}">${esc(value)}</Data></Cell>`;
      };
      const buildSheet = (title: string, headers: string[], rows: any[][], widths: number[]) => {
        const columns = widths.map(w => `<Column ss:Width="${w * 7}"/>`).join('');
        const headerRow = `<Row>${headers.map(h => cell(h, 'Header')).join('')}</Row>`;
        const bodyRows = rows.map((row, index) =>
          `<Row>${row.map(v => cell(v, index % 2 === 0 ? 'DataAlt' : 'Data')).join('')}</Row>`
        ).join('');
        return `
          <Worksheet ss:Name="${sheetName(title)}">
            <Table>
              ${columns}
              <Row><Cell ss:MergeAcross="${Math.max(headers.length - 1, 0)}" ss:StyleID="Title"><Data ss:Type="String">${esc(`PAKFROST (PVT) LIMITED - ${title}`)}</Data></Cell></Row>
              <Row><Cell ss:MergeAcross="${Math.max(headers.length - 1, 0)}" ss:StyleID="Subtitle"><Data ss:Type="String">${esc(`Generated: ${dateStr} | Cold Storage WMS`)}</Data></Cell></Row>
              <Row></Row>
              ${headerRow}
              ${bodyRows}
            </Table>
            <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
              <FreezePanes/><FrozenNoSplit/><SplitHorizontal>4</SplitHorizontal><TopRowBottomPane>4</TopRowBottomPane><ActivePane>2</ActivePane>
            </WorksheetOptions>
          </Worksheet>`;
      };

      const sheets: string[] = [];
      const activePallets = store.pallets.filter(p => p.status === 'active');

      sheets.push(buildSheet('Active Inventory', ['IGP No', 'Customer', 'Product', 'Code', 'Qty', 'Weight', 'Total Wt (Kg)', 'Pack Type', 'Room', 'Location', 'Mfg Date', 'Expiry Date', 'Date In'],
        activePallets.map(p => [
          p.igpNumber, p.customerName, p.productName, p.productCode,
          p.cartons, p.weightPerCarton, p.totalWeight, p.packingType || 'Carton',
          p.room, p.room === 'Ante Room' ? 'Floor' : `${p.side}${p.row}-${p.slot}`,
          formatDate(p.mfgDate), formatDate(p.expiryDate), formatDate(p.dateIn),
        ]), [10, 16, 22, 10, 6, 8, 13, 10, 10, 12, 12, 13, 13]));

      const inMoves = store.movements.filter(m => m.type === 'IN');
      sheets.push(buildSheet('Stock IN History', ['IGP No', 'Date', 'Customer', 'Product', 'Qty', 'Total Wt (Kg)', 'Vehicle', 'Driver', 'Operator'],
        inMoves.map(m => [
          m.docNumber, formatDate((m as any).createdAt || m.date), m.customerName, m.productName,
          m.cartons, m.totalWeight, m.vehicleNo || '', m.driverName || '', m.operatorName || '',
        ]), [10, 12, 16, 22, 8, 13, 14, 16, 14]));

      const outMoves = store.movements.filter(m => m.type === 'OUT');
      sheets.push(buildSheet('Stock OUT History', ['OGP No', 'Date', 'Customer', 'Product', 'Qty', 'Total Wt (Kg)', 'Vehicle', 'Driver', 'Destination', 'Operator'],
        outMoves.map(m => [
          m.docNumber, formatDate((m as any).createdAt || m.date), m.customerName, m.productName,
          m.cartons, m.totalWeight, m.vehicleNo || '', m.driverName || '', m.destination || '', m.operatorName || '',
        ]), [10, 12, 16, 22, 8, 13, 14, 16, 18, 14]));

      sheets.push(buildSheet('Customers', ['Code', 'Name', 'Contact Person', 'Phone', 'Email', 'Temp Req.', 'Contract Expiry', 'Status'],
        store.customers.map(cu => [cu.code, cu.name, cu.contactPerson || '', cu.phone || '', cu.email || '', cu.tempRequirement || '', formatDate(cu.contractExpiry), cu.isActive ? 'Active' : 'Inactive']),
        [10, 20, 18, 14, 22, 12, 15, 10]));

      sheets.push(buildSheet('Products', ['Code', 'Name', 'Category', 'Customer', 'Ctns/Pallet', 'Weight', 'UOM'],
        store.products.map(p => {
          const cu = store.customers.find(c => c.id === p.customerId);
          return [p.code, p.name, p.category, cu?.name || '', p.cartonsPerPallet, p.weightPerCarton, p.uom];
        }), [12, 24, 14, 18, 12, 10, 8]));

      sheets.push(buildSheet('Drivers', ['Code', 'Name', 'CNIC', 'Phone', 'License No', 'License Expiry', 'Status'],
        store.drivers.map(d => [d.code, d.name, d.cnic, d.phone, d.licenseNo, formatDate(d.licenseExpiry), d.status]),
        [10, 20, 16, 14, 16, 15, 10]));

      sheets.push(buildSheet('Vehicles', ['Vehicle No', 'Type', 'Ownership', 'Route Permit Expiry', 'Token Expiry', 'Fitness Expiry', 'Insurance Expiry', 'Status'],
        store.vehicles.map(v => [v.vehicleNo, v.type, v.ownership, formatDate(v.routePermitExpiry), formatDate(v.tokenExpiry), formatDate(v.fitnessExpiry), formatDate(v.insuranceExpiry), v.status]),
        [14, 14, 12, 20, 14, 14, 17, 10]));

      sheets.push(buildSheet('Temperature Log', ['Date / Time', 'Room', 'Temperature (C)', 'Recorded By', 'Notes'],
        store.temperatures.map(t => [formatDateTime(t.recordedAt || t.time), t.room, t.temperature, t.recordedBy, t.notes || '']),
        [22, 12, 18, 18, 24]));

      const totalWt = activePallets.reduce((s, p) => s + Number(p.totalWeight), 0);
      sheets.push(buildSheet('Summary', ['Metric', 'Value'], [
        ['Total Active Pallets', activePallets.length],
        ['Total Weight in Storage (Kg)', parseFloat(Number(totalWt).toFixed(0))],
        ['Total Customers (Active)', store.customers.filter(c => c.isActive).length],
        ['Total Products', store.products.length],
        ['Total Stock Movements', store.movements.length],
        ['Last Backup', dateStr],
      ], [32, 18]));

      sheets.push(buildSheet('Customer Summary', ['Customer', 'Active Pallets', 'Total Qty', 'Total Kg'],
        store.customers.filter(cu => cu.isActive).map(cu => {
          const cp = activePallets.filter(p => p.customerId === cu.id);
          return [cu.name, cp.length, cp.reduce((s, p) => s + Number(p.cartons), 0), parseFloat(cp.reduce((s, p) => s + Number(p.totalWeight), 0).toFixed(0))];
        }), [24, 14, 12, 12]));

      const workbook = `<?xml version="1.0" encoding="UTF-8"?>
        <?mso-application progid="Excel.Sheet"?>
        <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
          xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
          <Styles>
            <Style ss:ID="Title"><Font ss:Bold="1" ss:Size="14" ss:Color="#FFFFFF"/><Interior ss:Color="#0C3547" ss:Pattern="Solid"/></Style>
            <Style ss:ID="Subtitle"><Font ss:Color="#FFFFFF"/><Interior ss:Color="#1A5276" ss:Pattern="Solid"/></Style>
            <Style ss:ID="Header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#2471A3" ss:Pattern="Solid"/></Style>
            <Style ss:ID="Data"><Font ss:Color="#1B2631"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D6EAF8"/></Borders></Style>
            <Style ss:ID="DataAlt"><Font ss:Color="#1B2631"/><Interior ss:Color="#EBF5FB" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D6EAF8"/></Borders></Style>
          </Styles>
          ${sheets.join('')}
        </Workbook>`;

      const blob = new Blob([workbook], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `PAKFROST_WMS_Backup_${new Date().toISOString().slice(0, 10)}.xls`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
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
            peekNextIGP={store.peekNextIGP}
            peekNextOGP={store.peekNextOGP}
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
            onFetchIGPDetail={store.fetchIGPDetail}
            onFetchOGPDetail={store.fetchOGPDetail}
            onVoidIGP={store.voidIGP}
            onRestoreIGP={store.restoreIGP}
            onVoidOGP={store.voidOGP}
            onRestoreOGP={store.restoreOGP}
            onGetDocStatus={store.getDocStatus}
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
    <Layout currentPage={currentPage} onNavigate={navigate} permissions={perms} onBackup={handleBackup} isRefreshing={store.isRefreshing} lastSync={store.lastSync} onManualRefresh={store.manualRefresh} syncError={store.syncError}>
      <PageTransition pageKey={currentPage}>
        {renderPage()}
      </PageTransition>
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
