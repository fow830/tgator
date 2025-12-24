# 🚀 Сервисы запущены!

## Текущий статус:

- ✅ Backend: http://localhost:3000
- ✅ Frontend: http://localhost:5173

## ⚠️ Важно: Заполните Telegram API credentials!

Для работы с Telegram нужно заполнить `backend/.env`:

1. Получите API ID и API Hash на https://my.telegram.org
2. Отредактируйте `backend/.env`:
   ```bash
   nano backend/.env
   # или
   vim backend/.env
   ```
3. Заполните:
   - `TELEGRAM_API_ID` - ваш API ID
   - `TELEGRAM_API_HASH` - ваш API Hash  
   - `TELEGRAM_PHONE` - номер телефона с +
   - `ALERT_CHANNEL_ID` - канал для алертов (@username или ID)

## 📋 Следующие шаги:

### 1. Авторизация в Telegram:

```bash
# Отправить код
curl -X POST http://localhost:3000/api/auth/send-code

# Ввести код из Telegram (замените 12345)
curl -X POST http://localhost:3000/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"code":"12345"}'
```

### 2. Использование админки:

1. Откройте http://localhost:5173
2. Добавьте чаты для мониторинга
3. Добавьте ключевые слова
4. Система начнет мониторить автоматически

## 🛑 Остановка серверов:

```bash
# Остановить все
kill $(cat backend.pid) $(cat frontend.pid) 2>/dev/null

# Или вручную
pkill -f "node.*server.js"
pkill -f "vite"
```

## 📊 Логи:

```bash
# Backend
tail -f backend.log

# Frontend  
tail -f frontend.log
```

## 🔍 Проверка работы:

```bash
# Health check
curl http://localhost:3000/api/health

# Список чатов
curl http://localhost:3000/api/chats

# Список ключевых слов
curl http://localhost:3000/api/keywords
```
