import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from './db';
import { classifyItems } from './ai';

const router = Router();

// Расширяем типы для session
declare module 'express-session' {
  interface SessionData {
    role?: 'egor' | 'syoma';
  }
}

// Middleware для проверки авторизации
const requireAuth = (req: Request, res: Response, next: any) => {
  if (!req.session?.role) {
    return res.status(401).json({ error: 'Не авторизован' });
  }
  next();
};

// === АВТОРИЗАЦИЯ ===

// Вход по PIN-коду
router.post('/auth', (req: Request, res: Response) => {
  const { pin } = req.body;
  console.log('🔐 Попытка входа с PIN:', pin);
  
  let role: 'egor' | 'syoma' | null = null;
  
  if (pin === '1329') {
    role = 'egor';
  } else if (pin === '3415') {
    role = 'syoma';
  }
  
  if (!role) {
    console.log('❌ Неверный PIN:', pin);
    return res.status(401).json({ error: 'Неверный PIN' });
  }
  
  req.session!.role = role;
  console.log('✅ Успешный вход:', role);
  console.log('🍪 Сессия:', req.session);
  res.json({ success: true, role });
});

// Выход
router.post('/logout', (req: Request, res: Response) => {
  req.session!.role = undefined;
  res.json({ success: true });
});

// Проверка текущего пользователя
router.get('/me', (req: Request, res: Response) => {
  console.log('👤 Проверка пользователя');
  console.log('🍪 Текущая сессия:', req.session);
  console.log('🔑 Роль из сессии:', req.session?.role);
  const result = { role: req.session?.role || null };
  console.log('📤 Возвращаем:', result);
  res.json(result);
});

// === ПЛАТЕЖИ ===

// Создание платежа (ручной ввод)
router.post('/payment', requireAuth, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      total: z.number().positive(),
      paidEgor: z.number().min(0).default(0),
      paidSyoma: z.number().min(0).default(0),
      description: z.string().optional(),
      items: z.array(z.object({
        name: z.string(),
        qty: z.number().positive().default(1),
        price: z.number().positive(),
        categoryId: z.number().optional()
      })).optional()
    });

    const data = schema.parse(req.body);
    
    // Проверяем что сумма платежей соответствует общей сумме
    if (data.paidEgor + data.paidSyoma !== data.total) {
      return res.status(400).json({ 
        error: 'Сумма платежей не соответствует общей сумме' 
      });
    }

    // Создаем платеж
    const insertPayment = db.prepare(`
      INSERT INTO payment (total, paid_egor, paid_syoma, description, created_by)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const paymentResult = insertPayment.run(
      data.total,
      data.paidEgor,
      data.paidSyoma,
      data.description || null,
      req.session!.role
    );

    // Добавляем товары если есть
    if (data.items && data.items.length > 0) {
      const insertItem = db.prepare(`
        INSERT INTO item (payment_id, name, qty, price, category_id)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const item of data.items) {
        insertItem.run(
          paymentResult.lastInsertRowid,
          item.name,
          item.qty,
          item.price,
          item.categoryId || null
        );
      }
    }

    res.json({ success: true, id: paymentResult.lastInsertRowid });
  } catch (error) {
    console.error('Ошибка создания платежа:', error);
    res.status(400).json({ error: 'Неверные данные' });
  }
});

// Обработка QR кода чека
router.post('/qr', requireAuth, async (req: Request, res: Response) => {
  try {
    const { qr } = req.body;
    
    if (!qr) {
      return res.status(400).json({ error: 'QR код обязателен' });
    }

    console.log('📱 Начинаем обработку QR чека...');
    console.log('📋 QR данные:', qr);
    
    // Парсим QR код чека
    const qrData = parseReceiptQR(qr);
    console.log('🔍 Распаршенные данные чека:', qrData);
    
    let total = 0;
    let description = 'Чек из QR кода';
    
    if (qrData.sum) {
      total = Math.round(qrData.sum * 100); // в копейки
      description = `Чек от ${qrData.date || 'неизвестной даты'} на ${qrData.sum}₽`;
      console.log('💰 Сумма чека:', qrData.sum, '₽');
    } else {
      console.log('⚠️ Не удалось извлечь сумму из QR кода');
      description = 'Чек из QR кода (требует редактирования сумм)';
    }
    
    // Создаем платеж с QR данными
    const insertPayment = db.prepare(`
      INSERT INTO payment (total, paid_egor, paid_syoma, description, created_by, raw_qr)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    // Проверяем, нет ли уже платежа с таким же QR кодом
    const existingPayment = db.prepare('SELECT id FROM payment WHERE raw_qr = ?').get(qr);
    if (existingPayment) {
      console.log('⚠️ Платеж с таким QR кодом уже существует');
      return res.json({ 
        success: false, 
        error: 'Платеж с таким QR кодом уже создан' 
      });
    }
    
    // По умолчанию 100% оплаты назначается тому, кто сканирует
    const currentUser = req.session!.role;
    const paidEgor = currentUser === 'egor' ? total : 0;
    const paidSyoma = currentUser === 'syoma' ? total : 0;
    
    console.log('💾 Сохраняем платеж в базу...');
    console.log(`💰 ${currentUser === 'egor' ? 'Егор' : 'Сёма'} заплатил ${(total/100).toFixed(2)}₽ (100%)`);
    
    const paymentResult = insertPayment.run(
      total, paidEgor, paidSyoma, description, currentUser, qr
    );

    console.log('✅ Платеж создан с ID:', paymentResult.lastInsertRowid);

    // Получаем данные чека через ФНС API
    if (qrData.fn && qrData.i && qrData.fp && qrData.sum) {
      try {
        console.log('🏪 Запрашиваем данные чека через ФНС API...');
        const receiptData = await getReceiptFromFNS({
          fn: qrData.fn,
          i: qrData.i,
          fp: qrData.fp,
          sum: qrData.sum,
          date: qrData.date
        });
        
        if (receiptData && receiptData.items && receiptData.items.length > 0) {
          console.log(`📦 Получено ${receiptData.items.length} товаров из чека:`);
          
          const insertItem = db.prepare(`
            INSERT INTO item (payment_id, name, qty, price)
            VALUES (?, ?, ?, ?)
          `);
          
          for (const item of receiptData.items) {
            const itemResult = insertItem.run(
              paymentResult.lastInsertRowid,
              item.name,
              item.quantity,
              item.sum // сумма в копейках
            );
            console.log(`📦 Создан товар "${item.name}" ${item.quantity}шт × ${(item.sum/100).toFixed(2)}₽`);
          }
          
          console.log('✅ Реальные товары из чека добавлены. Запускаем автоматическую AI классификацию...');
          
          // Автоматически запускаем AI классификацию
          try {
            const { classifyItems } = await import('./ai');
            
            // Получаем товары этого платежа
            const items = db.prepare('SELECT id, name, qty, price FROM item WHERE payment_id = ?').all(paymentResult.lastInsertRowid);
            console.log(`📦 Найдено товаров для автоклассификации: ${items.length}`);
            
            if (items.length > 0) {
              // Получаем категории
              const categories = db.prepare('SELECT id, name, description FROM category ORDER BY name').all();
              console.log(`🏷️ Доступно категорий: ${categories.length}`);
              
              if (categories.length > 0) {
                const classification = await classifyItems(items as any[], categories as any[]);
                
                // Применяем результаты классификации
                const updateItem = db.prepare('UPDATE item SET category_id = ? WHERE id = ?');
                let updatedCount = 0;
                
                for (const [itemId, categoryId] of Object.entries(classification)) {
                  updateItem.run(categoryId, parseInt(itemId));
                  updatedCount++;
                }
                
                console.log(`✅ AI автоматически классифицировал ${updatedCount} товаров`);
              } else {
                console.log('⚠️ Нет категорий для автоклассификации');
              }
            }
          } catch (aiError) {
            console.error('⚠️ Ошибка автоклассификации:', aiError);
            console.log('💡 Товары добавлены без категорий. Используйте ручную классификацию.');
          }
        } else {
          console.log('⚠️ Не удалось получить товары из ФНС API. Чек сохранен без товаров.');
        }
      } catch (error) {
        console.error('❌ Ошибка получения данных из ФНС API:', error);
        console.log('⚠️ Чек сохранен без товаров. Добавьте товары вручную.');
      }
    } else {
      console.log('⚠️ Недостаточно данных для запроса к ФНС API. Чек сохранен без товаров.');
    }

    res.json({ 
      success: true, 
      id: paymentResult.lastInsertRowid,
      message: total > 0 
        ? `Чек на ${(total/100).toFixed(2)}₽ сохранен. Отредактируйте кто сколько заплатил.`
        : 'QR код сохранен. Отредактируйте платеж с правильными суммами.'
    });
    
  } catch (error) {
    console.error('❌ Ошибка обработки QR:', error);
    res.status(500).json({ error: 'Ошибка обработки QR кода: ' + (error as Error).message });
  }
});

// Функция парсинга QR кода чека
function parseReceiptQR(qr: string): {
  date?: string;
  sum?: number;
  fn?: string;
  i?: string;
  fp?: string;
} {
  try {
    const params = new URLSearchParams(qr.replace(/^[^?]*\?/, ''));
    
    const result: any = {};
    
    // Дата и время (t)
    const t = params.get('t');
    if (t) {
      try {
        // Формат: 20250630T1736
        const dateStr = t.replace('T', ' ');
        const year = dateStr.substr(0, 4);
        const month = dateStr.substr(4, 2);
        const day = dateStr.substr(6, 2);
        const hour = dateStr.substr(9, 2);
        const min = dateStr.substr(11, 2);
        result.date = `${day}.${month}.${year} ${hour}:${min}`;
      } catch {
        result.date = t;
      }
    }
    
    // Сумма (s)
    const s = params.get('s');
    if (s) {
      result.sum = parseFloat(s);
    }
    
    // Прочие параметры
    result.fn = params.get('fn');
    result.i = params.get('i');
    result.fp = params.get('fp');
    
    return result;
  } catch (error) {
    console.error('Ошибка парсинга QR:', error);
    return {};
  }
}

// Функция получения данных чека через ФНС API
async function getReceiptFromFNS(qrData: {
  fn: string;
  i: string; 
  fp: string;
  sum: number;
  date?: string;
}): Promise<{
  items: Array<{
    name: string;
    quantity: number;
    sum: number; // в копейках
    price: number; // цена за единицу в копейках
  }>;
} | null> {
  try {
    console.log('🔍 Параметры для ФНС API:', qrData);
    
    const token = process.env.FNS_API_TOKEN;
    if (!token) {
      console.log('⚠️ FNS_API_TOKEN не найден в .env файле');
      return null;
    }

    console.log('🌐 Отправляем запрос к proverkacheka.com (метод POST)...');
    
    // Используем POST запрос с токеном в теле согласно документации
    // Формируем qrraw в том же формате, что пришел с QR кода
    const dateParam = qrData.date ? 
      qrData.date.replace(/(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2})/, '$3$2$1T$4$5') : 
      '20250101T0000';
    
    const requestData = {
      token: token,
      qrraw: `t=${dateParam}&s=${qrData.sum}&fn=${qrData.fn}&i=${qrData.i}&fp=${qrData.fp}&n=1`
    };
    
    console.log('📋 Данные запроса:', requestData);
    
    const response = await fetch('https://proverkacheka.com/api/v1/check/get', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'mini-budget-app/1.0'
      },
      body: new URLSearchParams(requestData).toString()
    });

    console.log('📡 Статус ответа:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Ошибка от proverkacheka.com:', errorText);
      return null;
    }

    const data = await response.json();
    console.log('📦 Ответ от API:', JSON.stringify(data, null, 2));
    
    // Парсим ответ от proverkacheka.com
    if (data.code === 1 && data.data && data.data.json && data.data.json.items) {
      const items = data.data.json.items.map((item: any) => ({
        name: item.name || 'Неизвестный товар',
        quantity: item.quantity || 1,
        sum: item.sum || 0, // уже в копейках
        price: item.price || 0 // цена за единицу уже в копейках
      }));
      
      console.log(`✅ Получено ${items.length} товаров из чека`);
      items.forEach((item: any) => {
        console.log(`📦 ${item.name}: ${item.quantity}шт × ${(item.price/100).toFixed(2)}₽ = ${(item.sum/100).toFixed(2)}₽`);
      });
      return { items };
    } else {
      console.log('⚠️ Некорректный ответ от proverkacheka.com или чек не найден');
      console.log('🔍 Структура ответа:', Object.keys(data));
      console.log('🔍 code:', data.code, 'data:', !!data.data);
      return null;
    }
    
  } catch (error) {
    console.error('❌ Ошибка при запросе к ФНС API:', error);
    return null;
  }
}

// Получение списка платежей
router.get('/payments', requireAuth, (req: Request, res: Response) => {
  try {
    const query = `
      SELECT 
        p.*,
        json_group_array(
          json_object(
            'id', i.id,
            'name', i.name,
            'qty', i.qty,
            'price', i.price,
            'categoryId', i.category_id,
            'categoryName', c.name,
            'categoryColor', c.color
          )
        ) as items
      FROM payment p
      LEFT JOIN item i ON p.id = i.payment_id
      LEFT JOIN category c ON i.category_id = c.id
      GROUP BY p.id
      ORDER BY p.ts DESC
    `;
    
    const payments = db.prepare(query).all();
    
    // Парсим JSON с товарами
    const processedPayments = payments.map((payment: any) => ({
      ...payment,
      items: JSON.parse(payment.items).filter((item: any) => item.id !== null)
    }));
    
    res.json(processedPayments);
  } catch (error) {
    console.error('Ошибка получения платежей:', error);
    res.status(500).json({ error: 'Ошибка получения платежей' });
  }
});

// Редактирование платежа
router.patch('/payment/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const paymentId = parseInt(req.params.id);
    const updates = req.body;
    
    const updatePayment = db.prepare(`
      UPDATE payment 
      SET total = ?, paid_egor = ?, paid_syoma = ?, description = ?
      WHERE id = ?
    `);
    
    updatePayment.run(
      updates.total,
      updates.paidEgor,
      updates.paidSyoma,
      updates.description,
      paymentId
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка редактирования платежа:', error);
    res.status(500).json({ error: 'Ошибка редактирования платежа' });
  }
});

// Удаление платежа
router.delete('/payment/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const paymentId = parseInt(req.params.id);
    
    const deletePayment = db.prepare('DELETE FROM payment WHERE id = ?');
    deletePayment.run(paymentId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка удаления платежа:', error);
    res.status(500).json({ error: 'Ошибка удаления платежа' });
  }
});

// Редактирование товара
router.patch('/item/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const itemId = parseInt(req.params.id);
    const { name, qty, price, categoryId } = req.body;
    
    console.log(`📝 Редактируем товар ${itemId}:`, { name, qty, price, categoryId });
    
    const updateItem = db.prepare(`
      UPDATE item 
      SET name = COALESCE(?, name), 
          qty = COALESCE(?, qty), 
          price = COALESCE(?, price), 
          category_id = COALESCE(?, category_id)
      WHERE id = ?
    `);
    
    updateItem.run(
      name || null,
      qty || null, 
      price || null,
      categoryId || null,
      itemId
    );
    
    console.log(`✅ Товар ${itemId} обновлен`);
    res.json({ success: true });
    
  } catch (error) {
    console.error('❌ Ошибка редактирования товара:', error);
    res.status(500).json({ error: 'Ошибка редактирования товара' });
  }
});

// AI классификация товаров
router.post('/payment/:id/classify', requireAuth, async (req: Request, res: Response) => {
  try {
    const paymentId = parseInt(req.params.id);
    
    console.log(`🤖 Запуск AI классификации для платежа ${paymentId}...`);
    
    // Получаем товары этого платежа
    const items = db.prepare('SELECT id, name, qty, price FROM item WHERE payment_id = ?').all(paymentId);
    console.log(`📦 Найдено товаров для классификации: ${items.length}`);
    
    if (items.length === 0) {
      return res.json({ success: true, message: 'Нет товаров для классификации' });
    }
    
    // Получаем категории
    const categories = db.prepare('SELECT * FROM category').all();
    console.log(`🏷️ Доступно категорий: ${categories.length}`);
    
    // Запускаем AI классификацию
    const { classifyItems } = require('./ai');
    const classification = await classifyItems(items, categories);
    
    // Применяем результаты классификации (только если есть результаты)
    const classificationEntries = Object.entries(classification);
    let updatedCount = 0;
    
    if (classificationEntries.length > 0) {
      const updateItem = db.prepare('UPDATE item SET category_id = ? WHERE id = ?');
      
      for (const [itemId, categoryId] of classificationEntries) {
        updateItem.run(categoryId, parseInt(itemId));
        updatedCount++;
      }
      
      console.log(`✅ AI обновил категории у ${updatedCount} товаров`);
      res.json({ 
        success: true, 
        updatedCount,
        message: `AI классификация завершена. Обновлено ${updatedCount} товаров.`
      });
    } else {
      console.log(`⚠️ AI классификация не дала результатов. Товары остались без категорий.`);
      res.json({ 
        success: false, 
        updatedCount: 0,
        message: 'AI классификация не удалась. Установите категории товаров вручную.'
      });
    }
    
  } catch (error) {
    console.error('❌ Ошибка AI классификации:', error);
    res.status(500).json({ error: 'Ошибка AI классификации: ' + (error as Error).message });
  }
});

// === БАЛАНС ===

// Получение текущего баланса (правило 50/50)
router.get('/balance', requireAuth, (req: Request, res: Response) => {
  try {
    const balanceQuery = db.prepare(`
      SELECT
        SUM(paid_egor - total/2) AS egor_delta,
        SUM(paid_syoma - total/2) AS syoma_delta,
        SUM(total) AS total_spent,
        COUNT(*) AS payments_count
      FROM payment
      WHERE total > 0
    `);
    
    const balance = balanceQuery.get() as any;
    
    res.json({
      egorBalance: Math.round((balance.egor_delta || 0) / 100), // в рублях
      syomaBalance: Math.round((balance.syoma_delta || 0) / 100),
      totalSpent: Math.round((balance.total_spent || 0) / 100),
      paymentsCount: balance.payments_count || 0
    });
  } catch (error) {
    console.error('Ошибка получения баланса:', error);
    res.status(500).json({ error: 'Ошибка получения баланса' });
  }
});

// === КАТЕГОРИИ ===

// Получение списка категорий
router.get('/categories', requireAuth, (req: Request, res: Response) => {
  try {
    const categories = db.prepare('SELECT * FROM category ORDER BY name').all();
    res.json(categories);
  } catch (error) {
    console.error('Ошибка получения категорий:', error);
    res.status(500).json({ error: 'Ошибка получения категорий' });
  }
});

// Создание/редактирование категории
router.post('/categories', requireAuth, (req: Request, res: Response) => {
  try {
    const schema = z.object({
      id: z.number().optional(),
      name: z.string().min(1),
      description: z.string().optional(),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
      monthlyLimit: z.number().min(0)
    });

    const data = schema.parse(req.body);
    
    if (data.id) {
      // Редактирование
      const updateCategory = db.prepare(`
        UPDATE category 
        SET name = ?, description = ?, color = ?, monthly_limit = ?
        WHERE id = ?
      `);
      updateCategory.run(data.name, data.description, data.color, data.monthlyLimit, data.id);
      res.json({ success: true, id: data.id });
    } else {
      // Создание
      const insertCategory = db.prepare(`
        INSERT INTO category (name, description, color, monthly_limit)
        VALUES (?, ?, ?, ?)
      `);
      const result = insertCategory.run(data.name, data.description, data.color, data.monthlyLimit);
      res.json({ success: true, id: result.lastInsertRowid });
    }
  } catch (error) {
    console.error('Ошибка работы с категорией:', error);
    res.status(400).json({ error: 'Неверные данные категории' });
  }
});

// Удаление категории
router.delete('/categories/:id', requireAuth, (req: Request, res: Response) => {
  try {
    const categoryId = parseInt(req.params.id);
    
    const deleteCategory = db.prepare('DELETE FROM category WHERE id = ?');
    deleteCategory.run(categoryId);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Ошибка удаления категории:', error);
    res.status(500).json({ error: 'Ошибка удаления категории' });
  }
});

// === AI КЛАССИФИКАЦИЯ ===

// Автоматическая классификация товаров
router.post('/ai/classify', requireAuth, async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.body;
    
    if (!paymentId) {
      return res.status(400).json({ error: 'ID платежа обязателен' });
    }

    // Получаем товары платежа
    const items = db.prepare(`
      SELECT id, name, qty, price 
      FROM item 
      WHERE payment_id = ? AND category_id IS NULL
    `).all(paymentId);

    if (items.length === 0) {
      return res.json({ message: 'Нет товаров для классификации' });
    }

    // Получаем категории
    const categories = db.prepare('SELECT id, name, description FROM category').all();
    
    // Классифицируем с помощью Claude
    const classification = await classifyItems(items as any, categories as any);
    
    // Обновляем категории товаров
    const updateItem = db.prepare('UPDATE item SET category_id = ? WHERE id = ?');
    
    for (const [itemId, categoryId] of Object.entries(classification)) {
      updateItem.run(categoryId, parseInt(itemId));
    }
    
    res.json({ 
      success: true, 
      classified: Object.keys(classification).length,
      message: `Классифицировано ${Object.keys(classification).length} товаров`
    });
    
  } catch (error) {
    console.error('Ошибка AI классификации:', error);
    res.status(500).json({ error: 'Ошибка автоматической классификации' });
  }
});

// Ручное добавление товара к платежу (для тестирования)
router.post('/payment/:id/add-item', requireAuth, (req: Request, res: Response) => {
  try {
    const paymentId = parseInt(req.params.id);
    const { name, qty, price } = req.body;
    
    if (!name || !qty || !price) {
      return res.status(400).json({ error: 'Название, количество и цена обязательны' });
    }
    
    console.log(`📦 Добавляем товар к платежу ${paymentId}:`, { name, qty, price });
    
    const insertItem = db.prepare(`
      INSERT INTO item (payment_id, name, qty, price)
      VALUES (?, ?, ?, ?)
    `);
    
    const result = insertItem.run(
      paymentId,
      name,
      parseInt(qty),
      Math.round(parseFloat(price) * 100) // в копейки
    );
    
    console.log(`✅ Товар "${name}" добавлен с ID:`, result.lastInsertRowid);
    
    res.json({ 
      success: true, 
      id: result.lastInsertRowid,
      message: `Товар "${name}" добавлен к платежу`
    });
    
  } catch (error) {
    console.error('❌ Ошибка добавления товара:', error);
    res.status(500).json({ error: 'Ошибка добавления товара' });
  }
});

export default router; 