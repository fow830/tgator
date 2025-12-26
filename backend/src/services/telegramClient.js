import pkg from 'telegram';
const { TelegramClient, Api } = pkg;
import sessions from 'telegram/sessions/index.js';
const { StringSession } = sessions;
import { config } from '../config/env.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Export Api for use in other modules
export { Api };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSION_FILE = path.join(__dirname, '../../.session');

let telegramClient = null;
let isAuthorized = false;

// Export for logout functionality
export function resetClient() {
  telegramClient = null;
  isAuthorized = false;
}

/**
 * Get or create authorized Telegram client
 * @returns {Promise<TelegramClient>} Authorized Telegram client
 */
export async function getTelegramClient() {
  if (telegramClient && isAuthorized) {
    return telegramClient;
  }

  // Check if API credentials are configured
  if (!config.telegram.apiId || !config.telegram.apiHash || config.telegram.apiId === 0) {
    throw new Error('Telegram API credentials not configured. Please set TELEGRAM_API_ID and TELEGRAM_API_HASH in .env file.');
  }

  // Load or create session
  let sessionString = '';
  if (fs.existsSync(SESSION_FILE)) {
    sessionString = fs.readFileSync(SESSION_FILE, 'utf8');
  }

  const session = new StringSession(sessionString);
  
  try {
    telegramClient = new TelegramClient(session, config.telegram.apiId, config.telegram.apiHash, {
      connectionRetries: 5,
    });

    // Connect
    await telegramClient.connect();

    // Check if already authorized
    if (!(await telegramClient.checkAuthorization())) {
      throw new Error('Telegram client not authorized. Please authorize first using web interface.');
    }

    // Save session if changed
    const newSessionString = telegramClient.session.save();
    if (newSessionString !== sessionString) {
      fs.writeFileSync(SESSION_FILE, newSessionString);
    }

    isAuthorized = true;
    return telegramClient;
  } catch (error) {
    // If connection fails or authorization check fails, clean up
    if (telegramClient) {
      try {
        await telegramClient.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
      telegramClient = null;
      isAuthorized = false;
    }
    
    // Re-throw the error with more context
    if (error.message && error.message.includes('not authorized')) {
      throw error; // Already has good message
    }
    
    // Wrap other errors
    throw new Error(`Telegram client error: ${error.message || error}`);
  }
}
