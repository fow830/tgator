import { getTelegramClient } from './telegramClient.js';
import { Api } from './telegramClient.js';

export const chatManagementService = {
  /**
   * Join a chat by username (public channel/group)
   */
  async joinByUsername(username) {
    try {
      const client = await getTelegramClient();
      
      // Remove @ if present
      const cleanUsername = username.replace('@', '');
      
      // Resolve username to get chat info
      const resolved = await client.invoke(
        new Api.contacts.ResolveUsername({
          username: cleanUsername,
        })
      );

      if (!resolved.chats || resolved.chats.length === 0) {
        throw new Error(`Chat with username ${username} not found`);
      }

      const chat = resolved.chats[0];
      let chatId = '';
      let chatName = '';

      if (chat instanceof Api.Channel) {
        chatId = chat.id.toString();
        chatName = chat.title || chat.username || username;
        
        // Join the channel
        await client.invoke(
          new Api.channels.JoinChannel({
            channel: new Api.InputChannel({
              channelId: chat.id,
              accessHash: chat.accessHash,
            }),
          })
        );
      } else if (chat instanceof Api.Chat) {
        chatId = chat.id.toString();
        chatName = chat.title || username;
        // For regular chats, user is already a member if we can resolve it
      }

      return {
        chatId: chatId || '',
        name: chatName || username,
      };
    } catch (error) {
      console.error('Error joining chat by username:', error);
      throw new Error(`Failed to join chat: ${error.message}`);
    }
  },

  /**
   * Join a chat by invite link
   */
  async joinByInviteLink(inviteLink) {
    try {
      const client = await getTelegramClient();
      
      // Extract hash from invite link
      // Format: https://t.me/joinchat/HASH or https://t.me/+HASH
      const hashMatch = inviteLink.match(/(?:joinchat\/|\+)([A-Za-z0-9_-]+)/);
      if (!hashMatch) {
        throw new Error('Invalid invite link format');
      }

      const hash = hashMatch[1];

      // Import chat invite
      const result = await client.invoke(
        new Api.messages.ImportChatInvite({
          hash: hash,
        })
      );

      // Get chat info from updates
      const updates = result.updates || [];
      let chatId = '';
      let chatName = '';

      for (const update of updates) {
        if (update instanceof Api.UpdateNewMessage) {
          const message = update.message;
          if (message && message.peerId) {
            if (message.peerId instanceof Api.PeerChannel) {
              chatId = message.peerId.channelId.toString();
            } else if (message.peerId instanceof Api.PeerChat) {
              chatId = message.peerId.chatId.toString();
            }
          }
        } else if (update instanceof Api.UpdateChat) {
          chatId = update.chatId.toString();
        }
      }

      // Try to get chat info
      if (chatId) {
        try {
          const fullChat = await client.getEntity(chatId);
          if (fullChat) {
            chatName = fullChat.title || 'Unknown Chat';
          }
        } catch (e) {
          // Ignore errors getting chat info
        }
      }

      return {
        chatId: chatId || '',
        name: chatName || 'Unknown Chat',
      };
    } catch (error) {
      console.error('Error joining chat by invite link:', error);
      throw new Error(`Failed to join chat: ${error.message}`);
    }
  },

  /**
   * Leave a chat
   */
  async leaveChat(chatId) {
    try {
      const client = await getTelegramClient();
      
      // Parse chatId (could be string or number)
      const numericId = typeof chatId === 'string' ? parseInt(chatId) : chatId;
      
      // Get entity to determine type
      try {
        const entity = await client.getEntity(numericId);
        
        if (entity instanceof Api.Channel) {
          // Leave channel
          await client.invoke(
            new Api.channels.LeaveChannel({
              channel: new Api.InputChannel({
                channelId: entity.id,
                accessHash: entity.accessHash,
              }),
            })
          );
        } else if (entity instanceof Api.Chat) {
          // Leave regular chat
          await client.invoke(
            new Api.messages.DeleteChatUser({
              chatId: numericId,
              userId: new Api.InputUserSelf(),
            })
          );
        }
      } catch (error) {
        // If getEntity fails, try direct approach
        await client.invoke(
          new Api.channels.LeaveChannel({
            channel: new Api.InputChannel({
              channelId: Math.abs(numericId),
              accessHash: 0n,
            }),
          })
        );
      }

      return true;
    } catch (error) {
      console.error('Error leaving chat:', error);
      throw new Error(`Failed to leave chat: ${error.message}`);
    }
  },

  /**
   * Get chat information
   */
  async getChatInfo(chatId) {
    try {
      const client = await getTelegramClient();
      
      const numericId = typeof chatId === 'string' ? parseInt(chatId) : chatId;
      
      const entity = await client.getEntity(numericId);
      return entity;
    } catch (error) {
      console.error('Error getting chat info:', error);
      return null;
    }
  },
};
