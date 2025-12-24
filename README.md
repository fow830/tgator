# Telegram Monitor Service

Сервис для мониторинга Telegram-чатов на ключевые слова с отправкой алертов в канал.

## Возможности

- Автоматическое присоединение к чатам при добавлении
- Автоматический выход из чатов при удалении
- Мониторинг сообщений на ключевые слова
- Отправка алертов в указанный канал
- Простая веб-админка для управления

## Установка

### Требования

- Node.js 18+
- PostgreSQL
- Telegram API ID и API Hash (получите на https://my.telegram.org)

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Заполните .env файл своими данными
npx prisma generate
npx prisma migrate dev
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Настройка

1. Получите API ID и API Hash на https://my.telegram.org
2. Настройте PostgreSQL базу данных
3. Заполните переменные окружения в `backend/.env`:
   - `TELEGRAM_API_ID` - ваш API ID
   - `TELEGRAM_API_HASH` - ваш API Hash
   - `TELEGRAM_PHONE` - номер телефона в формате +1234567890
   - `ALERT_CHANNEL_ID` - ID или username канала для алертов
   - `DATABASE_URL` - строка подключения к PostgreSQL
   - `PORT` - порт для сервера (по умолчанию 3000)
   - `TELEGRAM_BOT_TOKEN` - опционально, токен бота для отправки алертов

4. При первом запуске авторизуйтесь в Telegram:
   ```bash
   # Отправьте запрос на получение кода
   curl -X POST http://localhost:3000/api/auth/send-code
   
   # Введите код из Telegram
   curl -X POST http://localhost:3000/api/auth/verify -H "Content-Type: application/json" -d '{"code":"12345"}'
   ```

## Использование

1. Откройте админку в браузере (обычно http://localhost:5173)
2. Добавьте чаты для мониторинга (username для публичных или invite link для приватных)
3. Добавьте ключевые слова
4. Система автоматически будет мониторить сообщения и отправлять алерты

## Структура проекта

```
tgator/
├── backend/          # Express API сервер
│   ├── src/
│   │   ├── routes/   # API routes
│   │   ├── services/ # Бизнес-логика
│   │   └── config/   # Конфигурация
│   └── prisma/       # Prisma schema
├── frontend/         # React админка
│   └── src/
│       ├── components/
│       └── services/
└── README.md
```

## API Endpoints

### Chats
- `GET /api/chats` - получить список чатов
- `POST /api/chats` - добавить чат (автоматически присоединяется)
- `DELETE /api/chats/:id` - удалить чат (автоматически выходит)

### Keywords
- `GET /api/keywords` - получить список ключевых слов
- `POST /api/keywords` - добавить ключевое слово
- `DELETE /api/keywords/:id` - удалить ключевое слово

### Alerts
- `GET /api/alerts` - получить историю алертов

### Auth
- `POST /api/auth/send-code` - отправить код авторизации
- `POST /api/auth/verify` - подтвердить код

## Примечания

- Для работы с user account требуется авторизация через код из Telegram
- Сессия сохраняется в файле `.session` в папке backend
- Мониторинг запускается автоматически при старте сервера
- Проверка новых сообщений происходит каждые 10 секунд
