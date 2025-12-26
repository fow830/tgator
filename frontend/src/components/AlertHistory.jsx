import { useState, useEffect } from 'react'
import { alertsApi } from '../services/api'

function AlertHistory() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [alertChannelId, setAlertChannelId] = useState('')
  const [savingChannel, setSavingChannel] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    // Only load if admin is logged in
    const adminToken = localStorage.getItem('adminToken')
    if (adminToken) {
      loadAlerts()
      loadAlertChannel()
      
      // Auto-refresh alerts every 5 seconds
      const interval = setInterval(() => {
        const currentToken = localStorage.getItem('adminToken')
        if (currentToken) {
          loadAlerts()
        }
      }, 5000)
      
      return () => clearInterval(interval)
    }
  }, [])
  
  const loadAlertChannel = async () => {
    // Check if admin is logged in first
    const adminToken = localStorage.getItem('adminToken')
    if (!adminToken) {
      return // Don't load if admin is not logged in
    }

    try {
      const response = await fetch('/api/config/alert-channel', {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        setAlertChannelId(data.alertChannelId || '')
      } else if (response.status === 401) {
        // Not authorized - this is normal, just ignore silently
        return
      }
    } catch (err) {
      // Silently ignore errors - user might not be authorized yet
      console.debug('Load alert channel:', err.message)
    }
  }
  
  const handleSaveAlertChannel = async (e) => {
    e.preventDefault()
    
    const adminToken = localStorage.getItem('adminToken')
    if (!adminToken) {
      setError('Необходима авторизация')
      return
    }
    
    setSavingChannel(true)
    setError(null)
    setSuccess(null)
    
    try {
      const response = await fetch('/api/config/save-alert-channel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          alertChannelId: alertChannelId.trim(),
        }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save alert channel')
      }
      
      setSuccess('✅ Канал алертов сохранен!')
      setTimeout(() => {
        setSuccess(null)
      }, 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingChannel(false)
    }
  }
  
  const handleLeaveAlertChannel = async () => {
    if (!confirm('Вы уверены, что хотите выйти из канала алертов? Настройка канала будет очищена.')) {
      return
    }
    
    const adminToken = localStorage.getItem('adminToken')
    if (!adminToken) {
      setError('Необходима авторизация')
      return
    }
    
    setSavingChannel(true)
    setError(null)
    setSuccess(null)
    
    try {
      const response = await fetch('/api/config/leave-alert-channel', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
        },
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to leave alert channel')
      }
      
      // Clear channel ID from UI
      setAlertChannelId('')
      
      setSuccess('✅ Вы вышли из канала алертов. Настройка канала очищена.')
      setTimeout(() => {
        setSuccess(null)
      }, 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingChannel(false)
    }
  }

  const loadAlerts = async () => {
    try {
      setLoading(true)
      const response = await alertsApi.getAll({ limit: 100 })
      setAlerts(response.data.alerts || [])
      setTotal(response.data.total || 0)
    } catch (err) {
      console.error('Failed to load alerts:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleString()
  }

  if (loading) {
    return <div className="loading">Loading alerts...</div>
  }

  return (
    <div>
      {/* Настройка канала алертов */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <h2>Настройка канала алертов</h2>
        <p style={{ color: '#666', fontSize: '14px', marginBottom: '15px' }}>
          Укажите канал или чат, куда будут отправляться алерты при обнаружении ключевых слов.
          Можно указать username (например, @my_channel) или ID канала.
        </p>
        
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
        
        <form onSubmit={handleSaveAlertChannel}>
          <div className="form-group">
            <label>Канал для алертов:</label>
            <input
              type="text"
              value={alertChannelId}
              onChange={(e) => setAlertChannelId(e.target.value)}
              placeholder="@my_channel или ID канала"
              disabled={savingChannel}
              style={{ width: '100%' }}
            />
          </div>
          
          <button
            type="submit"
            className="btn btn-primary"
            disabled={savingChannel}
            style={{ marginTop: '10px' }}
          >
            {savingChannel ? 'Сохранение...' : 'Сохранить канал'}
          </button>
        </form>
        
        {alertChannelId && alertChannelId !== '@your_channel' && (
          <div style={{ marginTop: '15px' }}>
            <div style={{ padding: '10px', backgroundColor: '#e8f5e9', borderRadius: '4px', marginBottom: '10px' }}>
              <strong>Текущий канал:</strong> {alertChannelId}
            </div>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleLeaveAlertChannel}
              disabled={savingChannel}
            >
              {savingChannel ? 'Выход...' : 'Выйти из канала'}
            </button>
          </div>
        )}
        
        {(!alertChannelId || alertChannelId === '@your_channel') && (
          <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
            ⚠️ Канал алертов не настроен. Алерты не будут отправляться в канал, но будут сохраняться в базу данных.
          </div>
        )}
      </div>

      {/* История алертов */}
      <div className="card">
        <h2>История алертов ({total})</h2>
        {alerts.length === 0 ? (
          <div className="empty-state">Пока нет алертов</div>
        ) : (
          <ul className="list">
            {alerts.map((alert) => (
              <li key={alert.id} className="list-item">
                <div className="list-item-content">
                  <div style={{ marginBottom: '5px' }}>
                    <strong>Чат:</strong> {alert.chat?.name || alert.chatId} | 
                    <strong> Ключевое слово:</strong> {alert.keyword}
                  </div>
                  <div style={{ marginBottom: '5px', color: '#666' }}>
                    {alert.message}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999' }}>
                    {formatDate(alert.createdAt)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default AlertHistory

