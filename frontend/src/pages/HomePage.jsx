import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
    fontFamily: 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif',
  },
  card: {
    background: 'white',
    borderRadius: '20px',
    padding: '40px',
    maxWidth: '440px',
    width: '100%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    textAlign: 'center',
  },
  title: {
    fontSize: '2.2rem',
    fontWeight: 'bold',
    color: '#4a154b',
    marginBottom: '8px',
  },
  subtitle: {
    color: '#888',
    marginBottom: '32px',
    fontSize: '1rem',
  },
  btn: {
    display: 'block',
    width: '100%',
    padding: '14px 24px',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    marginBottom: '12px',
    transition: 'transform 0.15s, box-shadow 0.15s',
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: 'white',
    boxShadow: '0 4px 15px rgba(102,126,234,0.4)',
  },
  btnSecondary: {
    background: '#f8f9fa',
    color: '#4a154b',
    border: '2px solid #764ba2',
  },
  divider: {
    margin: '20px 0',
    color: '#aaa',
    fontSize: '0.9rem',
  },
  input: {
    display: 'block',
    width: '100%',
    padding: '12px 16px',
    fontSize: '1.2rem',
    border: '2px solid #e0e0e0',
    borderRadius: '10px',
    marginBottom: '12px',
    textAlign: 'center',
    letterSpacing: '4px',
    fontWeight: 'bold',
    outline: 'none',
    direction: 'ltr',
  },
  error: {
    color: '#e53935',
    marginBottom: '12px',
    fontSize: '0.95rem',
  },
  adminLink: {
    marginTop: '24px',
    color: '#aaa',
    fontSize: '0.8rem',
    cursor: 'pointer',
    textDecoration: 'underline',
  },
  emoji: {
    fontSize: '3rem',
    marginBottom: '12px',
  }
}

export default function HomePage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState(null) // 'create' | 'join'
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await axios.post('/api/rooms')
      const { code, playerId, characters, secretCharacter } = res.data
      sessionStorage.setItem('playerId', playerId)
      sessionStorage.setItem('playerNum', '1')
      sessionStorage.setItem('characters', JSON.stringify(characters))
      sessionStorage.setItem('secretCharacter', JSON.stringify(secretCharacter))
      navigate(`/room/${code}`)
    } catch (err) {
      setError(err.response?.data?.error || 'שגיאה ביצירת חדר')
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async () => {
    if (joinCode.length !== 4) {
      setError('הכנס קוד בן 4 ספרות')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await axios.post('/api/rooms/join', { code: joinCode })
      const { code, playerId, characters, secretCharacter } = res.data
      sessionStorage.setItem('playerId', playerId)
      sessionStorage.setItem('playerNum', '2')
      sessionStorage.setItem('characters', JSON.stringify(characters))
      sessionStorage.setItem('secretCharacter', JSON.stringify(secretCharacter))
      navigate(`/room/${code}`)
    } catch (err) {
      setError(err.response?.data?.error || 'שגיאה בהצטרפות לחדר')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.emoji}>👨‍👩‍👧‍👦</div>
        <div style={styles.title}>Family Guess Who</div>
        <div style={styles.subtitle}>משחק נחש מי משפחתי</div>

        {!mode && (
          <>
            <button
              style={{ ...styles.btn, ...styles.btnPrimary }}
              onClick={handleCreate}
              disabled={loading}
              onMouseOver={e => e.target.style.transform = 'translateY(-2px)'}
              onMouseOut={e => e.target.style.transform = 'translateY(0)'}
            >
              {loading ? '...' : '🏠 צור חדר חדש'}
            </button>
            <div style={styles.divider}>— או —</div>
            <button
              style={{ ...styles.btn, ...styles.btnSecondary }}
              onClick={() => setMode('join')}
              onMouseOver={e => e.target.style.transform = 'translateY(-2px)'}
              onMouseOut={e => e.target.style.transform = 'translateY(0)'}
            >
              🔑 הצטרף עם קוד
            </button>
          </>
        )}

        {mode === 'join' && (
          <>
            <input
              style={styles.input}
              type="text"
              inputMode="numeric"
              maxLength={4}
              placeholder="0000"
              value={joinCode}
              onChange={e => {
                setJoinCode(e.target.value.replace(/\D/g, ''))
                setError('')
              }}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              autoFocus
            />
            {error && <div style={styles.error}>{error}</div>}
            <button
              style={{ ...styles.btn, ...styles.btnPrimary }}
              onClick={handleJoin}
              disabled={loading}
            >
              {loading ? 'מצטרף...' : '🚀 הצטרף למשחק'}
            </button>
            <button
              style={{ ...styles.btn, ...styles.btnSecondary, marginTop: '4px' }}
              onClick={() => { setMode(null); setError('') }}
            >
              ← חזור
            </button>
          </>
        )}

        {error && !mode && <div style={styles.error}>{error}</div>}

        <div style={styles.adminLink} onClick={() => navigate('/admin')}>
          כניסת מנהל
        </div>
      </div>
    </div>
  )
}
