import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import PetDetailPage from './pages/PetDetailPage'
import ShoppingListPage from './pages/ShoppingListPage'
import StockPage from './pages/StockPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/pets/:id" element={<PetDetailPage />} />
          {/* Sprint 5: "Запасы" and "Купить" pages */}
          <Route path="/stock" element={<StockPage />} />
          <Route path="/shopping" element={<ShoppingListPage />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
