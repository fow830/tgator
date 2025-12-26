# Быстрый деплой

## Вариант 1: Автоматический деплой (рекомендуется)

```bash
./deploy.sh
```

## Вариант 2: Ручной деплой

### 1. Подключитесь к серверу
```bash
ssh root@90.156.229.163
```

### 2. Выполните на сервере:

```bash
# Установка Node.js и PM2 (если еще не установлены)
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs
npm install -g pm2

# Создание пользователя
adduser tgator
cd /home/tgator

# Клонирование проекта (замените на ваш репозиторий)
git clone <your-repo-url> tgator
cd tgator

# Установка зависимостей
cd backend && npm install --production
cd ../frontend && npm install && npm run build

# Настройка .env
cd ../backend
nano .env
# Заполните все переменные из вашего локального .env

# Инициализация БД
npx prisma migrate deploy

# Запуск через PM2
cd ..
pm2 start backend/ecosystem.config.js
pm2 save
pm2 startup

# Настройка Nginx
cp nginx.conf /etc/nginx/sites-available/tgator
ln -s /etc/nginx/sites-available/tgator /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

# SSL (опционально)
apt install -y certbot python3-certbot-nginx
certbot --nginx -d tgator.betaserver.ru
```

### 3. Проверка
- Откройте: http://tgator.betaserver.ru
- Логи: `pm2 logs tgator-backend`
- Статус: `pm2 status`

## Важные файлы на сервере

- **Backend .env**: `/home/tgator/tgator/backend/.env`
- **PM2 конфиг**: `/home/tgator/tgator/backend/ecosystem.config.js`
- **Nginx конфиг**: `/etc/nginx/sites-available/tgator`
- **Логи**: `/home/tgator/tgator/logs/`

## Обновление

```bash
ssh root@90.156.229.163
cd /home/tgator/tgator
git pull
cd backend && npm install --production
cd ../frontend && npm install && npm run build
pm2 restart tgator-backend
```
