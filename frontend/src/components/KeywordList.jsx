import { useState, useEffect } from 'react'
import { keywordsApi } from '../services/api'

function KeywordList() {
  const [keywords, setKeywords] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [keyword, setKeyword] = useState('')

  useEffect(() => {
    loadKeywords()
  }, [])

  const loadKeywords = async () => {
    try {
      setLoading(true)
      const response = await keywordsApi.getAll()
      setKeywords(response.data)
    } catch (err) {
      setError('Failed to load keywords')
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
      await keywordsApi.create({ keyword })
      setSuccess('Keyword added successfully!')
      setKeyword('')
      loadKeywords()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add keyword')
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this keyword?')) {
      return
    }

    try {
      await keywordsApi.delete(id)
      setSuccess('Keyword deleted successfully!')
      loadKeywords()
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete keyword')
      console.error(err)
    }
  }

  if (loading) {
    return <div className="loading">Loading keywords...</div>
  }

  return (
    <div>
      <div className="card">
        <h2>Add Keyword</h2>
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Keyword</label>
            <input
              type="text"
              placeholder="Enter keyword to monitor"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              disabled={submitting}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting || !keyword.trim()}>
            {submitting ? 'Adding...' : 'Add Keyword'}
          </button>
        </form>
      </div>

      <div className="card">
        <h2>Monitored Keywords</h2>
        {keywords.length === 0 ? (
          <div className="empty-state">No keywords added yet</div>
        ) : (
          <ul className="list">
            {keywords.map((kw) => (
              <li key={kw.id} className="list-item">
                <div className="list-item-content">
                  <strong>{kw.keyword}</strong>
                </div>
                <div className="list-item-actions">
                  <button
                    className="btn btn-danger"
                    onClick={() => handleDelete(kw.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default KeywordList

