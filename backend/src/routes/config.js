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
        saved: false
      });
    }
    
    const envContent = fs.readFileSync(ENV_FILE, 'utf8');
    const phone = envContent.match(/^TELEGRAM_PHONE=(.+)$/m)?.[1] || '';
    const apiId = envContent.match(/^TELEGRAM_API_ID=(.+)$/m)?.[1] || '';
    const apiHash = envContent.match(/^TELEGRAM_API_HASH=(.+)$/m)?.[1] || '';
    
    res.json({
      phone: phone || '',
      apiId: apiId || '',
      apiHash: apiHash || '',
      saved: !!(phone && apiId && apiHash)
    });
  } catch (error) {
    console.error('Error reading credentials:', error);
    res.status(500).json({ error: error.message || 'Failed to read credentials' });
  }
});

export default router;

