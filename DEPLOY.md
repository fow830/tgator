# Инструкция по деплою

## Сервер
- **IP**: 90.156.229.163
- **Домен**: tgator.betaserver.ru

## Шаги деплоя

### 1. Подключение к серверу
```bash
ssh root@90.156.229.163
# или
ssh root@tgator.betaserver.ru
```

### 2. Установка зависимостей на сервере
```bash
# Обновление системы
apt update && apt upgrade -y

# Установка Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Установка PM2 (процесс-менеджер)
npm install -g pm2

# Установка nginx
apt install -y nginx
```

### 3. Создание пользователя для приложения
```bash
adduser tgator
usermod -aG sudo tgator
```

### 4. Клонирование проекта
```bash
cd /home/tgator
git clone <your-repo-url> tgator
cd tgator
```

### 5. Установка зависимостей проекта
```bash
cd backend
npm install --production

cd ../frontend
npm install
npm run build
```

### 6. Настройка .env файла
```bash
cd /home/tgator/tgator/backend
nano .env
```

Заполните все переменные:
```
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash
TELEGRAM_PHONE=your_phone
ALERT_CHANNEL_ID=@your_channel
DATABASE_URL=file:./prisma/dev.db
PORT=3000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=$2b$10$... (bcrypt hash)
JWT_SECRET=your_jwt_secret
```

### 7. Инициализация базы данных
```bash
cd /home/tgator/tgator/backend
npx prisma migrate deploy
```

### 8. Настройка PM2
```bash
cd /home/tgator/tgator
pm2 start backend/ecosystem.config.js
pm2 save
pm2 startup
```

### 9. Настройка Nginx
Создайте файл `/etc/nginx/sites-available/tgator`:
```nginx
server {
    listen 80;
    server_name tgator.betaserver.ru;

    # Frontend
    location / {
        root /home/tgator/tgator/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Активируйте конфигурацию:
```bash
ln -s /etc/nginx/sites-available/tgator /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 10. Настройка SSL (опционально, но рекомендуется)
```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d tgator.betaserver.ru
```

### 11. Проверка
- Откройте в браузере: http://tgator.betaserver.ru
- Проверьте логи: `pm2 logs tgator-backend`
- Проверьте статус: `pm2 status`

## Обновление проекта
```bash
cd /home/tgator/tgator
git pull
cd backend
npm install --production
cd ../frontend
npm install
npm run build
pm2 restart tgator-backend
```

## Полезные команды
```bash
# Просмотр логов
pm2 logs tgator-backend

# Перезапуск
pm2 restart tgator-backend

# Остановка
pm2 stop tgator-backend

# Статус
pm2 status

# Мониторинг
pm2 monit
```
