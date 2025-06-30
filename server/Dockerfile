# Используем официальный Node.js образ
FROM node:18-alpine

# Создаем рабочую директорию
WORKDIR /app

# Копируем package файлы
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci --only=production

# Копируем исходный код
COPY . .

# Собираем TypeScript
RUN npm run build

# Создаем директорию для данных
RUN mkdir -p /app/data

# Открываем порт
EXPOSE 3000

# Запускаем приложение
CMD ["npm", "start"] 