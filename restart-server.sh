#!/bin/bash
# Скрипт для перезапуска сервера через PM2

SERVER="root@90.156.229.163"
SSH_KEY="$HOME/.ssh/id_ed25519_tgator"

echo "🔄 Перезапуск сервера через PM2..."

# Попытка подключения с ключом
if [ -f "$SSH_KEY" ]; then
    echo "📝 Используем SSH ключ: $SSH_KEY"
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no $SERVER << 'EOF'
        cd /home/tgator/tgator
        echo "🔄 Перезапускаем PM2 процесс..."
        pm2 restart tgator-backend
        echo ""
        echo "📊 Статус PM2:"
        pm2 status
        echo ""
        echo "📋 Последние логи:"
        pm2 logs tgator-backend --lines 10 --nostream
EOF
else
    echo "❌ SSH ключ не найден: $SSH_KEY"
    echo ""
    echo "Выполните вручную:"
    echo "  ssh $SERVER"
    echo "  cd /home/tgator/tgator"
    echo "  pm2 restart tgator-backend"
    echo "  pm2 status"
fi

