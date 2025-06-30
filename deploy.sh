#!/bin/bash

echo "🚀 Mini Budget - Быстрый деплой"
echo "================================"

# Проверка наличия .env файла
if [ ! -f ".env" ]; then
    echo "❌ Файл .env не найден!"
    echo "📋 Скопируйте .env.example в .env и заполните переменные:"
    echo "   cp .env.example .env"
    exit 1
fi

# Проверка наличия ключей в .env
if ! grep -q "CLAUDE_API_KEY=sk-ant" .env; then
    echo "⚠️  Внимание: CLAUDE_API_KEY не настроен в .env"
fi

if ! grep -q "FNS_API_TOKEN=" .env && ! grep -q "your-fns-api-token-here" .env; then
    echo "⚠️  Внимание: FNS_API_TOKEN не настроен в .env"
fi

echo "🔧 Остановка существующих контейнеров..."
docker-compose down

echo "🏗️  Сборка приложения..."
docker-compose build

echo "🚀 Запуск приложения..."
docker-compose up -d

echo "⏳ Ожидание запуска сервера..."
sleep 15

echo "🔍 Проверка здоровья приложения..."
if curl -f http://localhost:3000/api/me > /dev/null 2>&1; then
    echo "✅ Приложение успешно запущено!"
    echo "🌐 Доступно по адресу: http://localhost:3000"
    echo ""
    echo "👥 Пользователи:"
    echo "   Егор: PIN 1329"
    echo "   Сёма: PIN 3415"
    echo ""
    echo "📊 Полезные команды:"
    echo "   docker-compose logs -f    # Просмотр логов"
    echo "   docker-compose down       # Остановка"
    echo "   docker-compose restart    # Перезапуск"
else
    echo "❌ Ошибка запуска! Проверьте логи:"
    echo "   docker-compose logs"
    exit 1
fi 