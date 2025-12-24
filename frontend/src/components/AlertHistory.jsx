import { useState, useEffect } from 'react'
import { alertsApi } from '../services/api'

function AlertHistory() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    loadAlerts()
  }, [])

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
    <div className="card">
      <h2>Alert History ({total})</h2>
      {alerts.length === 0 ? (
        <div className="empty-state">No alerts yet</div>
      ) : (
        <ul className="list">
          {alerts.map((alert) => (
            <li key={alert.id} className="list-item">
              <div className="list-item-content">
                <div style={{ marginBottom: '5px' }}>
                  <strong>Chat:</strong> {alert.chat?.name || alert.chatId} | 
                  <strong> Keyword:</strong> {alert.keyword}
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
  )
}

export default AlertHistory

