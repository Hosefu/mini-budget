import { NavLink, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import {
  CurrencyDollarIcon,
  QrCodeIcon,
  FolderIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline'

interface LayoutProps {
  userName: string
  children: React.ReactNode
}

export default function Layout({ userName, children }: LayoutProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Мутация для выхода
  const logoutMutation = useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] })
      navigate('/')
    },
  })

  const handleLogout = () => {
    logoutMutation.mutate()
  }

  const navLinks = [
    { 
      to: '/payments', 
      label: 'Платежи', 
      Icon: CurrencyDollarIcon
    },
    { 
      to: '/scan', 
      label: 'Сканер', 
      Icon: QrCodeIcon
    },
    { 
      to: '/categories', 
      label: 'Категории', 
      Icon: FolderIcon
    },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Шапка */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <CurrencyDollarIcon className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Семейный Бюджет</h1>
                <p className="text-sm text-gray-500">Привет, {userName}!</p>
              </div>
            </div>
            
            <button
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
              className="btn btn-secondary text-sm flex items-center space-x-2"
            >
              {logoutMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <ArrowRightOnRectangleIcon className="w-4 h-4" />
                  <span>Выйти</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Навигация */}
      <nav className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex space-x-8">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `flex items-center space-x-2 py-4 px-2 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`
                }
              >
                <link.Icon className="w-5 h-5" />
                <span>{link.label}</span>
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      {/* Основной контент */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {children}
      </main>

      {/* Мобильная навигация (фиксированная внизу) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t md:hidden safe-area-bottom">
        <div className="flex">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center py-2 px-1 text-xs font-medium ${
                  isActive
                    ? 'text-blue-600'
                    : 'text-gray-500'
                }`
              }
            >
              <link.Icon className="w-6 h-6 mb-1" />
              <span>{link.label}</span>
            </NavLink>
          ))}
        </div>
      </div>

      {/* Отступ для мобильной навигации */}
      <div className="h-16 md:hidden"></div>
    </div>
  )
} 