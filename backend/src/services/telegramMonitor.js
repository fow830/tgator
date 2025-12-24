import { getTelegramClient } from './telegramClient.js';
import { prisma } from '../models/index.js';
import { alertService } from './alertService.js';

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
                  // Create alert in database
                  await prisma.alert.create({
                    data: {
                      chatId: chat.chatId,
                      keyword: keyword.keyword,
                      message: message.message,
                      messageId: messageId,
                    },
                  });

                  // Send alert
                  await alertService.sendAlert({
                    chatName: chat.name || chat.chatId,
                    keyword: keyword.keyword,
                    message: message.message,
                    messageId: messageId,
                  });
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
