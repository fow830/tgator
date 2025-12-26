import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENV_FILE = path.join(__dirname, '../../.env');

const router = express.Router();

// POST save Telegram credentials
router.post('/save-credentials', async (req, res) => {
  try {
    const { phone, apiId, apiHash } = req.body;
    
    if (!phone || !apiId || !apiHash) {
      return res.status(400).json({ error: 'phone, apiId, and apiHash are required' });
    }

    // Read existing .env file
    let envContent = '';
    if (fs.existsSync(ENV_FILE)) {
      envContent = fs.readFileSync(ENV_FILE, 'utf8');
    } else {
      // Create default .env if doesn't exist
      envContent = `# Telegram API Configuration
TELEGRAM_API_ID=
TELEGRAM_API_HASH=
TELEGRAM_PHONE=
ALERT_CHANNEL_ID=
DATABASE_URL=file:./prisma/dev.db
PORT=3000
`;
    }
    
    // Update or add credentials
    const lines = envContent.split('\n');
    const updatedLines = lines.map(line => {
      if (line.startsWith('TELEGRAM_API_ID=')) {
        return `TELEGRAM_API_ID=${apiId}`;
      }
      if (line.startsWith('TELEGRAM_API_HASH=')) {
        return `TELEGRAM_API_HASH=${apiHash}`;
      }
      if (line.startsWith('TELEGRAM_PHONE=')) {
        return `TELEGRAM_PHONE=${phone}`;
      }
      return line;
    });
    
    // Check if we need to add missing lines
    let hasApiId = updatedLines.some(line => line.startsWith('TELEGRAM_API_ID='));
    let hasApiHash = updatedLines.some(line => line.startsWith('TELEGRAM_API_HASH='));
    let hasPhone = updatedLines.some(line => line.startsWith('TELEGRAM_PHONE='));
    
    if (!hasApiId) {
      updatedLines.push(`TELEGRAM_API_ID=${apiId}`);
    }
    if (!hasApiHash) {
      updatedLines.push(`TELEGRAM_API_HASH=${apiHash}`);
    }
    if (!hasPhone) {
      updatedLines.push(`TELEGRAM_PHONE=${phone}`);
    }
    
    // Write updated .env
    fs.writeFileSync(ENV_FILE, updatedLines.join('\n'));
    
    res.json({ 
      success: true, 
      message: 'Credentials saved successfully' 
    });
  } catch (error) {
    console.error('Error saving credentials:', error);
    res.status(500).json({ error: error.message || 'Failed to save credentials' });
  }
});

// GET current credentials (without sensitive data)
router.get('/credentials', async (req, res) => {
  try {
    if (!fs.existsSync(ENV_FILE)) {
      return res.json({ 
        phone: '',
        apiId: '',
        apiHash: '',
        alertChannelId: '',
        saved: false
      });
    }
    
    const envContent = fs.readFileSync(ENV_FILE, 'utf8');
    const phone = envContent.match(/^TELEGRAM_PHONE=(.+)$/m)?.[1] || '';
    const apiId = envContent.match(/^TELEGRAM_API_ID=(.+)$/m)?.[1] || '';
    const apiHash = envContent.match(/^TELEGRAM_API_HASH=(.+)$/m)?.[1] || '';
    const alertChannelId = envContent.match(/^ALERT_CHANNEL_ID=(.+)$/m)?.[1] || '';
    
    res.json({
      phone: phone || '',
      apiId: apiId || '',
      apiHash: apiHash || '',
      alertChannelId: alertChannelId || '',
      saved: !!(phone && apiId && apiHash)
    });
  } catch (error) {
    console.error('Error reading credentials:', error);
    res.status(500).json({ error: error.message || 'Failed to read credentials' });
  }
});

// POST save alert channel
router.post('/save-alert-channel', async (req, res) => {
  try {
    const { alertChannelId } = req.body;
    
    if (!alertChannelId) {
      return res.status(400).json({ error: 'alertChannelId is required' });
    }

    // Read existing .env file
    let envContent = '';
    if (fs.existsSync(ENV_FILE)) {
      envContent = fs.readFileSync(ENV_FILE, 'utf8');
    } else {
      envContent = `# Telegram API Configuration
TELEGRAM_API_ID=
TELEGRAM_API_HASH=
TELEGRAM_PHONE=
ALERT_CHANNEL_ID=
DATABASE_URL=file:./prisma/dev.db
PORT=3000
`;
    }
    
    // Update or add alert channel
    const lines = envContent.split('\n');
    const updatedLines = lines.map(line => {
      if (line.startsWith('ALERT_CHANNEL_ID=')) {
        return `ALERT_CHANNEL_ID=${alertChannelId}`;
      }
      return line;
    });
    
    // Check if we need to add missing line
    let hasAlertChannel = updatedLines.some(line => line.startsWith('ALERT_CHANNEL_ID='));
    if (!hasAlertChannel) {
      updatedLines.push(`ALERT_CHANNEL_ID=${alertChannelId}`);
    }
    
    // Write updated .env
    fs.writeFileSync(ENV_FILE, updatedLines.join('\n'));
    
    // Join the channel immediately after saving
    try {
      const { getTelegramClient, Api } = await import('../services/telegramClient.js');
      
      console.log(`🔔 Attempting to join channel after saving: ${alertChannelId}`);
      
      const client = await getTelegramClient();
      
      // Resolve channel
      let targetEntity;
      if (alertChannelId.startsWith('@')) {
        const username = alertChannelId.replace('@', '');
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
        const numericId = parseInt(alertChannelId);
        console.log(`🔍 Getting entity by ID: ${numericId}`);
        targetEntity = await client.getEntity(numericId);
        console.log(`✅ Found entity: ${targetEntity.title || targetEntity.id}`);
      }
      
      if (targetEntity && targetEntity instanceof Api.Channel) {
        console.log(`🔔 Joining channel...`);
        await client.invoke(
          new Api.channels.JoinChannel({
            channel: new Api.InputChannel({
              channelId: targetEntity.id,
              accessHash: targetEntity.accessHash,
            }),
          })
        );
        console.log(`✅ Successfully joined channel: ${alertChannelId}`);
      } else if (targetEntity && targetEntity instanceof Api.Chat) {
        console.log(`ℹ️ Entity is a regular chat, no need to join`);
      } else {
        console.log(`⚠️ Could not resolve channel entity`);
      }
    } catch (joinError) {
      const errorMessage = joinError.message || joinError.toString() || '';
      if (errorMessage.includes('USER_ALREADY_PARTICIPANT')) {
        console.log(`ℹ️ User is already a participant of channel ${alertChannelId}`);
      } else {
        console.error('⚠️ Warning: Could not join channel after saving:', joinError.message);
        // Don't fail the save operation if join fails
        // User can manually join or we'll try again when sending alerts
      }
    }
    
    res.json({ 
      success: true, 
      message: 'Alert channel saved successfully' 
    });
  } catch (error) {
    console.error('Error saving alert channel:', error);
    res.status(500).json({ error: error.message || 'Failed to save alert channel' });
  }
});

// GET current alert channel
router.get('/alert-channel', async (req, res) => {
  try {
    if (!fs.existsSync(ENV_FILE)) {
      return res.json({ 
        alertChannelId: '',
        saved: false
      });
    }
    
    const envContent = fs.readFileSync(ENV_FILE, 'utf8');
    const alertChannelId = envContent.match(/^ALERT_CHANNEL_ID=(.+)$/m)?.[1] || '';
    
    res.json({
      alertChannelId: alertChannelId || '',
      saved: !!alertChannelId && alertChannelId !== '@your_channel'
    });
  } catch (error) {
    console.error('Error reading alert channel:', error);
    res.status(500).json({ error: error.message || 'Failed to read alert channel' });
  }
});

// POST leave alert channel
router.post('/leave-alert-channel', async (req, res) => {
  try {
    const { alertService } = await import('../services/alertService.js');
    
    // Leave the channel
    await alertService.leaveAlertChannel();
    
    // Clear alert channel from .env file
    if (fs.existsSync(ENV_FILE)) {
      let envContent = fs.readFileSync(ENV_FILE, 'utf8');
      const lines = envContent.split('\n');
      const updatedLines = lines.map(line => {
        if (line.startsWith('ALERT_CHANNEL_ID=')) {
          return 'ALERT_CHANNEL_ID=';
        }
        return line;
      });
      fs.writeFileSync(ENV_FILE, updatedLines.join('\n'));
      console.log('Alert channel cleared from .env file');
    }
    
    res.json({
      success: true,
      message: 'Successfully left alert channel and cleared configuration'
    });
  } catch (error) {
    console.error('Error leaving alert channel:', error);
    res.status(500).json({ error: error.message || 'Failed to leave alert channel' });
  }
});

export default router;

