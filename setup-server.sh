#!/bin/bash
# Скрипт для первоначальной настройки сервера
# Запустите на сервере: bash <(curl -s https://raw.githubusercontent.com/your-repo/setup-server.sh)

set -e

echo "🚀 Настройка сервера для tgator..."

# Обновление системы
echo "📦 Обновление системы..."
apt update && apt upgrade -y

# Установка Node.js
echo "📦 Установка Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Установка PM2
echo "📦 Установка PM2..."
npm install -g pm2

# Установка Nginx
echo "📦 Установка Nginx..."
apt install -y nginx

# Создание пользователя
echo "👤 Создание пользователя..."
if ! id "tgator" &>/dev/null; then
    adduser --disabled-password --gecos "" tgator
    usermod -aG sudo tgator
fi

# Создание директорий
echo "📁 Создание директорий..."
mkdir -p /home/tgator/tgator/logs
chown -R tgator:tgator /home/tgator

echo "✅ Сервер настроен!"
echo "📋 Следующие шаги:"
echo "   1. Скопируйте проект в /home/tgator/tgator"
echo "   2. Настройте .env файл"
echo "   3. Запустите: pm2 start backend/ecosystem.config.js"
