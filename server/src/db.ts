import fs from 'fs';
import path from 'path';

// Пути к файлам данных
const DATA_DIR = path.join(process.cwd(), '../data');
const PAYMENTS_FILE = path.join(DATA_DIR, 'payments.json');
const CATEGORIES_FILE = path.join(DATA_DIR, 'categories.json');
const ITEMS_FILE = path.join(DATA_DIR, 'items.json');

// Интерфейсы для данных
export interface Category {
  id: number;
  name: string;
  description: string;
  color: string;
  monthly_limit: number;
  created_at: string;
}

export interface Payment {
  id: number;
  ts: string;
  total: number;
  paid_egor: number;
  paid_syoma: number;
  description?: string;
  raw_qr?: string;
  fns_payload?: string;
  created_by: string;
}

export interface Item {
  id: number;
  payment_id: number;
  name: string;
  qty: number;
  price: number;
  category_id?: number;
  created_at: string;
}

// Хранилища данных в памяти
let categories: Category[] = [];
let payments: Payment[] = [];
let items: Item[] = [];

// Счетчики для генерации ID
let categoryIdCounter = 1;
let paymentIdCounter = 1;
let itemIdCounter = 1;

// Утилиты для работы с файлами
const ensureDir = (dirPath: string) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const loadData = <T>(filePath: string, defaultData: T[]): T[] => {
  try {
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return Array.isArray(data) ? data : defaultData;
    }
  } catch (error) {
    console.warn(`Ошибка чтения ${filePath}:`, error);
  }
  return defaultData;
};

const saveData = <T>(filePath: string, data: T[]) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error(`Ошибка записи ${filePath}:`, error);
  }
};

// База данных (простая имитация)
export const db = {
  // Подготовленные запросы (имитация better-sqlite3)
  prepare: (sql: string) => ({
    run: (...params: any[]) => {
      // Имитация INSERT
      if (sql.includes('INSERT INTO category')) {
        const [name, description, color, monthly_limit] = params;
        const category: Category = {
          id: categoryIdCounter++,
          name,
          description: description || '',
          color,
          monthly_limit,
          created_at: new Date().toISOString()
        };
        categories.push(category);
        saveData(CATEGORIES_FILE, categories);
        return { lastInsertRowid: category.id };
      }
      
      if (sql.includes('INSERT INTO payment')) {
        const [total, paid_egor, paid_syoma, description, created_by, raw_qr] = params;
        const payment: Payment = {
          id: paymentIdCounter++,
          ts: new Date().toISOString(),
          total,
          paid_egor,
          paid_syoma,
          description,
          created_by,
          raw_qr
        };
        payments.push(payment);
        saveData(PAYMENTS_FILE, payments);
        return { lastInsertRowid: payment.id };
      }
      
      if (sql.includes('INSERT INTO item')) {
        const [payment_id, name, qty, price, category_id] = params;
        const item: Item = {
          id: itemIdCounter++,
          payment_id,
          name,
          qty,
          price,
          category_id,
          created_at: new Date().toISOString()
        };
        items.push(item);
        saveData(ITEMS_FILE, items);
        return { lastInsertRowid: item.id };
      }
      
      // Имитация UPDATE
      if (sql.includes('UPDATE payment')) {
        const [total, paid_egor, paid_syoma, description, id] = params;
        const payment = payments.find(p => p.id === id);
        if (payment) {
          payment.total = total;
          payment.paid_egor = paid_egor;
          payment.paid_syoma = paid_syoma;
          payment.description = description;
          saveData(PAYMENTS_FILE, payments);
        }
        return {};
      }
      
      if (sql.includes('UPDATE category')) {
        const [name, description, color, monthly_limit, id] = params;
        const category = categories.find(c => c.id === id);
        if (category) {
          category.name = name;
          category.description = description;
          category.color = color;
          category.monthly_limit = monthly_limit;
          saveData(CATEGORIES_FILE, categories);
        }
        return {};
      }
      
      if (sql.includes('UPDATE item')) {
        // Поддержка разных форматов UPDATE item
        if (sql.includes('COALESCE')) {
          // Формат: UPDATE item SET name = COALESCE(?, name), qty = COALESCE(?, qty), price = COALESCE(?, price), category_id = COALESCE(?, category_id) WHERE id = ?
          const [name, qty, price, category_id, id] = params;
          const item = items.find(i => i.id === id);
          if (item) {
            if (name !== null) item.name = name;
            if (qty !== null) item.qty = qty;
            if (price !== null) item.price = price;
            if (category_id !== null) item.category_id = category_id;
            saveData(ITEMS_FILE, items);
          }
        } else {
          // Старый формат: UPDATE item SET category_id = ? WHERE id = ?
          const [category_id, id] = params;
          const item = items.find(i => i.id === id);
          if (item) {
            item.category_id = category_id;
            saveData(ITEMS_FILE, items);
          }
        }
        return {};
      }
      
      // Имитация DELETE
      if (sql.includes('DELETE FROM payment')) {
        const [id] = params;
        payments = payments.filter(p => p.id !== id);
        items = items.filter(i => i.payment_id !== id); // CASCADE
        saveData(PAYMENTS_FILE, payments);
        saveData(ITEMS_FILE, items);
        return {};
      }
      
      if (sql.includes('DELETE FROM category')) {
        const [id] = params;
        categories = categories.filter(c => c.id !== id);
        saveData(CATEGORIES_FILE, categories);
        return {};
      }
      
      return {};
    },
    
    get: (...params: any[]) => {
      // Имитация SELECT для баланса
      if (sql.includes('SUM(paid_egor - total/2)')) {
        const egor_delta = payments.reduce((sum, p) => sum + (p.paid_egor - p.total/2), 0);
        const syoma_delta = payments.reduce((sum, p) => sum + (p.paid_syoma - p.total/2), 0);
        const total_spent = payments.reduce((sum, p) => sum + p.total, 0);
        
        return {
          egor_delta,
          syoma_delta,
          total_spent,
          payments_count: payments.filter(p => p.total > 0).length
        };
      }
      
      return null;
    },
    
    all: (...params: any[]) => {
      // Имитация SELECT для категорий
      if (sql.includes('SELECT * FROM category')) {
        return [...categories].sort((a, b) => a.name.localeCompare(b.name));
      }
      
      // Имитация SELECT для товаров
      if (sql.includes('SELECT id, name, qty, price')) {
        const [payment_id] = params;
        return items.filter(i => i.payment_id === payment_id);
      }
      
      if (sql.includes('SELECT id, name, description FROM category')) {
        return categories.map(c => ({ id: c.id, name: c.name, description: c.description }));
      }
      
      // Имитация сложного запроса для платежей с товарами
      if (sql.includes('json_group_array')) {
        return payments.map(payment => {
          const paymentItems = items.filter(i => i.payment_id === payment.id);
          const itemsWithCategories = paymentItems.map(item => {
            const category = categories.find(c => c.id === item.category_id);
            return {
              id: item.id,
              name: item.name,
              qty: item.qty,
              price: item.price,
              categoryId: item.category_id,
              categoryName: category?.name,
              categoryColor: category?.color
            };
          });
          
          return {
            ...payment,
            items: JSON.stringify(itemsWithCategories)
          };
        }).sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
      }
      
      return [];
    }
  }),
  
  // Имитация exec (не используется в нашем коде)
  exec: (sql: string) => {
    // Заглушка
  }
};

// Функция инициализации
export const initDatabase = () => {
  console.log('🗄️ Инициализация JSON базы данных...');
  
  // Создаем директорию для данных
  ensureDir(DATA_DIR);
  
  // Загружаем данные из файлов
  categories = loadData(CATEGORIES_FILE, []);
  payments = loadData(PAYMENTS_FILE, []);
  items = loadData(ITEMS_FILE, []);
  
  // Обновляем счетчики ID
  categoryIdCounter = categories.length > 0 ? Math.max(...categories.map(c => c.id)) + 1 : 1;
  paymentIdCounter = payments.length > 0 ? Math.max(...payments.map(p => p.id)) + 1 : 1;
  itemIdCounter = items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
  
  // Создаем базовые категории если их нет
  if (categories.length === 0) {
    console.log('📁 Создаем базовые категории...');
    
    const defaultCategories = [
      ['Бакалея', 'Крупы, макароны, рис, гречка, нут, долгие углеводы', '#6b7280', 0], 
      ['Белок', 'Мясо, птица, рыба, морепродукты, яйца', '#3b82f6', 0],   
      ['Бытовая химия', 'Средства для уборки, тряпки, салфетки и так далее', '#ef4444', 0],       
      ['Джанг-фуд', 'Чипсы, мармелад, сладости, снеки. Всё вредное и вкусное', '#8b5cf6', 4000],   
      ['Молочная продукция', 'Молоко (альтернативное и коровье), сливочное масло, сливки, творог и так далее', '#3b82f6', 0], 
      ['Овощи, фрукты', 'Замороженные, консервированные, свежие', '#10b981', 0],
      ['Прочее', 'Все остальные траты', '#6b7280', 100],                  
      ['Развлечения', 'Кино, рестораны, кафе, досуг', '#8b5cf6', 0],   
      ['Сервис', 'Оплата за доставку, пакеты и так далее', '#3b82f6', 0],
      ['Чай, кофе', 'Кофе, чай, травяные напитки', '#22c55e', 0]
    ];

    defaultCategories.forEach(([name, desc, color, limit]) => {
      const category: Category = {
        id: categoryIdCounter++,
        name: name as string,
        description: desc as string,
        color: color as string,
        monthly_limit: limit as number,
        created_at: new Date().toISOString()
      };
      categories.push(category);
    });
    
    saveData(CATEGORIES_FILE, categories);
  }

  console.log('✅ JSON база данных готова!');
  console.log(`📊 Загружено: ${categories.length} категорий, ${payments.length} платежей, ${items.length} товаров`);
}; 