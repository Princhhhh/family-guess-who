import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_BACKEND_URL || ''

export default function AdminPanel() {
  const navigate = useNavigate()
  const password = sessionStorage.getItem('adminPassword')
  const [characters, setCharacters] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [name, setName] = useState('')
  const [preview, setPreview] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    if (!password) {
      navigate('/admin')
      return
    }
    fetchCharacters()
  }, [])

  const authHeaders = { 'x-admin-password': password }

  const fetchCharacters = async () => {
    setLoading(true)
    try {
      const res = await axios.get('/api/admin/characters', { headers: authHeaders })
      setCharacters(res.data)
    } catch (e) {
      if (e.response?.status === 401) navigate('/admin')
      setError('שגיאה בטעינת דמויות')
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreview(url)
  }

  const handleUpload = async () => {
    if (!name.trim()) { setError('הכנס שם לדמות'); return }
    if (!fileRef.current?.files[0]) { setError('בחר תמונה'); return }

    setUploading(true)
    setError('')
    setSuccess('')

    const formData = new FormData()
    formData.append('name', name.trim())
    formData.append('image', fileRef.current.files[0])

    try {
      await axios.post('/api/admin/characters', formData, {
        headers: { ...authHeaders, 'Content-Type': 'multipart/form-data' }
      })
      setSuccess(`הדמות "${name}" נוספה בהצלחה!`)
      setName('')
      setPreview(null)
      if (fileRef.current) fileRef.current.value = ''
      fetchCharacters()
    } catch (e) {
      setError(e.response?.data?.error || 'שגיאה בהעלאה')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (char) => {
    if (!window.confirm(`למחוק את "${char.name}"?`)) return
    try {
      await axios.delete(`/api/admin/characters/${char.id}`, { headers: authHeaders })
      setSuccess(`"${char.name}" נמחקה`)
      fetchCharacters()
    } catch {
      setError('שגיאה במחיקה')
    }
  }

  const imgSrc = (char) => {
    if (char.image_path.startsWith('http')) return char.image_path
    return `${API_BASE}${char.image_path}`
  }

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#4a154b' }}>🔧 פאנל מנהל</span>
          <span style={{
            background: characters.length >= 24 ? '#e8f5e9' : '#fff3e0',
            color: characters.length >= 24 ? '#2e7d32' : '#e65100',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '0.85rem',
            fontWeight: 'bold',
          }}>
            {characters.length} דמויות {characters.length < 24 ? `(נדרשות ${24 - characters.length} נוספות)` : '✓'}
          </span>
        </div>
        <button style={outlineBtnStyle} onClick={() => navigate('/')}>← דף הבית</button>
      </div>

      <div style={contentStyle}>
        {/* Upload section */}
        <div style={cardStyle}>
          <h2 style={sectionTitle}>הוסף דמות חדשה</h2>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{
              width: '120px',
              height: '120px',
              borderRadius: '12px',
              border: '2px dashed #764ba2',
              overflow: 'hidden',
              flexShrink: 0,
              cursor: 'pointer',
              background: '#fafafa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
              onClick={() => fileRef.current?.click()}
            >
              {preview
                ? <img src={preview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: '2.5rem' }}>📷</span>
              }
            </div>

            <div style={{ flex: 1, minWidth: '200px' }}>
              <input
                type="text"
                placeholder="שם הדמות"
                value={name}
                onChange={e => setName(e.target.value)}
                style={inputStyle}
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <button
                style={{ ...secondaryBtnStyle, marginBottom: '8px' }}
                onClick={() => fileRef.current?.click()}
              >
                📁 בחר תמונה
              </button>
              <button
                style={primaryBtnStyle}
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? 'מעלה...' : '✅ הוסף דמות'}
              </button>
            </div>
          </div>

          {error && <div style={errorStyle}>{error}</div>}
          {success && <div style={successStyle}>{success}</div>}
        </div>

        {/* Characters grid */}
        <div style={cardStyle}>
          <h2 style={sectionTitle}>דמויות קיימות ({characters.length})</h2>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>טוען...</div>
          ) : characters.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
              <div style={{ fontSize: '3rem', marginBottom: '8px' }}>🎭</div>
              <div>עדיין אין דמויות. הוסף לפחות 24 דמויות כדי לאפשר משחק.</div>
            </div>
          ) : (
            <div style={gridStyle}>
              {characters.map(char => (
                <div key={char.id} style={charCardStyle}>
                  <img
                    src={imgSrc(char)}
                    alt={char.name}
                    style={charImgStyle}
                    onError={e => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23ddd" width="100" height="100"/></svg>' }}
                  />
                  <div style={charNameStyle}>{char.name}</div>
                  <button
                    style={deleteBtnStyle}
                    onClick={() => handleDelete(char)}
                  >
                    🗑️ מחק
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const pageStyle = {
  minHeight: '100vh',
  background: '#f5f5f5',
  direction: 'rtl',
}

const headerStyle = {
  background: 'white',
  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  padding: '14px 24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: '8px',
  position: 'sticky',
  top: 0,
  zIndex: 10,
}

const contentStyle = {
  maxWidth: '1000px',
  margin: '0 auto',
  padding: '20px',
}

const cardStyle = {
  background: 'white',
  borderRadius: '16px',
  padding: '24px',
  marginBottom: '20px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
}

const sectionTitle = {
  fontSize: '1.2rem',
  fontWeight: 'bold',
  color: '#4a154b',
  marginBottom: '20px',
}

const inputStyle = {
  display: 'block',
  width: '100%',
  padding: '10px 14px',
  fontSize: '1rem',
  border: '2px solid #e0e0e0',
  borderRadius: '8px',
  marginBottom: '10px',
  outline: 'none',
  direction: 'rtl',
}

const primaryBtnStyle = {
  display: 'block',
  width: '100%',
  padding: '10px',
  background: 'linear-gradient(135deg, #667eea, #764ba2)',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  fontSize: '0.95rem',
  fontWeight: 'bold',
  cursor: 'pointer',
}

const secondaryBtnStyle = {
  display: 'block',
  width: '100%',
  padding: '10px',
  background: '#f3e5f5',
  color: '#4a154b',
  border: '1px solid #ce93d8',
  borderRadius: '8px',
  fontSize: '0.95rem',
  cursor: 'pointer',
}

const outlineBtnStyle = {
  padding: '8px 16px',
  background: 'white',
  color: '#4a154b',
  border: '2px solid #764ba2',
  borderRadius: '8px',
  fontSize: '0.9rem',
  cursor: 'pointer',
  fontWeight: 'bold',
}

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
  gap: '12px',
}

const charCardStyle = {
  borderRadius: '12px',
  overflow: 'hidden',
  border: '1px solid #eee',
  background: '#fafafa',
}

const charImgStyle = {
  width: '100%',
  aspectRatio: '1',
  objectFit: 'cover',
  display: 'block',
}

const charNameStyle = {
  textAlign: 'center',
  fontWeight: 'bold',
  padding: '6px 4px',
  fontSize: '0.85rem',
  color: '#333',
  borderTop: '1px solid #eee',
}

const deleteBtnStyle = {
  display: 'block',
  width: '100%',
  padding: '6px',
  background: '#ffebee',
  color: '#c62828',
  border: 'none',
  borderTop: '1px solid #ffcdd2',
  cursor: 'pointer',
  fontSize: '0.8rem',
  fontWeight: 'bold',
}

const errorStyle = {
  color: '#c62828',
  background: '#ffebee',
  borderRadius: '8px',
  padding: '10px 14px',
  marginTop: '12px',
}

const successStyle = {
  color: '#2e7d32',
  background: '#e8f5e9',
  borderRadius: '8px',
  padding: '10px 14px',
  marginTop: '12px',
}
