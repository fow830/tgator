import { useState, useEffect } from 'react'
import { chatsApi } from '../services/api'
import './ChatList.css'

function ChatList() {
  const [chats, setChats] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [formData, setFormData] = useState({
    chatId: '',
    name: '',
    inviteLink: '',
  })

  useEffect(() => {
    loadChats()
  }, [])

  const loadChats = async () => {
    try {
      setLoading(true)
      const response = await chatsApi.getAll()
      setChats(response.data)
    } catch (err) {
      setError('Failed to load chats')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const data = formData.inviteLink 
        ? { inviteLink: formData.inviteLink, name: formData.name }
        : { chatId: formData.chatId, name: formData.name }

      await chatsApi.create(data)
      setSuccess('Chat added successfully!')
      setFormData({ chatId: '', name: '', inviteLink: '' })
      loadChats()
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.details || 'Failed to add chat')
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to remove this chat? You will be automatically removed from the chat.')) {
      return
    }

    try {
      await chatsApi.delete(id)
      setSuccess('Chat removed successfully!')
      loadChats()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove chat')
      console.error(err)
    }
  }

  if (loading) {
    return <div className="loading">Loading chats...</div>
  }

  return (
    <div className="chat-list">
      <div className="card">
        <h2>Add Chat</h2>
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Chat Username (for public chats)</label>
            <input
              type="text"
              placeholder="@channelname or channelname"
              value={formData.chatId}
              onChange={(e) => setFormData({ ...formData, chatId: e.target.value, inviteLink: '' })}
              disabled={submitting || !!formData.inviteLink}
            />
          </div>
          <div className="form-group">
            <label>OR Invite Link (for private chats)</label>
            <input
              type="text"
              placeholder="https://t.me/joinchat/..."
              value={formData.inviteLink}
              onChange={(e) => setFormData({ ...formData, inviteLink: e.target.value, chatId: '' })}
              disabled={submitting || !!formData.chatId}
            />
          </div>
          <div className="form-group">
            <label>Display Name (optional)</label>
            <input
              type="text"
              placeholder="Custom name for the chat"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={submitting}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting || (!formData.chatId && !formData.inviteLink)}>
            {submitting ? 'Adding...' : 'Add Chat'}
          </button>
        </form>
      </div>

      <div className="card">
        <h2>Monitored Chats</h2>
        {chats.length === 0 ? (
          <div className="empty-state">No chats added yet</div>
        ) : (
          <ul className="list">
            {chats.map((chat) => {
              const chatTypeLabels = {
                'group': 'Группа',
                'supergroup': 'Супергруппа',
                'channel': 'Канал',
              };
              const chatTypeLabel = chat.chatType ? chatTypeLabels[chat.chatType] || chat.chatType : 'Неизвестно';
              const joinDate = chat.joinDate ? new Date(chat.joinDate).toLocaleString('ru-RU', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              }) : null;
              
              return (
                <li key={chat.id} className="list-item">
                  <div className="list-item-content">
                    <strong>{chat.name || chat.chatId}</strong>
                    <div style={{ fontSize: '12px', color: '#999', marginTop: '5px' }}>
                      ID: {chat.chatId}
                      {chat.chatType && (
                        <> • Тип: <span style={{ color: '#666' }}>{chatTypeLabel}</span></>
                      )}
                      {joinDate && (
                        <> • Вступление: <span style={{ color: '#666' }}>{joinDate}</span></>
                      )}
                    </div>
                  </div>
                  <div className="list-item-actions">
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDelete(chat.id)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

export default ChatList

