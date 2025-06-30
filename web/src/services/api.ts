// Типы данных
export interface User {
  role: 'egor' | 'syoma';
}

export interface Category {
  id: number;
  name: string;
  description: string;
  color: string;
  monthly_limit: number;
  created_at: string;
}

export interface Item {
  id: number;
  name: string;
  qty: number;
  price: number;
  categoryId?: number;
  categoryName?: string;
  categoryColor?: string;
}

export interface Payment {
  id: number;
  ts: string;
  total: number;
  paid_egor: number;
  paid_syoma: number;
  description?: string;
  raw_qr?: string;
  created_by: string;
  items: Item[];
}

export interface Balance {
  egorBalance: number;
  syomaBalance: number;
  totalSpent: number;
  paymentsCount: number;
}

// Базовый URL API
const API_BASE = '/api';

// Утилита для HTTP запросов
async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || 'Произошла ошибка');
  }

  return response.json();
}

// API методы
export const api = {
  // Авторизация
  async login(pin: string): Promise<{ success: boolean; role: string }> {
    return fetchApi('/auth', {
      method: 'POST',
      body: JSON.stringify({ pin }),
    });
  },

  async logout(): Promise<{ success: boolean }> {
    return fetchApi('/logout', {
      method: 'POST',
    });
  },

  async getMe(): Promise<User> {
    return fetchApi('/me');
  },

  // Платежи
  async getPayments(): Promise<Payment[]> {
    return fetchApi('/payments');
  },

  async createPayment(data: {
    total: number;
    paidEgor: number;
    paidSyoma: number;
    description?: string;
    items?: Array<{
      name: string;
      qty: number;
      price: number;
      categoryId?: number;
    }>;
  }): Promise<{ success: boolean; id: number }> {
    return fetchApi('/payment', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updatePayment(id: number, data: {
    total: number;
    paidEgor: number;
    paidSyoma: number;
    description?: string;
  }): Promise<{ success: boolean }> {
    return fetchApi(`/payment/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deletePayment(id: number): Promise<{ success: boolean }> {
    return fetchApi(`/payment/${id}`, {
      method: 'DELETE',
    });
  },

  // QR коды
  async processQR(qr: string): Promise<{ success: boolean; id: number; message: string }> {
    return fetchApi('/qr', {
      method: 'POST',
      body: JSON.stringify({ qr }),
    });
  },

  // Баланс
  async getBalance(): Promise<Balance> {
    return fetchApi('/balance');
  },

  // Категории
  async getCategories(): Promise<Category[]> {
    return fetchApi('/categories');
  },

  async saveCategory(data: {
    id?: number;
    name: string;
    description: string;
    color: string;
    monthlyLimit: number;
  }): Promise<{ success: boolean; id: number }> {
    return fetchApi('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteCategory(id: number): Promise<{ success: boolean }> {
    return fetchApi(`/categories/${id}`, {
      method: 'DELETE',
    });
  },

  // Редактирование товара
  async updateItem(itemId: number, data: {
    name?: string;
    qty?: number;
    price?: number;
    categoryId?: number;
  }): Promise<{ success: boolean }> {
    return fetchApi(`/item/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // AI классификация товаров платежа
  async classifyPayment(paymentId: number): Promise<{ 
    success: boolean; 
    updatedCount: number; 
    message: string 
  }> {
    return fetchApi(`/payment/${paymentId}/classify`, {
      method: 'POST',
    });
  },
};

// Утилиты
export const utils = {
  // Форматирование суммы в рубли
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
    }).format(amount);
  },

  // Форматирование даты
  formatDate(dateString: string): string {
    return new Intl.DateTimeFormat('ru-RU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  },

  // Получение имени пользователя
  getUserName(role: 'egor' | 'syoma'): string {
    return role === 'egor' ? 'Егор' : 'Сёма';
  },

  // Класс для баланса
  getBalanceClass(balance: number): string {
    if (balance > 0) return 'balance-positive';
    if (balance < 0) return 'balance-negative';
    return 'balance-zero';
  },
}; 