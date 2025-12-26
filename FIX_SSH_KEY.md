# 🔧 Исправление SSH ключа

Ключ отправляется, но сервер его не принимает.

## Проверьте на сервере:

### 1. Подключитесь с паролем:
```bash
ssh root@90.156.229.163
```

### 2. Проверьте authorized_keys:
```bash
cat ~/.ssh/authorized_keys
```

Должна быть строка:
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJ2YLFjqXJQwsUfji9QFJrINpvfqCiwFILQMq64XmpC3 tgator@betaserver.ru
```

### 3. Установите правильные права:
```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
chown root:root ~/.ssh
chown root:root ~/.ssh/authorized_keys
```

### 4. Проверьте формат файла:
```bash
# Убедитесь что нет лишних пробелов или переносов строк
cat ~/.ssh/authorized_keys | od -c
```

### 5. Если ключа нет, добавьте заново:
```bash
echo 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJ2YLFjqXJQwsUfji9QFJrINpvfqCiwFILQMq64XmpC3 tgator@betaserver.ru' >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### 6. Проверьте логи SSH:
```bash
tail -f /var/log/auth.log
# Или
journalctl -u ssh -f
```

### 7. Проверьте конфигурацию SSH:
```bash
grep -E "PubkeyAuthentication|AuthorizedKeysFile" /etc/ssh/sshd_config
```

Должно быть:
```
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
```

Если изменили, перезапустите SSH:
```bash
systemctl restart sshd
```

## После исправления:

Попробуйте подключиться:
```bash
ssh -i ~/.ssh/id_ed25519_tgator root@90.156.229.163
```

Если работает, выполните деплой:
```bash
./deploy-with-key.sh
```
