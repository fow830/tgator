#!/bin/bash
# Тест SSH подключения

SSH_KEY="$HOME/.ssh/id_ed25519_tgator"
SERVER="root@90.156.229.163"

echo "🔍 Тестирую SSH подключение..."
echo "Ключ: $SSH_KEY"
echo "Сервер: $SERVER"
echo ""

# Проверка ключа
if [ ! -f "$SSH_KEY" ]; then
    echo "❌ Ключ не найден: $SSH_KEY"
    exit 1
fi

# Проверка прав
chmod 600 "$SSH_KEY" 2>/dev/null

# Тест подключения
echo "Пробую подключиться..."
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=10 -v $SERVER "echo '✅ Подключение успешно!'" 2>&1 | tail -20
