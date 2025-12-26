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

      console.log(`📤 Attempting to send alert to channel: ${config.alert.channelId}`);

      // Use user account to send alerts
      const client = await getTelegramClient();
      
      // Parse channel ID (could be username or numeric ID)
      let targetEntity;
      if (config.alert.channelId.startsWith('@')) {
        // Resolve username
        const username = config.alert.channelId.replace('@', '');
        console.log(`🔍 Resolving username: ${username}`);
        const resolved = await client.invoke(
          new Api.contacts.ResolveUsername({
            username: username,
          })
        );
        console.log(`✅ Resolved result:`, resolved.constructor.name);
        if (resolved.chats && resolved.chats.length > 0) {
          targetEntity = resolved.chats[0];
          console.log(`✅ Found channel: ${targetEntity.title || targetEntity.id}`);
        } else {
          console.error(`❌ No chats found for username: ${username}`);
        }
      } else {
        // Try to get entity by ID
        const numericId = parseInt(config.alert.channelId);
        console.log(`🔍 Getting entity by ID: ${numericId}`);
        targetEntity = await client.getEntity(numericId);
        console.log(`✅ Found entity: ${targetEntity.title || targetEntity.id}`);
      }

      if (!targetEntity) {
        throw new Error(`Could not resolve alert channel: ${config.alert.channelId}`);
      }

      // Check if entity is a channel and subscribe if needed
      if (targetEntity instanceof Api.Channel) {
        console.log(`📢 Channel found: ${targetEntity.title || targetEntity.id}`);
        
        // Try to join/subscribe to the channel first
        try {
          console.log(`🔔 Attempting to join channel: ${config.alert.channelId}`);
          await client.invoke(
            new Api.channels.JoinChannel({
              channel: new Api.InputChannel({
                channelId: targetEntity.id,
                accessHash: targetEntity.accessHash,
              }),
            })
          );
          console.log(`✅ Successfully joined channel: ${config.alert.channelId}`);
        } catch (joinError) {
          console.log(`⚠️ Could not join channel (might already be joined or need invite): ${joinError.message}`);
          // Continue anyway - might already be joined
        }
        
        // Get full channel info to check admin rights
        try {
          const fullChannel = await client.getEntity(targetEntity);
          const isAdmin = fullChannel.adminRights && (
            fullChannel.adminRights.postMessages || 
            fullChannel.adminRights.sendMessages
          );
          
          if (isAdmin) {
            console.log(`✅ User is an admin of channel ${config.alert.channelId}`);
            console.log(`   Admin rights - postMessages: ${fullChannel.adminRights.postMessages}, sendMessages: ${fullChannel.adminRights.sendMessages}`);
          } else {
            console.log(`⚠️ User is not an admin of channel ${config.alert.channelId}`);
            console.log(`   Note: Regular users cannot send messages to channels.`);
            console.log(`   Solution: Add the user as an administrator of the channel.`);
          }
        } catch (entityError) {
          console.log(`⚠️ Could not check admin rights: ${entityError.message}`);
        }
      }

      // Send message via user account
      console.log(`📨 Sending message to channel...`);
      await client.sendMessage(targetEntity, {
        message: alertText,
      });
      
      console.log(`✅ Alert sent successfully to channel: ${config.alert.channelId}`);
    } catch (error) {
      if (error.message && error.message.includes('CHAT_WRITE_FORBIDDEN')) {
        console.error(`❌ Error sending alert to channel ${config.alert.channelId}:`);
        console.error(`   User does not have permission to send messages to this channel.`);
        console.error(`   Solution: Add the user as an administrator of the channel ${config.alert.channelId}`);
        console.error(`   Or use a group instead of a channel (groups allow regular users to send messages)`);
      } else {
        console.error(`❌ Error sending alert to channel ${config.alert.channelId}:`, error.message);
      }
      console.error('Full error:', error);
      throw error;
    }
  },

  /**
   * Join/subscribe to alert channel
   */
  async joinAlertChannel() {
    try {
      if (!config.alert.channelId || config.alert.channelId === '@your_channel' || config.alert.channelId.trim() === '') {
        throw new Error('Alert channel not configured');
      }

      console.log(`🔔 Attempting to join channel: ${config.alert.channelId}`);

      const client = await getTelegramClient();
      
      // Parse channel ID (could be username or numeric ID)
      let targetEntity;
      if (config.alert.channelId.startsWith('@')) {
        // Resolve username
        const username = config.alert.channelId.replace('@', '');
        console.log(`🔍 Resolving username: ${username}`);
        const resolved = await client.invoke(
          new Api.contacts.ResolveUsername({
            username: username,
          })
        );
        if (resolved.chats && resolved.chats.length > 0) {
          targetEntity = resolved.chats[0];
          console.log(`✅ Found channel: ${targetEntity.title || targetEntity.id}`);
        }
      } else {
        // Try to get entity by ID
        const numericId = parseInt(config.alert.channelId);
        console.log(`🔍 Getting entity by ID: ${numericId}`);
        targetEntity = await client.getEntity(numericId);
        console.log(`✅ Found entity: ${targetEntity.title || targetEntity.id}`);
      }

      if (!targetEntity) {
        throw new Error(`Could not resolve alert channel: ${config.alert.channelId}`);
      }

      // Join channel
      if (targetEntity instanceof Api.Channel) {
        console.log(`🔔 Joining channel...`);
        try {
          await client.invoke(
            new Api.channels.JoinChannel({
              channel: new Api.InputChannel({
                channelId: targetEntity.id,
                accessHash: targetEntity.accessHash,
              }),
            })
          );
          console.log(`✅ Successfully joined channel: ${config.alert.channelId}`);
        } catch (joinError) {
          const errorMessage = joinError.message || joinError.toString() || '';
          if (errorMessage.includes('USER_ALREADY_PARTICIPANT')) {
            console.log(`ℹ️ User is already a participant of channel ${config.alert.channelId}`);
            // Not an error - user is already in the channel
            return;
          }
          throw joinError;
        }
      } else if (targetEntity instanceof Api.Chat) {
        console.log(`ℹ️ Entity is a regular chat, no need to join`);
        // For regular chats, user is already a member if we can resolve it
      } else {
        throw new Error(`Unsupported entity type: ${targetEntity.constructor.name}`);
      }
    } catch (error) {
      console.error(`❌ Error joining alert channel ${config.alert.channelId}:`, error.message);
      throw error;
    }
  },

  /**
   * Leave alert channel
   */
  async leaveAlertChannel() {
    try {
      if (!config.alert.channelId || config.alert.channelId === '@your_channel' || config.alert.channelId.trim() === '') {
        throw new Error('Alert channel not configured');
      }

      console.log(`🚪 Attempting to leave channel: ${config.alert.channelId}`);

      const client = await getTelegramClient();
      
      // Parse channel ID (could be username or numeric ID)
      let targetEntity;
      if (config.alert.channelId.startsWith('@')) {
        // Resolve username
        const username = config.alert.channelId.replace('@', '');
        console.log(`🔍 Resolving username: ${username}`);
        const resolved = await client.invoke(
          new Api.contacts.ResolveUsername({
            username: username,
          })
        );
        if (resolved.chats && resolved.chats.length > 0) {
          targetEntity = resolved.chats[0];
          console.log(`✅ Found channel: ${targetEntity.title || targetEntity.id}`);
        }
      } else {
        // Try to get entity by ID
        const numericId = parseInt(config.alert.channelId);
        console.log(`🔍 Getting entity by ID: ${numericId}`);
        targetEntity = await client.getEntity(numericId);
        console.log(`✅ Found entity: ${targetEntity.title || targetEntity.id}`);
      }

      if (!targetEntity) {
        throw new Error(`Could not resolve alert channel: ${config.alert.channelId}`);
      }

      // Leave channel
      if (targetEntity instanceof Api.Channel) {
        console.log(`🚪 Attempting to leave channel...`);
        try {
          await client.invoke(
            new Api.channels.LeaveChannel({
              channel: new Api.InputChannel({
                channelId: targetEntity.id,
                accessHash: targetEntity.accessHash,
              }),
            })
          );
          console.log(`✅ Successfully left channel: ${config.alert.channelId}`);
        } catch (leaveError) {
          const errorMessage = leaveError.message || leaveError.toString() || '';
          if (errorMessage.includes('USER_NOT_PARTICIPANT')) {
            console.log(`ℹ️ User is not a participant of channel ${config.alert.channelId}, nothing to leave`);
            // Not an error - user is simply not in the channel
            return;
          }
          throw leaveError;
        }
      } else if (targetEntity instanceof Api.Chat) {
        // Leave regular chat
        console.log(`🚪 Attempting to leave chat...`);
        try {
          await client.invoke(
            new Api.messages.DeleteChatUser({
              chatId: targetEntity.id,
              userId: new Api.InputUserSelf(),
            })
          );
          console.log(`✅ Successfully left chat: ${config.alert.channelId}`);
        } catch (leaveError) {
          const errorMessage = leaveError.message || leaveError.toString() || '';
          if (errorMessage.includes('USER_NOT_PARTICIPANT') || errorMessage.includes('CHAT_ID_INVALID')) {
            console.log(`ℹ️ User is not a participant of chat ${config.alert.channelId}, nothing to leave`);
            // Not an error - user is simply not in the chat
            return;
          }
          throw leaveError;
        }
      } else {
        throw new Error(`Unsupported entity type: ${targetEntity.constructor.name}`);
      }
    } catch (error) {
      console.error(`❌ Error leaving alert channel ${config.alert.channelId}:`, error.message);
      throw error;
    }
  },
};
