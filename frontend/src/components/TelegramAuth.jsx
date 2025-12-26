import { useState, useEffect, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import './TelegramAuth.css'

// Helper function to safely render QR code
function SafeQRCode({ value }) {
  // Check if QRCodeSVG is available
  if (typeof QRCodeSVG === 'undefined' || QRCodeSVG === null) {
    console.error('QRCodeSVG is undefined or null');
    return <div style={{ color: '#666' }}>⚠️ Библиотека QR-кода не загружена</div>;
  }
  
  // Check if value is valid
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    return <div style={{ color: '#666' }}>⏳ Генерация QR-кода...</div>;
  }
  
  try {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return <div style={{ color: '#666' }}>⏳ Генерация QR-кода...</div>;
    }
    
    // Double check QRCodeSVG before using
    if (typeof QRCodeSVG !== 'function' && typeof QRCodeSVG !== 'object') {
      console.error('QRCodeSVG is not a valid component:', typeof QRCodeSVG, QRCodeSVG);
      return <div style={{ color: '#666' }}>⚠️ Ошибка загрузки компонента QR-кода</div>;
    }
    
    return (
      <QRCodeSVG 
        value={trimmedValue} 
        size={256}
        level="H"
        includeMargin={true}
      />
    );
  } catch (error) {
    console.error('Error rendering QR code:', error);
    return <div style={{ color: '#666' }}>⏳ Генерация QR-кода...</div>;
  }
}

function TelegramAuth() {
  const [step, setStep] = useState('credentials') // 'credentials' | 'profile' | 'qr' | 'authorized'
  const [phone, setPhone] = useState('')
  const [apiId, setApiId] = useState('')
  const [apiHash, setApiHash] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [qrCode, setQrCode] = useState(null)
  const [sessionKey, setSessionKey] = useState(null)
  const [qrStatus, setQrStatus] = useState('waiting') // 'waiting' | 'authorized' | 'expired' | 'error'
  const [credentialsSaved, setCredentialsSaved] = useState(false)
  const [userInfo, setUserInfo] = useState(null)
  const pollingIntervalRef = useRef(null)

  // Load saved credentials and check auth status on mount
  useEffect(() => {
    // Only load if admin is logged in
    const adminToken = localStorage.getItem('adminToken')
    if (adminToken) {
      loadCredentials()
      checkAuthStatus()
    }
  }, [])
  
  // Check auth status periodically
  useEffect(() => {
    const adminToken = localStorage.getItem('adminToken')
    if (!adminToken) {
      return // Don't poll if admin is not logged in
    }

    const interval = setInterval(() => {
      if (step !== 'authorized') {
        const currentToken = localStorage.getItem('adminToken')
        if (currentToken) {
          checkAuthStatus()
        }
      }
    }, 5000) // Check every 5 seconds
    
    return () => clearInterval(interval)
  }, [step])
  
  const checkAuthStatus = async () => {
    // Check if admin is logged in first
    const adminToken = localStorage.getItem('adminToken')
    if (!adminToken) {
      return // Don't check Telegram auth if admin is not logged in
    }

    try {
      const response = await fetch('/api/auth/user-info', {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.authorized && data.user) {
          setUserInfo(data.user)
          setStep('authorized')
        } else if (data.success === false && data.authorized === false) {
          // Not authorized yet - this is normal, just ignore silently
          // Stay on current step (profile or qr)
          return
        }
      } else if (response.status === 401) {
        // Not authorized - this is normal, just ignore silently
        return
      }
    } catch (err) {
      // Silently ignore errors - user might not be authorized yet
      console.debug('Telegram auth check:', err.message)
    }
  }

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
      }
    }
  }, [])

  const loadCredentials = async () => {
    // Check if admin is logged in first
    const adminToken = localStorage.getItem('adminToken')
    if (!adminToken) {
      return // Don't load credentials if admin is not logged in
    }

    try {
      const response = await fetch('/api/config/credentials', {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.saved) {
          setPhone(data.phone || '')
          setApiId(data.apiId || '')
          setApiHash(data.apiHash || '')
          setCredentialsSaved(true)
          setStep('profile')
        }
      } else if (response.status === 401) {
        // Not authorized - this is normal, just ignore silently
        return
      }
    } catch (err) {
      // Silently ignore errors - user might not be authorized yet
      console.debug('Load credentials:', err.message)
    }
  }

  const handleSaveCredentials = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/config/save-credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone,
          apiId: parseInt(apiId),
          apiHash,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save credentials')
      }

      setCredentialsSaved(true)
      setSuccess('✅ Данные сохранены!')
      
      setTimeout(() => {
        setStep('profile')
        setSuccess(null)
      }, 1000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleRequestQR = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)
    setQrCode(null)
    setSessionKey(null)
    setQrStatus('waiting')

    // Clear any existing polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }

    try {
      const response = await fetch('/api/auth/web-qr-start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiId: parseInt(apiId),
          apiHash,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start QR authentication')
      }

      // If QR code is null, we'll get it from status polling
      if (data.qrCode && typeof data.qrCode === 'string' && data.qrCode.trim().length > 0) {
        setQrCode(data.qrCode.trim())
      } else {
        // Ensure qrCode is null if not valid
        setQrCode(null)
      }
      setSessionKey(data.sessionKey)
      setStep('qr')
      // НЕ запускаем автоматический polling - проверка по кнопке
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCheckAuth = async () => {
    console.log('handleCheckAuth called, sessionKey:', sessionKey)
    
    if (!sessionKey) {
      setError('Session key not found. Please request QR code again.')
      console.error('No sessionKey available')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      console.log('Checking QR status for sessionKey:', sessionKey)
      const response = await fetch(`/api/auth/web-qr-status/${sessionKey}`)
      console.log('Response status:', response.status)
      
      const status = await response.json()
      console.log('Status data:', status)

      if (!response.ok) {
        throw new Error(status.error || 'Failed to check QR status')
      }

      // Update QR code if received
      if (status.qrCode && typeof status.qrCode === 'string' && status.qrCode.trim().length > 0) {
        setQrCode(status.qrCode.trim())
      }

      if (status.status === 'authorized') {
        // Success!
        setQrStatus('authorized')
        setSuccess('✅ Авторизация успешна!')
        
        // Load user info and show authorized screen
        setTimeout(async () => {
          await checkAuthStatus()
        }, 1000)
      } else if (status.status === 'expired') {
        setQrStatus('expired')
        setError('QR-код истек. Запросите новый.')
      } else if (status.status === 'error') {
        setQrStatus('error')
        setError(status.error || 'Ошибка авторизации')
      } else if (status.status === 'not_found') {
        setQrStatus('error')
        setError('Сессия не найдена. Запросите новый QR-код.')
      } else {
        // Still waiting
        setSuccess('⏳ Ожидание авторизации... Сканируйте QR-код в Telegram и нажмите "Проверить" снова.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleEditCredentials = () => {
    setStep('credentials')
    setError(null)
    setSuccess(null)
    
    // Stop polling if active
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
  }
  
  const handleLogout = async () => {
    if (!confirm('Вы уверены, что хотите разорвать авторизацию?')) {
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to logout')
      }
      
      // Reset state
      setUserInfo(null)
      setStep('profile')
      setSuccess('✅ Авторизация разорвана')
      
      setTimeout(() => {
        setSuccess(null)
      }, 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  
  // Шаг 1: Ввод и сохранение данных
  if (step === 'credentials') {
    return (
      <div className="telegram-auth">
        <div className="card">
          <h2>Настройка Telegram API</h2>
          <p>Введите данные для подключения к Telegram</p>
          
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <form onSubmit={handleSaveCredentials}>
            <div className="form-group">
              <label>Номер телефона (с +)</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1234567890"
                required
                disabled={saving || loading}
              />
            </div>

            <div className="form-group">
              <label>API ID</label>
              <input
                type="text"
                value={apiId}
                onChange={(e) => setApiId(e.target.value)}
                placeholder="Ваш API ID"
                required
                disabled={saving || loading}
              />
            </div>

            <div className="form-group">
              <label>API Hash</label>
              <input
                type="text"
                value={apiHash}
                onChange={(e) => setApiHash(e.target.value)}
                placeholder="Ваш API Hash"
                required
                disabled={saving || loading}
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={saving || loading}
            >
              {saving ? 'Сохранение...' : 'Сохранить данные'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // Шаг 2: Профиль с сохраненными данными и кнопкой авторизации
  if (step === 'profile') {
    return (
      <div className="telegram-auth">
        <div className="card">
          <h2>Профиль Telegram</h2>
          <p>Данные сохранены. Готовы к авторизации.</p>
          
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <div className="profile-info">
            <div className="profile-item">
              <label>Номер телефона:</label>
              <div className="profile-value">{phone || 'Не указан'}</div>
            </div>
            
            <div className="profile-item">
              <label>API ID:</label>
              <div className="profile-value">{apiId || 'Не указан'}</div>
            </div>
            
            <div className="profile-item">
              <label>API Hash:</label>
              <div className="profile-value">{apiHash ? `${apiHash.substring(0, 10)}...` : 'Не указан'}</div>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn"
              onClick={handleEditCredentials}
              disabled={loading}
            >
              Изменить данные
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleRequestQR}
              disabled={loading}
            >
              {loading ? 'Загрузка...' : 'Запросить QR-код'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Шаг 4: Экран авторизованного пользователя
  if (step === 'authorized' && userInfo) {
    return (
      <div className="telegram-auth">
        <div className="card">
          <h2>✅ Авторизация успешна</h2>
          <p>Система готова к работе</p>
          
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <div className="profile-info">
            <div className="profile-item">
              <label>ID пользователя:</label>
              <div className="profile-value">{userInfo.id || 'N/A'}</div>
            </div>
            
            <div className="profile-item">
              <label>Имя:</label>
              <div className="profile-value">{userInfo.firstName || 'N/A'}</div>
            </div>
            
            {userInfo.lastName && (
              <div className="profile-item">
                <label>Фамилия:</label>
                <div className="profile-value">{userInfo.lastName}</div>
              </div>
            )}
            
            {userInfo.username && (
              <div className="profile-item">
                <label>Username:</label>
                <div className="profile-value">@{userInfo.username}</div>
              </div>
            )}
            
            {userInfo.phone && (
              <div className="profile-item">
                <label>Телефон:</label>
                <div className="profile-value">{userInfo.phone}</div>
              </div>
            )}
          </div>

          <div className="form-actions" style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleLogout}
              disabled={loading}
            >
              {loading ? 'Разрыв...' : 'Разорвать авторизацию'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Шаг 3: Отображение QR-кода
  return (
    <div className="telegram-auth">
      <div className="card">
        <h2>Сканируйте QR-код</h2>
        <p>Откройте Telegram на телефоне → Настройки → Устройства → Сканировать QR-код</p>
        
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
        
        {qrStatus === 'waiting' && (
          <div className="alert alert-info">
            📱 Отсканируйте QR-код в приложении Telegram, затем нажмите "Проверить авторизацию"
          </div>
        )}

        <div style={{ 
          textAlign: 'center', 
          margin: '20px 0',
          padding: '20px',
          backgroundColor: '#f5f5f5',
          borderRadius: '8px'
        }}>
          <SafeQRCode value={qrCode} />
        </div>

        <div className="form-actions" style={{ marginTop: '20px' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              console.log('Button clicked, sessionKey:', sessionKey, 'loading:', loading)
              if (!sessionKey) {
                setError('Session key not found. Please request QR code again.')
                return
              }
              handleCheckAuth()
            }}
            disabled={loading || !sessionKey}
          >
            {loading ? 'Проверка...' : 'Проверить авторизацию'}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current)
                pollingIntervalRef.current = null
              }
              setStep('profile')
              setError(null)
              setSuccess(null)
              setQrCode(null)
              setSessionKey(null)
              setQrStatus('waiting')
            }}
            disabled={loading}
          >
            Назад
          </button>
        </div>

        {qrStatus === 'expired' && (
          <div className="alert alert-error">
            ⚠️ QR-код истек. Запросите новый.
          </div>
        )}

        <div className="form-actions">
          <button
            type="button"
            className="btn"
            onClick={() => {
              setStep('profile')
              setError(null)
              setQrCode(null)
              setSessionKey(null)
              setQrStatus('waiting')
              
              // Stop polling
              if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current)
                pollingIntervalRef.current = null
              }
            }}
            disabled={loading}
          >
            Назад
          </button>
          {qrStatus === 'expired' && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleRequestQR}
              disabled={loading}
            >
              {loading ? 'Загрузка...' : 'Запросить новый QR-код'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default TelegramAuth
