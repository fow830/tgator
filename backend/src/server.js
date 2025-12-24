import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import chatRoutes from './routes/chats.js';
import keywordRoutes from './routes/keywords.js';
import alertRoutes from './routes/alerts.js';
import authRoutes from './routes/auth.js';
import configRoutes from './routes/config.js';
import { telegramMonitor } from './services/telegramMonitor.js';
import { alertService } from './services/alertService.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/chats', chatRoutes);
app.use('/api/keywords', keywordRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/config', configRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

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

