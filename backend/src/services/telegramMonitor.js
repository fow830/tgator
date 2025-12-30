import { getTelegramClient } from './telegramClient.js';
import { prisma } from '../models/index.js';
import { alertService } from './alertService.js';
import { config } from '../config/env.js';

let isMonitoring = false;
let monitoringInterval = null;
const processedMessages = new Set(); // Track processed messages
const processingMessages = new Set(); // Track messages currently being processed (lock)

export const telegramMonitor = {
  /**
   * Start monitoring chats for keywords
   */
  async start() {
    if (isMonitoring) {
      console.log('Monitoring already started');
      return;
    }

    isMonitoring = true;
    console.log('Starting Telegram monitor...');

    // Start monitoring loop
    monitoringInterval = setInterval(async () => {
      try {
        await this.checkNewMessages();
      } catch (error) {
        console.error('Error in monitoring loop:', error);
      }
    }, 15000); // Check every 15 seconds

    // Also check immediately
    await this.checkNewMessages();
  },

  /**
   * Stop monitoring
   */
  stop() {
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
      monitoringInterval = null;
    }
    isMonitoring = false;
    console.log('Telegram monitor stopped');
  },

  /**
   * Check for new messages in monitored chats
   */
  async checkNewMessages() {
    try {
      const chats = await prisma.chat.findMany();
      const keywords = await prisma.keyword.findMany();

      if (chats.length === 0 || keywords.length === 0) {
        return;
      }

      const client = await getTelegramClient();

      // EXCLUDE ALERT CHANNEL FROM MONITORING - НАВСЕГДА!
      const EXCLUDED_CHAT_IDS = ['3462702293']; // TEEEZZZZT ALERT CHANEL
      const EXCLUDED_CHAT_NAMES = ['TEEEZZZZT ALERT CHANEL', 'ALERT CHANEL'];

      for (const chat of chats) {
        try {
          // Skip alert channel - НАВСЕГДА ИСКЛЮЧАЕМ!
          if (EXCLUDED_CHAT_IDS.includes(chat.chatId)) {
            continue;
          }
          if (EXCLUDED_CHAT_NAMES.some(name => chat.name && chat.name.includes(name))) {
            continue;
          }

          const chatId = parseInt(chat.chatId);
          
          // Get entity
          const entity = await client.getEntity(chatId);
          
          // РЕАЛЬНОЕ ВРЕМЯ: Проверяем только сообщения за последние 5 минут
          // Это гарантирует, что обрабатываются только актуальные сообщения
          const now = new Date();
          const realTimeWindow = 5 * 60 * 1000; // 5 минут в миллисекундах
          let cutoffTime = new Date(now.getTime() - realTimeWindow);
          
          // СТРОГО: Не обрабатываем сообщения до даты вступления
          if (chat.joinDate) {
            const joinDate = new Date(chat.joinDate);
            // Используем более позднюю дату: либо дата вступления, либо 5 минут назад
            if (joinDate > cutoffTime) {
              cutoffTime = joinDate;
              console.log(`📅 Chat ${chat.name || chat.chatId}: Используем дату вступления (новее 5 минут): ${cutoffTime.toLocaleString('ru-RU')}`);
            } else {
              console.log(`⏰ Chat ${chat.name || chat.chatId}: Реальное время - проверяем сообщения за последние 5 минут (с ${cutoffTime.toLocaleString('ru-RU')})`);
            }
          } else {
            console.log(`⏰ Chat ${chat.name || chat.chatId}: Реальное время - проверяем сообщения за последние 5 минут (с ${cutoffTime.toLocaleString('ru-RU')})`);
          }
          
          // Дополнительно: если есть последний алерт, используем его как минимальную дату
          // (чтобы не пропустить сообщения между последним алертом и текущим моментом)
          const lastAlert = await prisma.alert.findFirst({
            where: { chatId: chat.chatId },
            orderBy: { createdAt: 'desc' },
          });
          
          if (lastAlert) {
            const lastAlertTime = new Date(lastAlert.createdAt);
            // Используем более позднюю дату: либо дата вступления/5 минут назад, либо последний алерт
            if (lastAlertTime > cutoffTime) {
              cutoffTime = lastAlertTime;
              console.log(`📊 Chat ${chat.name || chat.chatId}: Используем дату последнего алерта: ${cutoffTime.toLocaleString('ru-RU')}`);
            }
          }
          
          // ФИНАЛЬНАЯ ПРОВЕРКА: Не обрабатываем сообщения старше 5 минут (реальное время)
          const maxAge = new Date(now.getTime() - realTimeWindow);
          if (cutoffTime < maxAge) {
            cutoffTime = maxAge;
            console.log(`⏰ Chat ${chat.name || chat.chatId}: Ограничение реального времени - только сообщения за последние 5 минут`);
          }

          // Get recent messages with full info
          const messages = await client.getMessages(entity, {
            limit: 50, // Increased to have more messages to filter from
          });
          
          // Filter messages by date - only process messages newer than cutoff time
          const recentMessages = messages.filter(msg => {
            if (!msg.date) return false;
            const messageDate = new Date(msg.date * 1000); // Telegram date is in seconds
            return messageDate >= cutoffTime;
          });

          console.log(`📊 Chat ${chat.name || chat.chatId}: Найдено ${recentMessages.length} новых сообщений после ${cutoffTime.toLocaleString('ru-RU')} (из ${messages.length} всего)`);
          
          // Get full message info for each message to include sender data
          const messagesWithSenders = await Promise.all(
            recentMessages.map(async (msg) => {
              try {
                // Get full message with sender info
                const fullMessage = await client.getMessages(entity, {
                  ids: [msg.id],
                });
                return fullMessage[0] || msg;
              } catch (e) {
                // If can't get full message, return original
                return msg;
              }
            })
          );

          for (const message of messagesWithSenders) {
            // Skip if not a text message
            if (!message.message || typeof message.message !== 'string') {
              continue;
            }

            // Double-check message date (safety check)
            if (message.date) {
              const messageDate = new Date(message.date * 1000);
              if (messageDate < cutoffTime) {
                continue; // Skip old messages
              }
            }

            const messageKey = `${chat.chatId}-${message.id}`;
            const messageId = message.id?.toString();
            
            // CRITICAL: Check in DB FIRST (most reliable)
            const existingAlert = await prisma.alert.findFirst({
              where: {
                chatId: chat.chatId,
                messageId: messageId,
              },
            });

            if (existingAlert) {
              // Alert already exists in DB, mark as processed and skip
              processedMessages.add(messageKey);
              continue;
            }

            // Skip if already processed in memory
            if (processedMessages.has(messageKey)) {
              continue;
            }

            // Skip if currently being processed (lock to prevent duplicates)
            if (processingMessages.has(messageKey)) {
              continue;
            }

            // Lock this message for processing
            processingMessages.add(messageKey);

            const messageText = message.message.toLowerCase();

            // Find all matching keywords in this message
            const matchingKeywords = keywords.filter(kw => 
              messageText.includes(kw.keyword.toLowerCase())
            );

            // If no keywords found, unlock and skip
            if (matchingKeywords.length === 0) {
              processingMessages.delete(messageKey);
              processedMessages.add(messageKey);
              continue;
            }

            try {
              // Double-check in DB right before creating (race condition protection)
              const doubleCheck = await prisma.alert.findFirst({
                where: {
                  chatId: chat.chatId,
                  messageId: messageId,
                },
              });

              if (doubleCheck) {
                // Another process already created alert, unlock and skip
                processingMessages.delete(messageKey);
                processedMessages.add(messageKey);
                continue;
              }

              // Create alerts in database for each matching keyword
              const createdAlerts = [];
              for (const keyword of matchingKeywords) {
                try {
                  const alert = await prisma.alert.create({
                    data: {
                      chatId: chat.chatId,
                      keyword: keyword.keyword,
                      message: message.message,
                      messageId: messageId,
                    },
                  });
                  createdAlerts.push(alert);
                  console.log(`✅ Alert saved to database: ${alert.id} - ${keyword.keyword} in ${chat.name || chat.chatId}`);
                } catch (error) {
                  // If unique constraint violation, alert already exists - that's OK
                  if (error.code === 'P2002') {
                    console.log(`ℹ️ Alert already exists for ${keyword.keyword} in ${chat.name || chat.chatId}`);
                  } else {
                    console.error(`⚠️ Failed to save alert for keyword ${keyword.keyword}:`, error.message);
                  }
                }
              }

              // Send ONLY ONE alert to channel with all matching keywords
              if (createdAlerts.length > 0) {
                try {
                  if (config.alert.channelId && config.alert.channelId !== '@your_channel' && config.alert.channelId.trim() !== '') {
                    // Combine all keywords into one string
                    const allKeywords = matchingKeywords.map(kw => kw.keyword).join(', ');
                    
                    await alertService.sendAlert({
                      chatName: chat.name || chat.chatId,
                      keyword: allKeywords,
                      message: message.message,
                      messageId: messageId,
                      chatId: chat.chatId,
                      chatEntity: entity,
                      messageEntity: message,
                    });
                    console.log(`✅ Alert sent to channel: ${config.alert.channelId} (keywords: ${allKeywords})`);
                  } else {
                    console.log('⚠️ Alert channel not configured, alert saved to database only');
                  }
                } catch (alertError) {
                  console.error('⚠️ Failed to send alert to channel, but alert saved to database:', alertError.message);
                  // Alert is already in DB, so we continue
                }
              }

              // Mark as processed after successful creation
              processedMessages.add(messageKey);
            } finally {
              // Always unlock, even if error occurred
              processingMessages.delete(messageKey);
            }
            
            // Limit processed messages cache
            if (processedMessages.size > 1000) {
              const firstKey = processedMessages.values().next().value;
              processedMessages.delete(firstKey);
            }
          }
        } catch (error) {
          console.error(`Error checking messages in chat ${chat.chatId}:`, error);
          // Continue with other chats
        }
      }
    } catch (error) {
      console.error('Error in checkNewMessages:', error);
    }
  },
};
