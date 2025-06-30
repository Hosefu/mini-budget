# 💰 Семейный Бюджет-Трекер

Простое приложение для ведения семейного бюджета с QR сканированием чеков и автоматической классификацией трат с помощью Claude AI.

## 🎯 Особенности

- **Правило 50/50**: Все траты автоматически делятся поровну между членами семьи
- **QR сканирование**: Обработка чеков через QR коды  
- **AI классификация**: Автоматическая категоризация покупок с помощью Claude
- **Простая авторизация**: Вход по PIN-кодам
- **Адаптивный интерфейс**: Красивый и удобный на всех устройствах
- **Минимум кода**: ~600 строк кода для полнофункционального приложения

## 🚀 Быстрый запуск

### С Docker (рекомендуется)

1. Клонируйте репозиторий:
```bash
git clone <your-repo-url>
cd mini-budget
```

2. Создайте файл `.env`:
```bash
cp .env.example .env
```

3. Добавьте ваш Claude API ключ в `.env`:
```bash
CLAUDE_API_KEY=your_claude_api_key_here
```

4. Запустите приложение:
```bash
docker-compose up -d
```

5. Откройте http://localhost:3000

### Без Docker

1. Установите зависимости:
```bash
# Backend
cd server && npm install

# Frontend  
cd ../web && npm install
```

2. Создайте `.env` файл в корне проекта с вашим Claude API ключом

3. Запустите в режиме разработки:
```bash
# Terminal 1 - Backend
cd server && npm run dev

# Terminal 2 - Frontend
cd web && npm run dev
```

4. Откройте http://localhost:5173 (фронтенд) или http://localhost:3000 (API)

## 🔐 Авторизация

- **Егор**: PIN `1329`
- **Сёма**: PIN `3415`

## 📱 Использование

1. **Войдите** с помощью PIN-кода
2. **Добавьте платёж** вручную или через QR чек
3. **Классифицируйте** товары с помощью AI
4. **Отслеживайте баланс** по правилу 50/50
5. **Управляйте категориями** для лучшей классификации

## 🏗️ Архитектура

```
mini-budget/
├─ server/          # Express API + JSON база данных
│  ├─ src/
│  │   ├─ db.ts         # JSON "база данных"
│  │   ├─ ai.ts         # Claude API интеграция
│  │   ├─ routes.ts     # REST API роуты
│  │   └─ index.ts      # Express сервер
│  └─ Dockerfile
├─ web/             # React + Vite фронтенд
│  ├─ src/
│  │   ├─ pages/        # Страницы приложения
│  │   ├─ components/   # React компоненты
│  │   └─ services/     # API клиент
│  └─ ...
└─ docker-compose.yml
```

## 🛠️ Технологии

**Backend:**
- Node.js + TypeScript
- Express.js
- JSON файлы (вместо базы данных)
- Claude API для AI классификации
- Cookie-based сессии

**Frontend:**
- React + TypeScript  
- Vite (сборщик)
- TailwindCSS (стили)
- TanStack Query (состояние)
- React Router (маршрутизация)

## 📊 API

| Метод | URL | Описание |
|-------|-----|----------|
| `POST /api/auth` | Авторизация по PIN |
| `GET /api/me` | Текущий пользователь |
| `GET /api/payments` | Список платежей |
| `POST /api/payment` | Создать платёж |
| `PATCH /api/payment/:id` | Редактировать платёж |
| `DELETE /api/payment/:id` | Удалить платёж |
| `POST /api/qr` | Обработать QR чек |
| `GET /api/balance` | Текущий баланс |
| `GET /api/categories` | Список категорий |
| `POST /api/categories` | Создать/редактировать категорию |
| `POST /api/ai/classify` | AI классификация товаров |

## 🔧 Конфигурация

Переменные окружения в `.env`:

```bash
# Обязательные
CLAUDE_API_KEY=your_claude_api_key_here

# Опциональные  
SESSION_KEY=your-secret-session-key
NODE_ENV=development
PORT=3000
```

## 📦 Деплой

### На любом сервере с Docker:

```bash
# Клонируем и настраиваем
git clone <repo-url>
cd mini-budget
cp .env.example .env
# Редактируем .env с вашими ключами

# Запускаем
docker-compose up -d

# Проверяем
curl http://localhost:3000/api/me
```

### На Vercel/Netlify:
Можно задеплоить только фронтенд и использовать внешний API.

## 🎨 Скриншоты

- 💰 **Главная**: Баланс семьи и список платежей
- 📱 **Сканер**: QR код чеков 
- 📂 **Категории**: Управление категориями трат
- 🔐 **Вход**: Простая авторизация по PIN

## 🤝 Вклад

1. Fork проекта
2. Создайте feature branch (`git checkout -b feature/amazing-feature`)
3. Commit изменения (`git commit -m 'Add amazing feature'`)
4. Push в branch (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

## 📄 Лицензия

MIT License - используйте как хотите!

## 🆘 Поддержка

Если что-то не работает:

1. Проверьте что у вас есть Claude API ключ
2. Убедитесь что порт 3000 свободен
3. Посмотрите логи: `docker-compose logs`

---

**Сделано с ❤️ для семьи Егора и Сёмы** 