import { getTelegramClient, Api } from './telegramClient.js';
import { config } from '../config/env.js';

export const alertService = {
  /**
   * Initialize alert service
   */
  async initialize() {
    console.log('Alert service initialized (using user account)');
  },

  /**
   * Send alert to channel
   */
  async sendAlert({ chatName, keyword, message, messageId }) {
    try {
      const alertText = `🚨 Alert!\n\n` +
        `Chat: ${chatName}\n` +
        `Keyword: ${keyword}\n` +
        `Message: ${message}\n` +
        `Message ID: ${messageId}`;

      // Use user account to send alerts
      const client = await getTelegramClient();
      
      // Parse channel ID (could be username or numeric ID)
      let targetEntity;
      if (config.alert.channelId.startsWith('@')) {
        // Resolve username
        const resolved = await client.invoke(
          new Api.contacts.ResolveUsername({
            username: config.alert.channelId.replace('@', ''),
          })
        );
        if (resolved.chats && resolved.chats.length > 0) {
          targetEntity = resolved.chats[0];
        }
      } else {
        // Try to get entity by ID
        const numericId = parseInt(config.alert.channelId);
        targetEntity = await client.getEntity(numericId);
      }

      if (!targetEntity) {
        throw new Error('Could not resolve alert channel');
      }

      // Send message via user account
      await client.sendMessage(targetEntity, {
        message: alertText,
      });
      
      console.log('Alert sent via user account');
    } catch (error) {
      console.error('Error sending alert:', error);
      throw error;
    }
  },
};
