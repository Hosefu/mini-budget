import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, utils, Payment } from '../services/api'
import PaymentForm from '../components/PaymentForm'
import BalanceCard from '../components/BalanceCard'
import {
  PlusIcon,
  CreditCardIcon,
  UserIcon,
  SparklesIcon,
  PencilIcon,
  TrashIcon,
  QrCodeIcon,
} from '@heroicons/react/24/outline'

export default function PaymentsPage() {
  const [showForm, setShowForm] = useState(false)
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null)
  const queryClient = useQueryClient()

  // Загрузка данных
  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['payments'],
    queryFn: api.getPayments,
  })

  const { data: balance } = useQuery({
    queryKey: ['balance'],
    queryFn: api.getBalance,
  })

  // Мутация для удаления платежа
  const deletePaymentMutation = useMutation({
    mutationFn: api.deletePayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['balance'] })
    },
  })

  // Мутация для AI классификации
  const classifyMutation = useMutation({
    mutationFn: api.classifyPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
    },
  })

  const handleEdit = (payment: Payment) => {
    setEditingPayment(payment)
    setShowForm(true)
  }

  const handleDelete = (id: number) => {
    if (confirm('Удалить этот платёж?')) {
      deletePaymentMutation.mutate(id)
    }
  }

  const handleClassify = (paymentId: number) => {
    classifyMutation.mutate(paymentId)
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditingPayment(null)
  }

  if (paymentsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Баланс */}
      <BalanceCard balance={balance} />

      {/* Заголовок и кнопка добавления */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">
          Платежи
          {payments.length > 0 && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({payments.length})
            </span>
          )}
        </h2>
        <button
          onClick={() => setShowForm(true)}
          className="btn btn-primary flex items-center space-x-2"
        >
          <PlusIcon className="w-4 h-4" />
          <span>Добавить</span>
        </button>
      </div>

      {/* Форма добавления/редактирования */}
      {showForm && (
        <PaymentForm
          payment={editingPayment}
          onClose={handleFormClose}
        />
      )}

      {/* Список платежей */}
      {payments.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <CreditCardIcon className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Пока нет платежей
          </h3>
          <p className="text-gray-500 mb-6">
            Добавьте первый платёж или отсканируйте чек
          </p>
          <div className="space-x-4">
            <button
              onClick={() => setShowForm(true)}
              className="btn btn-primary flex items-center space-x-2 mx-auto"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Добавить платёж</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {payments.map((payment) => (
            <PaymentCard
              key={payment.id}
              payment={payment}
              onEdit={() => handleEdit(payment)}
              onDelete={() => handleDelete(payment.id)}
              onClassify={() => handleClassify(payment.id)}
              isClassifying={classifyMutation.isPending}
              isDeleting={deletePaymentMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Компонент карточки платежа
interface PaymentCardProps {
  payment: Payment
  onEdit: () => void
  onDelete: () => void
  onClassify: () => void
  isClassifying: boolean
  isDeleting: boolean
}

function PaymentCard({ 
  payment, 
  onEdit, 
  onDelete, 
  onClassify, 
  isClassifying, 
  isDeleting 
}: PaymentCardProps) {
  const hasUnclassifiedItems = payment.items.some(item => !item.categoryId)

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <h3 className="text-lg font-semibold text-gray-900">
              {utils.formatCurrency(payment.total / 100)}
            </h3>
            <span className="text-sm text-gray-500">
              {utils.formatDate(payment.ts)}
            </span>
          </div>
          
          {payment.description && (
            <p className="text-gray-600 mb-2">{payment.description}</p>
          )}
          
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-1">
              <div className="w-4 h-4 bg-blue-100 rounded-full flex items-center justify-center">
                <UserIcon className="w-3 h-3 text-blue-600" />
              </div>
              <span className="text-gray-600">
                Егор: {utils.formatCurrency(payment.paid_egor / 100)}
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <div className="w-4 h-4 bg-pink-100 rounded-full flex items-center justify-center">
                <UserIcon className="w-3 h-3 text-pink-600" />
              </div>
              <span className="text-gray-600">
                Сёма: {utils.formatCurrency(payment.paid_syoma / 100)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {hasUnclassifiedItems && (
            <button
              onClick={onClassify}
              disabled={isClassifying}
              className="btn btn-secondary text-xs flex items-center"
              title="Классифицировать с помощью AI"
            >
              {isClassifying ? (
                <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <SparklesIcon className="w-3 h-3" />
              )}
            </button>
          )}
          
          <button
            onClick={onEdit}
            className="btn btn-secondary text-xs flex items-center"
            title="Редактировать"
          >
            <PencilIcon className="w-3 h-3" />
          </button>
          
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="btn btn-danger text-xs flex items-center"
            title="Удалить"
          >
            {isDeleting ? (
              <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <TrashIcon className="w-3 h-3" />
            )}
          </button>
        </div>
      </div>

      {/* Товары */}
      {payment.items.length > 0 && (
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Товары ({payment.items.length}):
          </h4>
          <div className="space-y-1">
            {payment.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center space-x-2">
                  {item.categoryColor && (
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.categoryColor }}
                    />
                  )}
                  <span className="text-gray-600">{item.name}</span>
                  {item.qty > 1 && (
                    <span className="text-gray-400">×{item.qty}</span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-gray-900">
                    {utils.formatCurrency(item.price / 100)}
                  </span>
                  {item.categoryName && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {item.categoryName}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* QR код метка */}
      {payment.raw_qr && (
        <div className="mt-3 flex items-center space-x-1 text-xs text-gray-500">
          <QrCodeIcon className="w-3 h-3" />
          <span>Создано из QR кода</span>
        </div>
      )}
    </div>
  )
} 