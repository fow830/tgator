import express from 'express';
import { webSendCode, webVerifyCode, webStartQR, webCheckQRStatus } from '../services/webAuthService.js';

const router = express.Router();

// POST web send code (with custom credentials)
router.post('/web-send-code', async (req, res) => {
  try {
    const { phone, apiId, apiHash } = req.body;
    
    if (!phone || !apiId || !apiHash) {
      return res.status(400).json({ error: 'phone, apiId, and apiHash are required' });
    }

    const result = await webSendCode(phone, apiId, apiHash);
    res.json({ 
      success: true, 
      phoneCodeHash: result.phoneCodeHash,
      message: 'Code sent to Telegram'
    });
  } catch (error) {
    console.error('Error sending code:', error);
    res.status(500).json({ error: error.message || 'Failed to send code' });
  }
});

// POST web verify code (with custom credentials)
router.post('/web-verify', async (req, res) => {
  try {
    const { phone, apiId, apiHash, code, phoneCodeHash } = req.body;
    
    if (!phone || !apiId || !apiHash || !code || !phoneCodeHash) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const result = await webVerifyCode(phone, apiId, apiHash, code, phoneCodeHash);
    res.json({ 
      success: true, 
      message: 'Authorization successful',
      session: result.session
    });
  } catch (error) {
    console.error('Error verifying code:', error);
    res.status(500).json({ error: error.message || 'Failed to verify code' });
  }
});

// POST start QR code authentication
router.post('/web-qr-start', async (req, res) => {
  try {
    const { apiId, apiHash } = req.body;
    
    if (!apiId || !apiHash) {
      return res.status(400).json({ error: 'apiId and apiHash are required' });
    }

    const result = await webStartQR(apiId, apiHash);
    res.json({ 
      success: true, 
      sessionKey: result.sessionKey,
      qrCode: result.qrCode,
      message: 'QR code generated. Scan with Telegram app.'
    });
  } catch (error) {
    console.error('Error starting QR auth:', error);
    res.status(500).json({ error: error.message || 'Failed to start QR authentication' });
  }
});

// GET check QR authentication status
router.get('/web-qr-status/:sessionKey', async (req, res) => {
  try {
    const { sessionKey } = req.params;
    
    if (!sessionKey) {
      return res.status(400).json({ error: 'sessionKey is required' });
    }

    const status = await webCheckQRStatus(sessionKey);
    res.json(status);
  } catch (error) {
    console.error('Error checking QR status:', error);
    res.status(500).json({ error: error.message || 'Failed to check QR status' });
  }
});

// GET current user info
router.get('/user-info', async (req, res) => {
  try {
    const { getTelegramClient } = await import('../services/telegramClient.js');
    const client = await getTelegramClient();
    const me = await client.getMe();
    
    res.json({
      success: true,
      authorized: true,
      user: {
        id: me.id.toString(),
        username: me.username || null,
        firstName: me.firstName || null,
        lastName: me.lastName || null,
        phone: me.phone || null,
      },
    });
  } catch (error) {
    // Log full error for debugging
    console.error('[user-info] Full error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    
    // If client is not authorized, return success: false but don't throw 500
    const errorMessage = error.message || String(error);
    if (errorMessage.includes('not authorized') || 
        errorMessage.includes('Please authorize') ||
        errorMessage.includes('checkAuthorization')) {
      console.log('[user-info] Telegram client not authorized yet');
      return res.json({ 
        success: false,
        authorized: false,
        message: 'Telegram client not authorized. Please authorize first.',
      });
    }
    
    // Check for connection errors or missing config
    if (errorMessage.includes('API_ID') || 
        errorMessage.includes('API_HASH') ||
        errorMessage.includes('apiId') ||
        errorMessage.includes('apiHash') ||
        errorMessage.includes('config') ||
        errorMessage.includes('undefined')) {
      console.log('[user-info] Configuration error:', errorMessage);
      return res.json({ 
        success: false,
        authorized: false,
        message: 'Telegram API credentials not configured. Please configure API ID and API Hash first.',
      });
    }
    
    // For other errors, return 200 with error info (not 500) to avoid breaking frontend
    console.error('[user-info] Unexpected error getting user info:', errorMessage);
    return res.json({ 
      success: false,
      authorized: false,
      error: errorMessage || 'Failed to get user info',
      message: 'Unable to get Telegram user info. Please check server logs.',
    });
  }
});

// POST logout (delete session)
router.post('/logout', async (req, res) => {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const { resetClient } = await import('../services/telegramClient.js');
    
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const SESSION_FILE = path.join(__dirname, '../../.session');
    
    // Disconnect and reset client
    const { getTelegramClient } = await import('../services/telegramClient.js');
    try {
      const client = await getTelegramClient();
      await client.disconnect();
    } catch (e) {
      // Ignore if not connected
    }
    
    resetClient();
    
    // Delete session file
    if (fs.existsSync(SESSION_FILE)) {
      fs.unlinkSync(SESSION_FILE);
      console.log('Session file deleted');
    }
    
    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Error logging out:', error);
    res.status(500).json({ error: error.message || 'Failed to logout' });
  }
});

export default router;
