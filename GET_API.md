# Получение Telegram API Credentials

## Автоматизированные помощники

### Вариант 1: Bash скрипт
```bash
./get-telegram-api.sh
```

### Вариант 2: Node.js скрипт  
```bash
node auto-get-api.js
```

## Ручной процесс

1. **Откройте сайт**: https://my.telegram.org/auth

2. **Введите номер телефона** (в международном формате, например +1234567890)

3. **Нажмите "Next"**

4. **Проверьте Telegram** - вам придет код подтверждения

5. **Введите код** на сайте

6. **После входа** нажмите **"API development tools"**

7. **Заполните форму создания приложения**:
   - **App title**: Telegram Monitor
   - **Short name**: tgmonitor
   - **Platform**: Other
   - **Description**: Monitor service for Telegram chats

8. **Скопируйте** `api_id` и `api_hash`

9. **Обновите backend/.env**:
   ```bash
   nano backend/.env
   ```
   
   Замените:
   ```
   TELEGRAM_API_ID=ваш_api_id
   TELEGRAM_API_HASH=ваш_api_hash
   ```

## После получения credentials

Авторизуйтесь в Telegram через API:

```bash
# Отправить код
curl -X POST http://localhost:3000/api/auth/send-code

# Ввести код (замените 12345 на код из Telegram)
curl -X POST http://localhost:3000/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"code":"12345"}'
```

## Примечания

- API credentials уникальны для каждого приложения
- Один аккаунт может создать несколько приложений
- Credentials не истекают
- Храните их в безопасности (не коммитьте в git)
