import express from 'express';
import cookieSession from 'cookie-session';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { initDatabase } from './db';
import routes from './routes';
import qrScanner from './qr-scanner';

// Загружаем .env из корня проекта
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 3000;

// Инициализируем базу данных при запуске
initDatabase();

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? true : 'http://localhost:5173',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Настройка сессий с cookie
app.use(cookieSession({
  name: 'budget-session',
  keys: [process.env.SESSION_KEY || 'budget-secret-key-change-in-production'],
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 дней
  httpOnly: true,
  secure: false, // Отключаем для HTTP
  sameSite: 'lax'
}));

// API роуты
app.use('/api', routes);
app.use('/api', qrScanner);

// В продакшене раздаем статику React приложения
if (process.env.NODE_ENV === 'production') {
  const staticPath = path.join(__dirname, '../public');
  app.use(express.static(staticPath));
  
  // Все остальные маршруты отдаем на React Router
  app.get('*', (req, res) => {
    res.sendFile(path.join(staticPath, 'index.html'));
  });
} else {
  // В режиме разработки показываем простую страницу
  app.get('/', (req, res) => {
    res.json({ 
      message: 'Семейный бюджет API работает!', 
      env: 'development',
      version: '1.0.0'
    });
  });
}

// Обработчик ошибок
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Ошибка сервера:', err);
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' 
      ? 'Внутренняя ошибка сервера' 
      : err.message 
  });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log('🚀 Сервер запущен!');
  console.log(`📍 Адрес: http://localhost:${PORT}`);
  console.log(`🌍 Режим: ${process.env.NODE_ENV || 'development'}`);
  console.log('📱 PIN коды: Егор=1329, Сёма=3415');
});

export default app; 