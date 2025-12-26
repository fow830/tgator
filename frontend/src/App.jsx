import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ChatList from './components/ChatList'
import KeywordList from './components/KeywordList'
import AlertHistory from './components/AlertHistory'
import TelegramAuth from './components/TelegramAuth'
import './App.css'

function App() {
  const navigate = useNavigate()
  
  // Load active tab from localStorage or default to 'auth'
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('activeTab') || 'auth'
  })
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)

  // Check authentication on mount
  useEffect(() => {
    const token = localStorage.getItem('adminToken')
    if (token) {
      fetch('/api/admin-auth/check', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
        .then(res => res.json())
        .then(data => {
          if (data.authenticated) {
            setIsAuthenticated(true)
          } else {
            navigate('/login')
          }
          setCheckingAuth(false)
        })
        .catch(() => {
          setIsAuthenticated(false)
          setCheckingAuth(false)
          localStorage.removeItem('adminToken')
          localStorage.removeItem('adminUsername')
          navigate('/login')
        })
    } else {
      setIsAuthenticated(false)
      setCheckingAuth(false)
      navigate('/login')
    }
  }, [navigate])

  // Save active tab to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab)
  }, [activeTab])

  const handleLogout = async () => {
    try {
      await fetch('/api/admin-auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        },
      })
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      localStorage.removeItem('adminToken')
      localStorage.removeItem('adminUsername')
      navigate('/login')
    }
  }

  // Show loading while checking auth
  if (checkingAuth) {
    return <div className="loading">Проверка авторизации...</div>
  }

  // Don't render if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Telegram Monitor Admin</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <nav className="tabs">
            <button
              className={activeTab === 'auth' ? 'active' : ''}
              onClick={() => setActiveTab('auth')}
            >
              Telegram Auth
            </button>
            <button
              className={activeTab === 'chats' ? 'active' : ''}
              onClick={() => setActiveTab('chats')}
            >
              Chats
            </button>
            <button
              className={activeTab === 'keywords' ? 'active' : ''}
              onClick={() => setActiveTab('keywords')}
            >
              Keywords
            </button>
            <button
              className={activeTab === 'alerts' ? 'active' : ''}
              onClick={() => setActiveTab('alerts')}
            >
              Alerts
            </button>
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: '#666', fontSize: '14px' }}>
              {localStorage.getItem('adminUsername') || 'Admin'}
            </span>
            <button
              className="btn btn-danger"
              onClick={handleLogout}
              style={{ padding: '8px 16px', fontSize: '14px' }}
            >
              Выход
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="container">
          {activeTab === 'auth' && <TelegramAuth />}
          {activeTab === 'chats' && <ChatList />}
          {activeTab === 'keywords' && <KeywordList />}
          {activeTab === 'alerts' && <AlertHistory />}
        </div>
      </main>
    </div>
  )
}

export default App

