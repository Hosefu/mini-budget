import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Category, utils } from '../services/api'
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

export default function CategoriesPage() {
  const [showForm, setShowForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const queryClient = useQueryClient()

  // Загрузка категорий
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: api.getCategories,
  })

  // Мутация для удаления категории
  const deleteMutation = useMutation({
    mutationFn: api.deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })

  const handleEdit = (category: Category) => {
    setEditingCategory(category)
    setShowForm(true)
  }

  const handleDelete = (id: number) => {
    if (confirm('Удалить эту категорию?')) {
      deleteMutation.mutate(id)
    }
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditingCategory(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Категории</h1>
          <p className="text-gray-600">Управление категориями трат</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn btn-primary flex items-center space-x-2"
        >
          <PlusIcon className="w-4 h-4" />
          <span>Добавить</span>
        </button>
      </div>

      {/* Форма */}
      {showForm && (
        <CategoryForm
          category={editingCategory}
          onClose={handleFormClose}
        />
      )}

      {/* Список категорий */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {categories.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            onEdit={() => handleEdit(category)}
            onDelete={() => handleDelete(category.id)}
            isDeleting={deleteMutation.isPending}
          />
        ))}
      </div>
    </div>
  )
}

// Компонент карточки категории
interface CategoryCardProps {
  category: Category
  onEdit: () => void
  onDelete: () => void
  isDeleting: boolean
}

function CategoryCard({ category, onEdit, onDelete, isDeleting }: CategoryCardProps) {
  return (
    <div className="card">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div
            className="w-4 h-4 rounded-full flex-shrink-0"
            style={{ backgroundColor: category.color }}
          />
          <h3 className="font-semibold text-gray-900">{category.name}</h3>
        </div>
        
        <div className="flex items-center space-x-1">
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

      {category.description && (
        <p className="text-sm text-gray-600 mb-3">{category.description}</p>
      )}

      <div className="text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Лимит:</span>
          <span className="font-medium">
            {utils.formatCurrency(category.monthly_limit / 100)}/мес
          </span>
        </div>
      </div>
    </div>
  )
}

// Компонент формы категории
interface CategoryFormProps {
  category?: Category | null
  onClose: () => void
}

function CategoryForm({ category, onClose }: CategoryFormProps) {
  const [name, setName] = useState(category?.name || '')
  const [description, setDescription] = useState(category?.description || '')
  const [color, setColor] = useState(category?.color || '#6366f1')
  const [monthlyLimit, setMonthlyLimit] = useState(
    category ? (category.monthly_limit / 100).toString() : ''
  )
  const [error, setError] = useState('')

  const queryClient = useQueryClient()
  const isEditing = !!category

  // Мутация для сохранения категории
  const saveMutation = useMutation({
    mutationFn: api.saveCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      onClose()
    },
    onError: (error: Error) => {
      setError(error.message)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Название обязательно')
      return
    }

    const limit = parseFloat(monthlyLimit) || 0

    const data = {
      id: category?.id,
      name: name.trim(),
      description: description.trim(),
      color,
      monthlyLimit: Math.round(limit * 100), // в копейки
    }

    saveMutation.mutate(data)
  }

  const predefinedColors = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308',
    '#84cc16', '#22c55e', '#10b981', '#14b8a6',
    '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
    '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
    '#f43f5e', '#6b7280'
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full max-h-screen overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              {isEditing ? 'Редактировать категорию' : 'Новая категория'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Название */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Название *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="Продукты"
                required
              />
            </div>

            {/* Описание */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Описание
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input"
                rows={3}
                placeholder="Еда, напитки, продуктовые магазины..."
              />
              <p className="text-xs text-gray-500 mt-1">
                Помогает AI лучше классифицировать покупки
              </p>
            </div>

            {/* Цвет */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Цвет
              </label>
              <div className="flex items-center space-x-3 mb-3">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                />
                <span className="text-sm text-gray-600">{color}</span>
              </div>
              <div className="grid grid-cols-9 gap-2">
                {predefinedColors.map((presetColor) => (
                  <button
                    key={presetColor}
                    type="button"
                    onClick={() => setColor(presetColor)}
                    className={`w-6 h-6 rounded border-2 ${
                      color === presetColor ? 'border-gray-800' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: presetColor }}
                  />
                ))}
              </div>
            </div>

            {/* Месячный лимит */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Месячный лимит (₽)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={monthlyLimit}
                onChange={(e) => setMonthlyLimit(e.target.value)}
                className="input"
                placeholder="5000"
              />
              <p className="text-xs text-gray-500 mt-1">
                Для планирования бюджета и уведомлений
              </p>
            </div>

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