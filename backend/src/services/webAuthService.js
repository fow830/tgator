import pkg from 'telegram';
const { TelegramClient, Api } = pkg;
import sessions from 'telegram/sessions/index.js';
const { StringSession } = sessions;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSION_FILE = path.join(__dirname, '../../.session');

// Store active auth sessions
const activeAuthSessions = new Map();

export async function webSendCode(phone, apiId, apiHash) {
  const session = new StringSession('');
  const client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
  });
  
  await client.connect();
  
  try {
    // Use simple sendCode method
    const result = await client.sendCode(
      { apiId, apiHash },
      phone
    );
    
    // Store client and phoneCodeHash for later use
    const sessionKey = `${phone}-${apiId}`;
    activeAuthSessions.set(sessionKey, {
      client,
      phoneCodeHash: result.phoneCodeHash,
      phone,
      apiId,
      apiHash,
    });
    
    return {
      phoneCodeHash: result.phoneCodeHash,
    };
  } catch (error) {
    await client.disconnect();
    throw error;
  }
}

export async function webVerifyCode(phone, apiId, apiHash, code, phoneCodeHash) {
  const sessionKey = `${phone}-${apiId}`;
  const authSession = activeAuthSessions.get(sessionKey);
  
  if (!authSession) {
    throw new Error('Auth session not found. Please send code again.');
  }
  
  const { client } = authSession;
  
  try {
    // Use signInUser method
    await client.signInUser(
      { apiId, apiHash },
      {
        phoneNumber: phone,
        phoneCode: () => Promise.resolve(code),
        phoneCodeHash: phoneCodeHash,
      }
    );
    
    // Save session
    const sessionString = client.session.save();
    fs.writeFileSync(SESSION_FILE, sessionString);
    
    // Update .env with new credentials if different
    const envPath = path.join(__dirname, '../../.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Update phone, apiId, apiHash if they changed
    envContent = envContent.replace(/^TELEGRAM_PHONE=.*$/m, `TELEGRAM_PHONE=${phone}`);
    envContent = envContent.replace(/^TELEGRAM_API_ID=.*$/m, `TELEGRAM_API_ID=${apiId}`);
    envContent = envContent.replace(/^TELEGRAM_API_HASH=.*$/m, `TELEGRAM_API_HASH=${apiHash}`);
    
    fs.writeFileSync(envPath, envContent);
    
    // Clean up
    activeAuthSessions.delete(sessionKey);
    await client.disconnect();
    
    return {
      session: sessionString,
    };
  } catch (error) {
    await client.disconnect();
    activeAuthSessions.delete(sessionKey);
    throw error;
  }
}

