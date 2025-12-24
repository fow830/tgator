import { useState } from 'react'
import ChatList from './components/ChatList'
import KeywordList from './components/KeywordList'
import AlertHistory from './components/AlertHistory'
import TelegramAuth from './components/TelegramAuth'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('auth')

  return (
    <div className="app">
      <header className="app-header">
        <h1>Telegram Monitor Admin</h1>
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

