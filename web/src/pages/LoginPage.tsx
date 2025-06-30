import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'

export default function LoginPage() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const queryClient = useQueryClient()

  // Мутация для входа
  const loginMutation = useMutation({
    mutationFn: api.login,
    onSuccess: (data) => {
      // Сразу записываем пользователя в кэш React Query
      queryClient.setQueryData(['me'], { role: data.role })
      // Инвалидируем запросы
      queryClient.invalidateQueries({ queryKey: ['me'] })
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['balance'] })
      
      // Небольшая задержка для обновления состояния React Query
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['me'] })
      }, 50)
    },
    onError: (error: Error) => {
      setError(error.message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (pin.length !== 4) {
      setError('PIN должен содержать 4 цифры')
      return
    }
    
    loginMutation.mutate(pin)
  }

  const handlePinChange = (value: string) => {
    // Разрешаем только цифры и ограничиваем длину
    const digits = value.replace(/\D/g, '').slice(0, 4)
    setPin(digits)
    setError('')
  }

  // Кнопки быстрого ввода (для демо)
  const quickPins = [
    { pin: '1329', name: 'Егор', emoji: '👨‍💻' },
    { pin: '3415', name: 'Сёма', emoji: '👩‍💻' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Логотип и заголовок */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">💰</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Семейный Бюджет
          </h1>
          <p className="text-gray-600">
            Управление финансами для Егора и Сёмы
          </p>
        </div>

        {/* Форма входа */}
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="pin" className="block text-sm font-medium text-gray-700 mb-2">
                Введите ваш PIN-код
              </label>
              <input
                id="pin"
                type="password"
                value={pin}
                onChange={(e) => handlePinChange(e.target.value)}
                placeholder="••••"
                className="input text-center text-2xl tracking-widest"
                maxLength={4}
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1 text-center">
                4 цифры
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-600 text-sm text-center">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={pin.length !== 4 || loginMutation.isPending}
              className="w-full btn btn-primary text-lg py-3"
            >
              {loginMutation.isPending ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Вход...</span>
                </div>
              ) : (
                'Войти'
              )}
            </button>
          </form>

          {/* Быстрый вход для демо */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500 text-center mb-3">
              Быстрый вход:
            </p>
            <div className="flex space-x-3">
              {quickPins.map((user) => (
                <button
                  key={user.pin}
                  onClick={() => handlePinChange(user.pin)}
                  className="flex-1 btn btn-secondary text-sm py-2"
                  disabled={loginMutation.isPending}
                >
                  <span className="mr-2">{user.emoji}</span>
                  {user.name}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              Нажмите на кнопку, затем "Войти"
            </p>
          </div>
        </div>

        {/* Подсказка */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            🔒 Безопасный вход по персональному PIN-коду
          </p>
        </div>
      </div>
    </div>
  )
} 