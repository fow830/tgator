import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import chatRoutes from './routes/chats.js';
import keywordRoutes from './routes/keywords.js';
import alertRoutes from './routes/alerts.js';
import authRoutes from './routes/auth.js';
import configRoutes from './routes/config.js';
import adminAuthRoutes from './routes/adminAuth.js';
import { authenticateToken } from './middleware/auth.js';
import { telegramMonitor } from './services/telegramMonitor.js';
import { alertService } from './services/alertService.js';

const app = express();

app.use(cors());
app.use(express.json());

// Public routes (no authentication required)
app.use('/api/admin-auth', adminAuthRoutes);
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Telegram auth routes (public - needed for initial authorization)
// These routes don't require admin authentication
app.post('/api/auth/web-qr-start', async (req, res, next) => {
  try {
    const authRoutes = await import('./routes/auth.js');
    const router = authRoutes.default;
    // Manually handle the route
    const route = router.stack.find(layer => 
      layer.route && 
      layer.route.path === '/web-qr-start' && 
      layer.route.methods.post
    );
    if (route) {
      return route.route.stack[0].handle(req, res, next);
    }
    // Fallback: import and call directly
    const { webStartQR } = await import('./services/webAuthService.js');
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
app.get('/api/auth/web-qr-status/:sessionKey', async (req, res, next) => {
  try {
    const { webCheckQRStatus } = await import('./services/webAuthService.js');
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
app.post('/api/auth/web-send-code', async (req, res, next) => {
  try {
    const { webSendCode } = await import('./services/webAuthService.js');
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
app.post('/api/auth/web-verify', async (req, res, next) => {
  try {
    const { webVerifyCode } = await import('./services/webAuthService.js');
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

// Protected routes (require authentication)
app.use('/api/chats', authenticateToken, chatRoutes);
app.use('/api/keywords', authenticateToken, keywordRoutes);
app.use('/api/alerts', authenticateToken, alertRoutes);
app.use('/api/auth', authenticateToken, authRoutes);
app.use('/api/config', authenticateToken, configRoutes);

// Initialize services
async function initialize() {
  try {
    // Initialize alert service
    await alertService.initialize();
    
    // Start monitoring (with delay to allow server to start)
    setTimeout(async () => {
      try {
        await telegramMonitor.start();
        console.log('Telegram monitoring started successfully');
      } catch (error) {
        console.error('Failed to start monitoring:', error.message);
        console.log('Monitoring will retry when Telegram client is authorized');
        console.log('Use web interface at http://localhost:5173 to authorize');
      }
    }, 2000);
  } catch (error) {
    console.error('Initialization error:', error.message);
  }
}

app.listen(config.server.port, () => {
  console.log(`Server running on port ${config.server.port}`);
  initialize();
});

