import express from 'express';
import { webSendCode, webVerifyCode } from '../services/webAuthService.js';

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

export default router;
