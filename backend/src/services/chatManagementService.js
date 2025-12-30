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
      let chatType = '';
      let joinDate = null;

      if (chat instanceof Api.Channel) {
        chatId = chat.id.toString();
        chatName = chat.title || chat.username || username;
        chatType = chat.megagroup ? 'supergroup' : 'channel';
        
        // Join the channel
        await client.invoke(
          new Api.channels.JoinChannel({
            channel: new Api.InputChannel({
              channelId: chat.id,
              accessHash: chat.accessHash,
            }),
          })
        );
        
        // Get join date
        try {
          const participant = await client.invoke(
            new Api.channels.GetParticipant({
              channel: new Api.InputChannel({
                channelId: chat.id,
                accessHash: chat.accessHash,
              }),
              participant: new Api.InputPeerSelf(),
            })
          );
          
          if (participant.participant && participant.participant.date) {
            joinDate = new Date(participant.participant.date * 1000);
          }
        } catch (error) {
          console.log(`⚠️ Could not get join date: ${error.message}`);
          // Use current date as fallback
          joinDate = new Date();
        }
      } else if (chat instanceof Api.Chat) {
        chatId = chat.id.toString();
        chatName = chat.title || username;
        chatType = 'group';
        // For regular chats, we're already a member, use current date
        joinDate = new Date();
      }

      return {
        chatId: chatId || '',
        name: chatName || username,
        chatType: chatType,
        joinDate: joinDate,
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
      let chatType = '';
      let joinDate = new Date(); // For invite links, join date is now
      
      if (chatId) {
        try {
          const fullChat = await client.getEntity(parseInt(chatId));
          if (fullChat) {
            chatName = fullChat.title || 'Unknown Chat';
            
            // Determine chat type
            if (fullChat instanceof Api.Channel) {
              chatType = fullChat.megagroup ? 'supergroup' : 'channel';
              
              // Try to get join date
              try {
                const participant = await client.invoke(
                  new Api.channels.GetParticipant({
                    channel: new Api.InputChannel({
                      channelId: fullChat.id,
                      accessHash: fullChat.accessHash,
                    }),
                    participant: new Api.InputPeerSelf(),
                  })
                );
                
                if (participant.participant && participant.participant.date) {
                  joinDate = new Date(participant.participant.date * 1000);
                }
              } catch (e) {
                // Use current date if can't get join date
                joinDate = new Date();
              }
            } else if (fullChat instanceof Api.Chat) {
              chatType = 'group';
            }
          }
        } catch (e) {
          // Ignore errors getting chat info
          chatType = 'unknown';
        }
      }

      return {
        chatId: chatId || '',
        name: chatName || 'Unknown Chat',
        chatType: chatType,
        joinDate: joinDate,
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
