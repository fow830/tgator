import { useState, useEffect } from 'react'
import './TelegramAuth.css'

function TelegramAuth() {
  const [step, setStep] = useState('credentials') // 'credentials' | 'profile' | 'code'
  const [phone, setPhone] = useState('')
  const [apiId, setApiId] = useState('')
  const [apiHash, setApiHash] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [phoneCodeHash, setPhoneCodeHash] = useState(null)
  const [credentialsSaved, setCredentialsSaved] = useState(false)

  // Load saved credentials on mount
  useEffect(() => {
    loadCredentials()
  }, [])

  const loadCredentials = async () => {
    try {
      const response = await fetch('/api/config/credentials')
      const data = await response.json()
      
      if (data.saved) {
        setPhone(data.phone || '')
        setApiId(data.apiId || '')
        setApiHash(data.apiHash || '')
        setCredentialsSaved(true)
        setStep('profile') // Переходим на страницу профиля если данные сохранены
      }
    } catch (err) {
      console.error('Failed to load credentials:', err)
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
      
      // Переходим на страницу профиля после сохранения
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

  const handleSendCode = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/auth/web-send-code', {
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
        throw new Error(data.error || 'Failed to send code')
      }

      setPhoneCodeHash(data.phoneCodeHash)
      setStep('code')
      setSuccess('Код отправлен! Проверьте Telegram.')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/auth/web-verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone,
          apiId: parseInt(apiId),
          apiHash,
          code,
          phoneCodeHash,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify code')
      }

      setSuccess('✅ Авторизация успешна! Система готова к работе.')
      setTimeout(() => {
        window.location.reload()
      }, 2000)
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
              onClick={handleSendCode}
              disabled={loading}
            >
              {loading ? 'Отправка...' : 'Отправить код авторизации'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Шаг 3: Ввод кода
  return (
    <div className="telegram-auth">
      <div className="card">
        <h2>Введите код из Telegram</h2>
        <p>Код отправлен на {phone}</p>
        
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleVerifyCode}>
          <div className="form-group">
            <label>Код из Telegram</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="12345"
              required
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn"
              onClick={() => {
                setStep('profile')
                setCode('')
                setError(null)
              }}
              disabled={loading}
            >
              Назад
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Авторизация...' : 'Авторизоваться'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default TelegramAuth
