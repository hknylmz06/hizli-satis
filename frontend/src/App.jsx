import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth'
import LoginPage from './pages/LoginPage'
import AdminPage from './pages/AdminPage'
import PosLayout from './pages/PosLayout'
import QuickSalePage from './pages/QuickSalePage'
import ProductsPage from './pages/ProductsPage'
import CustomersPage from './pages/CustomersPage'
import ReportsPage from './pages/ReportsPage'
import FiscalPairingPage from './pages/FiscalPairingPage'

function RequireAuth({ role, children }) {
  const { session } = useAuth()
  if (!session) return <Navigate to="/" replace />
  if (role && session.role !== role) return <Navigate to="/" replace />
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
        <Route index element={<QuickSalePage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="fiscal" element={<FiscalPairingPage />} />
      </Route>
    </Routes>
  )
}
