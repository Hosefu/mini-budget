import { Routes, Route, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from './services/api'
import LoginPage from './pages/LoginPage'
import PaymentsPage from './pages/PaymentsPage'
import ScanPage from './pages/ScanPage'
import CategoriesPage from './pages/CategoriesPage'
import Layout from './components/Layout'

function App() {
  // Проверяем авторизацию
  const { data: user, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: api.getMe,
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Если не авторизован - показываем логин
  if (!user?.role) {
    return <LoginPage />
  }

  // Основное приложение с роутингом
  return (
    <Layout userName={user.role === 'egor' ? 'Егор' : 'Сёма'}>
      <Routes>
        <Route path="/" element={<Navigate to="/payments" replace />} />
        <Route path="/payments" element={<PaymentsPage />} />
        <Route path="/scan" element={<ScanPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="*" element={<Navigate to="/payments" replace />} />
      </Routes>
    </Layout>
  )
}

export default App 