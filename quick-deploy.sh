#!/bin/bash
# Быстрый деплой на сервер

SERVER="root@90.156.229.163"
APP_DIR="/home/tgator/tgator"

echo "🚀 Быстрый деплой на $SERVER..."

# Проверка архива
if [ ! -f "/tmp/tgator-deploy.tar.gz" ]; then
    echo "❌ Архив не найден! Создайте его сначала."
    exit 1
fi

# Копирование
echo "📤 Копируем на сервер..."
scp /tmp/tgator-deploy.tar.gz $SERVER:/tmp/

# Выполнение на сервере
echo "⚙️  Устанавливаем..."
ssh $SERVER bash << 'ENDSSH'
set -e
APP_DIR="/home/tgator/tgator"
mkdir -p $APP_DIR/logs
cd $APP_DIR
tar -xzf /tmp/tgator-deploy.tar.gz
rm /tmp/tgator-deploy.tar.gz
cd backend && npm install --production
cd ../frontend && npm install && npm run build
cd .. && pm2 restart tgator-backend || pm2 start backend/ecosystem.config.js
pm2 save
echo "✅ Готово!"
ENDSSH

echo "✅ Деплой завершен!"
