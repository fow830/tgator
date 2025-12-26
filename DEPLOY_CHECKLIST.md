# Чеклист деплоя

## Перед деплоем

- [ ] Все изменения закоммичены в git
- [ ] Локально все работает
- [ ] Production build создан (`npm run build`)
- [ ] .env файл готов (без реальных паролей в git!)

## На сервере

- [ ] Node.js 18+ установлен
- [ ] PM2 установлен
- [ ] Nginx установлен
- [ ] Пользователь `tgator` создан
- [ ] Проект скопирован в `/home/tgator/tgator`
- [ ] .env файл настроен в `backend/.env`
- [ ] База данных инициализирована (`npx prisma migrate deploy`)
- [ ] PM2 запущен (`pm2 start backend/ecosystem.config.js`)
- [ ] Nginx настроен и перезагружен
- [ ] Домен указывает на сервер (DNS)
- [ ] SSL сертификат установлен (опционально)

## После деплоя

- [ ] Сайт открывается: http://tgator.betaserver.ru
- [ ] Логин работает (admin/gramgram)
- [ ] API отвечает
- [ ] Логи PM2 проверены (`pm2 logs`)
- [ ] Мониторинг работает (`pm2 monit`)

## Команды для проверки

```bash
# Статус PM2
pm2 status

# Логи
pm2 logs tgator-backend

# Мониторинг
pm2 monit

# Перезапуск
pm2 restart tgator-backend

# Nginx статус
systemctl status nginx

# Nginx логи
tail -f /var/log/nginx/tgator-error.log
```
