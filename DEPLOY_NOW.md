# 🚀 ДЕПЛОЙ СЕЙЧАС!

## Архив готов: /tmp/tgator-deploy.tar.gz (162K)

## Выполните эти команды:

### 1. Скопируйте архив на сервер:
```bash
scp /tmp/tgator-deploy.tar.gz root@90.156.229.163:/tmp/
```

### 2. Подключитесь к серверу:
```bash
ssh root@90.156.229.163
```

### 3. На сервере выполните:

```bash
# Создание пользователя (если еще не создан)
adduser --disabled-password --gecos "" tgator 2>/dev/null || true

# Создание директорий
mkdir -p /home/tgator/tgator/logs
cd /home/tgator/tgator

# Распаковка
tar -xzf /tmp/tgator-deploy.tar.gz
rm /tmp/tgator-deploy.tar.gz

# Установка Node.js (если нужно)
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs
fi

# Установка PM2 (если нужно)
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi

# Установка зависимостей
cd backend
npm install --production

cd ../frontend
npm install
npm run build

# Настройка .env (ВАЖНО!)
cd ../backend
nano .env
# Скопируйте все переменные из вашего локального backend/.env

# Инициализация БД
npx prisma migrate deploy

# Запуск PM2
cd ..
pm2 start backend/ecosystem.config.js
pm2 save
pm2 startup

# Настройка Nginx
cp nginx.conf /etc/nginx/sites-available/tgator
ln -sf /etc/nginx/sites-available/tgator /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

# SSL (опционально)
certbot --nginx -d tgator.betaserver.ru
```

### 4. Проверка:
```bash
pm2 logs tgator-backend
pm2 status
```

### 5. Откройте в браузере:
http://tgator.betaserver.ru

## Или используйте готовый скрипт:

После копирования архива на сервер, выполните на сервере:
```bash
bash <(cat << 'SCRIPT'
# ... (скопируйте содержимое из deploy-commands.sh)
SCRIPT
)
```
