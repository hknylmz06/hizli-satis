import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth'
import LoginPage from './pages/LoginPage'
import AdminPage from './pages/AdminPage'
import PosLayout from './pages/PosLayout'
import DashboardPage from './pages/DashboardPage'
import QuickSalePage from './pages/QuickSalePage'
import ProductsPage from './pages/ProductsPage'
import CustomersPage from './pages/CustomersPage'
import ReportsPage from './pages/ReportsPage'
import FiscalPairingPage from './pages/FiscalPairingPage'
import OtherSettingsPage from './pages/OtherSettingsPage'
import SupportPage from './pages/SupportPage'
import PurchaseInvoicesPage from './pages/PurchaseInvoicesPage'
import ExpensesPage from './pages/ExpensesPage'
import AccountsPage from './pages/AccountsPage'
import UsersPage from './pages/UsersPage'
import SuppliersPage from './pages/SuppliersPage'
import { allows } from './permissions'

function RequireAuth({ role, children }) {
  const { session } = useAuth()
  if (!session) return <Navigate to="/" replace />
  if (role && session.role !== role) return <Navigate to="/" replace />
  return children
}

function Guard({ perm, children }) {
  const { session } = useAuth()
  if (perm && !allows(session, perm)) {
    return <div className="p-8 text-red-300 font-bold">Bu sayfaya erişim yetkin yok.</div>
  }
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route
        path="/admin"
        element={
          <RequireAuth role="PlatformAdmin">
            <AdminPage />
          </RequireAuth>
        }
      />
      <Route
        path="/app"
        element={
          <RequireAuth role="TenantUser">
            <PosLayout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="pos" element={<Guard perm="can_access_pos"><QuickSalePage /></Guard>} />
        <Route path="products" element={<Guard perm="can_access_definitions"><ProductsPage /></Guard>} />
        <Route path="customers" element={<Guard perm="can_access_definitions"><CustomersPage /></Guard>} />
        <Route path="reports" element={<Guard perm="can_access_reports"><ReportsPage /></Guard>} />
        <Route path="fiscal" element={<Guard perm="can_access_settings"><FiscalPairingPage /></Guard>} />
        <Route path="settings" element={<Guard perm="can_access_settings"><OtherSettingsPage /></Guard>} />
        <Route path="users" element={<Guard perm="can_manage_users"><UsersPage /></Guard>} />
        <Route path="suppliers" element={<Guard perm="can_access_definitions"><SuppliersPage /></Guard>} />
        <Route path="invoices" element={<Guard perm="can_access_invoices"><PurchaseInvoicesPage /></Guard>} />
        <Route path="expenses" element={<Guard perm="can_access_definitions"><ExpensesPage /></Guard>} />
        <Route path="accounts" element={<Guard perm="can_access_definitions"><AccountsPage /></Guard>} />
        <Route path="support" element={<SupportPage />} />
      </Route>
    </Routes>
  )
}
