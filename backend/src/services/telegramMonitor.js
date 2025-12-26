import { getTelegramClient } from './telegramClient.js';
import { prisma } from '../models/index.js';
import { alertService } from './alertService.js';
import { config } from '../config/env.js';

let isMonitoring = false;
let monitoringInterval = null;
const processedMessages = new Set(); // Track processed messages

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
    }, 10000); // Check every 10 seconds

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

      for (const chat of chats) {
        try {
          const chatId = parseInt(chat.chatId);
          
          // Get entity
          const entity = await client.getEntity(chatId);
          
          // Get recent messages
          const messages = await client.getMessages(entity, {
            limit: 20,
          });

          for (const message of messages) {
            // Skip if not a text message
            if (!message.message || typeof message.message !== 'string') {
              continue;
            }

            const messageKey = `${chat.chatId}-${message.id}`;
            
            // Skip if already processed
            if (processedMessages.has(messageKey)) {
              continue;
            }

            processedMessages.add(messageKey);
            
            // Limit processed messages cache
            if (processedMessages.size > 1000) {
              const firstKey = processedMessages.values().next().value;
              processedMessages.delete(firstKey);
            }

            const messageText = message.message.toLowerCase();
            const messageId = message.id?.toString();

            // Check if message contains any keyword
            for (const keyword of keywords) {
              if (messageText.includes(keyword.keyword.toLowerCase())) {
                // Check if we already created an alert for this message
                const existingAlert = await prisma.alert.findFirst({
                  where: {
                    chatId: chat.chatId,
                    messageId: messageId,
                    keyword: keyword.keyword,
                  },
                });

                if (!existingAlert) {
                  // Create alert in database FIRST (always save to DB)
                  const alert = await prisma.alert.create({
                    data: {
                      chatId: chat.chatId,
                      keyword: keyword.keyword,
                      message: message.message,
                      messageId: messageId,
                    },
                  });

                  console.log(`✅ Alert saved to database: ${alert.id} - ${keyword.keyword} in ${chat.name || chat.chatId}`);

                  // Send alert to channel (if configured)
                  // Don't fail if channel send fails - alert is already in DB
                  try {
                    if (config.alert.channelId && config.alert.channelId !== '@your_channel' && config.alert.channelId.trim() !== '') {
                      await alertService.sendAlert({
                        chatName: chat.name || chat.chatId,
                        keyword: keyword.keyword,
                        message: message.message,
                        messageId: messageId,
                      });
                      console.log(`✅ Alert sent to channel: ${config.alert.channelId}`);
                    } else {
                      console.log('⚠️ Alert channel not configured, alert saved to database only');
                    }
                  } catch (alertError) {
                    console.error('⚠️ Failed to send alert to channel, but alert saved to database:', alertError.message);
                    // Alert is already in DB, so we continue
                  }
                }
              }
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
