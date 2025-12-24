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

/**
 * Get or create authorized Telegram client
 * @returns {Promise<TelegramClient>} Authorized Telegram client
 */
export async function getTelegramClient() {
  if (telegramClient && isAuthorized) {
    return telegramClient;
  }

  // Load or create session
  let sessionString = '';
  if (fs.existsSync(SESSION_FILE)) {
    sessionString = fs.readFileSync(SESSION_FILE, 'utf8');
  }

  const session = new StringSession(sessionString);
  
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
}
