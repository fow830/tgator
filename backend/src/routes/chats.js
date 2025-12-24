import express from 'express';
import { prisma } from '../models/index.js';
import { chatManagementService } from '../services/chatManagementService.js';

const router = express.Router();

// GET all chats
router.get('/', async (req, res) => {
  try {
    const chats = await prisma.chat.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(chats);
  } catch (error) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

// POST create chat
router.post('/', async (req, res) => {
  try {
    const { chatId, name, inviteLink } = req.body;

    if (!chatId && !inviteLink) {
      return res.status(400).json({ error: 'chatId or inviteLink is required' });
    }

    // Try to join the chat
    let joinedChat;
    try {
      if (inviteLink) {
        joinedChat = await chatManagementService.joinByInviteLink(inviteLink);
      } else {
        joinedChat = await chatManagementService.joinByUsername(chatId);
      }
    } catch (error) {
      console.error('Error joining chat:', error);
      return res.status(400).json({ 
        error: 'Failed to join chat',
        details: error.message 
      });
    }

    // Save to database
    const chat = await prisma.chat.upsert({
      where: { chatId: joinedChat.chatId },
      update: { name: name || joinedChat.name },
      create: {
        chatId: joinedChat.chatId,
        name: name || joinedChat.name,
      },
    });

    res.json(chat);
  } catch (error) {
    console.error('Error creating chat:', error);
    res.status(500).json({ error: 'Failed to create chat' });
  }
});

// DELETE chat
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get chat info before deleting
    const chat = await prisma.chat.findUnique({
      where: { id },
    });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    // Try to leave the chat
    try {
      await chatManagementService.leaveChat(chat.chatId);
    } catch (error) {
      console.error('Error leaving chat:', error);
      // Continue with deletion even if leave fails
    }

    // Delete from database
    await prisma.chat.delete({
      where: { id },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting chat:', error);
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

export default router;

