#!/bin/bash
# Скрипт для выполнения НА СЕРВЕРЕ
# Скопируйте этот файл на сервер и запустите: bash server-deploy.sh

set -e

APP_DIR="/home/tgator/tgator"

echo "🚀 Начинаем деплой на сервере..."

# Создание пользователя
if ! id "tgator" &>/dev/null; then
    echo "👤 Создаем пользователя tgator..."
    adduser --disabled-password --gecos "" tgator
fi

# Создание директорий
mkdir -p $APP_DIR/logs
chown -R tgator:tgator /home/tgator

# Проверка архива
if [ ! -f "/tmp/tgator-deploy.tar.gz" ]; then
    echo "❌ Архив не найден в /tmp/tgator-deploy.tar.gz"
    echo "Скопируйте архив: scp /tmp/tgator-deploy.tar.gz root@90.156.229.163:/tmp/"
    exit 1
fi

# Бэкап
if [ -d "$APP_DIR/backend" ]; then
    BACKUP_DIR="/home/tgator/tgator-backup-$(date +%Y%m%d-%H%M%S)"
    echo "💾 Создаем бэкап в $BACKUP_DIR..."
    cp -r $APP_DIR $BACKUP_DIR
fi

# Распаковка
echo "📦 Распаковываем архив..."
cd $APP_DIR
tar -xzf /tmp/tgator-deploy.tar.gz
rm /tmp/tgator-deploy.tar.gz
chown -R tgator:tgator $APP_DIR

# Установка Node.js
if ! command -v node &> /dev/null; then
    echo "📦 Устанавливаем Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs
fi

# Установка PM2
if ! command -v pm2 &> /dev/null; then
    echo "📦 Устанавливаем PM2..."
    npm install -g pm2
fi

# Установка зависимостей backend
echo "📥 Устанавливаем зависимости backend..."
cd $APP_DIR/backend
npm install --production

# Установка зависимостей frontend
echo "📥 Устанавливаем зависимости frontend..."
cd $APP_DIR/frontend
npm install
npm run build

# Инициализация БД
echo "🗄️  Инициализируем базу данных..."
cd $APP_DIR/backend
if [ ! -f "prisma/dev.db" ]; then
    npx prisma migrate deploy || echo "⚠️  Миграции пропущены"
fi

# Запуск PM2
echo "🔄 Запускаем приложение..."
cd $APP_DIR
if pm2 list | grep -q "tgator-backend"; then
    pm2 restart tgator-backend
else
    pm2 start backend/ecosystem.config.js
    pm2 save
    pm2 startup
fi

# Настройка Nginx
echo "🌐 Настраиваем Nginx..."
if [ -f "$APP_DIR/nginx.conf" ]; then
    cp $APP_DIR/nginx.conf /etc/nginx/sites-available/tgator
    ln -sf /etc/nginx/sites-available/tgator /etc/nginx/sites-enabled/
    nginx -t && systemctl reload nginx
    echo "✅ Nginx настроен"
else
    echo "⚠️  nginx.conf не найден, настройте Nginx вручную"
fi

echo ""
echo "✅ Деплой завершен!"
echo ""
echo "📋 Следующие шаги:"
echo "   1. Настройте .env: cd $APP_DIR/backend && nano .env"
echo "   2. Проверьте логи: pm2 logs tgator-backend"
echo "   3. Проверьте статус: pm2 status"
echo "   4. Откройте: http://tgator.betaserver.ru"
echo ""
echo "🔐 SSL (опционально): certbot --nginx -d tgator.betaserver.ru"

