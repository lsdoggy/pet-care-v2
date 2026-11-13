import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider'
import AppShell from './components/layout/AppShell'
import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import PetDetailPage from './pages/PetDetailPage'
import SettingsPage from './pages/SettingsPage'
import ShoppingListPage from './pages/ShoppingListPage'
import StockPage from './pages/StockPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public auth routes: no shell (no user context yet) */}
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />

          {/* Design Sprint 0: AppShell layout wrapper around existing pages.
              Pages themselves are unchanged; they render into <Outlet/>. */}
          <Route element={<AppShell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/pets/:id" element={<PetDetailPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            {/* Sprint 5: "Запасы" and "Купить" pages */}
            <Route path="/stock" element={<StockPage />} />
            <Route path="/shopping" element={<ShoppingListPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
