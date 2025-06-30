# Многоэтапная сборка
FROM node:18-alpine AS frontend-builder

# Собираем фронтенд
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# Основной этап - backend
FROM node:18-alpine

WORKDIR /app

# Копируем package файлы сервера
COPY server/package*.json ./
RUN npm ci

# Копируем исходный код сервера
COPY server/ ./

# Собираем TypeScript сервера
RUN npm run build

# Копируем собранный фронтенд (Vite собирает в server/public)
COPY --from=frontend-builder /app/server/public ./public

# Создаем директории
RUN mkdir -p /app/data
RUN chown -R node:node /app

# Переключаемся на пользователя node для безопасности
USER node

# Открываем порт
EXPOSE 3000

# Запускаем приложение
CMD ["npm", "start"] 