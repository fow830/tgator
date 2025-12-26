#!/bin/bash
# Автоматический деплой с использованием нового SSH ключа

SSH_KEY="$HOME/.ssh/id_ed25519_tgator"
SERVER="root@90.156.229.163"

if [ ! -f "$SSH_KEY" ]; then
    echo "❌ SSH ключ не найден: $SSH_KEY"
    exit 1
fi

echo "🚀 Деплой с ключом $SSH_KEY..."

# Копирование файлов
echo "📤 Копирую архив..."
scp -i "$SSH_KEY" -o StrictHostKeyChecking=no /tmp/tgator-deploy.tar.gz $SERVER:/tmp/

echo "📤 Копирую скрипт деплоя..."
scp -i "$SSH_KEY" -o StrictHostKeyChecking=no server-deploy.sh $SERVER:/tmp/

echo "📤 Копирую .env..."
scp -i "$SSH_KEY" -o StrictHostKeyChecking=no backend/.env $SERVER:/tmp/tgator.env

# Выполнение деплоя
echo "⚙️  Выполняю деплой..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no $SERVER "mv /tmp/tgator.env /home/tgator/tgator/backend/.env && bash /tmp/server-deploy.sh && pm2 restart tgator-backend"

echo "✅ Деплой завершен!"
echo "🌐 Откройте: http://tgator.betaserver.ru"
