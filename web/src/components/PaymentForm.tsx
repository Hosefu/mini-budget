import { useState, useEffect } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { api, Payment, Category, Item } from '../services/api'

interface PaymentFormProps {
  payment?: Payment | null
  onClose: () => void
}

export default function PaymentForm({ payment, onClose }: PaymentFormProps) {
  const [total, setTotal] = useState('')
  const [paidEgor, setPaidEgor] = useState('')
  const [paidSyoma, setPaidSyoma] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [editingItems, setEditingItems] = useState<Item[]>([])

  const queryClient = useQueryClient()
  const isEditing = !!payment

  // Загружаем категории
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: api.getCategories,
  })

  // Заполняем форму при редактировании
  useEffect(() => {
    if (payment) {
      setTotal((payment.total / 100).toString())
      setPaidEgor((payment.paid_egor / 100).toString())
      setPaidSyoma((payment.paid_syoma / 100).toString())
      setDescription(payment.description || '')
      setEditingItems(payment.items || [])
    }
  }, [payment])

  // Мутация для создания/обновления платежа
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (isEditing) {
        return api.updatePayment(payment.id, data)
      } else {
        return api.createPayment(data)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['balance'] })
      onClose()
    },
    onError: (error: Error) => {
      setError(error.message)
    },
  })

  // Мутация для обновления товара
  const updateItemMutation = useMutation({
    mutationFn: ({ itemId, data }: { itemId: number; data: any }) => 
      api.updateItem(itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
    },
  })

  // Мутация для AI классификации
  const classifyMutation = useMutation({
    mutationFn: () => api.classifyPayment(payment!.id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      // Обновляем локальные товары
      if (result.success) {
        // Перезагружаем платеж чтобы получить обновленные категории
        queryClient.invalidateQueries({ queryKey: ['payments'] })
      }
    },
    onError: (error: Error) => {
      setError(error.message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const totalAmount = parseFloat(total) || 0
    const egorAmount = parseFloat(paidEgor) || 0
    const syomaAmount = parseFloat(paidSyoma) || 0

    if (totalAmount <= 0) {
      setError('Общая сумма должна быть больше 0')
      return
    }

    if (egorAmount + syomaAmount !== totalAmount) {
      setError('Сумма платежей должна равняться общей сумме')
      return
    }

    const data = {
      total: Math.round(totalAmount * 100), // в копейки
      paidEgor: Math.round(egorAmount * 100),
      paidSyoma: Math.round(syomaAmount * 100),
      description: description.trim() || undefined,
    }

    saveMutation.mutate(data)
  }

  // Быстрое заполнение 50/50
  const handleSplit5050 = () => {
    const totalAmount = parseFloat(total) || 0
    if (totalAmount > 0) {
      const half = (totalAmount / 2).toFixed(2)
      setPaidEgor(half)
      setPaidSyoma(half)
    }
  }

  // Быстрое заполнение - один платит всё
  const handlePayAll = (who: 'egor' | 'syoma') => {
    const totalAmount = parseFloat(total) || 0
    if (totalAmount > 0) {
      if (who === 'egor') {
        setPaidEgor(totalAmount.toFixed(2))
        setPaidSyoma('0')
      } else {
        setPaidEgor('0')
        setPaidSyoma(totalAmount.toFixed(2))
      }
    }
  }

  // Обновление категории товара
  const handleItemCategoryChange = (itemId: number, categoryId: number | null) => {
    updateItemMutation.mutate({
      itemId,
      data: { categoryId }
    })

    // Обновляем локальное состояние
    setEditingItems(prev => 
      prev.map(item => 
        item.id === itemId 
          ? { 
              ...item, 
              categoryId: categoryId || undefined,
              categoryName: categories.find(c => c.id === categoryId)?.name,
              categoryColor: categories.find(c => c.id === categoryId)?.color,
            }
          : item
      )
    )
  }

  // AI классификация
  const handleAIClassify = () => {
    if (payment?.id) {
      classifyMutation.mutate()
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-screen overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {isEditing ? 'Редактировать платёж' : 'Новый платёж'}
              </h2>
              {isEditing && payment?.raw_qr && (
                <div className="text-sm text-gray-500 mt-1">
                  📱 Создан из QR кода чека
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Общая сумма */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Общая сумма (₽) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                className="input"
                placeholder="0.00"
                required
              />
            </div>

            {/* Описание */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Описание
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input"
                placeholder="Продукты в Пятёрочке"
              />
            </div>

            {/* Кто сколько заплатил */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  👨‍💻 Егор заплатил (₽)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={paidEgor}
                  onChange={(e) => setPaidEgor(e.target.value)}
                  className="input"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  👩‍💻 Сёма заплатил (₽)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={paidSyoma}
                  onChange={(e) => setPaidSyoma(e.target.value)}
                  className="input"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Быстрое заполнение */}
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">
                Быстрое заполнение:
              </div>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={handleSplit5050}
                  className="btn btn-secondary text-xs flex-1"
                  disabled={!total}
                >
                  50/50
                </button>
                <button
                  type="button"
                  onClick={() => handlePayAll('egor')}
                  className="btn btn-secondary text-xs flex-1"
                  disabled={!total}
                >
                  👨‍💻 Егор
                </button>
                <button
                  type="button"
                  onClick={() => handlePayAll('syoma')}
                  className="btn btn-secondary text-xs flex-1"
                  disabled={!total}
                >
                  👩‍💻 Сёма
                </button>
              </div>
            </div>

            {/* Проверка суммы */}
            {total && paidEgor && paidSyoma && (
              <div className="text-sm">
                {parseFloat(paidEgor) + parseFloat(paidSyoma) === parseFloat(total) ? (
                  <div className="text-green-600">✅ Суммы сходятся</div>
                ) : (
                  <div className="text-red-600">
                    ❌ Разница: {((parseFloat(paidEgor) || 0) + (parseFloat(paidSyoma) || 0) - (parseFloat(total) || 0)).toFixed(2)} ₽
                  </div>
                )}
              </div>
            )}

            {/* Товары (только при редактировании) */}
            {isEditing && (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-700">
                    📦 Товары в чеке ({editingItems.length})
                  </h3>
                  <button
                    type="button"
                    onClick={handleAIClassify}
                    disabled={classifyMutation.isPending}
                    className="btn btn-primary text-xs"
                  >
                    {classifyMutation.isPending ? (
                      <div className="flex items-center space-x-1">
                        <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                        <span>AI...</span>
                      </div>
                    ) : (
                      '🤖 AI классификация'
                    )}
                  </button>
                </div>

                {editingItems.length > 0 ? (
                  <>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {editingItems.map((item) => (
                        <div key={item.id} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-medium text-sm">{item.name}</div>
                            <div className="text-sm text-gray-600">
                              {item.qty} шт × {(item.price / 100).toFixed(2)} ₽
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <label className="text-xs text-gray-600 flex-shrink-0">
                              Категория:
                            </label>
                            <select
                              value={item.categoryId || ''}
                              onChange={(e) => 
                                handleItemCategoryChange(
                                  item.id, 
                                  e.target.value ? parseInt(e.target.value) : null
                                )
                              }
                              className="text-xs border border-gray-200 rounded px-2 py-1 flex-1"
                              disabled={updateItemMutation.isPending}
                            >
                              <option value="">Без категории</option>
                              {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                  {category.name}
                                </option>
                              ))}
                            </select>
                            
                            {item.categoryColor && (
                              <div
                                className="w-4 h-4 rounded-full border"
                                style={{ backgroundColor: item.categoryColor }}
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {editingItems.some(item => !item.categoryId) && (
                      <div className="mt-2 text-xs text-amber-600 bg-amber-50 rounded p-2">
                        💡 Некоторые товары не имеют категории. Используйте AI классификацию или установите категории вручную.
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-2">📦</div>
                    <p className="text-sm">
                      {payment?.raw_qr 
                        ? 'Товары из чека не загружены. Добавьте их вручную.'
                        : 'Нет товаров в этом платеже'
                      }
                    </p>
                    <button
                      type="button"
                      className="mt-3 btn btn-secondary text-xs"
                      onClick={() => {
                        // TODO: Добавить модал для создания товара
                        alert('Функция добавления товаров будет добавлена в следующем обновлении');
                      }}
                    >
                      ➕ Добавить товар
                    </button>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {/* Кнопки */}
            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 btn btn-secondary"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="flex-1 btn btn-primary"
              >
                {saveMutation.isPending ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{isEditing ? 'Сохранение...' : 'Создание...'}</span>
                  </div>
                ) : (
                  isEditing ? 'Сохранить' : 'Создать'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
} 