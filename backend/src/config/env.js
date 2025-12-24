import dotenv from 'dotenv';

dotenv.config();

export const config = {
  telegram: {
    apiId: parseInt(process.env.TELEGRAM_API_ID || '0'),
    apiHash: process.env.TELEGRAM_API_HASH || '',
    phone: process.env.TELEGRAM_PHONE || '',
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  },
  alert: {
    channelId: process.env.ALERT_CHANNEL_ID || '',
  },
  server: {
    port: parseInt(process.env.PORT || '3000'),
  },
  database: {
    url: process.env.DATABASE_URL || '',
  },
};

