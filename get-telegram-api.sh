#!/bin/bash

echo "=========================================="
echo "Telegram API Credentials Helper"
echo "=========================================="
echo ""
echo "Этот скрипт поможет вам получить API ID и API Hash"
echo ""

# Check if we have a phone number
PHONE=$(grep "^TELEGRAM_PHONE=" backend/.env | cut -d'=' -f2 | tr -d '"' | tr -d "'")

if [ -z "$PHONE" ] || [ "$PHONE" = "+1234567890" ] || [ "$PHONE" = "your_phone_here" ]; then
    echo "⚠️  Номер телефона не указан в backend/.env"
    read -p "Введите ваш номер телефона (с +): " PHONE
    if [ ! -z "$PHONE" ]; then
        # Update .env file
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|^TELEGRAM_PHONE=.*|TELEGRAM_PHONE=$PHONE|" backend/.env
        else
            sed -i "s|^TELEGRAM_PHONE=.*|TELEGRAM_PHONE=$PHONE|" backend/.env
        fi
        echo "✓ Номер телефона сохранен в backend/.env"
    else
        echo "✗ Номер телефона не введен. Выход."
        exit 1
    fi
else
    echo "✓ Используется номер: $PHONE"
    read -p "Использовать этот номер? (y/n): " USE_PHONE
    if [ "$USE_PHONE" != "y" ] && [ "$USE_PHONE" != "Y" ]; then
        read -p "Введите новый номер телефона (с +): " PHONE
        if [ ! -z "$PHONE" ]; then
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "s|^TELEGRAM_PHONE=.*|TELEGRAM_PHONE=$PHONE|" backend/.env
            else
                sed -i "s|^TELEGRAM_PHONE=.*|TELEGRAM_PHONE=$PHONE|" backend/.env
            fi
        fi
    fi
fi

echo ""
echo "=========================================="
echo "Инструкция по получению API credentials:"
echo "=========================================="
echo ""
echo "1. Откройте в браузере: https://my.telegram.org/auth"
echo ""
echo "2. Введите номер телефона: $PHONE"
echo ""
echo "3. Нажмите 'Next'"
echo ""
echo "4. Проверьте Telegram - вам придет код подтверждения"
echo ""
echo "5. Введите код на сайте"
echo ""
echo "6. После входа нажмите 'API development tools'"
echo ""
echo "7. Заполните форму:"
echo "   - App title: Telegram Monitor"
echo "   - Short name: tgmonitor"
echo "   - Platform: Other"
echo "   - Description: Monitor service"
echo ""
echo "8. Скопируйте api_id и api_hash"
echo ""
read -p "Нажмите Enter когда откроете сайт..."

# Try to open browser
if command -v open > /dev/null; then
    open "https://my.telegram.org/auth"
elif command -v xdg-open > /dev/null; then
    xdg-open "https://my.telegram.org/auth"
fi

echo ""
echo "=========================================="
echo "После получения credentials:"
echo "=========================================="
echo ""
read -p "Введите api_id: " API_ID
read -p "Введите api_hash: " API_HASH

if [ ! -z "$API_ID" ] && [ ! -z "$API_HASH" ]; then
    # Update .env file
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/^TELEGRAM_API_ID=.*/TELEGRAM_API_ID=$API_ID/" backend/.env
        sed -i '' "s/^TELEGRAM_API_HASH=.*/TELEGRAM_API_HASH=$API_HASH/" backend/.env
    else
        sed -i "s/^TELEGRAM_API_ID=.*/TELEGRAM_API_ID=$API_ID/" backend/.env
        sed -i "s/^TELEGRAM_API_HASH=.*/TELEGRAM_API_HASH=$API_HASH/" backend/.env
    fi
    
    echo ""
    echo "✅ API credentials сохранены в backend/.env"
    echo ""
    echo "Текущие настройки:"
    echo "  API ID: $API_ID"
    echo "  API Hash: $API_HASH"
    echo "  Phone: $PHONE"
    echo ""
    echo "Теперь можно авторизоваться в Telegram:"
    echo "  curl -X POST http://localhost:3000/api/auth/send-code"
else
    echo "✗ API credentials не введены"
fi

