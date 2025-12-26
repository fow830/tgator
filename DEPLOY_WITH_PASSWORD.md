# 🚀 ДЕПЛОЙ С ПАРОЛЕМ

SSH ключи не подходят, нужен пароль.

## Выполните вручную:

### 1. Скопируйте файлы (потребуется пароль):
```bash
scp /tmp/tgator-deploy.tar.gz root@90.156.229.163:/tmp/
scp server-deploy.sh root@90.156.229.163:/tmp/
scp backend/.env root@90.156.229.163:/tmp/tgator.env
```

### 2. Подключитесь (потребуется пароль):
```bash
ssh root@90.156.229.163
```

### 3. На сервере выполните:
```bash
# Переместите .env
mv /tmp/tgator.env /home/tgator/tgator/backend/.env

# Запустите деплой
bash /tmp/server-deploy.sh

# Перезапустите
pm2 restart tgator-backend
```

## Или используйте sshpass (если установлен):
```bash
# Установите sshpass
brew install hudochenkov/sshpass/sshpass  # macOS

# Деплой с паролем
export SSHPASS='your_password'
sshpass -e scp /tmp/tgator-deploy.tar.gz root@90.156.229.163:/tmp/
sshpass -e scp server-deploy.sh root@90.156.229.163:/tmp/
sshpass -e ssh root@90.156.229.163 "bash /tmp/server-deploy.sh"
```
