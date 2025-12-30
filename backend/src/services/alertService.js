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
  async sendAlert({ chatName, keyword, message, messageId, chatId, chatEntity, messageEntity }) {
    try {
      // Use user account to send alerts
      const client = await getTelegramClient();
      
      // Get sender information
      let senderUsername = '-';
      let senderPhone = '-';
      
      if (messageEntity) {
        try {
          let sender = null;
          let senderId = null;
          
          // Try multiple ways to get sender ID
          if (messageEntity.fromId) {
            if (messageEntity.fromId instanceof Api.PeerUser) {
              senderId = messageEntity.fromId.userId;
            } else if (messageEntity.fromId.userId) {
              senderId = messageEntity.fromId.userId;
            } else if (typeof messageEntity.fromId === 'number' || typeof messageEntity.fromId === 'bigint') {
              senderId = messageEntity.fromId;
            }
          } else if (messageEntity.senderId) {
            if (messageEntity.senderId instanceof Api.PeerUser) {
              senderId = messageEntity.senderId.userId;
            } else if (messageEntity.senderId.userId) {
              senderId = messageEntity.senderId.userId;
            } else if (typeof messageEntity.senderId === 'number' || typeof messageEntity.senderId === 'bigint') {
              senderId = messageEntity.senderId;
            }
          } else if (messageEntity.sender) {
            // Direct sender object
            sender = messageEntity.sender;
          } else if (messageEntity.peerId && messageEntity.peerId instanceof Api.PeerUser) {
            senderId = messageEntity.peerId.userId;
          }
          
          // If we have senderId, get the user entity with FULL information
          if (senderId && !sender) {
            try {
              // First try to get full user info
              try {
                const fullUser = await client.invoke(
                  new Api.users.GetFullUser({
                    id: new Api.InputUser({
                      userId: BigInt(senderId),
                      accessHash: 0n, // Will be resolved by Telegram
                    }),
                  })
                );
                
                if (fullUser && fullUser.users && fullUser.users.length > 0) {
                  sender = fullUser.users[0];
                  // Full user info might have phone in fullUser.fullUser
                  if (fullUser.fullUser && fullUser.fullUser.phone) {
                    sender.phone = fullUser.fullUser.phone;
                  }
                }
              } catch (fullUserError) {
                // If getFullUser fails, try regular getEntity
                console.log(`⚠️ Could not get full user info, trying regular entity: ${fullUserError.message}`);
                sender = await client.getEntity(senderId);
              }
            } catch (entityError) {
              console.log(`⚠️ Could not get entity for senderId ${senderId}: ${entityError.message}`);
            }
          }
          
          // Extract information from sender - try multiple sources
          if (sender) {
            if (sender instanceof Api.User) {
              // Get username
              senderUsername = sender.username ? `@${sender.username}` : '-';
              
              // Get phone - try multiple sources
              if (sender.phone) {
                senderPhone = sender.phone;
              } else if (sender.phoneNumber) {
                senderPhone = sender.phoneNumber;
              } else {
                // Try to get from full user info if available
                try {
                  if (senderId) {
                    const fullUser = await client.invoke(
                      new Api.users.GetFullUser({
                        id: new Api.InputUser({
                          userId: BigInt(senderId),
                          accessHash: sender.accessHash || 0n,
                        }),
                      })
                    );
                    if (fullUser && fullUser.fullUser && fullUser.fullUser.phone) {
                      senderPhone = fullUser.fullUser.phone;
                    }
                  }
                } catch (phoneError) {
                  // Phone not available or can't access
                  senderPhone = '-';
                }
              }
              
              // If still no phone, try alternative method
              if (senderPhone === '-' && senderId) {
                try {
                  // Get user by ID and check all fields
                  const userEntity = await client.getEntity(senderId);
                  if (userEntity && userEntity.phone) {
                    senderPhone = userEntity.phone;
                  }
                } catch (e) {
                  // Ignore
                }
              }
              
              // If still no username, try to get from first/last name
              if (senderUsername === '-' && (sender.firstName || sender.lastName)) {
                const name = `${sender.firstName || ''} ${sender.lastName || ''}`.trim();
                if (name) {
                  senderUsername = name;
                }
              }
            } else if (sender instanceof Api.Channel) {
              // Channel post - no sender
              senderUsername = '-';
              senderPhone = '-';
            } else {
              // Try to get username/phone from any object
              senderUsername = sender.username ? `@${sender.username}` : (sender.firstName ? `${sender.firstName} ${sender.lastName || ''}`.trim() : '-');
              senderPhone = sender.phone || sender.phoneNumber || '-';
            }
          } else {
            console.log(`⚠️ Could not determine sender from message entity`);
            console.log(`   Message entity keys: ${Object.keys(messageEntity).join(', ')}`);
            if (messageEntity.fromId) {
              console.log(`   fromId type: ${messageEntity.fromId.constructor?.name || typeof messageEntity.fromId}`);
            }
          }
        } catch (senderError) {
          console.log(`⚠️ Could not get sender info: ${senderError.message}`);
          console.log(`   Error stack: ${senderError.stack}`);
        }
      } else {
        console.log(`⚠️ messageEntity is not provided`);
      }

      // Generate message link
      let messageLink = '-';
      try {
        let chatUsername = null;
        
        // Get chat username if available
        if (chatEntity) {
          if (chatEntity instanceof Api.Channel) {
            chatUsername = chatEntity.username;
          }
        } else if (chatId) {
          try {
            const entity = await client.getEntity(parseInt(chatId));
            if (entity instanceof Api.Channel && entity.username) {
              chatUsername = entity.username;
            }
          } catch (e) {
            // Ignore
          }
        }
        
        if (chatUsername) {
          // Public channel/group - use username
          messageLink = `https://t.me/${chatUsername}/${messageId}`;
        } else if (chatId) {
          // Private channel/group - use chat ID
          // Format: https://t.me/c/CHAT_ID/MESSAGE_ID
          // For channels, chatId needs to be converted: -100 + chatId
          const numericChatId = parseInt(chatId);
          // For supergroups/channels, ID format is -100XXXXXXXXXX
          // We need to remove -100 prefix for the link
          let channelId = numericChatId;
          if (numericChatId < 0) {
            channelId = Math.abs(numericChatId);
          }
          // If it's a channel ID (starts with 100), remove the 100 prefix
          if (channelId.toString().length > 10 && channelId.toString().startsWith('100')) {
            channelId = parseInt(channelId.toString().substring(3));
          }
          messageLink = `https://t.me/c/${channelId}/${messageId}`;
        }
      } catch (linkError) {
        console.log(`⚠️ Could not generate message link: ${linkError.message}`);
      }

      // Find the line containing the keyword
      let messageLine = message;
      if (keyword && message) {
        const lines = message.split('\n');
        const keywordLower = keyword.toLowerCase();
        // Find first line that contains any of the keywords (keyword might be comma-separated)
        const keywords = keyword.split(',').map(k => k.trim().toLowerCase());
        for (const line of lines) {
          const lineLower = line.toLowerCase();
          if (keywords.some(kw => lineLower.includes(kw))) {
            messageLine = line.trim();
            break;
          }
        }
        // If no line found, use first line or full message (truncated)
        if (messageLine === message && message.length > 100) {
          messageLine = message.substring(0, 100) + '...';
        }
      }

      // Format chat name as link (HTML format for Telegram)
      const chatNameLink = messageLink !== '-' 
        ? `<a href="${messageLink}">${chatName}</a>`
        : chatName;

      // Format alert text with new format
      const alertText = `Чат: ${chatNameLink}\n` +
        `Ключ: ${keyword}\n` +
        `Отправитель: ${senderUsername}\n` +
        `Телефон: ${senderPhone}\n` +
        `➖➖➖➖➖\n` +
        `${messageLine}\n` +
        `➖➖➖➖➖`;

      console.log(`📤 Attempting to send alert to channel: ${config.alert.channelId}`);
      
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

      // Send message via user account with HTML parsing, disable link preview
      console.log(`📨 Sending message to channel...`);
      await client.sendMessage(targetEntity, {
        message: alertText,
        parseMode: 'html', // Enable HTML parsing for links
        linkPreview: false, // Disable link preview to avoid forwarded message appearance
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
