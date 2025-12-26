#!/bin/bash

# Скрипт для деплоя на сервер
# Использование: ./deploy.sh

set -e

SERVER="root@90.156.229.163"
DOMAIN="tgator.betaserver.ru"
APP_DIR="/home/tgator/tgator"

echo "🚀 Начинаем деплой на $DOMAIN..."

# Проверка что мы в правильной директории
if [ ! -f "package.json" ] && [ ! -f "backend/package.json" ]; then
    echo "❌ Ошибка: запустите скрипт из корня проекта"
    exit 1
fi

# Создание архива для деплоя
echo "📦 Создаем архив..."
tar --exclude='node_modules' \
    --exclude='.git' \
    --exclude='.env' \
    --exclude='*.log' \
    --exclude='dist' \
    --exclude='backend/.session' \
    --exclude='backend/prisma/dev.db*' \
    -czf /tmp/tgator-deploy.tar.gz .

# Копирование на сервер
echo "📤 Копируем файлы на сервер..."
scp /tmp/tgator-deploy.tar.gz $SERVER:/tmp/

# Выполнение команд на сервере
echo "⚙️  Устанавливаем на сервере..."
ssh $SERVER << 'ENDSSH'
set -e

APP_DIR="/home/tgator/tgator"
BACKUP_DIR="/home/tgator/tgator-backup-$(date +%Y%m%d-%H%M%S)"

# Создание бэкапа если директория существует
if [ -d "$APP_DIR" ]; then
    echo "💾 Создаем бэкап..."
    cp -r $APP_DIR $BACKUP_DIR
fi

# Создание директории если не существует
mkdir -p $APP_DIR
cd $APP_DIR

# Распаковка архива
echo "📦 Распаковываем архив..."
tar -xzf /tmp/tgator-deploy.tar.gz
rm /tmp/tgator-deploy.tar.gz

# Установка зависимостей backend
echo "📥 Устанавливаем зависимости backend..."
cd backend
npm install --production

# Установка зависимостей frontend
echo "📥 Устанавливаем зависимости frontend..."
cd ../frontend
npm install
npm run build

# Создание директории для логов
mkdir -p ../logs

# Перезапуск PM2
echo "🔄 Перезапускаем приложение..."
cd $APP_DIR
if pm2 list | grep -q "tgator-backend"; then
    pm2 restart tgator-backend
else
    pm2 start backend/ecosystem.config.js
    pm2 save
fi

echo "✅ Деплой завершен!"
echo "📋 Проверьте логи: pm2 logs tgator-backend"
ENDSSH

# Удаление локального архива
rm /tmp/tgator-deploy.tar.gz

echo "✅ Деплой завершен!"
echo "🌐 Откройте в браузере: http://$DOMAIN"
