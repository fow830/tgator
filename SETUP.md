# Настройка Telegram Monitor Service

## Быстрый старт

### 1. Установка зависимостей (уже выполнено)
```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Настройка .env файла

Отредактируйте `backend/.env` и заполните реальными данными:

```env
# Получите на https://my.telegram.org
TELEGRAM_API_ID=ваш_api_id
TELEGRAM_API_HASH=ваш_api_hash
TELEGRAM_PHONE=+1234567890

# Канал для алертов (username или ID)
ALERT_CHANNEL_ID=@your_channel

# Опционально: токен бота для отправки алертов
TELEGRAM_BOT_TOKEN=

# База данных (SQLite уже настроена)
DATABASE_URL="file:./dev.db"

# Порт сервера
PORT=3000
```

### 3. База данных (уже настроена)

База данных SQLite уже создана. Если нужно пересоздать:
```bash
cd backend
npx prisma migrate reset
npx prisma migrate dev
```

### 4. Авторизация в Telegram

При первом запуске нужно авторизоваться:

```bash
# 1. Отправить код в Telegram
curl -X POST http://localhost:3000/api/auth/send-code

# 2. Ввести код из Telegram
curl -X POST http://localhost:3000/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"code":"12345"}'
```

Или используйте админку для авторизации (будет добавлено в будущих версиях).

### 5. Запуск

#### Вариант 1: Используя скрипт
```bash
./start.sh
```

#### Вариант 2: Вручную

Терминал 1 (Backend):
```bash
cd backend
npm run dev
```

Терминал 2 (Frontend):
```bash
cd frontend
npm run dev
```

### 6. Использование

1. Откройте http://localhost:5173 в браузере
2. Авторизуйтесь в Telegram (если еще не сделали)
3. Добавьте чаты для мониторинга
4. Добавьте ключевые слова
5. Система автоматически будет мониторить и отправлять алерты

## Структура проекта

```
tgator/
├── backend/              # Express API сервер
│   ├── src/
│   │   ├── routes/       # API endpoints
│   │   ├── services/     # Бизнес-логика
│   │   └── config/       # Конфигурация
│   ├── prisma/           # Prisma schema и миграции
│   └── dev.db            # SQLite база данных
├── frontend/             # React админка
│   └── src/
│       ├── components/   # React компоненты
│       └── services/     # API клиент
└── start.sh              # Скрипт запуска
```

## API Endpoints

### Health Check
- `GET /api/health` - проверка работы сервера

### Авторизация
- `POST /api/auth/send-code` - отправить код авторизации
- `POST /api/auth/verify` - подтвердить код

### Чаты
- `GET /api/chats` - список чатов
- `POST /api/chats` - добавить чат (автоматически присоединяется)
- `DELETE /api/chats/:id` - удалить чат (автоматически выходит)

### Ключевые слова
- `GET /api/keywords` - список ключевых слов
- `POST /api/keywords` - добавить ключевое слово
- `DELETE /api/keywords/:id` - удалить ключевое слово

### Алерты
- `GET /api/alerts` - история алертов

## Примечания

- Сессия Telegram сохраняется в `backend/.session`
- Мониторинг запускается автоматически при старте сервера
- Проверка новых сообщений происходит каждые 10 секунд
- Для работы нужна авторизация в Telegram через код

## Устранение проблем

### Сервер не запускается
- Проверьте, что порт 3000 свободен
- Убедитесь, что .env файл заполнен правильно
- Проверьте логи: `tail -f backend.log`

### Ошибка авторизации Telegram
- Убедитесь, что API ID и API Hash правильные
- Проверьте номер телефона (должен быть с +)
- Удалите файл `.session` и попробуйте снова

### База данных не работает
- Убедитесь, что файл `backend/dev.db` существует
- Запустите миграции: `cd backend && npx prisma migrate dev`

