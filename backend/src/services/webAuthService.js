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

// Store QR auth sessions
const qrAuthSessions = new Map();

/**
 * Poll for QR scan and import login token
 */
async function pollForQRScan(sessionKey, token, client, sessionInfo) {
  console.log('🚀 Starting background polling for QR scan, sessionKey:', sessionKey);
  let attempts = 0;
  const maxAttempts = 120; // 2 minutes (1 second * 120)
  let tokenExpired = false;
  
  const pollInterval = setInterval(async () => {
    try {
      attempts++;
      console.log(`[Background polling] Attempt ${attempts}/${maxAttempts} for sessionKey: ${sessionKey}`);
      
      // Check if already authorized
      if (sessionInfo.isAuthorized) {
        console.log('✅ Already authorized, stopping background polling');
        clearInterval(pollInterval);
        return;
      }
      
      // If token expired, check if client session was updated
      if (tokenExpired) {
        console.log('[Background polling] Token expired, checking if client session was updated...');
        try {
          // First, try getMe() - more reliable
          try {
            const me = await client.getMe();
            console.log('✅✅✅ Client is authorized after token expired! Got user info:', me.id);
            console.log('✅✅✅ This means QR was scanned and session was updated!');
            sessionInfo.isAuthorized = true;
            
            const sessionString = client.session.save();
            fs.writeFileSync(SESSION_FILE, sessionString);
            console.log('✅ Session saved via background polling (after token expired), length:', sessionString.length);
            
            const envPath = path.join(__dirname, '../../.env');
            if (fs.existsSync(envPath)) {
              let envContent = fs.readFileSync(envPath, 'utf8');
              envContent = envContent.replace(/^TELEGRAM_API_ID=.*$/m, `TELEGRAM_API_ID=${sessionInfo.apiId}`);
              envContent = envContent.replace(/^TELEGRAM_API_HASH=.*$/m, `TELEGRAM_API_HASH=${sessionInfo.apiHash}`);
              fs.writeFileSync(envPath, envContent);
            }
            
            clearInterval(pollInterval);
            // НЕ отключаем клиент здесь - оставляем его подключенным для обновления сессии
            return;
          } catch (getMeError) {
            console.log('[Background polling] getMe() failed:', getMeError.message);
            
            // Fallback to checkAuthorization
            const isAuthorized = await client.checkAuthorization();
            console.log('[Background polling] checkAuthorization result:', isAuthorized);
            if (isAuthorized) {
              console.log('✅✅✅ Client is authorized via checkAuthorization after token expired!');
              sessionInfo.isAuthorized = true;
              
              const sessionString = client.session.save();
              fs.writeFileSync(SESSION_FILE, sessionString);
              console.log('✅ Session saved via background polling (after token expired), length:', sessionString.length);
              
              const envPath = path.join(__dirname, '../../.env');
              if (fs.existsSync(envPath)) {
                let envContent = fs.readFileSync(envPath, 'utf8');
                envContent = envContent.replace(/^TELEGRAM_API_ID=.*$/m, `TELEGRAM_API_ID=${sessionInfo.apiId}`);
                envContent = envContent.replace(/^TELEGRAM_API_HASH=.*$/m, `TELEGRAM_API_HASH=${sessionInfo.apiHash}`);
                fs.writeFileSync(envPath, envContent);
              }
              
              clearInterval(pollInterval);
              // НЕ отключаем клиент здесь - оставляем его подключенным для обновления сессии
              return;
            }
          }
        } catch (checkError) {
          console.log('[Background polling] Error checking authorization:', checkError.message);
        }
      } else {
        // Try to import login token
        try {
          console.log(`[Background polling] Trying ImportLoginToken for sessionKey: ${sessionKey}`);
          const importResult = await client.invoke(
            new Api.auth.ImportLoginToken({
              token: token,
            })
          );
          
          console.log(`[Background polling] ImportLoginToken result: ${importResult.constructor.name}`);
          
          if (importResult instanceof Api.auth.LoginTokenSuccess) {
            // Authorization successful!
            console.log('✅✅✅ QR authorization successful via background polling!');
            console.log('LoginTokenSuccess authorization:', importResult.authorization ? 'exists' : 'missing');
            console.log('LoginTokenSuccess user:', importResult.authorization?.user ? 'exists' : 'missing');
            
            // КЛЮЧЕВОЙ МОМЕНТ: После получения LoginTokenSuccess, сессия должна быть обновлена
            // Но нам нужно явно использовать authorization для завершения авторизации
            // Попробуем вызвать getMe() чтобы проверить, обновилась ли сессия
            try {
              // Сначала сохраняем текущую сессию
              const sessionString = client.session.save();
              console.log('Session before LoginTokenSuccess, length:', sessionString.length);
              
              // Попробуем вызвать getMe() - это должно обновить сессию
              const me = await client.getMe();
              console.log('✅✅✅ getMe() successful after LoginTokenSuccess! User ID:', me.id);
              
              // Теперь сохраняем обновленную сессию
              const updatedSessionString = client.session.save();
              fs.writeFileSync(SESSION_FILE, updatedSessionString);
              console.log('✅ Session saved via background polling after LoginTokenSuccess, length:', updatedSessionString.length);
              
              sessionInfo.isAuthorized = true;
              
              // Update .env
              const envPath = path.join(__dirname, '../../.env');
              if (fs.existsSync(envPath)) {
                let envContent = fs.readFileSync(envPath, 'utf8');
                envContent = envContent.replace(/^TELEGRAM_API_ID=.*$/m, `TELEGRAM_API_ID=${sessionInfo.apiId}`);
                envContent = envContent.replace(/^TELEGRAM_API_HASH=.*$/m, `TELEGRAM_API_HASH=${sessionInfo.apiHash}`);
                fs.writeFileSync(envPath, envContent);
              }
              
              console.log('✅ Background polling completed successfully, cleaning up');
              clearInterval(pollInterval);
              // НЕ отключаем клиент здесь - оставляем его подключенным для обновления сессии
              return;
            } catch (getMeError) {
              console.log('⚠️ getMe() failed after LoginTokenSuccess:', getMeError.message);
              // Если getMe() не работает, попробуем сохранить сессию как есть
              // Возможно, сессия уже обновлена, но getMe() не работает по другой причине
              const sessionString = client.session.save();
              fs.writeFileSync(SESSION_FILE, sessionString);
              console.log('✅ Session saved anyway, length:', sessionString.length);
              
              sessionInfo.isAuthorized = true;
              
              // Update .env
              const envPath = path.join(__dirname, '../../.env');
              if (fs.existsSync(envPath)) {
                let envContent = fs.readFileSync(envPath, 'utf8');
                envContent = envContent.replace(/^TELEGRAM_API_ID=.*$/m, `TELEGRAM_API_ID=${sessionInfo.apiId}`);
                envContent = envContent.replace(/^TELEGRAM_API_HASH=.*$/m, `TELEGRAM_API_HASH=${sessionInfo.apiHash}`);
                fs.writeFileSync(envPath, envContent);
              }
              
              clearInterval(pollInterval);
              return;
            }
          }
        } catch (importError) {
          const errorMessage = importError.message || importError.toString() || '';
          console.log(`[Background polling] ImportLoginToken error: ${errorMessage}`);
          if (errorMessage.includes('AUTH_TOKEN_INVALID') || errorMessage.includes('AUTH_TOKEN_EXPIRED')) {
            // Token expired, but continue checking if session was updated
            console.log('⚠️ Login token expired in background polling, but will continue checking session');
            tokenExpired = true;
            // Don't stop polling - continue checking if session was updated
          }
          // Other errors - continue polling
        }
      }
      
      // Max attempts reached
      if (attempts >= maxAttempts) {
        console.log('⚠️ Max polling attempts reached in background polling');
        clearInterval(pollInterval);
        return;
      }
    } catch (error) {
      console.error('❌ Error in background QR polling:', error);
    }
      }, 1000); // Poll every 1 second - faster to catch QR scan before token expires
}

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

/**
 * Start QR code authentication using ExportLoginToken
 * Uses UpdateLoginToken event handler (correct approach from gramjs source)
 */
export async function webStartQR(apiId, apiHash) {
  const session = new StringSession('');
  const client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
  });
  
  await client.connect();
  
  const sessionKey = `qr-${apiId}-${Date.now()}`;
  
  // Store session info
  const sessionInfo = {
    client,
    qrCode: null,
    isAuthorized: false,
    authError: null,
    apiId,
    apiHash,
    token: null,
    updateHandler: null,
  };
  qrAuthSessions.set(sessionKey, sessionInfo);
  
  try {
    console.log('Requesting QR code via ExportLoginToken...');
    
    // КЛЮЧЕВОЙ МОМЕНТ: Подписываемся на UpdateLoginToken событие
    // Это происходит, когда пользователь сканирует QR-код
    const updatePromise = new Promise((resolve) => {
      const handler = async (update) => {
        if (update instanceof Api.UpdateLoginToken) {
          console.log('✅✅✅ UpdateLoginToken received! QR code was scanned!');
          
          // Когда получаем UpdateLoginToken, вызываем ExportLoginToken снова
          try {
            const result2 = await client.invoke(
              new Api.auth.ExportLoginToken({
                apiId: apiId,
                apiHash: apiHash,
                exceptIds: [],
              })
            );
            
            console.log('ExportLoginToken after UpdateLoginToken result:', result2.constructor.name);
            
            if (result2 instanceof Api.auth.LoginTokenSuccess && 
                result2.authorization instanceof Api.auth.Authorization) {
              console.log('✅✅✅ LoginTokenSuccess received! Authorization successful!');
              console.log('User ID:', result2.authorization.user?.id);
              
              // Сохраняем сессию
              const sessionString = client.session.save();
              fs.writeFileSync(SESSION_FILE, sessionString);
              console.log('✅ Session saved, length:', sessionString.length);
              
              // Update .env
              const envPath = path.join(__dirname, '../../.env');
              if (fs.existsSync(envPath)) {
                let envContent = fs.readFileSync(envPath, 'utf8');
                envContent = envContent.replace(/^TELEGRAM_API_ID=.*$/m, `TELEGRAM_API_ID=${apiId}`);
                envContent = envContent.replace(/^TELEGRAM_API_HASH=.*$/m, `TELEGRAM_API_HASH=${apiHash}`);
                fs.writeFileSync(envPath, envContent);
              }
              
              sessionInfo.isAuthorized = true;
              sessionInfo.user = result2.authorization.user;
              
              // Удаляем handler
              client.removeEventHandler(handler);
              sessionInfo.updateHandler = null;
              
              resolve(result2.authorization.user);
            } else if (result2 instanceof Api.auth.LoginTokenMigrateTo) {
              console.log('LoginTokenMigrateTo - need to switch DC');
              await client._switchDC(result2.dcId);
              
              const migratedResult = await client.invoke(
                new Api.auth.ImportLoginToken({
                  token: result2.token,
                })
              );
              
              if (migratedResult instanceof Api.auth.LoginTokenSuccess &&
                  migratedResult.authorization instanceof Api.auth.Authorization) {
                console.log('✅✅✅ Migrated LoginTokenSuccess received!');
                
                const sessionString = client.session.save();
                fs.writeFileSync(SESSION_FILE, sessionString);
                
                const envPath = path.join(__dirname, '../../.env');
                if (fs.existsSync(envPath)) {
                  let envContent = fs.readFileSync(envPath, 'utf8');
                  envContent = envContent.replace(/^TELEGRAM_API_ID=.*$/m, `TELEGRAM_API_ID=${apiId}`);
                  envContent = envContent.replace(/^TELEGRAM_API_HASH=.*$/m, `TELEGRAM_API_HASH=${apiHash}`);
                  fs.writeFileSync(envPath, envContent);
                }
                
                sessionInfo.isAuthorized = true;
                sessionInfo.user = migratedResult.authorization.user;
                
                client.removeEventHandler(handler);
                sessionInfo.updateHandler = null;
                
                resolve(migratedResult.authorization.user);
              } else {
                throw new Error(`Unexpected migrated result: ${migratedResult.constructor.name}`);
              }
            } else {
              throw new Error(`Unexpected result after UpdateLoginToken: ${result2.constructor.name}`);
            }
          } catch (error) {
            console.error('Error processing UpdateLoginToken:', error);
            sessionInfo.authError = error.message;
            client.removeEventHandler(handler);
            sessionInfo.updateHandler = null;
            resolve(null);
          }
        }
      };
      
      client.addEventHandler(handler);
      sessionInfo.updateHandler = handler;
    });
    
    // Получаем первый токен для QR-кода
    const result = await client.invoke(
      new Api.auth.ExportLoginToken({
        apiId: apiId,
        apiHash: apiHash,
        exceptIds: [],
      })
    );
    
    console.log('ExportLoginToken result:', result.constructor.name);
    
    if (result instanceof Api.auth.LoginToken) {
      // QR code token received
      const token = result.token;
      const expires = result.expires || 60;
      
      // Convert token to base64url format (as per gramjs source)
      let qrTokenString = null;
      if (Buffer.isBuffer(token)) {
        qrTokenString = token.toString('base64url');
      } else if (typeof token === 'string') {
        qrTokenString = token;
      } else {
        qrTokenString = token.toString();
      }
      
      // Telegram QR format: tg://login?token=...
      const qrCodeValue = `tg://login?token=${qrTokenString}`;
      
      // Update session info
      sessionInfo.qrCode = qrCodeValue;
      sessionInfo.token = token;
      
      console.log('QR code generated successfully, expires in:', expires, 'seconds');
      console.log('Waiting for UpdateLoginToken event...');
      
      // Запускаем обработку UpdateLoginToken в фоне (не блокируем)
      updatePromise.catch((error) => {
        console.error('UpdateLoginToken promise error:', error);
      });
      
      return {
        sessionKey,
        qrCode: qrCodeValue,
      };
    } else if (result instanceof Api.auth.LoginTokenSuccess) {
      // Already authorized somehow
      console.log('Already authorized via LoginTokenSuccess');
      sessionInfo.isAuthorized = true;
      const sessionString = client.session.save();
      fs.writeFileSync(SESSION_FILE, sessionString);
      
      // Update .env
      const envPath = path.join(__dirname, '../../.env');
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, 'utf8');
        envContent = envContent.replace(/^TELEGRAM_API_ID=.*$/m, `TELEGRAM_API_ID=${apiId}`);
        envContent = envContent.replace(/^TELEGRAM_API_HASH=.*$/m, `TELEGRAM_API_HASH=${apiHash}`);
        fs.writeFileSync(envPath, envContent);
      }
      
      await client.disconnect();
      qrAuthSessions.delete(sessionKey);
      
      return {
        sessionKey,
        qrCode: null,
        authorized: true,
      };
    } else {
      console.error('Unexpected result type:', result.constructor.name);
      throw new Error(`Unexpected response: ${result.constructor.name}`);
    }
  } catch (error) {
    console.error('Error exporting login token:', error);
    // Clean up handler if exists
    if (sessionInfo.updateHandler) {
      try {
        sessionInfo.client.removeEventHandler(sessionInfo.updateHandler);
      } catch (e) {
        // Ignore
      }
    }
    await client.disconnect();
    qrAuthSessions.delete(sessionKey);
    throw new Error(`Failed to generate QR code: ${error.message}`);
  }
}

/**
 * Check QR authentication status
 */
export async function webCheckQRStatus(sessionKey) {
  const sessionInfo = qrAuthSessions.get(sessionKey);
  
  if (!sessionInfo) {
    return {
      status: 'not_found',
      error: 'QR session not found',
    };
  }
  
  // Check if already authorized
  if (sessionInfo.isAuthorized) {
    // Clean up - но НЕ отключаем клиент, он может быть нужен для обновления сессии
    // Клиент будет отключен автоматически при следующем переподключении или при завершении процесса
    if (sessionInfo.client) {
      // Сохраняем сессию перед очисткой
      try {
        const sessionString = sessionInfo.client.session.save();
        if (sessionString && sessionString.length > 0) {
          fs.writeFileSync(SESSION_FILE, sessionString);
          console.log('Session saved before cleanup, length:', sessionString.length);
        }
      } catch (e) {
        console.log('Could not save session before cleanup:', e.message);
      }
      // НЕ отключаем клиент - оставляем его подключенным
    }
    qrAuthSessions.delete(sessionKey);
    return {
      status: 'authorized',
      success: true,
    };
  }
  
  // Check for errors
  if (sessionInfo.authError) {
    qrAuthSessions.delete(sessionKey);
    if (sessionInfo.client) {
      await sessionInfo.client.disconnect();
    }
    return {
      status: 'error',
      error: sessionInfo.authError,
    };
  }
  
  console.log('webCheckQRStatus called for sessionKey:', sessionKey);
  console.log('sessionInfo.client exists:', !!sessionInfo.client);
  console.log('sessionInfo.isAuthorized:', sessionInfo.isAuthorized);
  
  // KEY INSIGHT: After QR scan, the session in the original client might be updated
  // Even if ImportLoginToken failed due to expired token, the session might still be updated
  // Try to check if the original client's session was updated after QR scan
  if (sessionInfo.client) {
    // First, try to get and save current session from client
    // The session might have been updated automatically after QR scan
    let currentSessionString = '';
    try {
      currentSessionString = sessionInfo.client.session.save();
      if (currentSessionString && currentSessionString.length > 0) {
        // Save it to file
        fs.writeFileSync(SESSION_FILE, currentSessionString);
        console.log('Saved session from current client, length:', currentSessionString.length);
        
        // Try to create a NEW client with this saved session and check if it's authorized
        // This is the key - if QR was scanned, the session should be updated
        const testSession = new StringSession(currentSessionString);
        const testClient = new TelegramClient(testSession, sessionInfo.apiId, sessionInfo.apiHash, {
          connectionRetries: 5,
        });
        
        await testClient.connect();
        console.log('Test client connected with saved session');
        
        // Try getMe() to check if authorized
        try {
          const me = await testClient.getMe();
          console.log('✅✅✅ Test client is authorized! Got user info:', me.id);
          console.log('This means QR was scanned and session was updated!');
          
          sessionInfo.isAuthorized = true;
          
          // Save session again (might have been updated by testClient)
          const finalSessionString = testClient.session.save();
          fs.writeFileSync(SESSION_FILE, finalSessionString);
          console.log('Final session saved, length:', finalSessionString.length);
          
          // Update .env
          const envPath = path.join(__dirname, '../../.env');
          if (fs.existsSync(envPath)) {
            let envContent = fs.readFileSync(envPath, 'utf8');
            envContent = envContent.replace(/^TELEGRAM_API_ID=.*$/m, `TELEGRAM_API_ID=${sessionInfo.apiId}`);
            envContent = envContent.replace(/^TELEGRAM_API_HASH=.*$/m, `TELEGRAM_API_HASH=${sessionInfo.apiHash}`);
            fs.writeFileSync(envPath, envContent);
          }
          
          // Отключаем testClient, но НЕ отключаем оригинальный client - он нужен для обновления сессии
          await testClient.disconnect();
          // НЕ отключаем sessionInfo.client здесь - оставляем его подключенным
          // Он будет отключен только после успешной авторизации в конце функции
          qrAuthSessions.delete(sessionKey);
          
          return {
            status: 'authorized',
            success: true,
          };
        } catch (getMeError) {
          console.log('Test client getMe() failed:', getMeError.message);
          
          // Try checkAuthorization
          const isAuthorized = await testClient.checkAuthorization();
          if (isAuthorized) {
            console.log('✅✅✅ Test client is authorized via checkAuthorization!');
            sessionInfo.isAuthorized = true;
            
            const finalSessionString = testClient.session.save();
            fs.writeFileSync(SESSION_FILE, finalSessionString);
            
            const envPath = path.join(__dirname, '../../.env');
            if (fs.existsSync(envPath)) {
              let envContent = fs.readFileSync(envPath, 'utf8');
              envContent = envContent.replace(/^TELEGRAM_API_ID=.*$/m, `TELEGRAM_API_ID=${sessionInfo.apiId}`);
              envContent = envContent.replace(/^TELEGRAM_API_HASH=.*$/m, `TELEGRAM_API_HASH=${sessionInfo.apiHash}`);
              fs.writeFileSync(envPath, envContent);
            }
            
            // Отключаем testClient, но НЕ отключаем оригинальный client
            await testClient.disconnect();
            // НЕ отключаем sessionInfo.client здесь - оставляем его подключенным
            qrAuthSessions.delete(sessionKey);
            
            return {
              status: 'authorized',
              success: true,
            };
          }
          
          await testClient.disconnect();
        }
      }
    } catch (sessionError) {
      console.log('Could not save/check session from current client:', sessionError.message);
    }
    
    // Fallback: try to check if original client is authorized
    try {
      try {
        const me = await sessionInfo.client.getMe();
        console.log('✅ Client is authorized! Got user info:', me.id);
        sessionInfo.isAuthorized = true;
        
        const sessionString = sessionInfo.client.session.save();
        fs.writeFileSync(SESSION_FILE, sessionString);
        console.log('Session saved, length:', sessionString.length);
        
        const envPath = path.join(__dirname, '../../.env');
        if (fs.existsSync(envPath)) {
          let envContent = fs.readFileSync(envPath, 'utf8');
          envContent = envContent.replace(/^TELEGRAM_API_ID=.*$/m, `TELEGRAM_API_ID=${sessionInfo.apiId}`);
          envContent = envContent.replace(/^TELEGRAM_API_HASH=.*$/m, `TELEGRAM_API_HASH=${sessionInfo.apiHash}`);
          fs.writeFileSync(envPath, envContent);
        }
        
        await sessionInfo.client.disconnect();
        qrAuthSessions.delete(sessionKey);
        
        return {
          status: 'authorized',
          success: true,
        };
      } catch (getMeError) {
        const isAuthorized = await sessionInfo.client.checkAuthorization();
        if (isAuthorized) {
          console.log('✅ Client is authorized via checkAuthorization!');
          sessionInfo.isAuthorized = true;
          
          const sessionString = sessionInfo.client.session.save();
          fs.writeFileSync(SESSION_FILE, sessionString);
          
          const envPath = path.join(__dirname, '../../.env');
          if (fs.existsSync(envPath)) {
            let envContent = fs.readFileSync(envPath, 'utf8');
            envContent = envContent.replace(/^TELEGRAM_API_ID=.*$/m, `TELEGRAM_API_ID=${sessionInfo.apiId}`);
            envContent = envContent.replace(/^TELEGRAM_API_HASH=.*$/m, `TELEGRAM_API_HASH=${sessionInfo.apiHash}`);
            fs.writeFileSync(envPath, envContent);
          }
          
          await sessionInfo.client.disconnect();
          qrAuthSessions.delete(sessionKey);
          
          return {
            status: 'authorized',
            success: true,
          };
        }
      }
    } catch (authCheckError) {
      console.log('Authorization check error:', authCheckError.message);
    }
  }
  
  // Old ExportLoginToken/ImportLoginToken logic - remove if not needed
  if (sessionInfo.token && sessionInfo.client) {
    try {
      console.log('Checking if QR code was scanned by trying ImportLoginToken...');
      console.log('Token type:', sessionInfo.token.constructor.name, 'Token length:', sessionInfo.token.length);
      
      const importResult = await sessionInfo.client.invoke(
        new Api.auth.ImportLoginToken({
          token: sessionInfo.token,
        })
      );
      
      console.log('ImportLoginToken result:', importResult.constructor.name);
      
      if (importResult instanceof Api.auth.LoginTokenSuccess) {
        // Authorization successful!
        console.log('✅✅✅ QR authorization successful via ImportLoginToken!');
        console.log('LoginTokenSuccess authorization:', importResult.authorization ? 'exists' : 'missing');
        console.log('LoginTokenSuccess user:', importResult.authorization?.user ? 'exists' : 'missing');
        
        // КЛЮЧЕВОЙ МОМЕНТ: После получения LoginTokenSuccess, сессия должна быть обновлена
        // Но нам нужно явно использовать authorization для завершения авторизации
        // Попробуем вызвать getMe() чтобы проверить, обновилась ли сессия
        try {
          // Сначала сохраняем текущую сессию
          const sessionString = sessionInfo.client.session.save();
          console.log('Session before LoginTokenSuccess, length:', sessionString.length);
          
          // Попробуем вызвать getMe() - это должно обновить сессию
          const me = await sessionInfo.client.getMe();
          console.log('✅✅✅ getMe() successful after LoginTokenSuccess! User ID:', me.id);
          
          // Теперь сохраняем обновленную сессию
          const updatedSessionString = sessionInfo.client.session.save();
          fs.writeFileSync(SESSION_FILE, updatedSessionString);
          console.log('✅ Session saved after LoginTokenSuccess, length:', updatedSessionString.length);
          
          sessionInfo.isAuthorized = true;
          
          // Update .env
          const envPath = path.join(__dirname, '../../.env');
          if (fs.existsSync(envPath)) {
            let envContent = fs.readFileSync(envPath, 'utf8');
            envContent = envContent.replace(/^TELEGRAM_API_ID=.*$/m, `TELEGRAM_API_ID=${sessionInfo.apiId}`);
            envContent = envContent.replace(/^TELEGRAM_API_HASH=.*$/m, `TELEGRAM_API_HASH=${sessionInfo.apiHash}`);
            fs.writeFileSync(envPath, envContent);
          }
          
          // НЕ отключаем клиент здесь - оставляем его подключенным для обновления сессии
          qrAuthSessions.delete(sessionKey);
          
          return {
            status: 'authorized',
            success: true,
          };
        } catch (getMeError) {
          console.log('⚠️ getMe() failed after LoginTokenSuccess:', getMeError.message);
          // Если getMe() не работает, попробуем сохранить сессию как есть
          // Возможно, сессия уже обновлена, но getMe() не работает по другой причине
          const sessionString = sessionInfo.client.session.save();
          fs.writeFileSync(SESSION_FILE, sessionString);
          console.log('✅ Session saved anyway, length:', sessionString.length);
          
          sessionInfo.isAuthorized = true;
          
          // Update .env
          const envPath = path.join(__dirname, '../../.env');
          if (fs.existsSync(envPath)) {
            let envContent = fs.readFileSync(envPath, 'utf8');
            envContent = envContent.replace(/^TELEGRAM_API_ID=.*$/m, `TELEGRAM_API_ID=${sessionInfo.apiId}`);
            envContent = envContent.replace(/^TELEGRAM_API_HASH=.*$/m, `TELEGRAM_API_HASH=${sessionInfo.apiHash}`);
            fs.writeFileSync(envPath, envContent);
          }
          
          // НЕ отключаем клиент здесь - оставляем его подключенным для обновления сессии
          qrAuthSessions.delete(sessionKey);
          
          return {
            status: 'authorized',
            success: true,
          };
        }
      }
        } catch (importError) {
      // Token not ready yet or invalid
      const errorMessage = importError.message || importError.toString() || '';
      console.log('ImportLoginToken error:', errorMessage);
      
      if (errorMessage.includes('AUTH_TOKEN_INVALID') || errorMessage.includes('AUTH_TOKEN_EXPIRED')) {
        console.log('Login token expired. But if user scanned QR, authorization might have happened.');
        
        // When QR is scanned, Telegram authorizes the device on the server
        // If we call ExportLoginToken again and device is already authorized,
        // Telegram will return LoginTokenSuccess instead of LoginToken
        console.log('Trying to check if user is authorized by calling ExportLoginToken again...');
        try {
          const recheckResult = await sessionInfo.client.invoke(
            new Api.auth.ExportLoginToken({
              apiId: sessionInfo.apiId,
              apiHash: sessionInfo.apiHash,
              exceptIds: [],
            })
          );
          
          console.log('Recheck ExportLoginToken result type:', recheckResult.constructor.name);
          console.log('Is LoginTokenSuccess?', recheckResult instanceof Api.auth.LoginTokenSuccess);
          console.log('Is LoginToken?', recheckResult instanceof Api.auth.LoginToken);
          console.log('Result has authorization property?', 'authorization' in recheckResult);
          console.log('Result keys:', Object.keys(recheckResult));
          
          // Check if result has 'authorization' property (LoginTokenSuccess has it)
          // Also check by checking if result has authorization property directly
          if (recheckResult instanceof Api.auth.LoginTokenSuccess || ('authorization' in recheckResult && recheckResult.authorization)) {
            // Device is already authorized! QR was scanned successfully
            console.log('✅ Device is already authorized! QR was scanned successfully.');
            console.log('Authorization object:', recheckResult.authorization ? 'exists' : 'missing');
            
            sessionInfo.isAuthorized = true;
            
            // Save session - IMPORTANT: session might have been updated by ExportLoginToken
            const sessionString = sessionInfo.client.session.save();
            fs.writeFileSync(SESSION_FILE, sessionString);
            console.log('Session saved, length:', sessionString.length);
            
            // Update .env
            const envPath = path.join(__dirname, '../../.env');
            if (fs.existsSync(envPath)) {
              let envContent = fs.readFileSync(envPath, 'utf8');
              envContent = envContent.replace(/^TELEGRAM_API_ID=.*$/m, `TELEGRAM_API_ID=${sessionInfo.apiId}`);
              envContent = envContent.replace(/^TELEGRAM_API_HASH=.*$/m, `TELEGRAM_API_HASH=${sessionInfo.apiHash}`);
              fs.writeFileSync(envPath, envContent);
            }
            
                // НЕ отключаем клиент здесь - оставляем его подключенным для обновления сессии
                qrAuthSessions.delete(sessionKey);
                
                return {
                  status: 'authorized',
                  success: true,
                };
              } else if (recheckResult instanceof Api.auth.LoginToken) {
            console.log('ExportLoginToken returned LoginToken again - device not authorized yet or QR not scanned');
            console.log('Token expires in:', recheckResult.expires, 'seconds');
          } else {
            console.log('Unexpected ExportLoginToken result type:', recheckResult.constructor.name);
            console.log('Result keys:', Object.keys(recheckResult));
            console.log('Result className:', recheckResult.className);
            console.log('Result CONSTRUCTOR_ID:', recheckResult.CONSTRUCTOR_ID);
            
            // Check if result has 'authorization' property directly (might be LoginTokenSuccess but instanceof failed)
            if ('authorization' in recheckResult && recheckResult.authorization) {
              console.log('✅ Found authorization property in result! Device is authorized!');
              sessionInfo.isAuthorized = true;
              
              // Save session
              const sessionString = sessionInfo.client.session.save();
              fs.writeFileSync(SESSION_FILE, sessionString);
              console.log('Session saved, length:', sessionString.length);
              
              // Update .env
              const envPath = path.join(__dirname, '../../.env');
              if (fs.existsSync(envPath)) {
                let envContent = fs.readFileSync(envPath, 'utf8');
                envContent = envContent.replace(/^TELEGRAM_API_ID=.*$/m, `TELEGRAM_API_ID=${sessionInfo.apiId}`);
                envContent = envContent.replace(/^TELEGRAM_API_HASH=.*$/m, `TELEGRAM_API_HASH=${sessionInfo.apiHash}`);
                fs.writeFileSync(envPath, envContent);
              }
              
              await sessionInfo.client.disconnect();
              qrAuthSessions.delete(sessionKey);
              
              return {
                status: 'authorized',
                success: true,
              };
            }
            
            // Check by CONSTRUCTOR_ID - LoginTokenSuccess has specific CONSTRUCTOR_ID
            // LoginTokenSuccess CONSTRUCTOR_ID is 957176926 (0x390d5c5e)
            // LoginToken CONSTRUCTOR_ID is 1654593920 (0x629f1980)
            if (recheckResult.CONSTRUCTOR_ID === 957176926 || recheckResult.CONSTRUCTOR_ID === 0x390d5c5e) {
              console.log('✅✅✅ Found LoginTokenSuccess by CONSTRUCTOR_ID! Device is authorized!');
              sessionInfo.isAuthorized = true;
              
              // Save session
              const sessionString = sessionInfo.client.session.save();
              fs.writeFileSync(SESSION_FILE, sessionString);
              console.log('Session saved, length:', sessionString.length);
              
              // Update .env
              const envPath = path.join(__dirname, '../../.env');
              if (fs.existsSync(envPath)) {
                let envContent = fs.readFileSync(envPath, 'utf8');
                envContent = envContent.replace(/^TELEGRAM_API_ID=.*$/m, `TELEGRAM_API_ID=${sessionInfo.apiId}`);
                envContent = envContent.replace(/^TELEGRAM_API_HASH=.*$/m, `TELEGRAM_API_HASH=${sessionInfo.apiHash}`);
                fs.writeFileSync(envPath, envContent);
              }
              
              await sessionInfo.client.disconnect();
              qrAuthSessions.delete(sessionKey);
              
              return {
                status: 'authorized',
                success: true,
              };
            }
          }
        } catch (recheckError) {
          console.log('Error rechecking ExportLoginToken:', recheckError.message);
        }
        
        console.log('Trying to check if user is authorized by creating new client...');
        
        // Token expired, but user might have scanned QR and authorized
        // When QR is scanned, Telegram authorizes the device, but we need to check
        // if our session was updated. Try creating a new client and checking authorization.
        try {
          // Load existing session if any
          let sessionString = '';
          if (fs.existsSync(SESSION_FILE)) {
            sessionString = fs.readFileSync(SESSION_FILE, 'utf8');
            console.log('Loaded existing session, length:', sessionString.length);
          } else {
            console.log('No existing session file found');
          }
          
          // Also try to get session from the current client
          if (sessionInfo.client) {
            try {
              const currentSessionString = sessionInfo.client.session.save();
              if (currentSessionString && currentSessionString.length > 0) {
                sessionString = currentSessionString;
                console.log('Got session from current client, length:', sessionString.length);
                // Save it
                fs.writeFileSync(SESSION_FILE, sessionString);
              }
            } catch (sessionError) {
              console.log('Could not get session from current client:', sessionError.message);
            }
          }
          
          // KEY INSIGHT: When QR is scanned, Telegram authorizes the device on the server
          // If we create a NEW client with EMPTY session, Telegram should recognize the device as authorized
          console.log('Creating NEW client with EMPTY session to check if device is already authorized...');
          const emptySession = new StringSession('');
          const newSession = emptySession;
          const newClient = new TelegramClient(newSession, sessionInfo.apiId, sessionInfo.apiHash, {
            connectionRetries: 5,
          });
          
          await newClient.connect();
          console.log('New client connected');
          
          // Try getMe() first - more reliable
          try {
            const me = await newClient.getMe();
            console.log('✅ User is authorized! Got user info via getMe():', me.id);
            
            // Save session
            const newSessionString = newClient.session.save();
            fs.writeFileSync(SESSION_FILE, newSessionString);
            console.log('Session saved to file, length:', newSessionString.length);
            
            // Update .env
            const envPath = path.join(__dirname, '../../.env');
            if (fs.existsSync(envPath)) {
              let envContent = fs.readFileSync(envPath, 'utf8');
              envContent = envContent.replace(/^TELEGRAM_API_ID=.*$/m, `TELEGRAM_API_ID=${sessionInfo.apiId}`);
              envContent = envContent.replace(/^TELEGRAM_API_HASH=.*$/m, `TELEGRAM_API_HASH=${sessionInfo.apiHash}`);
              fs.writeFileSync(envPath, envContent);
              console.log('Environment file updated');
            }
            
                await newClient.disconnect();
                // НЕ отключаем sessionInfo.client здесь - оставляем его подключенным
                qrAuthSessions.delete(sessionKey);
                
                return {
                  status: 'authorized',
                  success: true,
                };
              } catch (getMeError) {
                console.log('getMe() failed on new client:', getMeError.message);
                
                // Fallback to checkAuthorization
                const isAuthorized = await newClient.checkAuthorization();
                console.log('New client checkAuthorization result:', isAuthorized);
                
                if (isAuthorized) {
                  console.log('✅ User is authorized via checkAuthorization!');
                  
                  // Save session
                  const newSessionString = newClient.session.save();
                  fs.writeFileSync(SESSION_FILE, newSessionString);
                  console.log('Session saved to file');
                  
                  // Update .env
                  const envPath = path.join(__dirname, '../../.env');
                  if (fs.existsSync(envPath)) {
                    let envContent = fs.readFileSync(envPath, 'utf8');
                    envContent = envContent.replace(/^TELEGRAM_API_ID=.*$/m, `TELEGRAM_API_ID=${sessionInfo.apiId}`);
                    envContent = envContent.replace(/^TELEGRAM_API_HASH=.*$/m, `TELEGRAM_API_HASH=${sessionInfo.apiHash}`);
                    fs.writeFileSync(envPath, envContent);
                    console.log('Environment file updated');
                  }
                  
                  await newClient.disconnect();
                  // НЕ отключаем sessionInfo.client здесь - оставляем его подключенным
                  qrAuthSessions.delete(sessionKey);
                  
                  return {
                    status: 'authorized',
                    success: true,
                  };
                } else {
                  console.log('User is not authorized yet. QR might not have been scanned, or session not updated.');
                  await newClient.disconnect();
                }
              }
            } catch (newClientError) {
              console.log('Error checking with new client:', newClientError.message);
              console.log('Full error:', newClientError);
            }
            
            // If we get here, token expired but we couldn't verify authorization
            // Don't return expired - user might have scanned but session not updated yet
            // Return waiting status so user can check again
            console.log('Token expired but authorization check inconclusive. Returning waiting status - user can check again.');
            // НЕ отключаем клиент - он нужен для обновления сессии
        return {
          status: 'waiting',
          qrCode: sessionInfo.qrCode || null,
        };
      }
      // Other errors - user hasn't scanned yet, continue waiting
      console.log('Login token not ready yet, error:', errorMessage);
      console.log('Error type:', importError.constructor.name);
    }
  } else {
    console.log('Cannot check ImportLoginToken: token or client missing');
    console.log('token:', !!sessionInfo.token, 'client:', !!sessionInfo.client);
  }
  
  // Still waiting - return QR code if available
  return {
    status: 'waiting',
    qrCode: sessionInfo.qrCode || null,
  };
}
